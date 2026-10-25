"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { RATE_LIMITS, consumeRateLimit, resetRateLimit } from "@/lib/rate-limit";

export interface AuthActionState {
  ok: boolean;
  error?: string;
  /** Where the user should land after a successful login. */
  redirectTo?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normaliseEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Progressive account lockout.
 * Attempts 1-4 are free; from 5 the lock doubles, capped at 15 minutes.
 */
function lockDurationSeconds(attempts: number): number {
  if (attempts < 5) return 0;
  return Math.min(2 ** (attempts - 5) * 60, 900);
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = normaliseEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!EMAIL_RE.test(email) || password.length === 0) {
    return { ok: false, error: "Enter a valid email address and password." };
  }

  const ipLimit = await consumeRateLimit(`login-ip:${await ipKey()}`, RATE_LIMITS.login);
  const acctLimit = await consumeRateLimit(`login-acct:${email}`, RATE_LIMITS.login);
  if (!ipLimit.allowed || !acctLimit.allowed) {
    const wait = Math.max(ipLimit.retryAfterSeconds, acctLimit.retryAfterSeconds);
    return {
      ok: false,
      error: `Too many sign-in attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`,
    };
  }

  const user = (
    await db.select().from(users).where(eq(users.email, email))
  )[0];

  if (user?.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const seconds = Math.ceil(
      (new Date(user.lockedUntil).getTime() - Date.now()) / 1000
    );
    await writeAudit({
      action: "auth.login_blocked",
      entityType: "user",
      entityId: user.id,
      actorLabel: email,
      after: { reason: "locked" },
    });
    return {
      ok: false,
      error: `Account temporarily locked. Try again in ${Math.ceil(seconds / 60)} minute(s).`,
    };
  }

  if (user?.status === "disabled") {
    await writeAudit({
      action: "auth.login_denied",
      entityType: "user",
      entityId: user.id,
      actorLabel: email,
      after: { reason: "account_disabled" },
    });
    // Do not disclose the account state to an unauthenticated visitor.
    return { ok: false, error: "Invalid email or password." };
  }

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
  } catch {
    const attempts = (user?.failedLoginAttempts ?? 0) + 1;
    const lockSeconds = lockDurationSeconds(attempts);

    if (user) {
      await db
        .update(users)
        .set({
          failedLoginAttempts: attempts,
          lockedUntil:
            lockSeconds > 0
              ? new Date(Date.now() + lockSeconds * 1000)
              : null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }

    await writeAudit({
      action: "auth.login_failed",
      entityType: "user",
      entityId: user?.id ?? null,
      actorLabel: email,
      after: { attempts, lockedForSeconds: lockSeconds },
    });

    return {
      ok: false,
      error:
        lockSeconds > 0
          ? `Invalid email or password. This account is now locked for ${Math.ceil(lockSeconds / 60)} minute(s).`
          : "Invalid email or password.",
    };
  }

  // Success: clear counters and audit.
  if (user) {
    await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  }
  await resetRateLimit(`login-acct:${email}`);
  await resetRateLimit(`login-ip:${await ipKey()}`);

  await writeAudit({
    action: "auth.login_success",
    entityType: "user",
    entityId: user?.id ?? null,
    actorUserId: user?.id ?? null,
    actorLabel: email,
  });

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const mustChange = Boolean(user?.mustChangePassword);

  // redirect() must not run inside a try/catch.
  redirect(mustChange ? "/account/password?required=1" : safeNext);
}

export async function logoutAction(): Promise<void> {
  const headerList = await headers();
  const session = await auth.api.getSession({ headers: headerList });
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("better-auth.session_token")?.value ?? null;

  try {
    await auth.api.signOut({ headers: headerList });
  } finally {
    if (session?.user) {
      await writeAudit({
        action: "auth.logout",
        entityType: "user",
        entityId: session.user.id,
        actorUserId: session.user.id,
        actorLabel: session.user.email,
      });
    }
    void sessionToken;
  }
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = normaliseEmail(formData.get("email"));
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const limit = await consumeRateLimit(
    `reset-ip:${await ipKey()}`,
    RATE_LIMITS.passwordReset
  );
  if (!limit.allowed) {
    return { ok: false, error: "Too many reset requests. Try again later." };
  }

  const origin = (await headers()).get("origin") ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

  // Always report success so the endpoint cannot be used to enumerate accounts.
  try {
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `${origin}/reset-password`,
      },
      headers: await headers(),
    });
  } catch (err) {
    console.error("[auth] password reset request failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  await writeAudit({
    action: "auth.password_reset_requested",
    entityType: "user",
    actorLabel: email,
  });

  return {
    ok: true,
    error: "If that address has an account, a reset link has been sent.",
  };
}

export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { ok: false, error: "This reset link is invalid or has expired." };
  if (password.length < 12) return { ok: false, error: "Password must be at least 12 characters." };
  if (password !== confirm) return { ok: false, error: "Passwords do not match." };

  try {
    await auth.api.resetPassword({
      body: { token, newPassword: password },
      headers: await headers(),
    });
  } catch {
    // Single-use, expiring token: any failure here means it is spent or stale.
    return {
      ok: false,
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }

  await writeAudit({ action: "auth.password_reset_completed", entityType: "user" });

  redirect("/login?reset=1");
}

/** Change password for the signed-in user (including forced first-login change). */
export async function changePasswordAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 12) return { ok: false, error: "Password must be at least 12 characters." };
  if (password !== confirm) return { ok: false, error: "Passwords do not match." };

  try {
    await auth.api.changePassword({
      body: { currentPassword: current, newPassword: password, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch {
    return { ok: false, error: "Current password is incorrect." };
  }

  const headerList = await headers();
  const session = await auth.api.getSession({ headers: headerList });
  if (session?.user) {
    await db
      .update(users)
      .set({ mustChangePassword: false, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));
    await writeAudit({
      action: "auth.password_changed",
      entityType: "user",
      entityId: session.user.id,
      actorUserId: session.user.id,
      actorLabel: session.user.email,
    });
  }

  return { ok: true, redirectTo: "/dashboard" };
}

async function ipKey(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      "unknown"
    );
  } catch {
    return "unknown";
  }
}
