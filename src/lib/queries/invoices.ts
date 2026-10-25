import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  ne,
  or,
  sql,
  count,
} from "drizzle-orm";

import { db } from "@/db";
import {
  businessSettings,
  customers,
  creditNotes,
  creditNoteAllocations,
  documentCharges,
  invoiceItems,
  invoices,
  paymentAllocations,
  paymentMethods,
  payments,
  products,
  quotationItems,
  quotations,
  taxRates,
} from "@/db/schema";

export interface InvoiceListParams {
  companyId: string;
  q?: string;
  status?: string;
  customerId?: string;
  from?: string;
  to?: string;
  sort?: "number" | "issueDate" | "dueDate" | "total" | "created";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export type EffectiveStatus =
  | "draft"
  | "issued"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

export interface InvoiceListRow {
  id: string;
  invoiceNumber: string;
  status: string;
  effectiveStatus: EffectiveStatus;
  issueDate: string;
  dueDate: string | null;
  grandTotal: string;
  currency: string;
  customerName: string;
  paid: string;
  outstanding: string;
  createdAt: Date;
}

export const INVOICE_STATUSES = [
  "draft",
  "issued",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
] as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Derive the display status. A fully paid invoice is never overdue, and
 * void/draft invoices never show as overdue either.
 */
export function effectiveStatus(
  status: string,
  dueDate: string | null,
  outstanding: string
): EffectiveStatus {
  if (status === "void" || status === "draft" || status === "paid") {
    return status as EffectiveStatus;
  }
  const paidOff = Number(outstanding) <= 0;
  if (paidOff) return status as EffectiveStatus;
  if (
    (status === "issued" || status === "sent" || status === "partially_paid") &&
    dueDate &&
    dueDate < todayIso()
  ) {
    return "overdue";
  }
  return status as EffectiveStatus;
}

/** Outstanding = grand total − recorded payments − live credit notes. */
async function financialsFor(ids: string[]) {
  if (ids.length === 0) return new Map<string, { paid: string; credited: string }>();

  const [paidRows, creditRows] = await Promise.all([
    db
      .select({
        invoiceId: paymentAllocations.invoiceId,
        total: sql<string>`coalesce(sum(${paymentAllocations.amount}), 0)::text`,
      })
      .from(paymentAllocations)
      .innerJoin(
        payments,
        and(eq(payments.id, paymentAllocations.paymentId), eq(payments.status, "recorded"))
      )
      .where(inArray(paymentAllocations.invoiceId, ids))
      .groupBy(paymentAllocations.invoiceId),
    db
      .select({
        invoiceId: creditNoteAllocations.invoiceId,
        total: sql<string>`coalesce(sum(${creditNoteAllocations.amount}), 0)::text`,
      })
      .from(creditNoteAllocations)
      .innerJoin(
        creditNotes,
        and(
          eq(creditNotes.id, creditNoteAllocations.creditNoteId),
          ne(creditNotes.status, "void"),
          ne(creditNotes.status, "draft")
        )
      )
      .where(inArray(creditNoteAllocations.invoiceId, ids))
      .groupBy(creditNoteAllocations.invoiceId),
  ]);

  const map = new Map<string, { paid: string; credited: string }>();
  for (const id of ids) map.set(id, { paid: "0", credited: "0" });
  for (const r of paidRows) map.get(r.invoiceId)!.paid = r.total;
  for (const r of creditRows) map.get(r.invoiceId)!.credited = r.total;
  return map;
}

export async function listInvoices(params: InvoiceListParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 20));
  const q = params.q?.trim();

  const conditions = [eq(invoices.companyId, params.companyId)];

  if (params.status && params.status !== "all") {
    if (params.status === "overdue") {
      conditions.push(
        inArray(invoices.status, ["issued", "sent", "partially_paid"]),
        lte(invoices.dueDate, todayIso())
      );
    } else {
      conditions.push(eq(invoices.status, params.status as never));
    }
  }
  if (params.customerId) conditions.push(eq(invoices.customerId, params.customerId));
  if (params.from) conditions.push(gte(invoices.issueDate, params.from));
  if (params.to) conditions.push(lte(invoices.issueDate, params.to));

  if (q) {
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    conditions.push(
      or(
        ilike(invoices.invoiceNumber, like),
        ilike(customers.name, like),
        ilike(invoices.customerPo, like)
      )!
    );
  }

  const where = and(...conditions);

  const sortColumn =
    params.sort === "issueDate"
      ? invoices.issueDate
      : params.sort === "dueDate"
        ? invoices.dueDate
        : params.sort === "total"
          ? invoices.grandTotal
          : params.sort === "created"
            ? invoices.createdAt
            : invoices.invoiceNumber;
  const direction = params.dir === "asc" ? asc : desc;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        status: invoices.status,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        grandTotal: invoices.grandTotal,
        currency: invoices.currency,
        createdAt: invoices.createdAt,
        customerName: customers.name ?? "",
      })
      .from(invoices)
      .leftJoin(customers, eq(customers.id, invoices.customerId))
      .where(where)
      .orderBy(direction(sortColumn))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(invoices)
      .leftJoin(customers, eq(customers.id, invoices.customerId))
      .where(where),
  ]);

  const fin = await financialsFor(rows.map((r) => r.id));

  const items: InvoiceListRow[] = rows.map((r) => {
    const f = fin.get(r.id)!;
    const outstandingNum = Math.max(0, Number(r.grandTotal) - Number(f.paid) - Number(f.credited));
    const outstanding = outstandingNum.toFixed(2);
    const row = {
      ...r,
      paid: f.paid ?? "0",
      outstanding,
      effectiveStatus: effectiveStatus(r.status, r.dueDate, outstanding),
      customerName: r.customerName ?? "",
    } as InvoiceListRow;
    return row;
  });

  const total = totalRow[0]?.total ?? 0;

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getInvoiceDetail(companyId: string, id: string) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.companyId, companyId)));
  if (!invoice) return null;

  const [customer, items, charges, paymentRows, creditRows, linkedQuotation] =
    await Promise.all([
      db
        .select()
        .from(customers)
        .where(eq(customers.id, invoice.customerId))
        .then((r) => r[0] ?? null),
      db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, id))
        .orderBy(asc(invoiceItems.lineNo)),
      db
        .select()
        .from(documentCharges)
        .where(
          and(
            eq(documentCharges.documentType, "invoice"),
            eq(documentCharges.documentId, id)
          )
        )
        .orderBy(asc(documentCharges.sortOrder)),
      db
        .select({
          allocationId: paymentAllocations.id,
          amount: paymentAllocations.amount,
          paymentId: payments.id,
          paymentDate: payments.paymentDate,
          methodCode: payments.methodCode,
          status: payments.status,
          externalReference: payments.externalReference,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
        .where(eq(paymentAllocations.invoiceId, id))
        .orderBy(desc(payments.paymentDate)),
      db
        .select({
          id: creditNotes.id,
          number: creditNotes.creditNoteNumber,
          status: creditNotes.status,
          amount: creditNoteAllocations.amount,
          reason: creditNotes.reason,
        })
        .from(creditNoteAllocations)
        .innerJoin(creditNotes, eq(creditNotes.id, creditNoteAllocations.creditNoteId))
        .where(eq(creditNoteAllocations.invoiceId, id))
        .orderBy(desc(creditNotes.issueDate)),
      invoice.quotationId
        ? db
            .select({ id: quotations.id, number: quotations.quotationNumber })
            .from(quotations)
            .where(eq(quotations.id, invoice.quotationId))
            .then((r) => r[0] ?? null)
        : Promise.resolve(null),
    ]);

  const paid = paymentRows
    .filter((p) => p.status === "recorded")
    .reduce((acc, p) => acc + Number(p.amount), 0)
    .toFixed(2);
  const credited = creditRows
    .filter((c) => c.status !== "void" && c.status !== "draft")
    .reduce((acc, c) => acc + Number(c.amount), 0)
    .toFixed(2);
  const outstandingNum = Math.max(0, Number(invoice.grandTotal) - Number(paid) - Number(credited));

  return {
    invoice,
    customer,
    items,
    charges,
    payments: paymentRows,
    credits: creditRows,
    linkedQuotation,
    stats: {
      paid,
      credited,
      outstanding: outstandingNum.toFixed(2),
      status: effectiveStatus(invoice.status, invoice.dueDate, outstandingNum.toFixed(2)),
    },
  };
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoiceDetail>>>;

