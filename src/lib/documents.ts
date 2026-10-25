import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { taxRates } from "@/db/schema";
import { calculateDocument, type DocumentResult, type LineInput } from "@/lib/calc";
import type {
  DocumentChargeInput,
  DocumentLineInput,
} from "@/lib/validation";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tx = PgDatabase<any, any, any>;

export interface ResolvedTaxRate {
  id: string;
  rate: string;
  isInclusive: boolean;
}

/**
 * Load tax rates for the given ids, scoped to the company. Unknown or
 * foreign rates are dropped rather than trusted — a client cannot smuggle
 * in a rate by posting an id.
 */
export async function resolveTaxRates(
  tx: Tx,
  companyId: string,
  ids: string[]
): Promise<Map<string, ResolvedTaxRate>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const rows = await tx
    .select({
      id: taxRates.id,
      rate: taxRates.rate,
      isInclusive: taxRates.isInclusive,
    })
    .from(taxRates)
    .where(
      eq(taxRates.companyId, companyId)
    );

  const map = new Map<string, ResolvedTaxRate>();
  for (const row of rows) {
    if (unique.includes(row.id)) {
      map.set(row.id, {
        id: row.id,
        rate: row.rate,
        isInclusive: row.isInclusive,
      });
    }
  }
  return map;
}

export interface PricedLine extends DocumentLineInput {
  taxRateSnapshot: string;
  taxInclusive: boolean;
}

/**
 * Stamp each line with its company-owned tax rate snapshot, then run the
 * shared calculation engine over lines, charges and the document discount.
 * Totals returned here are the authoritative values stored on the document
 * — the browser's numbers are never used.
 */
export function priceDocument(
  lines: DocumentLineInput[],
  charges: DocumentChargeInput[],
  docDiscount: { type: "none" | "percent" | "amount"; value: string },
  rates: Map<string, ResolvedTaxRate>,
  currency: string,
  chargeDefaultTaxRateId?: string
): { priced: PricedLine[]; result: DocumentResult } {
  const priced: PricedLine[] = lines.map((line) => {
    const rate = line.taxRateId ? rates.get(line.taxRateId) : undefined;
    return {
      ...line,
      taxRateSnapshot: rate ? rate.rate : "0",
      taxInclusive: rate ? rate.isInclusive : false,
    };
  });

  const inputs: LineInput[] = priced.map((l) => ({
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discountType: l.discountType,
    discountValue: l.discountValue,
    taxRate: l.taxRateSnapshot,
    taxInclusive: l.taxInclusive,
  }));

  const chargeInputs = charges.map((c) => {
    const rate =
      c.taxable && chargeDefaultTaxRateId
        ? rates.get(chargeDefaultTaxRateId)
        : undefined;
    return {
      amount: c.amount,
      taxable: c.taxable,
      taxRate: rate ? rate.rate : 0,
      taxInclusive: rate ? rate.isInclusive : false,
    };
  });

  const result = calculateDocument({
    lines: inputs,
    charges: chargeInputs,
    documentDiscount: { type: docDiscount.type, value: docDiscount.value },
    currency,
  });

  return { priced, result };
}
