import Link from "next/link";
import Decimal from "decimal.js";

import { Charts } from "./charts";
import { getDashboardData } from "@/lib/queries/dashboard";
import { requirePermission, getCompany } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatDate } from "@/lib/format";

/** Reads the session plus live financial data: rendered per request. */
export const instant = false;

export default async function DashboardPage() {
  await requirePermission(PERMISSIONS.DASHBOARD_VIEW);
  const company = await getCompany();
  const data = await getDashboardData(company.id);

  const statusOrder = ["draft", "issued", "sent", "accepted", "rejected", "expired", "converted", "cancelled"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Figures below are calculated from your documents and payment records.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Quotations this month"
          value={String(data.quotationsThisMonth)}
          hint={`${statusOrder.filter((s) => s !== "draft").reduce((sum, s) => sum + (data.quotationStatuses[s] ?? 0), 0)} lifetime non-draft`}
        />
        <Kpi
          label="Total invoiced"
          value={formatMoney(data.invoicedTotal)}
          hint="Issued invoice value (not cash)"
        />
        <Kpi
          label="Outstanding receivables"
          value={formatMoney(data.outstanding)}
          hint="Invoiced less payments less credits"
        />
        <Kpi
          label="Overdue"
          value={formatMoney(data.overdue.amount)}
          hint={`${data.overdue.count} invoice(s) past due date`}
          tone={data.overdue.count > 0 ? "danger" : undefined}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Collected this month"
          value={formatMoney(data.collectedThisMonth)}
          hint="Payments actually recorded"
        />
        <Kpi
          label="Conversion rate (this month)"
          value={data.conversionRate === null ? "—" : `${data.conversionRate.toFixed(0)}%`}
          hint="Quotations converted ÷ quotations decided"
        />
        <Kpi
          label="Recent activity"
          value={String(data.recentActivity.length)}
          hint="Audit events loaded below"
        />
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-500">Quick actions</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link className="font-medium text-slate-800 underline-offset-4 hover:underline" href="/quotations/new">
              + New quotation
            </Link>
            <Link className="font-medium text-slate-800 underline-offset-4 hover:underline" href="/invoices/new">
              + New invoice
            </Link>
            <Link className="font-medium text-slate-800 underline-offset-4 hover:underline" href="/customers/new">
              + New customer
            </Link>
          </div>
        </div>
      </div>

      <Charts monthly={data.monthly} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentDocuments.length === 0 ? (
              <Empty text="No documents yet. Create your first quotation." />
            ) : (
              data.recentDocuments.map((doc) => (
                <Link
                  key={`${doc.type}-${doc.id}`}
                  href={`/${doc.type === "quotation" ? "quotations" : "invoices"}/${doc.id}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {doc.number}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {doc.customer} · {formatDate(doc.date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {doc.status.replace("_", " ")}
                    </Badge>
                    <span className="text-sm tabular-nums text-slate-700">
                      {formatMoney(doc.total)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top customers by invoiced value</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topCustomers.length === 0 ? (
              <Empty text="No issued invoices yet." />
            ) : (
              data.topCustomers.map((c, idx) => (
                <Link
                  key={c.id}
                  href={`/customers/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">{idx + 1}</span>
                    <span className="truncate text-sm text-slate-800">{c.name}</span>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-slate-700">
                    {formatMoney(c.invoiced)}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming quotation expiries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.upcomingExpiries.length === 0 ? (
              <Empty text="Nothing expiring in the next 14 days." />
            ) : (
              data.upcomingExpiries.map((q) => (
                <Link
                  key={q.id}
                  href={`/quotations/${q.id}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{q.number}</p>
                    <p className="truncate text-xs text-slate-500">{q.customer}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-500">{formatDate(q.expiryDate)}</p>
                    <p className="text-sm tabular-nums text-slate-700">
                      {formatMoney(q.total)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length === 0 ? (
            <Empty text="No audit events yet." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-800">
                      <span className="font-medium">{a.action}</span>
                      <span className="text-slate-500"> · {a.entityType}</span>
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-slate-400">
                    {a.actor ?? "system"} · {new Date(a.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "danger";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${
          tone === "danger" ? "text-red-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-2 text-sm text-slate-400">{text}</p>;
}

export function __unusedDecimal() {
  return Decimal;
}
