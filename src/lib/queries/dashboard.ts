import Decimal from "decimal.js";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, customers, invoices, quotations } from "@/db/schema";
import { desc, eq, gte, inArray, lte } from "drizzle-orm";

/**
 * Dashboard metrics.
 *
 * Accounting terms are kept distinct on purpose:
 *  - "invoiced"      = gross value of issued invoices (a claim, not cash)
 *  - "outstanding"   = invoiced minus payments minus applied credits
 *  - "collected"     = cash actually recorded against invoices
 *  - "overdue"       = outstanding where the due date has passed
 * Nothing here treats those as interchangeable.
 */

const NON_ISSUED = ["draft"] as const;
const EXCLUDED_FROM_BALANCE = ["draft", "void"] as const;

export interface DashboardData {
  quotationsThisMonth: number;
  quotationStatuses: Record<string, number>;
  invoicedTotal: string;
  outstanding: string;
  overdue: { count: number; amount: string };
  collectedThisMonth: string;
  conversionRate: number | null;
  topCustomers: { id: string; name: string; invoiced: string; count: number }[];
  recentDocuments: {
    id: string;
    type: "quotation" | "invoice";
    number: string;
    status: string;
    total: string;
    date: string;
    customer: string;
  }[];
  upcomingExpiries: {
    id: string;
    number: string;
    customer: string;
    expiryDate: string;
    total: string;
  }[];
  monthly: { month: string; invoiced: number; collected: number }[];
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    actor: string | null;
    createdAt: string;
  }[];
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getDashboardData(companyId: string): Promise<DashboardData> {
  const now = new Date();
  const monthStart = startOfMonth(now);

  const [
    quotationAgg,
    balanceAgg,
    collectedAgg,
    conversionAgg,
    topCustomers,
    recentDocs,
    expiries,
    monthlyInvoiced,
    monthlyCollected,
    activity,
  ] = await Promise.all([
    // Quotation counts this month + status breakdown.
    db.execute(sql`
      with counts as (
        select status, count(*)::int as n
        from quotations
        where company_id = ${companyId}
        group by status
      ), this_month as (
        select count(*)::int as c
        from quotations
        where company_id = ${companyId}
          and issue_date >= ${monthStart.toISOString().slice(0, 10)}
      )
      select
        (select c from this_month) as this_month,
        coalesce((select jsonb_object_agg(status, n) from counts), '{}'::jsonb) as statuses
    `),

    // Receivables: issued invoice totals minus live payments minus applied credits.
    db.execute(sql`
      with paid as (
        select pa.invoice_id, sum(pa.amount) as amount
        from payment_allocations pa
        join payments p on p.id = pa.payment_id and p.status = 'recorded'
        group by pa.invoice_id
      ), credited as (
        select cna.invoice_id, sum(cna.amount) as amount
        from credit_note_allocations cna
        join credit_notes cn on cn.id = cna.credit_note_id and cn.status <> 'void'
        group by cna.invoice_id
      )
      select
        coalesce(sum(i.grand_total), 0)::text as invoiced_total,
        coalesce(sum(i.grand_total - coalesce(paid.amount, 0) - coalesce(credited.amount, 0)), 0)::text as outstanding,
        coalesce(sum(
          case when i.due_date is not null and i.due_date < ${now.toISOString().slice(0, 10)}
                 and i.grand_total - coalesce(paid.amount, 0) - coalesce(credited.amount, 0) > 0
               then i.grand_total - coalesce(paid.amount, 0) - coalesce(credited.amount, 0)
               else 0 end
        ), 0)::text as overdue_amount,
        count(*) filter (
          where i.due_date is not null and i.due_date < ${now.toISOString().slice(0, 10)}
            and i.grand_total - coalesce(paid.amount, 0) - coalesce(credited.amount, 0) > 0
        )::int as overdue_count
      from invoices i
      left join paid on paid.invoice_id = i.id
      left join credited on credited.invoice_id = i.id
      where i.company_id = ${companyId}
        and i.status not in ('draft', 'void')
    `),

    // Cash recorded this month.
    db.execute(sql`
      select coalesce(sum(amount), 0)::text as collected
      from payments
      where company_id = ${companyId}
        and status = 'recorded'
        and payment_date >= ${monthStart.toISOString().slice(0, 10)}
    `),

    // Conversion: converted quotations over quotations that reached a decision.
    db.execute(sql`
      select
        count(*) filter (where status = 'converted')::int as converted,
        count(*) filter (where status in ('accepted','rejected','converted'))::int as decided
      from quotations
      where company_id = ${companyId}
        and issue_date >= ${monthStart.toISOString().slice(0, 10)}
    `),

    // Top customers by invoiced value.
    db.execute(sql`
      select c.id, c.name,
             coalesce(sum(i.grand_total), 0)::text as invoiced,
             count(i.id)::int as count
      from invoices i
      join customers c on c.id = i.customer_id
      where i.company_id = ${companyId}
        and i.status not in ('draft', 'void')
      group by c.id, c.name
      order by sum(i.grand_total) desc
      limit 5
    `),

    // Recently created/updated documents across both types.
    (async () => {
      const [q, i] = await Promise.all([
        db
          .select({
            id: quotations.id,
            number: quotations.quotationNumber,
            status: quotations.status,
            total: quotations.grandTotal,
            date: quotations.issueDate,
            customerName: customers.name,
            updatedAt: quotations.updatedAt,
          })
          .from(quotations)
          .innerJoin(customers, eq(customers.id, quotations.customerId))
          .where(eq(quotations.companyId, companyId))
          .orderBy(desc(quotations.updatedAt))
          .limit(5),
        db
          .select({
            id: invoices.id,
            number: invoices.invoiceNumber,
            status: invoices.status,
            total: invoices.grandTotal,
            date: invoices.issueDate,
            customerName: customers.name,
            updatedAt: invoices.updatedAt,
          })
          .from(invoices)
          .innerJoin(customers, eq(customers.id, invoices.customerId))
          .where(eq(invoices.companyId, companyId))
          .orderBy(desc(invoices.updatedAt))
          .limit(5),
      ]);

      return [...q.map((r) => ({ ...r, type: "quotation" as const })),
             ...i.map((r) => ({ ...r, type: "invoice" as const }))]
        .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
        .slice(0, 8);
    })(),

    // Quotations expiring in the next 14 days.
    db
      .select({
        id: quotations.id,
        number: quotations.quotationNumber,
        customer: customers.name,
        expiryDate: quotations.expiryDate,
        total: quotations.grandTotal,
      })
      .from(quotations)
      .innerJoin(customers, eq(customers.id, quotations.customerId))
      .where(
        inArray(quotations.status, ["issued", "sent"]) &&
          gte(quotations.expiryDate, now.toISOString().slice(0, 10)) &&
          lte(
            quotations.expiryDate,
            new Date(now.getTime() + 14 * 86400_000).toISOString().slice(0, 10)
          ) &&
          eq(quotations.companyId, companyId)
      )
      .orderBy(quotations.expiryDate)
      .limit(6),

    // 12 months of invoiced value.
    db.execute(sql`
      select to_char(date_trunc('month', issue_date), 'YYYY-MM') as month,
             coalesce(sum(grand_total), 0)::float as total
      from invoices
      where company_id = ${companyId}
        and status not in ('draft','void')
        and issue_date >= ${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))
          .toISOString()
          .slice(0, 10)}
      group by 1
      order by 1
    `),

    // 12 months of collections.
    db.execute(sql`
      select to_char(date_trunc('month', payment_date), 'YYYY-MM') as month,
             coalesce(sum(amount), 0)::float as total
      from payments
      where company_id = ${companyId}
        and status = 'recorded'
        and payment_date >= ${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))
          .toISOString()
          .slice(0, 10)}
      group by 1
      order by 1
    `),

    // Recent audit events.
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        actor: auditLogs.actorLabel,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.companyId, companyId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(8),
  ]);

  const statusRow = quotationAgg.rows[0] as {
    this_month: number;
    statuses: Record<string, number>;
  };
  const balanceRow = balanceAgg.rows[0] as {
    invoiced_total: string;
    outstanding: string;
    overdue_amount: string;
    overdue_count: number;
  };
  const collectedRow = collectedAgg.rows[0] as { collected: string };
  const conversionRow = conversionAgg.rows[0] as {
    converted: number;
    decided: number;
  };

  // Build a continuous 12-month series so the charts have no gaps.
  const invoicedMap = new Map(
    (monthlyInvoiced.rows as { month: string; total: string }[]).map((r) => [
      r.month,
      new Decimal(r.total ?? 0).toNumber(),
    ])
  );
  const collectedMap = new Map(
    (monthlyCollected.rows as { month: string; total: string }[]).map((r) => [
      r.month,
      new Decimal(r.total ?? 0).toNumber(),
    ])
  );

  const monthly: DashboardData["monthly"] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(d);
    monthly.push({
      month: key,
      invoiced: invoicedMap.get(key) ?? 0,
      collected: collectedMap.get(key) ?? 0,
    });
  }

  void NON_ISSUED;
  void EXCLUDED_FROM_BALANCE;

  return {
    quotationsThisMonth: statusRow.this_month ?? 0,
    quotationStatuses: statusRow.statuses ?? {},
    invoicedTotal: balanceRow.invoiced_total ?? "0",
    outstanding: balanceRow.outstanding ?? "0",
    overdue: {
      count: Number(balanceRow.overdue_count ?? 0),
      amount: balanceRow.overdue_amount ?? "0",
    },
    collectedThisMonth: collectedRow.collected ?? "0",
    conversionRate:
      conversionRow.decided > 0
        ? (conversionRow.converted / conversionRow.decided) * 100
        : null,
    topCustomers: (topCustomers.rows as {
      id: string;
      name: string;
      invoiced: string;
      count: number;
    }[]).map((r) => ({
      id: r.id,
      name: r.name,
      invoiced: r.invoiced,
      count: Number(r.count),
    })),
    recentDocuments: recentDocs.map((d) => ({
      id: d.id,
      type: d.type,
      number: d.number,
      status: d.status,
      total: d.total,
      date: String(d.date ?? ""),
      customer: d.customerName,
    })),
    upcomingExpiries: (expiries as {
      id: string;
      number: string;
      customer: string;
      expiryDate: string | null;
      total: string;
    }[]).map((e) => ({
      id: e.id,
      number: e.number,
      customer: e.customer,
      expiryDate: e.expiryDate ?? "",
      total: e.total,
    })),
    monthly,
    recentActivity: (
      activity as {
        id: string;
        action: string;
        entityType: string;
        actor: string | null;
        createdAt: Date | null;
      }[]
    ).map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      actor: a.actor,
      createdAt: a.createdAt?.toISOString() ?? "",
    })),
  };
}
