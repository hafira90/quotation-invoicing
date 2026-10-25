import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Better Auth catch-all handler with the guards the app owns:
 *
 * 1. Public sign-up is rejected. Accounts are created by an administrator or
 *    by scripts/bootstrap-admin.ts — there is no self-registration path.
 * 2. Database-backed rate limiting on sign-in and password reset, which
 *    survives serverless isolate recycling (unlike in-memory counters).
 */
function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return ip;
}

async function guard(req: NextRequest): Promise<NextResponse | null> {
  const path = new URL(req.url).pathname;

  if (path.endsWith("/sign-up/email")) {
    return NextResponse.json(
      {
        error: true,
        code: "SIGNUP_DISABLED",
        message:
          "Self-registration is disabled. An administrator must create your account.",
      },
      { status: 403 }
    );
  }

  const checks: Array<{ match: string; bucket: string; rule: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS] }> = [
    { match: "/sign-in/email", bucket: "login", rule: RATE_LIMITS.login },
    {
      match: "/request-password-reset",
      bucket: "reset",
      rule: RATE_LIMITS.passwordReset,
    },
  ];

  for (const check of checks) {
    if (!path.endsWith(check.match)) continue;
    const result = await consumeRateLimit(
      `${check.bucket}:${clientKey(req)}`,
      check.rule
    );
    if (!result.allowed) {
      return NextResponse.json(
        {
          error: true,
          code: "RATE_LIMITED",
          message: `Too many attempts. Try again in ${result.retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(result.retryAfterSeconds) },
        }
      );
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  return auth.handler(req);
}

export async function POST(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  return auth.handler(req);
}
