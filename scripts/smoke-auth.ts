/**
 * Auth smoke test against the running dev server.
 *
 *   npm run dev            (in one terminal)
 *   npx tsx scripts/smoke-auth.ts
 *
 * Creates (or reuses) a dedicated smoke user, logs in over real HTTP, and
 * checks the protected routes. Credentials are generated in-process and never
 * printed, so the transcript stays clean.
 */
import "./load-env";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL ?? "smoke@example.com";

type Check = { name: string; ok: boolean; detail?: string };
const results: Check[] = [];

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function parseSetCookies(res: Response): Map<string, string> {
  const jar = new Map<string, string>();
  const raw =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie") as string]
        : [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
  return jar;
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function ensureUser(): Promise<string> {
  const password = `Sm0ke-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}!`;
  const { db, pool } = await import("../src/db");
  const { hashPassword } = await import("better-auth/crypto");
  const { randomUUID } = await import("crypto");
  const schema = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");

  const existing = (
    await db.select().from(schema.users).where(eq(schema.users.email, EMAIL))
  )[0];

  const hash = await hashPassword(password);

  if (existing) {
    await db
      .update(schema.users)
      .set({ status: "active", lockedUntil: null, failedLoginAttempts: 0, updatedAt: new Date() })
      .where(eq(schema.users.id, existing.id));
    await db
      .update(schema.accounts)
      .set({ password: hash })
      .where(eq(schema.accounts.userId, existing.id));
    await pool.end();
    return password;
  }

  const id = randomUUID();
  await db.insert(schema.users).values({
    id,
    name: "Smoke Test",
    email: EMAIL,
    emailVerified: true,
    status: "active",
  });
  await db.insert(schema.accounts).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: hash,
  });
  await db.insert(schema.userRoles).values({ userId: id, roleId: "super_admin" });
  await pool.end();
  return password;
}

async function main() {
  /* 1. Signed-out access control ---------------------------------------- */
  const signedOut = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  record(
    "signed-out /dashboard redirects",
    signedOut.status >= 300 && signedOut.status < 400,
    `status ${signedOut.status} -> ${signedOut.headers.get("location") ?? ""}`
  );

  const signup = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email: "nobody@example.com", password: "abcdefgh1234" }),
  });
  record("public sign-up rejected", signup.status === 403, `status ${signup.status}`);

  /* 2. Login page + CSRF cookie ----------------------------------------- */
  const loginPage = await fetch(`${BASE}/login`);
  record("login page renders", loginPage.status === 200, `status ${loginPage.status}`);
  const jar = parseSetCookies(loginPage);

  /* 3. Real credential login -------------------------------------------- */
  const password = await ensureUser();
  const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE,
      ...(jar.size > 0 ? { Cookie: cookieHeader(jar) } : {}),
      ...(jar.get("better-auth.csrf_token")
        ? { "x-csrf-token": jar.get("better-auth.csrf_token") as string }
        : {}),
    },
    body: JSON.stringify({ email: EMAIL, password, callbackURL: "/dashboard" }),
  });

  if (signIn.status !== 200) {
    const body = await signIn.text();
    record("credential login", false, `status ${signIn.status} ${body.slice(0, 200)}`);
    return;
  }
  record("credential login", true, "200");

  for (const [k, v] of parseSetCookies(signIn)) jar.set(k, v);
  const authed = { Cookie: cookieHeader(jar) };

  /* 4. Protected routes with a valid session ---------------------------- */
  const dashboard = await fetch(`${BASE}/dashboard`, { headers: authed });
  const html = await dashboard.text();
  record("dashboard loads for signed-in user", dashboard.status === 200, `status ${dashboard.status}`);
  record(
    "dashboard shows real metrics",
    html.includes("Dashboard") && html.includes("Outstanding receivables"),
    html.includes("Outstanding receivables") ? "KPI present" : "KPI missing"
  );

  const passwordPage = await fetch(`${BASE}/account/password`, { headers: authed });
  record("account password page", passwordPage.status === 200, `status ${passwordPage.status}`);

  const root = await fetch(`${BASE}/`, { headers: authed, redirect: "manual" });
  record(
    "root redirects to dashboard",
    (root.status >= 300 && root.status < 400 && (root.headers.get("location") ?? "").includes("dashboard")) ||
      root.status === 200,
    `status ${root.status} -> ${root.headers.get("location") ?? ""}`
  );

  /* 4b. Customers module ------------------------------------------------- */
  const customersList = await fetch(`${BASE}/customers`, { headers: authed });
  const customersHtml = await customersList.text();
  record(
    "customers list renders",
    customersList.status === 200 && customersHtml.includes("New customer"),
    `status ${customersList.status}`
  );
  record(
    "customers list is empty-state friendly",
    customersHtml.includes("No customers yet") || customersHtml.includes("<table") || customersHtml.includes("table"),
    "empty state or table present"
  );

  const newCustomer = await fetch(`${BASE}/customers/new`, { headers: authed });
  const newCustomerHtml = await newCustomer.text();
  record(
    "new customer form renders",
    newCustomer.status === 200 && newCustomerHtml.includes("Company name") || newCustomerHtml.includes("Customer name"),
    `status ${newCustomer.status}`
  );

  const customerSearch = await fetch(`${BASE}/customers?q=zzzznotfound`, { headers: authed });
  const searchHtml = await customerSearch.text();
  record(
    "customer search returns a result page",
    customerSearch.status === 200 && searchHtml.includes("No customers match"),
    `status ${customerSearch.status}`
  );

  const signedOutCustomers = await fetch(`${BASE}/customers`, { redirect: "manual" });
  record(
    "signed-out /customers redirects",
    signedOutCustomers.status >= 300 && signedOutCustomers.status < 400,
    `status ${signedOutCustomers.status}`
  );

  /* 5. Session invalidation after sign-out ------------------------------- */
  const signOut = await fetch(`${BASE}/api/auth/sign-out`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE,
      Cookie: cookieHeader(jar),
      ...(jar.get("better-auth.csrf_token")
        ? { "x-csrf-token": jar.get("better-auth.csrf_token") as string }
        : {}),
    },
    body: "{}",
  });
  record("sign-out accepted", signOut.status === 200 || signOut.status === 204, `status ${signOut.status}`);

  const afterSignOut = await fetch(`${BASE}/dashboard`, { headers: authed, redirect: "manual" });
  record(
    "session invalidated after sign-out",
    afterSignOut.status >= 300 && afterSignOut.status < 400,
    `status ${afterSignOut.status}`
  );
}

main()
  .then(() => {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error("smoke test crashed:", err?.message ?? err);
    process.exit(1);
  });
