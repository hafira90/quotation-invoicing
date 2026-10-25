/**
 * E2E helpers.
 *
 * The test account is created here with a password generated at runtime, so
 * no credential is ever committed to the repository or printed to the
 * transcript. `SMOKE_EMAIL` (default smoke@example.com) is reused so the
 * suite does not litter the user table.
 */
import "../../scripts/load-env";

import { randomUUID } from "crypto";

import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { db } from "../../src/db";
import { accounts, users, userRoles } from "../../src/db/schema";

export const TEST_EMAIL = process.env.E2E_EMAIL ?? "smoke@example.com";

/**
 * Runs once per test process: the user is created/reset a single time and the
 * shared pool stays open for the lifetime of the worker.
 */
let userPromise: Promise<{ email: string; password: string }> | null = null;

export function ensureTestUser(): Promise<{ email: string; password: string }> {
  if (!userPromise) userPromise = createUser();
  return userPromise;
}

async function createUser(): Promise<{ email: string; password: string }> {
  const password = `E2e-${randomUUID().replace(/-/g, "").slice(0, 16)}!aA`;

  const existing = (
    await db.select().from(users).where(eq(users.email, TEST_EMAIL))
  )[0];

  const hash = await hashPassword(password);

  if (existing) {
    await db
      .update(users)
      .set({
        status: "active",
        lockedUntil: null,
        failedLoginAttempts: 0,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    await db
      .update(accounts)
      .set({ password: hash })
      .where(eq(accounts.userId, existing.id));
    return { email: TEST_EMAIL, password };
  }

  const id = randomUUID();
  await db.insert(users).values({
    id,
    name: "E2E Tester",
    email: TEST_EMAIL,
    emailVerified: true,
    status: "active",
    mustChangePassword: false,
  });
  await db.insert(accounts).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: hash,
  });
  await db.insert(userRoles).values({ userId: id, roleId: "super_admin" });

  return { email: TEST_EMAIL, password };
}

export function uniqueCustomerName(): string {
  // Random per call: never collides with a record left by an earlier run.
  return `E2E Test Customer ${randomUUID().slice(0, 8)}`;
}
