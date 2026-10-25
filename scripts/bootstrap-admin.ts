/**
 * One-time, idempotent administrator bootstrap.
 *
 *   npm run bootstrap:admin
 *   ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD=... npm run bootstrap:admin
 *
 * Creates, only when missing:
 *   - the first company + business settings + payment methods + numbering
 *   - the permission catalogue and the five roles with their permissions
 *   - the first Super Admin account (email + password, email verified)
 *
 * There is no public registration page and no default password anywhere in
 * this repository. If ADMIN_PASSWORD is not supplied, a strong random one is
 * generated and printed to this terminal exactly once.
 *
 * Safe to re-run: it never overwrites an existing password or role assignment.
 */
import "./load-env";

import { randomBytes, randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { db, pool } from "../src/db";
import {
  accounts,
  businessSettings,
  companies,
  documentSequences,
  paymentMethods,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "../src/db/schema";
import { PERMISSION_LIST, ROLE_KEYS, ROLE_LABELS, ROLE_PERMISSIONS } from "../src/lib/permissions";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "admin@example.com").trim();
const ADMIN_NAME = process.env.ADMIN_NAME ?? "Super Admin";
const GENERATED_PASSWORD = !process.env.ADMIN_PASSWORD;

function generatePassword(): string {
  // 24 chars from a broad alphabet ≈ 140 bits of entropy.
  return randomBytes(18).toString("base64url");
}

async function main() {
  const year = String(new Date().getFullYear());

  /* 1. Company + settings ------------------------------------------------ */
  let company = (await db.select().from(companies).limit(1))[0];
  if (!company) {
    [company] = await db
      .insert(companies)
      .values({ legalName: process.env.COMPANY_NAME ?? "My Company Berhad" })
      .returning();
    console.log(`✓ company created: ${company!.legalName}`);
  } else {
    console.log(`• company already exists: ${company.legalName}`);
  }
  const companyId = company!.id;

  const existingSettings = (
    await db.select().from(businessSettings).where(eq(businessSettings.companyId, companyId))
  )[0];
  if (!existingSettings) {
    await db.insert(businessSettings).values({
      companyId,
      // Malaysian defaults from the specification; nothing tax-related is
      // assumed — SST stays unconfigured until an administrator sets it.
      defaultCurrency: "MYR",
      defaultLocale: "en-MY",
      defaultTimezone: "Asia/Kuala_Lumpur",
      defaultDocumentLanguage: "en",
      sstRegistered: false,
      taxTreatment: "exclusive",
      paperSize: "A4",
      paymentTermsDays: 30,
      quotationValidityDays: 14,
      invoiceDueDays: 30,
      emailSenderName: process.env.COMPANY_NAME ?? "My Company Berhad",
    });
    console.log("✓ business settings seeded (MYR, Asia/Kuala_Lumpur, A4)");
  }

  const existingMethods = await db
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .where(eq(paymentMethods.companyId, companyId));
  if (existingMethods.length === 0) {
    await db.insert(paymentMethods).values([
      { companyId, code: "cash", label: "Cash", sortOrder: 10 },
      { companyId, code: "bank_transfer", label: "Bank Transfer", sortOrder: 20 },
      { companyId, code: "duitnow_qr", label: "DuitNow QR", sortOrder: 30 },
      { companyId, code: "fpx", label: "FPX", sortOrder: 40 },
      { companyId, code: "card", label: "Card", sortOrder: 50 },
      { companyId, code: "cheque", label: "Cheque", sortOrder: 60 },
      { companyId, code: "other", label: "Other", sortOrder: 90 },
    ]);
    console.log("✓ payment methods seeded (incl. DuitNow QR, FPX)");
  }

  const existingSequences = await db
    .select({ id: documentSequences.nextValue })
    .from(documentSequences)
    .where(eq(documentSequences.companyId, companyId));
  if (existingSequences.length === 0) {
    await db.insert(documentSequences).values([
      { companyId, docType: "quotation", period: year, prefix: "QUO", separator: "-", padding: 5 },
      { companyId, docType: "invoice", period: year, prefix: "INV", separator: "-", padding: 5 },
      { companyId, docType: "receipt", period: year, prefix: "REC", separator: "-", padding: 5 },
      { companyId, docType: "credit_note", period: year, prefix: "CN", separator: "-", padding: 5 },
    ]);
    console.log(`✓ document sequences seeded for ${year} (QUO/INV/REC/CN)`);
  }

  /* 2. Permissions + roles ---------------------------------------------- */
  for (const p of PERMISSION_LIST) {
    await db
      .insert(permissions)
      .values({ code: p.code, category: p.category, description: p.description })
      .onConflictDoNothing({ target: permissions.code });
  }
  console.log(`✓ ${PERMISSION_LIST.length} permissions ensured`);

  for (const key of ROLE_KEYS) {
    await db
      .insert(roles)
      .values({ id: key, key, name: ROLE_LABELS[key], isSystem: true })
      .onConflictDoUpdate({ target: roles.key, set: { name: ROLE_LABELS[key] } });

    // System roles are re-synced from the code so permissions stay reviewable.
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, key));
    const codes = ROLE_PERMISSIONS[key];
    if (codes.length > 0) {
      await db.insert(rolePermissions).values(
        codes.map((code) => ({ roleId: key, permissionCode: code }))
      );
    }
  }
  console.log(`✓ ${ROLE_KEYS.length} roles synced with their permissions`);

  /* 3. First Super Admin ------------------------------------------------- */
  const existingAdmin = (
    await db.select().from(users).where(eq(users.email, ADMIN_EMAIL.toLowerCase()))
  )[0];

  let createdAdmin = false;
  if (!existingAdmin) {
    const password = process.env.ADMIN_PASSWORD ?? generatePassword();
    const userId = randomUUID();
    const passwordHash = await hashPassword(password);

    await db.insert(users).values({
      id: userId,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL.toLowerCase(),
      emailVerified: true,
      status: "active",
      mustChangePassword: GENERATED_PASSWORD ? false : false,
    });

    await db.insert(accounts).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });

    await db.insert(userRoles).values({ userId, roleId: "super_admin" });

    createdAdmin = true;
    console.log(`✓ Super Admin created: ${ADMIN_EMAIL.toLowerCase()}`);
    if (GENERATED_PASSWORD) {
      console.log("");
      console.log("  ┌──────────────────────────────────────────────────────┐");
      console.log("  │  Initial password (shown once — store it now):        │");
      console.log(`  │  ${password.padEnd(54)}│`);
      console.log("  └──────────────────────────────────────────────────────┘");
      console.log("");
    }
  } else {
    console.log(`• user already exists, password untouched: ${ADMIN_EMAIL}`);
  }

  const counts = {
    companies: (await db.select({ n: companies.id }).from(companies)).length,
    users: (await db.select({ n: users.id }).from(users)).length,
    roles: (await db.select({ n: roles.id }).from(roles)).length,
    permissions: (await db.select({ n: permissions.code }).from(permissions)).length,
  };
  console.log(
    `done — companies:${counts.companies} users:${counts.users} ` +
      `roles:${counts.roles} permissions:${counts.permissions}` +
      (createdAdmin ? " (admin created)" : "")
  );
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("bootstrap failed:", err?.message ?? err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
