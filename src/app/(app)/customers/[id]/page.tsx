import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomerRowActions } from "../row-actions";
import { getCustomerDetail } from "@/lib/queries/customers";
import { getCompany, requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDate, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Customer" };
export const instant = false;

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.CUSTOMER_VIEW);
  const company = await getCompany();
  const { id } = await params;

  const detail = await getCustomerDetail(company.id, id);
  if (!detail) notFound();

  const { customer, stats, recentInvoices, recentQuotations } = detail;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {customer.name}
            </h1>
            <Badge variant="outline" className="capitalize">
              {customer.customerType}
            </Badge>
            {customer.status === "archived" ? <Badge variant="secondary">Archived</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {customer.registrationNumber ? `Reg. ${customer.registrationNumber} · ` : ""}
            Created {formatDate(customer.createdAt.toISOString().slice(0, 10))}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<Link href={`/customers/${customer.id}/edit`} />}>
            Edit
          </Button>
          <CustomerRowActions id={customer.id} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Invoiced (lifetime)" value={formatMoney(stats.invoicedTotal)} hint={`${stats.invoiceCount} invoice(s)`} />
        <Stat label="Outstanding" value={formatMoney(stats.outstanding)} hint="After payments and credits" />
        <Stat label="Payments received" value={formatMoney(stats.paidTotal)} hint={`${stats.paymentCount} payment(s)`} />
        <Stat label="Credit notes" value={formatMoney(stats.creditedTotal)} hint="Applied + unapplied" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact & details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Field label="Legal name" value={customer.legalName} />
            <Field label="Contact person" value={customer.contactPerson} />
            <Field label="Customer reference" value={customer.customerReference} />
            <Field label="Email" value={customer.email} />
            <Field label="Phone" value={customer.phone} />
            <Field label="Tax registration" value={customer.taxRegistrationNumber} />
            <Field
              label="Payment terms"
              value={customer.paymentTermsDays != null ? `${customer.paymentTermsDays} days` : null}
            />
            <Field label="Tax treatment" value={customer.taxTreatment} />
            <Field label="Tax exempt" value={customer.taxExempt ? "Yes" : "No"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Addresses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Billing</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">
                {customer.billingAddress || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Shipping / service</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">
                {customer.shippingAddress || customer.billingAddress || "—"}
              </p>
            </div>
            {customer.notes ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Internal notes</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{customer.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent quotations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentQuotations.length === 0 ? (
              <p className="text-sm text-slate-400">No quotations yet.</p>
            ) : (
              recentQuotations.map((q) => (
                <Link
                  key={q.id}
                  href={`/quotations/${q.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-slate-800">{q.number}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {q.status}
                    </Badge>
                    <span className="text-sm tabular-nums text-slate-700">
                      {formatMoney(q.grandTotal)}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-slate-400">No invoices yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentInvoices.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/invoices/${i.id}`}
                    className="flex items-center justify-between gap-3 py-2 hover:bg-slate-50"
                  >
                    <span className="text-sm font-medium text-slate-800">{i.number}</span>
                    <span className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500">{formatDate(i.issueDate)}</span>
                      <Badge variant="outline" className="capitalize">
                        {i.status.replace("_", " ")}
                      </Badge>
                      <span className="tabular-nums text-slate-700">
                        {formatMoney(i.grandTotal)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-800">{value || "—"}</span>
    </div>
  );
}
