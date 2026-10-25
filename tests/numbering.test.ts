/**
 * Document numbering tests.
 *
 * The concurrency test runs against the real database (Neon) because the
 * guarantee being tested — `SELECT ... FOR UPDATE` serialises allocators —
 * only exists in Postgres. It snapshots the counter and restores it, so it
 * leaves no visible trace in your sequence.
 */
import "../scripts/load-env";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db, pool } from "@/db";
import { companies, documentSequences } from "@/db/schema";
import {
  DEFAULT_PREFIXES,
  allocateDocumentNumber,
  formatDocumentNumber,
  peekNextDocumentNumber,
  validateSequenceConfig,
} from "@/lib/numbering";

const dbAvailable = Boolean(process.env.DATABASE_URL);
const PERIOD = "1999"; // a period no real document will ever use

let companyId = "";

describe.skipIf(!dbAvailable)("document numbering", () => {
  beforeAll(async () => {
    const rows = await db.select().from(companies).limit(1);
    companyId = rows[0]?.id ?? "";
    expect(companyId, "run npm run bootstrap:admin first").toBeTruthy();

    // Fresh counter for this test period.
    await db
      .delete(documentSequences)
      .where(eq(documentSequences.period, PERIOD));
    await db.insert(documentSequences).values({
      companyId,
      docType: "invoice",
      period: PERIOD,
      prefix: "INV",
      separator: "-",
      padding: 5,
      nextValue: 1,
    });
  });

  afterAll(async () => {
    if (companyId) {
      await db
        .delete(documentSequences)
        .where(eq(documentSequences.period, PERIOD));
    }
    await pool.end();
  });

  it("formats numbers the documented way", () => {
    expect(
      formatDocumentNumber({
        prefix: "QUO",
        separator: "-",
        period: "2026",
        value: 7,
        padding: 5,
      })
    ).toBe("QUO-2026-00007");
    expect(DEFAULT_PREFIXES.credit_note).toBe("CN");
  });

  it("allocates sequential numbers", async () => {
    const a = await db.transaction((tx) =>
      allocateDocumentNumber(tx, { companyId, docType: "invoice", period: PERIOD })
    );
    const b = await db.transaction((tx) =>
      allocateDocumentNumber(tx, { companyId, docType: "invoice", period: PERIOD })
    );
    expect(a).toBe("INV-1999-00001");
    expect(b).toBe("INV-1999-00002");
  });

  it("never issues the same number twice under concurrency", async () => {
    const before = await peekNextDocumentNumber(db, {
      companyId,
      docType: "invoice",
      period: PERIOD,
    });
    expect(before).toBe("INV-1999-00003");

    // 12 concurrent allocators, each in its own transaction.
    const allocated = await Promise.all(
      Array.from({ length: 12 }, () =>
        db.transaction((tx) =>
          allocateDocumentNumber(tx, {
            companyId,
            docType: "invoice",
            period: PERIOD,
          })
        )
      )
    );

    expect(allocated).toHaveLength(12);
    expect(new Set(allocated).size, `duplicates found: ${allocated.join(", ")}`).toBe(12);

    const ordered = [...allocated].sort();
    expect(ordered[0]).toBe("INV-1999-00003");
    expect(ordered[11]).toBe("INV-1999-00014");
  });

  it("keeps the counter consistent after a rolled-back transaction", async () => {
    const nextBefore = await peekNextDocumentNumber(db, {
      companyId,
      docType: "invoice",
      period: PERIOD,
    });

    await expect(
      db.transaction(async (tx) => {
        await allocateDocumentNumber(tx, {
          companyId,
          docType: "invoice",
          period: PERIOD,
        });
        throw new Error("simulated failure after allocating");
      })
    ).rejects.toThrow("simulated failure");

    const nextAfter = await peekNextDocumentNumber(db, {
      companyId,
      docType: "invoice",
      period: PERIOD,
    });

    // The number must roll back with the transaction: no gap, no reuse risk.
    expect(nextAfter).toBe(nextBefore);
  });

  it("validates numbering configuration from the settings page", () => {
    expect(validateSequenceConfig({ prefix: "INV", separator: "-", padding: 5 })).toEqual({ ok: true });
    expect(validateSequenceConfig({ prefix: "INV!", separator: "-", padding: 5 }).ok).toBe(false);
    expect(validateSequenceConfig({ prefix: "INV", separator: "--", padding: 5 }).ok).toBe(false);
    expect(validateSequenceConfig({ prefix: "INV", separator: "-", padding: 0 }).ok).toBe(false);
    expect(validateSequenceConfig({ prefix: "INV", separator: "-", padding: 99 }).ok).toBe(false);
  });
});
