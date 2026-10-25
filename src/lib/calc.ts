import Decimal from "decimal.js";

/**
 * The single financial calculation engine.
 *
 * Used by: server-side validation (authoritative), the UI preview, PDF
 * rendering, CSV export and reports. The browser's numbers are never
 * trusted — every document is recalculated with these functions on the
 * server before it is stored.
 *
 * Documented calculation policy
 * -----------------------------
 * 1. Line gross        = quantity × unitPrice                      (6 dp)
 * 2. Line discount     = percent of gross, or a flat amount.        (never below 0)
 * 3. Line net          = gross − line discount, rounded HALF_UP to
 *                        currency precision (2 dp for MYR).
 * 4. Document discount = applied to the sum of line nets, allocated
 *                        across lines proportionally with the
 *                        largest-remainder method, so the allocated
 *                        parts always sum back to the discount exactly.
 * 5. Tax               = applied per line, after discounts.
 *                        exclusive: tax = net × rate, total = net + tax
 *                        inclusive: total = net (tax already inside),
 *                                   net = total ÷ (1 + rate), tax = difference
 * 6. Rounding          = HALF_UP at currency precision, once per line.
 *                        Totals are the sum of already-rounded line values,
 *                        never a second rounding of an aggregate.
 * 7. Charges           = delivery/shipping/handling lines below the item
 *                        table; taxable charges add to the tax base at
 *                        their own configured rate.
 * 8. Partial payments  = balances are derived from allocations, never
 *                        stored as an independent total.
 */

/** Intermediate maths keep more precision than the final currency. */
const WORK_DP = 6;

type DecimalLike = string | number | Decimal;

const d = (value: DecimalLike): Decimal => {
  if (value instanceof Decimal) return value;
  return new Decimal(typeof value === "number" ? String(value) : value || "0");
};

export type DiscountType = "none" | "percent" | "amount";
export type TaxTreatment = "exclusive" | "inclusive";

export interface LineInput {
  quantity: string | number;
  unitPrice: string | number;
  discountType?: DiscountType;
  discountValue?: string | number;
  /** Percentage, e.g. 6 for 6%. */
  taxRate?: string | number;
  taxInclusive?: boolean;
}

export interface ChargeInput {
  amount: string | number;
  taxable?: boolean;
  taxRate?: string | number;
  taxInclusive?: boolean;
}

export interface DocumentDiscount {
  type: DiscountType;
  value: string | number;
}

export interface LineResult {
  /** Gross before discount. */
  gross: string;
  /** Line-level discount amount. */
  discount: string;
  /**
   * Amount the document-level discount is allocated against.
   * Exclusive lines: the pre-tax net. Inclusive lines: the tax-inclusive
   * amount (because that is what the customer sees and pays).
   */
  base: string;
  /** Tax-exclusive value of the line. */
  net: string;
  tax: string;
  /** Net after the proportional document discount (tax-exclusive). */
  netAfterDocumentDiscount: string;
  taxAfterDocumentDiscount: string;
  /** What the customer pays for this line. */
  total: string;
}

export interface DocumentResult {
  currency: string;
  precision: number;
  lineSubtotal: string;
  lineDiscountTotal: string;
  documentDiscountTotal: string;
  discountTotal: string;
  chargesTotal: string;
  taxableBase: string;
  taxTotal: string;
  grandTotal: string;
  lines: LineResult[];
  charges: { tax: string; total: string; net: string }[];
}

function round(value: DecimalLike, precision: number): Decimal {
  return d(value).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP);
}

function money(value: DecimalLike, precision: number): string {
  return round(value, precision).toFixed(precision);
}

function applyLineDiscount(
  gross: Decimal,
  type: DiscountType,
  value: string | number,
  precision: number
): Decimal {
  if (type === "percent") {
    const pct = d(value);
    if (pct.lte(0)) return gross;
    // A discount above 100% would make the line negative; clamp at zero.
    const clamped = Decimal.min(pct, 100);
    return gross.minus(gross.times(clamped).div(100));
  }
  if (type === "amount") {
    const amount = d(value);
    if (amount.lte(0)) return gross;
    return Decimal.max(gross.minus(amount), 0);
  }
  return gross;
}

/**
 * Calculate one line before document-level discount.
 */
