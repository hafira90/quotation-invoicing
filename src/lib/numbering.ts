import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { documentSequences } from "@/db/schema";

export type DocumentSequenceType =
  | "quotation"
  | "invoice"
  | "receipt"
  | "credit_note";

export interface AllocateOptions {
  companyId: string;
  docType: DocumentSequenceType;
  /** Defaults to the current calendar year. */
  period?: string;
  /** Override the seeded prefix, e.g. "QUO". */
  prefix?: string;
  padding?: number;
  separator?: string;
}

export const DEFAULT_PREFIXES: Record<DocumentSequenceType, string> = {
  quotation: "QUO",
  invoice: "INV",
  receipt: "REC",
  credit_note: "CN",
};

export function currentPeriod(date = new Date()): string {
  return String(date.getUTCFullYear());
}

export function formatDocumentNumber(parts: {
  prefix: string;
  separator: string;
  period: string;
  value: number;
  padding: number;
}): string {
  const digits = String(parts.value).padStart(Math.max(1, parts.padding), "0");
  // QUO-2026-00001
  return `${parts.prefix}${parts.separator}${parts.period}${parts.separator}${digits}`;
}

/**
 * Allocate the next document number inside the caller's transaction.
 *
 * Safety comes from three layers:
 *   1. `SELECT ... FOR UPDATE` on the sequence row serialises concurrent
 *      allocators, so two requests can never read the same counter value.
 *   2. The counter is incremented in the same statement/transaction, so a
 *      rolled-back document also rolls back its number.
 *   3. A unique index on (company_id, document_number) is the final backstop
 *      if anything ever bypasses the lock.
 *
 * Numbers are never derived from COUNT(*): gaps after a cancelled draft are
 * expected and preferable to duplicates.
 *
 * Must be called with a transaction-bound database handle:
 *
 *   await db.transaction(async (tx) => {
 *     const number = await allocateDocumentNumber(tx, { companyId, docType: "invoice" });
 *     ...insert the invoice with that number...
 *   });
 */
export async function allocateDocumentNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: PgDatabase<any, any, any>,
  options: AllocateOptions
): Promise<string> {
  const period = options.period ?? currentPeriod();
  const prefix = options.prefix ?? DEFAULT_PREFIXES[options.docType];

  // Ensure the row exists for this period (racy creation is fine: unique PK).
  await tx
    .insert(documentSequences)
    .values({
      companyId: options.companyId,
      docType: options.docType,
      period,
      prefix,
      separator: options.separator ?? "-",
      padding: options.padding ?? 5,
      nextValue: 1,
    })
    .onConflictDoNothing();

  const rows = await tx.execute<{
    prefix: string;
    separator: string;
    padding: number;
    next_value: number;
  }>(sql`
    select prefix, separator, padding, next_value
    from document_sequences
    where company_id = ${options.companyId}
      and doc_type = ${options.docType}
      and period = ${period}
    for update
  `);

  const row = rows.rows[0];
  if (!row) {
    throw new Error(
      `No document sequence found for ${options.docType} ${period}. ` +
        `Run npm run bootstrap:admin to seed the defaults.`
    );
  }

  const value = Number(row.next_value);

  await tx.execute(sql`
    update document_sequences
    set next_value = ${value + 1},
        updated_at = now()
    where company_id = ${options.companyId}
      and doc_type = ${options.docType}
      and period = ${period}
  `);

  return formatDocumentNumber({
    prefix: options.prefix ?? row.prefix,
    separator: options.separator ?? row.separator,
    period,
    value,
    padding: options.padding ?? Number(row.padding),
  });
}

/** Read the next number without consuming it (preview in the UI). */
export async function peekNextDocumentNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: PgDatabase<any, any, any>,
  options: AllocateOptions
): Promise<string> {
  const period = options.period ?? currentPeriod();
  const rows = await db
    .select()
    .from(documentSequences)
    .where(
      and(
        eq(documentSequences.companyId, options.companyId),
        eq(documentSequences.docType, options.docType),
        eq(documentSequences.period, period)
      )
    );

  const row = rows[0];
  if (!row) {
    return formatDocumentNumber({
      prefix: options.prefix ?? DEFAULT_PREFIXES[options.docType],
      separator: options.separator ?? "-",
      period,
      value: 1,
      padding: options.padding ?? 5,
    });
  }

  return formatDocumentNumber({
    prefix: options.prefix ?? row.prefix,
    separator: options.separator ?? row.separator,
    period,
    value: row.nextValue,
    padding: options.padding ?? row.padding,
  });
}

/** Validate a user-supplied numbering pattern (settings page). */
export function validateSequenceConfig(config: {
  prefix: string;
  separator: string;
  padding: number;
}): { ok: true } | { ok: false; error: string } {
  if (!/^[A-Za-z0-9]{1,10}$/.test(config.prefix)) {
    return { ok: false, error: "Prefix must be 1-10 letters or digits." };
  }
  if (config.separator.length !== 1 || /[\sA-Za-z0-9]/.test(config.separator)) {
    return { ok: false, error: "Separator must be a single non-alphanumeric character." };
  }
  if (config.padding < 1 || config.padding > 12) {
    return { ok: false, error: "Sequence length must be between 1 and 12." };
  }
  return { ok: true };
}
