import { describe, expect, it } from "vitest";

import {
  allocateProportionally,
  calculateBalance,
  calculateDocument,
  calculateLine,
  resolveInvoiceStatus,
} from "@/lib/calc";
import Decimal from "decimal.js";

describe("calculateLine", () => {
  it("multiplies quantity by unit price", () => {
    const r = calculateLine({ quantity: 3, unitPrice: "19.90" });
    expect(r.net).toBe("59.70");
    expect(r.tax).toBe("0.00");
    expect(r.total).toBe("59.70");
  });

  it("applies a percentage line discount before tax", () => {
    const r = calculateLine({
      quantity: 1,
      unitPrice: "100.00",
      discountType: "percent",
      discountValue: 10,
      taxRate: 6,
    });
    expect(r.discount).toBe("10.00");
    expect(r.net).toBe("90.00");
    expect(r.tax).toBe("5.40");
    expect(r.total).toBe("95.40");
  });

  it("applies a flat amount discount and never goes negative", () => {
    const r = calculateLine({
      quantity: 1,
      unitPrice: "10.00",
      discountType: "amount",
      discountValue: "50.00",
    });
    expect(r.net).toBe("0.00");
    expect(r.total).toBe("0.00");
  });

  it("supports fractional quantities", () => {
    const r = calculateLine({ quantity: "1.5", unitPrice: "20.00" });
    expect(r.net).toBe("30.00");
  });

  it("handles zero-value items without producing NaN", () => {
    const r = calculateLine({ quantity: 1, unitPrice: 0, taxRate: 6 });
    expect(r.net).toBe("0.00");
    expect(r.tax).toBe("0.00");
    expect(r.total).toBe("0.00");
  });

  it("extracts tax from an inclusive price", () => {
    const r = calculateLine({
      quantity: 1,
      unitPrice: "106.00",
      taxRate: 6,
      taxInclusive: true,
    });
    expect(r.total).toBe("106.00");
    expect(r.net).toBe("100.00");
    expect(r.tax).toBe("6.00");
  });

  it("rounds half up at currency precision", () => {
    // 1 × 0.125 at 2dp → 0.13 (HALF_UP), not 0.12.
    const r = calculateLine({ quantity: 1, unitPrice: "0.125" });
    expect(r.net).toBe("0.13");
  });
});

describe("calculateDocument", () => {
  it("sums lines and applies tax", () => {
    const doc = calculateDocument({
      lines: [
        { quantity: 2, unitPrice: "50.00", taxRate: 6 },
        { quantity: 1, unitPrice: "10.00", taxRate: 6 },
      ],
    });
    expect(doc.lineSubtotal).toBe("110.00");
    expect(doc.taxTotal).toBe("6.60");
    expect(doc.grandTotal).toBe("116.60");
  });

  it("allocates a document-level percent discount so parts sum exactly", () => {
    const doc = calculateDocument({
      lines: [
        { quantity: 1, unitPrice: "10.00" },
        { quantity: 1, unitPrice: "10.00" },
        { quantity: 1, unitPrice: "10.00" },
      ],
      documentDiscount: { type: "percent", value: 10 },
    });
    expect(doc.documentDiscountTotal).toBe("3.00");
    expect(doc.grandTotal).toBe("27.00");
    const partsSum = doc.lines
      .reduce((acc, l) => acc.plus(l.netAfterDocumentDiscount), new Decimal(0))
      .toFixed(2);
    expect(partsSum).toBe("27.00");
  });

  it("splits an awkward discount without losing or inventing cents", () => {
    const doc = calculateDocument({
      lines: [
        { quantity: 1, unitPrice: "10.00" },
        { quantity: 1, unitPrice: "20.00" },
        { quantity: 1, unitPrice: "30.00" },
      ],
      documentDiscount: { type: "amount", value: "10.00" },
    });
    expect(doc.documentDiscountTotal).toBe("10.00");
    const sum = doc.lines
      .reduce((acc, l) => acc.plus(l.netAfterDocumentDiscount), new Decimal(0))
      .toFixed(2);
    expect(sum).toBe("50.00");
    expect(doc.grandTotal).toBe("50.00");
  });

  it("adds taxable and non-taxable charges correctly", () => {
    const doc = calculateDocument({
      lines: [{ quantity: 1, unitPrice: "100.00", taxRate: 6 }],
      charges: [
        { amount: "20.00", taxable: false },
        { amount: "10.00", taxable: true, taxRate: 6 },
      ],
    });
    expect(doc.chargesTotal).toBe("30.00");
    expect(doc.taxTotal).toBe("6.60"); // 6.00 line + 0.60 charge
    expect(doc.grandTotal).toBe("136.60");
  });

  it("matches totals when every value is inclusive", () => {
    const doc = calculateDocument({
      lines: [
        { quantity: 3, unitPrice: "106.00", taxRate: 6, taxInclusive: true },
      ],
      precision: 2,
    });
    expect(doc.grandTotal).toBe("318.00");
    expect(doc.taxTotal).toBe("18.00");
  });

  it("handles an empty document", () => {
    const doc = calculateDocument({ lines: [] });
    expect(doc.grandTotal).toBe("0.00");
    expect(doc.taxTotal).toBe("0.00");
  });

  it("supports zero-decimal currencies", () => {
    const doc = calculateDocument(
      { lines: [{ quantity: 1, unitPrice: "100.4", taxRate: 6 }], precision: 0 },
      { precision: 0 }
    );
    expect(doc.taxTotal).toBe("6");
    expect(doc.grandTotal).toBe("106");
  });
});

