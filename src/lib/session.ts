import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "./auth";
import { db } from "@/db";
import { companies, rolePermissions, roles, userRoles } from "@/db/schema";
import { hasPermission, type PermissionCode } from "./permissions";

/**
 * Server-side session and authorisation guards.
 *
 * Every page, Server Action, Route Handler and download endpoint calls these.
 * Hiding a button in the UI is never the security boundary — this is.
 */

export class ForbiddenError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`Missing permission: ${code}`);
    this.name = "ForbiddenError";
    this.code = code;
  }
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  status: "active" | "disabled";
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  roleKeys: string[];
  permissions: string[];
  companyId: string;
}

/**
 * Resolves the current user plus their effective permission set.
 * Cached per request by React `cache`, so a page and its children do not
 * repeat the same three queries.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const userId = session.user.id;
  const status = (session.user as { status?: string }).status ?? "active";

  const roleRows = await db
    .select({ roleId: userRoles.roleId, key: roles.key })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId));

  if (roleRows.length === 0) {
    throw new Error(
      "Authenticated user has no role assigned. Run the administrator " +
        "bootstrap (npm run bootstrap:admin) or assign a role in User Management."
    );
  }

  const perms = await db
    .select({ code: rolePermissions.permissionCode })
    .from(rolePermissions)
    .innerJoin(userRoles, eq(userRoles.roleId, rolePermissions.roleId))
    .where(eq(userRoles.userId, userId));

  const company = await db
    .select({ id: companies.id })
    .from(companies)
    .limit(1);

  if (company.length === 0) {
    throw new Error(
      "No company record found. Run the administrator bootstrap " +
        "(npm run bootstrap:admin) to create the first company and Super Admin."
    );
  }

  const u = session.user as typeof session.user & {
    mustChangePassword?: boolean;
    twoFactorEnabled?: boolean;
  };

  return {
    id: userId,
    name: u.name,
    email: u.email,
    status: status as SessionUser["status"],
    mustChangePassword: Boolean(u.mustChangePassword),
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
    roleKeys: roleRows.map((r) => r.key),
    permissions: [...new Set(perms.map((p) => p.code))],
    companyId: company[0].id,
  };
});

/** Require a signed-in, active user; otherwise send them to the login page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status === "disabled") {
    redirect("/login?error=account_disabled");
  }
  return user;
}

/** Require a permission, throwing ForbiddenError when it is absent. */
export async function requirePermission(code: PermissionCode): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user.permissions, code)) {
    throw new ForbiddenError(code);
  }
  return user;
}

/** Convenience for pages: returns false instead of throwing. */
export async function can(code: PermissionCode): Promise<boolean> {
  const user = await getSessionUser();
  return Boolean(user && hasPermission(user.permissions, code));
}

export interface CompanyContext {
  id: string;
}

/** Single active company (business-scoped data model, ready for multi-company). */
export const getCompany = cache(async (): Promise<CompanyContext> => {
  const rows = await db.select({ id: companies.id }).from(companies).limit(1);
  if (rows.length === 0) {
    throw new Error(
      "No company record found. Run the administrator bootstrap " +
        "(npm run bootstrap:admin)."
    );
  }
  return { id: rows[0].id };
});
