import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Authentication tables.
 *
 * Table and column names are pinned to Better Auth's documented Drizzle
 * schema (`user`, `session`, `account`, `verification`) so the adapter matches
 * its expectations exactly. The UI refers to `user` as "Users".
 *
 * Application-specific hardening columns live on `user`: account status,
 * progressive lockout counters and the must-change-password flag.
 */
export const users = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    disabledReason: text("disabled_reason"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  },
  (t) => [
    uniqueIndex("user_email_uq").on(t.email),
    check("user_status_ck", sql`${t.status} in ('active', 'disabled')`),
    index("user_created_at_idx").on(t.createdAt),
  ]
);

export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("session_token_uq").on(t.token),
    index("session_user_id_idx").on(t.userId),
    index("session_expires_at_idx").on(t.expiresAt),
  ]
);

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    /** Credential password hash (scrypt encoded string). */
    password: text("password"),
    /** OAuth scopes granted, when a linked provider returns them. */
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("account_user_id_idx").on(t.userId),
    // One credential row per user for the email/password provider.
    uniqueIndex("account_credential_uq")
      .on(t.userId, t.providerId)
      .where(sql`${t.providerId} = 'credential'`),
  ]
);

/**
 * Used by Better Auth for email verification and password reset tokens.
 * `value` holds the token (or its hash), `identifier` the email address.
 * Tokens are single-use and expire at `expiresAt`.
 */
export const verifications = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
);

/** TOTP secrets and encrypted backup codes (Better Auth two-factor plugin). */
export const twoFactors = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("two_factor_user_uq").on(t.userId)]
);

/* ------------------------------------------------------------------ */
/* Role based access control                                           */
/* ------------------------------------------------------------------ */

export const roles = pgTable(
  "roles",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** System roles cannot be deleted. */
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("roles_key_uq").on(t.key)]
);

/**
 * Permission catalogue. `code` is the stable string checked by
 * `requirePermission()` on every server action, route handler and page.
 */
export const permissions = pgTable("permissions", {
  code: text("code").primaryKey(),
  category: text("category").notNull(),
  description: text("description").notNull(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionCode: text("permission_code")
      .notNull()
      .references(() => permissions.code, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionCode] }),
    index("role_permissions_permission_idx").on(t.permissionCode),
  ]
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    grantedBy: text("granted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    index("user_roles_role_idx").on(t.roleId),
  ]
);

/**
 * Database-backed fixed-window rate limiter. Needed on serverless where
 * in-process counters are per-isolate and unreliable.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
    blockedUntil: timestamp("blocked_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("rate_limits_blocked_until_idx").on(t.blockedUntil)]
);