export function calculateLine(input: LineInput, precision = 2): LineResult {
  const grossRaw = d(input.quantity).times(d(input.unitPrice));
  const afterLineDiscount = applyLineDiscount(
    grossRaw,
    input.discountType ?? "none",
    input.discountValue ?? 0,
    precision
  );

  // Policy 3: round the net once, at currency precision.
  const net = round(afterLineDiscount, precision);
  const gross = round(grossRaw, precision);
  const discount = gross.minus(net);

  const rate = d(input.taxRate ?? 0);
  const inclusive = Boolean(input.taxInclusive);

  if (rate.lte(0)) {
    return {
      gross: money(gross, precision),
      discount: money(discount, precision),
      base: money(net, precision),
      net: money(net, precision),
      tax: money(0, precision),
      netAfterDocumentDiscount: money(net, precision),
      taxAfterDocumentDiscount: money(0, precision),
      total: money(net, precision),
    };
  }

  if (inclusive) {
    // The discounted amount already contains tax: split it back out.
    const total = net;
    const derivedNet = total.div(new Decimal(1).plus(rate.div(100)));
    const tax = round(total.minus(derivedNet), precision);
    return {
      gross: money(gross, precision),
      discount: money(discount, precision),
      base: money(total, precision),
      net: money(round(derivedNet, precision), precision),
      tax: money(tax, precision),
      netAfterDocumentDiscount: money(round(derivedNet, precision), precision),
      taxAfterDocumentDiscount: money(tax, precision),
      total: money(total, precision),
    };
  }

  const tax = round(net.times(rate).div(100), precision);
  const total = net.plus(tax);

  return {
    gross: money(gross, precision),
    discount: money(discount, precision),
    base: money(net, precision),
    net: money(net, precision),
    tax: money(tax, precision),
    netAfterDocumentDiscount: money(net, precision),
    taxAfterDocumentDiscount: money(tax, precision),
    total: money(total, precision),
  };
}

/**
 * Proportionally split an amount across weights (largest-remainder method).
 * The returned parts always sum exactly to `amount`.
 */
export function allocateProportionally(
  amount: Decimal,
  weights: Decimal[],
  precision: number
): Decimal[] {
  const totalWeight = weights.reduce((acc, w) => acc.plus(w), new Decimal(0));
  if (totalWeight.isZero() || amount.isZero()) {
    return weights.map(() => new Decimal(0));
  }

  const unit = new Decimal(10).pow(-precision);
  const exact = weights.map((w) => amount.times(w).div(totalWeight));
  const floors = exact.map((v) => v.div(unit).toDecimalPlaces(0, Decimal.ROUND_FLOOR).times(unit));

  const allocated = floors.reduce((acc, v) => acc.plus(v), new Decimal(0));
  let remainder = amount.minus(allocated);

  // Hand out the leftover cents, one unit at a time, largest fraction first.
  const order = exact
    .map((v, i) => ({ i, frac: v.minus(floors[i]) }))
    .sort((a, b) => b.frac.comparedTo(a.frac) || a.i - b.i);

  let cursor = 0;
  while (remainder.abs().greaterThan(unit.div(2)) && order.length > 0) {
    const target = order[cursor % order.length];
    if (!target) break;
    const step = remainder.isNegative() ? unit.negated() : unit;
    floors[target.i] = floors[target.i].plus(step);
    remainder = remainder.minus(step);
    cursor++;
    if (cursor > order.length * 4) break;
  }

  return floors;
}

/**
 * Calculate a whole document: items, document-level discount, charges and tax.
 */