describe("allocateProportionally", () => {
  it("always returns parts that sum to the amount", () => {
    for (const amount of ["10.00", "0.03", "1.00", "7.77"]) {
      for (const weights of [
        ["1.00", "2.00", "3.00"],
        ["0.01", "0.01", "0.01"],
        ["100.00", "0.01"],
      ]) {
        const parts = allocateProportionally(
          new Decimal(amount),
          weights.map((w) => new Decimal(w)),
          2
        );
        const sum = parts.reduce((a, b) => a.plus(b), new Decimal(0));
        expect(sum.toFixed(2)).toBe(new Decimal(amount).toFixed(2));
      }
    }
  });
});

describe("calculateBalance", () => {
  it("subtracts payments and credits", () => {
    const b = calculateBalance({
      grandTotal: "1000.00",
      paidAmount: "400.00",
      creditedAmount: "100.00",
    });
    expect(b.outstanding).toBe("500.00");
    expect(b.settled).toBe(false);
  });

  it("never reports a negative balance", () => {
    const b = calculateBalance({ grandTotal: "100.00", paidAmount: "150.00" });
    expect(b.outstanding).toBe("0.00");
    expect(b.settled).toBe(true);
  });

  it("flags fully paid invoices as settled", () => {
    const b = calculateBalance({ grandTotal: "250.00", paidAmount: "250.00" });
    expect(b.settled).toBe(true);
  });
});

describe("resolveInvoiceStatus", () => {
  const today = "2026-10-25";

  it("keeps drafts and void invoices untouched", () => {
    expect(
      resolveInvoiceStatus({ status: "draft", grandTotal: "100", settledAmount: "0", dueDate: "2026-01-01", today })
    ).toBe("draft");
    expect(
      resolveInvoiceStatus({ status: "void", grandTotal: "100", settledAmount: "0", dueDate: "2026-01-01", today })
    ).toBe("void");
  });

  it("never marks a fully paid invoice overdue", () => {
    expect(
      resolveInvoiceStatus({
        status: "sent",
        grandTotal: "500.00",
        settledAmount: "500.00",
        dueDate: "2026-01-01",
        today,
      })
    ).toBe("paid");
  });

  it("marks a past-due unpaid invoice overdue", () => {
    expect(
      resolveInvoiceStatus({
        status: "sent",
        grandTotal: "500.00",
        settledAmount: "0",
        dueDate: "2026-10-01",
        today,
      })
    ).toBe("overdue");
  });

  it("keeps a partly paid invoice as partially paid before the due date", () => {
    expect(
      resolveInvoiceStatus({
        status: "issued",
        grandTotal: "500.00",
        settledAmount: "100.00",
        dueDate: "2026-12-31",
        today,
      })
    ).toBe("partially_paid");
  });

  it("still marks a partly paid invoice overdue after the due date", () => {
    expect(
      resolveInvoiceStatus({
        status: "partially_paid",
        grandTotal: "500.00",
        settledAmount: "100.00",
        dueDate: "2026-10-01",
        today,
      })
    ).toBe("overdue");
  });
});
