import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QuotationActions } from "./actions";
import { getQuotationDetail } from "@/lib/queries/quotations";
import { getCompany, getSessionUser, requirePermission } from "@/lib/session";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { formatDate, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Quotation" };
export const instant = false;

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  issued: "secondary",
  sent: "secondary",
  accepted: "default",
  rejected: "destructive",
  expired: "destructive",
  converted: "default",
  cancelled: "secondary",
};

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.QUOTATION_VIEW);
  const company = await getCompany();
  const user = await getSessionUser();
  const { id } = await params;

  const detail = await getQuotationDetail(company.id, id);
  if (!detail) notFound();

  const { quotation: q, customer, items, charges, milestones, linkedInvoice } = detail;
  const perms = user?.permissions ?? [];

  const flags = {
    status: q.status,
    canEdit: q.status === "draft" && hasPermission(perms, PERMISSIONS.QUOTATION_EDIT),
    canIssue: q.status === "draft" && hasPermission(perms, PERMISSIONS.QUOTATION_ISSUE),
    canSend: q.status === "issued" && hasPermission(perms, PERMISSIONS.QUOTATION_ISSUE),
    canDecide:
      (q.status === "issued" || q.status === "sent") &&
      hasPermission(perms, PERMISSIONS.QUOTATION_DECIDE),
    canConvert: q.status === "accepted" && hasPermission(perms, PERMISSIONS.QUOTATION_CONVERT),
    canCancel:
      q.status !== "converted" &&
      q.status !== "cancelled" &&
      hasPermission(perms, PERMISSIONS.QUOTATION_ARCHIVE),
    canDuplicate: hasPermission(perms, PERMISSIONS.QUOTATION_CREATE),
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {q.quotationNumber}
            </h1>
            <Badge variant={STATUS_BADGE[q.status] ?? "outline"} className="capitalize">
              {q.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Issued {formatDate(q.issueDate)}
            {q.expiryDate ? ` · expires ${formatDate(q.expiryDate)}` : ""}
            {q.customerPo ? ` · PO ${q.customerPo}` : ""}
          </p>
        </div>
      </div>

      <QuotationActions id={q.id} flags={flags} />

      {linkedInvoice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Converted to invoice{" "}
          <Link href={`/invoices/${linkedInvoice.id}`} className="font-medium underline">
            {linkedInvoice.number}
          </Link>{" "}
          ({linkedInvoice.status}).
        </p>
      ) : null}

      {q.status === "accepted" && q.acceptanceName ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Accepted by {q.acceptanceName}
          {q.acceptanceDesignation ? `, ${q.acceptanceDesignation}` : ""}
          {q.acceptedAt ? ` on ${formatDate(q.acceptedAt.toISOString().slice(0, 10))}` : ""}.
        </p>
      ) : null}
      {q.status === "rejected" && q.rejectionReason ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Rejected: {q.rejectionReason}
        </p>
      ) : null}

      {/* Parties ------------------------------------------------------- */}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Customer
          </h2>
          <p className="mt-1 font-medium text-slate-900">{customer?.name ?? "—"}</p>
          {customer?.billingAddress ? (
            <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
              {customer.billingAddress}
            </p>
          ) : null}
          {customer?.email ? (
            <p className="text-sm text-slate-600">{customer.email}</p>
          ) : null}
        </div>
        <div className="sm:text-right">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Document
          </h2>
          <dl className="mt-1 space-y-1 text-sm text-slate-700">
            <div className="flex justify-between gap-6 sm:justify-end">
              <dt className="text-slate-500">Currency</dt>
              <dd>{q.currency}</dd>
            </div>
            <div className="flex justify-between gap-6 sm:justify-end">
              <dt className="text-slate-500">Issue date</dt>
              <dd>{formatDate(q.issueDate)}</dd>
            </div>
            <div className="flex justify-between gap-6 sm:justify-end">
              <dt className="text-slate-500">Valid until</dt>
              <dd>{q.expiryDate ? formatDate(q.expiryDate) : "—"}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Lines --------------------------------------------------------- */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 text-right font-medium">Qty</th>
              <th className="px-4 py-2 text-right font-medium">Price</th>
              <th className="px-4 py-2 text-right font-medium">Disc</th>
              <th className="px-4 py-2 text-right font-medium">Tax</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((line, i) => (
              <tr key={line.id} className="border-t border-slate-100">
                <td className="px-4 py-2 tabular-nums text-slate-400">{i + 1}</td>
                <td className="px-4 py-2">
                  <p className="font-medium text-slate-900">
                    {line.sku ? `${line.sku} — ` : ""}
                    {line.name}
                  </p>
                  {line.description ? (
                    <p className="mt-0.5 whitespace-pre-line text-xs text-slate-500">
                      {line.description}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {line.quantity} {line.unit}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatMoney(line.unitPrice, q.currency)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                  {line.discountType === "percent"
                    ? `${line.discountValue}%`
                    : line.discountType === "amount"
                      ? formatMoney(line.discountValue, q.currency)
                      : "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                  {Number(line.taxRate) > 0 ? `${line.taxRate}%` : "—"}
                  <span className="block text-xs text-slate-400">
                    {formatMoney(line.taxAmount, q.currency)}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-900">
                  {formatMoney(line.lineTotal, q.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals + text ------------------------------------------------ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {charges.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Charges
              </h2>
              <ul className="mt-2 space-y-1">
                {charges.map((c) => (
                  <li key={c.id} className="flex justify-between">
                    <span className="text-slate-600">
                      {c.label}
                      {c.taxable ? " (taxable)" : ""}
                    </span>
                    <span className="tabular-nums">{formatMoney(c.amount, q.currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {milestones.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Payment milestones
              </h2>
              <ul className="mt-2 space-y-1">
                {milestones.map((m) => (
                  <li key={m.id} className="flex justify-between gap-4">
                    <span className="text-slate-600">
                      {m.label}
                      {m.dueOn ? ` · due ${formatDate(m.dueOn)}` : ""}
                    </span>
                    <span className="tabular-nums">{m.percent}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {q.terms ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Terms &amp; conditions
              </h2>
              <p className="mt-2 whitespace-pre-line text-slate-700">{q.terms}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="space-y-1 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="tabular-nums">{formatMoney(q.subtotal, q.currency)}</span>
            </div>
            {Number(q.discountTotal) > 0 ? (
              <div className="flex justify-between">
                <span className="text-slate-500">Discount</span>
                <span className="tabular-nums text-red-600">
                  −{formatMoney(q.discountTotal, q.currency)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-slate-500">Charges</span>
              <span className="tabular-nums">{formatMoney(q.shippingTotal, q.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tax</span>
              <span className="tabular-nums">{formatMoney(q.taxTotal, q.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <span>Grand total</span>
              <span className="tabular-nums">{formatMoney(q.grandTotal, q.currency)}</span>
            </div>
          </div>

          {q.notes ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Notes to customer
              </h2>
              <p className="mt-2 whitespace-pre-line text-slate-700">{q.notes}</p>
            </div>
          ) : null}

          {q.internalNotes ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                Internal notes — never printed
              </h2>
              <p className="mt-2 whitespace-pre-line text-amber-900">{q.internalNotes}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