export function calculateDocument(
  input: {
    lines: LineInput[];
    charges?: ChargeInput[];
    documentDiscount?: DocumentDiscount;
    currency?: string;
    precision?: number;
  },
  options?: { precision?: number; locale?: string }
): DocumentResult {
  const precision = input.precision ?? options?.precision ?? 2;
  const currency = input.currency ?? "MYR";

  const lineResults = input.lines.map((line) => calculateLine(line, precision));

  // Document discount is allocated across the tax-inclusive bases, i.e.
  // across what the customer actually pays before the document discount.
  const baseAmounts = lineResults.map((l) => d(l.base));
  const baseTotal = baseAmounts.reduce((acc, v) => acc.plus(v), new Decimal(0));

  const docDiscount = applyLineDiscount(
    baseTotal,
    input.documentDiscount?.type ?? "none",
    input.documentDiscount?.value ?? 0,
    precision
  );
  const docDiscountAmount = round(baseTotal.minus(docDiscount), precision);

  const parts = allocateProportionally(docDiscountAmount, baseAmounts, precision);
  const lineDocDiscount = parts.map((p) => round(p, precision));

  // Recompute each line from its discounted base.
  const finalLines: LineResult[] = input.lines.map((line, i) => {
    const base = baseAmounts[i] ?? new Decimal(0);
    const discountPart = lineDocDiscount[i] ?? new Decimal(0);
    const afterDiscount = base.minus(discountPart);

    const rate = d(line.taxRate ?? 0);
    const inclusive = Boolean(line.taxInclusive);

    if (rate.lte(0)) {
      return {
        ...lineResults[i]!,
        netAfterDocumentDiscount: money(round(afterDiscount, precision), precision),
        taxAfterDocumentDiscount: money(0, precision),
        total: money(afterDiscount, precision),
      };
    }

    if (inclusive) {
      // The discounted amount still contains the tax.
      const totalAfter = afterDiscount;
      const derivedNet = totalAfter.div(new Decimal(1).plus(rate.div(100)));
      const taxAfter = round(totalAfter.minus(derivedNet), precision);
      return {
        ...lineResults[i]!,
        netAfterDocumentDiscount: money(round(derivedNet, precision), precision),
        taxAfterDocumentDiscount: money(taxAfter, precision),
        total: money(totalAfter, precision),
      };
    }

    const netAfter = afterDiscount;
    const taxAfter = round(netAfter.times(rate).div(100), precision);
    const totalAfter = netAfter.plus(taxAfter);

    return {
      ...lineResults[i]!,
      netAfterDocumentDiscount: money(round(netAfter, precision), precision),
      taxAfterDocumentDiscount: money(taxAfter, precision),
      total: money(totalAfter, precision),
    };
  });

  /* Charges ---------------------------------------------------------------- */
  const chargeResults = (input.charges ?? []).map((charge) => {
    const amount = round(d(charge.amount), precision);
    const rate = d(charge.taxRate ?? 0);
    const inclusive = Boolean(charge.taxInclusive);

    if (!charge.taxable || rate.lte(0)) {
      return { net: money(amount, precision), tax: money(0, precision), total: money(amount, precision) };
    }
    if (inclusive) {
      const derivedNet = amount.div(new Decimal(1).plus(rate.div(100)));
      const tax = round(amount.minus(derivedNet), precision);
      return { net: money(round(derivedNet, precision), precision), tax: money(tax, precision), total: money(amount, precision) };
    }
    const tax = round(amount.times(rate).div(100), precision);
    return { net: money(amount, precision), tax: money(tax, precision), total: money(amount.plus(tax), precision) };
  });

  const sum = (xs: string[]): Decimal =>
    xs.reduce((acc, v) => acc.plus(d(v)), new Decimal(0));

  const lineDiscountTotal = sum(lineResults.map((l) => l.discount));
  // Subtotal is the tax-exclusive value of every line, before the document
  // discount: for inclusive lines that means backing tax out of the base.
  const lineSubtotal = sum(
    input.lines.map((line, i) => {
      const res = lineResults[i]!;
      const rate = d(line.taxRate ?? 0);
      if (Boolean(line.taxInclusive) && rate.greaterThan(0)) {
        return d(res.base).div(new Decimal(1).plus(rate.div(100))).toFixed(precision);
      }
      return res.base;
    })
  );
  const chargesTotal = sum(chargeResults.map((c) => c.net));
  const taxTotal = sum(finalLines.map((l) => l.taxAfterDocumentDiscount)).plus(
    sum(chargeResults.map((c) => c.tax))
  );
  const grandTotal = sum(finalLines.map((l) => l.total)).plus(
    sum(chargeResults.map((c) => c.total))
  );

  const taxableBase = sum(finalLines.map((l) => l.netAfterDocumentDiscount)).plus(
    sum(chargeResults.filter((_, i) => (input.charges ?? [])[i]?.taxable).map((c) => c.net))
  );

  return {
    currency,
    precision,
    lineSubtotal: money(lineSubtotal, precision),
    lineDiscountTotal: money(lineDiscountTotal, precision),
    documentDiscountTotal: money(docDiscountAmount, precision),
    discountTotal: money(lineDiscountTotal.plus(docDiscountAmount), precision),
    chargesTotal: money(chargesTotal, precision),
    taxableBase: money(taxableBase, precision),
    taxTotal: money(taxTotal, precision),
    grandTotal: money(grandTotal, precision),
    lines: finalLines,
    charges: chargeResults,
  };
}

/**
 * Outstanding balance for an invoice = total − live payments − applied credits.
 * Reversed payments are excluded; their allocations remain for audit.
 */
export function calculateBalance(input: {
  grandTotal: string | number;
  paidAmount?: string | number;
  creditedAmount?: string | number;
  precision?: number;
}): { outstanding: string; settled: boolean } {
  const precision = input.precision ?? 2;
  const total = d(input.grandTotal);
  const paid = d(input.paidAmount ?? 0);
  const credited = d(input.creditedAmount ?? 0);
  const outstanding = total.minus(paid).minus(credited);
  const clamped = Decimal.max(outstanding, 0);
  return { outstanding: money(clamped, precision), settled: clamped.lessThanOrEqualTo(0) };
}

/**
 * Invoice status that depends on dates and balances.
 * A fully paid invoice is never "overdue".
 */
export function resolveInvoiceStatus(input: {
  status: "draft" | "issued" | "sent" | "partially_paid" | "paid" | "overdue" | "void";
  grandTotal: string | number;
  /** Live payments plus applied credits (reversed payments excluded). */
  settledAmount?: string | number;
  dueDate?: string | null;
  today?: string;
}): typeof input.status {
  if (input.status === "draft" || input.status === "void") return input.status;

  const total = d(input.grandTotal);
  const settled = d(input.settledAmount ?? 0);
  const outstanding = total.minus(settled);

  // Policy: a fully paid invoice is never overdue.
  if (outstanding.lessThanOrEqualTo(0)) return "paid";

  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const isPastDue = Boolean(input.dueDate) && String(input.dueDate) < today;
  if (isPastDue) return "overdue";

  if (settled.greaterThan(0)) return "partially_paid";
  return input.status === "overdue" ? "sent" : input.status;
}
