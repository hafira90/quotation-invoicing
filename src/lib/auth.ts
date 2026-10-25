import { nextCookies } from "better-auth/next-js";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import * as schema from "@/db/schema";
import {
  accounts,
  sessions,
  twoFactors,
  users,
  verifications,
} from "@/db/schema";
import { db } from "@/db";

/**
 * Better Auth instance.
 *
 * Decisions worth knowing:
 * - Passwords use Better Auth's built-in scrypt (N=16384, r=16, p=1,
 *   dkLen=64, 16-byte random salt, NFKC normalised), which satisfies the
 *   requirement for a modern, appropriately configured password hash.
 * - Credential verification is entirely handled by the library, so we do not
 *   bolt a second hasher onto it: a mismatch there is how hashes get lost.
 * - Built-in rate limiting is disabled; the app uses its own database-backed
 *   limiter (src/lib/rate-limit.ts) because in-memory counters are per-isolate
 *   on serverless and therefore useless against distributed brute force.
 * - Public sign-up is rejected at the route handler
 *   (src/app/api/auth/[...all]/route.ts); the first admin comes from
 *   scripts/bootstrap-admin.ts.
 * - Sessions live in Postgres (the `session` table) and travel in HttpOnly
 *   cookies with SameSite=Lax; Secure is added in production.
 */
export const auth = betterAuth({
  appName: "Quotation & Invoicing",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    // Better Auth resolves models by these exact keys; our exports are
    // pluralised (users, sessions, ...) so the mapping is explicit.
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
      twoFactor: twoFactors,
    },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 200,
    // Reset tokens are single-use and short-lived (handled by the library).
    resetPasswordTokenExpiresIn: 60 * 30,
    sendResetPasswordOnRequest: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // absolute lifetime: 7 days
    updateAge: 60 * 60 * 24, // sliding refresh once per day
    /**
     * Cookie cache is deliberately OFF. It would let a signed-out (revoked)
     * session keep authenticating from the cached cookie until it expired —
     * the smoke test proved that. For financial records every request
     * revalidates the token against the session table instead.
     */
    cookieCache: {
      enabled: false,
      maxAge: 60 * 5,
    },
  },

  user: {
    additionalFields: {
      status: { type: "string", defaultValue: "active", input: false },
      disabledAt: { type: "string", required: false, input: false },
      disabledReason: { type: "string", required: false, input: false },
      mustChangePassword: { type: "boolean", defaultValue: false, input: false },
      failedLoginAttempts: { type: "number", defaultValue: 0, input: false },
      lockedUntil: { type: "string", required: false, input: false },
      lastLoginAt: { type: "string", required: false, input: false },
      twoFactorEnabled: { type: "boolean", defaultValue: false, input: false },
    },
  },

  // Replaced by the database-backed limiter applied in the auth route handler.
  rateLimit: {
    enabled: false,
  },

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      sameSite: "lax",
      httpOnly: true,
    },
  },

  trustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  plugins: [nextCookies()],
});

export type Auth = typeof auth;
