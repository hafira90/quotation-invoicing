import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Database-backed fixed-window rate limiter.
 *
 * Serverless isolates do not share memory, so an in-process counter cannot
 * stop a distributed login attempt. This writes the counter to Postgres and
 * evaluates it atomically in a single statement.
 */
export interface RateLimitRule {
  /** Number of attempts allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** How long to block once the limit is exceeded (0 = block for the window). */
  blockSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the block lifts, when blocked. */
  retryAfterSeconds: number;
}

/** Presets for the sensitive endpoints. */
export const RATE_LIMITS = {
  login: { limit: 10, windowSeconds: 300, blockSeconds: 900 },
  passwordReset: { limit: 5, windowSeconds: 900, blockSeconds: 900 },
  register: { limit: 3, windowSeconds: 3600, blockSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export async function consumeRateLimit(
  bucket: string,
  rule: RateLimitRule
): Promise<RateLimitResult> {
  const rows = await db.execute<{
    count: number;
    blocked_until: Date | null;
  }>(sql`
    insert into rate_limits (key, window_started_at, count, updated_at)
    values (${bucket}, now(), 1, now())
    on conflict (key) do update set
      count = case
        when rate_limits.window_started_at < now() - make_interval(secs => ${rule.windowSeconds})
          then 1
        else rate_limits.count + 1
      end,
      window_started_at = case
        when rate_limits.window_started_at < now() - make_interval(secs => ${rule.windowSeconds})
          then now()
        else rate_limits.window_started_at
      end,
      updated_at = now()
    returning count, blocked_until
  `);

  const row = rows.rows[0];
  const count = Number(row?.count ?? 0);
  const blockedUntil = row?.blocked_until ? new Date(row.blocked_until) : null;
  const now = new Date();

  if (blockedUntil && blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000),
    };
  }

  if (count > rule.limit) {
    const blockSeconds = rule.blockSeconds || rule.windowSeconds;
    await db.execute(sql`
      update rate_limits
      set blocked_until = now() + make_interval(secs => ${blockSeconds}),
          updated_at = now()
      where key = ${bucket}
    `);
    return { allowed: false, remaining: 0, retryAfterSeconds: blockSeconds };
  }

  return {
    allowed: true,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: 0,
  };
}

/** Clear a bucket — used after a successful login so a user is not punished. */
export async function resetRateLimit(bucket: string): Promise<void> {
  await db.execute(sql`delete from rate_limits where key = ${bucket}`);
}
