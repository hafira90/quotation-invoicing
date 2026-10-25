import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { cache } from "react";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";

/**
 * Audit trail writer.
 *
 * Only this module inserts into audit_logs; nothing in the application
 * updates or deletes rows, so ordinary users cannot rewrite history.
 * Never pass passwords, session tokens, reset tokens or payment credentials
 * — only identifiers and business values.
 */
export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  companyId?: string | null;
  actorUserId?: string | null;
  actorLabel?: string | null;
  before?: unknown;
  after?: unknown;
}

/** Request correlation id — generated per request and reused across writes. */
export const getRequestId = cache(async (): Promise<string> => {
  try {
    const h = await headers();
    return h.get("x-request-id") ?? randomUUID();
  } catch {
    // Called outside a request (scripts, tests).
    return randomUUID();
  }
});

export async function writeAudit(input: AuditInput): Promise<void> {
  let ip: string | null = null;
  let userAgent: string | null = null;
  let requestId: string | null = null;

  try {
    const h = await headers();
    ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null;
    userAgent = h.get("user-agent");
    requestId = h.get("x-request-id") ?? null;
  } catch {
    // Running from a script.
  }

  await db.insert(auditLogs).values({
    companyId: input.companyId ?? null,
    actorUserId: input.actorUserId ?? null,
    actorLabel: input.actorLabel ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    ip,
    userAgent,
    requestId: requestId ?? (await getRequestId()),
  });
}
