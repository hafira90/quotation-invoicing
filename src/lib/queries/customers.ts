import { and, asc, desc, eq, ilike, or, sql, count } from "drizzle-orm";

import { db } from "@/db";
import {
  creditNotes,
  customers,
  invoices,
  paymentAllocations,
  payments,
  quotations,
} from "@/db/schema";

export interface CustomerListParams {
  companyId: string;
  q?: string;
  status?: "active" | "archived" | "all";
  type?: "individual" | "company" | "all";
  sort?: "name" | "created" | "updated";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface CustomerListRow {
  id: string;
  name: string;
  customerType: "individual" | "company";
  email: string | null;
  phone: string | null;
  registrationNumber: string | null;
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
  invoiceCount: number;
  invoicedTotal: string;
}

export async function listCustomers(params: CustomerListParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 20));
  const q = params.q?.trim();

  const conditions = [eq(customers.companyId, params.companyId)];

  if (params.status && params.status !== "all") {
    conditions.push(eq(customers.status, params.status));
  } else if (!params.status) {
    // Default view shows active customers only.
    conditions.push(eq(customers.status, "active"));
  }

  if (params.type && params.type !== "all") {
    conditions.push(eq(customers.customerType, params.type));
  }

  if (q) {
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    conditions.push(
      or(
        ilike(customers.name, like),
        ilike(customers.email, like),
        ilike(customers.registrationNumber, like),
        ilike(customers.phone, like),
        ilike(customers.contactPerson, like)
      )!
    );
  }

  const where = and(...conditions);

  const sortColumn =
    params.sort === "created"
      ? customers.createdAt
      : params.sort === "updated"
        ? customers.updatedAt
        : customers.name;
  const direction = params.dir === "desc" ? desc : asc;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        customerType: customers.customerType,
        email: customers.email,
        phone: customers.phone,
        registrationNumber: customers.registrationNumber,
        status: customers.status,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
      })
      .from(customers)
      .where(where)
      .orderBy(direction(sortColumn))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(customers).where(where),
  ]);

  // Lifetime invoiced totals for the visible page (one grouped query).
  const ids = rows.map((r) => r.id);
  const totals = ids.length
    ? await db
        .select({
          customerId: invoices.customerId,
          n: sql<number>`count(*) filter (where ${invoices.status} not in ('draft','void'))::int`,
          total: sql<string>`coalesce(sum(${invoices.grandTotal}) filter (where ${invoices.status} not in ('draft','void')), 0)::text`,
        })
        .from(invoices)
        .where(sql`${invoices.customerId} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`)
        .groupBy(invoices.customerId)
    : [];

  const total = totalRow[0]?.total ?? 0;

  const items: CustomerListRow[] = rows.map((r) => {
    const t = totals.find((x) => x.customerId === r.id);
    return {
      ...r,
      invoiceCount: Number(t?.n ?? 0),
      invoicedTotal: t?.total ?? "0",
    };
  });

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getCustomerDetail(companyId: string, customerId: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.companyId, companyId)));
  if (!customer) return null;

  const [recentInvoices, recentQuotations, paymentsAgg, creditAgg, paidAgg] =
    await Promise.all([
      db
        .select({
          id: invoices.id,
          number: invoices.invoiceNumber,
          status: invoices.status,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          grandTotal: invoices.grandTotal,
        })
        .from(invoices)
        .where(eq(invoices.customerId, customerId))
        .orderBy(desc(invoices.issueDate))
        .limit(10),
      db
        .select({
          id: quotations.id,
          number: quotations.quotationNumber,
          status: quotations.status,
          issueDate: quotations.issueDate,
          expiryDate: quotations.expiryDate,
          grandTotal: quotations.grandTotal,
        })
        .from(quotations)
        .where(eq(quotations.customerId, customerId))
        .orderBy(desc(quotations.issueDate))
        .limit(10),
      db
        .select({
          n: sql<number>`count(*)::int`,
          total: sql<string>`coalesce(sum(${payments.amount}), 0)::text`,
        })
        .from(payments)
        .where(eq(payments.customerId, customerId)),
      db
        .select({ total: sql<string>`coalesce(sum(${creditNotes.creditTotal}), 0)::text` })
        .from(creditNotes)
        .where(eq(creditNotes.customerId, customerId)),
      db
        .select({
          total: sql<string>`coalesce(sum(${paymentAllocations.amount}), 0)::text`,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
        .where(eq(payments.customerId, customerId)),
    ]);

  const invoicedAgg = await db
    .select({
      n: sql<number>`count(*) filter (where ${invoices.status} not in ('draft','void'))::int`,
      total: sql<string>`coalesce(sum(${invoices.grandTotal}) filter (where ${invoices.status} not in ('draft','void')), 0)::text`,
    })
    .from(invoices)
    .where(eq(invoices.customerId, customerId));

  const invoicedTotal = invoicedAgg[0]?.total ?? "0";
  const settled = paidAgg[0]?.total ?? "0";
  const credited = creditAgg[0]?.total ?? "0";
  const outstandingValue = Math.max(
    0,
    Number(invoicedTotal) - Number(settled) - Number(credited)
  );

  return {
    customer,
    stats: {
      invoiceCount: Number(invoicedAgg[0]?.n ?? 0),
      invoicedTotal,
      paymentCount: Number(paymentsAgg[0]?.n ?? 0),
      paidTotal: settled,
      creditedTotal: credited,
      outstanding: outstandingValue.toFixed(2),
    },
    recentInvoices,
    recentQuotations,
  };
}
