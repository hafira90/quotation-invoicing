import { and, asc, desc, eq, gte, ilike, lte, or, sql, count } from "drizzle-orm";

import { db } from "@/db";
import {
  businessSettings,
  customers,
  documentCharges,
  invoiceItems,
  invoices,
  paymentMilestones,
  products,
  quotationItems,
  quotations,
  taxRates,
} from "@/db/schema";

export interface QuotationListParams {
  companyId: string;
  q?: string;
  status?: string;
  customerId?: string;
  from?: string;
  to?: string;
  sort?: "number" | "issueDate" | "total" | "created";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface QuotationListRow {
  id: string;
  quotationNumber: string;
  status: string;
  issueDate: string;
  expiryDate: string | null;
  grandTotal: string;
  currency: string;
  customerName: string;
  convertedAt: Date | null;
  createdAt: Date;
}

export const QUOTATION_STATUSES = [
  "draft",
  "issued",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "converted",
  "cancelled",
] as const;

export async function listQuotations(params: QuotationListParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 20));
  const q = params.q?.trim();

  const conditions = [eq(quotations.companyId, params.companyId)];

  if (params.status && params.status !== "all") {
    conditions.push(eq(quotations.status, params.status as never));
  }
  if (params.customerId) {
    conditions.push(eq(quotations.customerId, params.customerId));
  }
  if (params.from) conditions.push(gte(quotations.issueDate, params.from));
  if (params.to) conditions.push(lte(quotations.issueDate, params.to));

  if (q) {
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    conditions.push(
      or(
        ilike(quotations.quotationNumber, like),
        ilike(customers.name, like),
        ilike(quotations.customerPo, like)
      )!
    );
  }

  const where = and(...conditions);

  const sortColumn =
    params.sort === "issueDate"
      ? quotations.issueDate
      : params.sort === "total"
        ? quotations.grandTotal
        : params.sort === "created"
          ? quotations.createdAt
          : quotations.quotationNumber;
  const direction = params.dir === "asc" ? asc : desc;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: quotations.id,
        quotationNumber: quotations.quotationNumber,
        status: quotations.status,
        issueDate: quotations.issueDate,
        expiryDate: quotations.expiryDate,
        grandTotal: quotations.grandTotal,
        currency: quotations.currency,
        convertedAt: quotations.convertedAt,
        createdAt: quotations.createdAt,
        customerName: customers.name,
      })
      .from(quotations)
      .leftJoin(customers, eq(customers.id, quotations.customerId))
      .where(where)
      .orderBy(direction(sortColumn))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(quotations)
      .leftJoin(customers, eq(customers.id, quotations.customerId))
      .where(where),
  ]);
  const total = totalRow[0]?.total ?? 0;

  return {
    items: rows as QuotationListRow[],
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getQuotationDetail(companyId: string, id: string) {
  const [quotation] = await db
    .select()
    .from(quotations)
    .where(and(eq(quotations.id, id), eq(quotations.companyId, companyId)));
  if (!quotation) return null;

  const [customer, items, charges, milestones, linkedInvoice] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(eq(customers.id, quotation.customerId))
      .then((r) => r[0] ?? null),
    db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, id))
      .orderBy(asc(quotationItems.lineNo)),
    db
      .select()
      .from(documentCharges)
      .where(
        and(
          eq(documentCharges.documentType, "quotation"),
          eq(documentCharges.documentId, id)
        )
      )
      .orderBy(asc(documentCharges.sortOrder)),
    db
      .select()
      .from(paymentMilestones)
      .where(
        and(
          eq(paymentMilestones.documentType, "quotation"),
          eq(paymentMilestones.documentId, id)
        )
      )
      .orderBy(asc(paymentMilestones.sortOrder)),
    db
      .select({ id: invoices.id, number: invoices.invoiceNumber, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.quotationId, id))
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);

  return { quotation, customer, items, charges, milestones, linkedInvoice };
}

export type QuotationDetail = NonNullable<Awaited<ReturnType<typeof getQuotationDetail>>>;

/**
 * Data for the quotation form: pickers plus company defaults (currency,
 * validity period, standard terms) for a new document.
 */
export async function getQuotationFormOptions(companyId: string) {
  const [customerRows, productRows, rateRows, settings] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        defaultCurrency: customers.defaultCurrency,
        paymentTermsDays: customers.paymentTermsDays,
        taxTreatment: customers.taxTreatment,
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
        quotationValidityDays: businessSettings.quotationValidityDays,
        defaultTerms: businessSettings.defaultTerms,
        taxTreatment: businessSettings.taxTreatment,
      })
      .from(businessSettings)
      .where(eq(businessSettings.companyId, companyId))
      .then((r) => r[0] ?? null),
  ]);

  return { customers: customerRows, products: productRows, rates: rateRows, settings };
}