export async function getInvoiceFormOptions(companyId: string) {
  const [customerRows, productRows, rateRows, settings] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        defaultCurrency: customers.defaultCurrency,
        paymentTermsDays: customers.paymentTermsDays,
        taxExempt: customers.taxExempt,
      })
      .from(customers)
      .where(and(eq(customers.companyId, companyId), eq(customers.status, "active")))
      .orderBy(asc(customers.name))
      .limit(500),
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        unit: products.unit,
        unitPrice: products.unitPrice,
        discountType: products.discountType,
        discountValue: products.discountValue,
        taxRateId: products.taxRateId,
        description: products.description,
      })
      .from(products)
      .where(and(eq(products.companyId, companyId), eq(products.status, "active")))
      .orderBy(asc(products.name))
      .limit(1000),
    db
      .select({
        id: taxRates.id,
        code: taxRates.code,
        name: taxRates.name,
        rate: taxRates.rate,
        isInclusive: taxRates.isInclusive,
      })
      .from(taxRates)
      .where(and(eq(taxRates.companyId, companyId), eq(taxRates.active, true)))
      .orderBy(asc(taxRates.code)),
    db
      .select({
        defaultCurrency: businessSettings.defaultCurrency,
        invoiceDueDays: businessSettings.invoiceDueDays,
        paymentTermsDays: businessSettings.paymentTermsDays,
        defaultTerms: businessSettings.defaultTerms,
        taxTreatment: businessSettings.taxTreatment,
      })
      .from(businessSettings)
      .where(eq(businessSettings.companyId, companyId))
      .then((r) => r[0] ?? null),
  ]);

  return { customers: customerRows, products: productRows, rates: rateRows, settings };
}

/** Payment methods for the record-payment form. */
export async function getPaymentMethods(companyId: string) {
  return db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.companyId, companyId))
    .orderBy(asc(paymentMethods.sortOrder));
}
