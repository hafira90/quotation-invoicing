import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import {
  INVOICE_STATUSES,
  listInvoices,
  type InvoiceListParams,
} from "@/lib/queries/invoices";
import { getCompany, requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Invoices" };
export const instant = false;

type Search = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  issued: "secondary",
  sent: "secondary",
  partially_paid: "secondary",
  paid: "default",
  overdue: "destructive",
  void: "destructive",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePermission(PERMISSIONS.INVOICE_VIEW);
  const company = await getCompany();
  const sp = await searchParams;

  const result = await listInvoices({
    companyId: company.id,
    q: sp.q,
    status: sp.status,
    from: sp.from,
    to: sp.to,
    sort: (sp.sort as InvoiceListParams["sort"]) ?? "created",
    dir: (sp.dir as InvoiceListParams["dir"]) ?? "desc",
    page: Number(sp.page ?? 1) || 1,
    pageSize: 20,
  });

  const qs = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      q: sp.q,
      status: sp.status,
      from: sp.from,
      to: sp.to,
      sort: sp.sort,
      dir: sp.dir,
      page: sp.page,
      ...patch,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== "all") params.set(key, value);
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  };

  const hasFilters = Boolean(sp.q || sp.status || sp.from || sp.to);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Invoices</h1>
        <p className="mt-1 text-sm text-slate-500">
          {result.total} invoice{result.total === 1 ? "" : "s"}
        </p>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <label htmlFor="q" className="text-sm font-medium text-slate-700">
            Search
          </label>
          <Input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Number, customer or PO…" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="status" className="text-sm font-medium text-slate-700">
            Status
          </label>
          <Select name="status" defaultValue={sp.status ?? "all"}>
            <SelectTrigger id="status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {INVOICE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  <span className="capitalize">{status.replaceAll("_", " ")}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="from" className="text-sm font-medium text-slate-700">
            From
          </label>
          <Input id="from" name="from" type="date" defaultValue={sp.from ?? ""} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="to" className="text-sm font-medium text-slate-700">
            To
          </label>
          <Input id="to" name="to" type="date" defaultValue={sp.to ?? ""} />
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {hasFilters ? (
          <Button type="button" variant="ghost" render={<Link href="/invoices" />}>
            Clear
          </Button>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">
                  {sp.q ? (
                    <>
                      No invoices match “{sp.q}”.{" "}
                      <Link href="/invoices" className="font-medium text-slate-700 underline">
                        Clear search
                      </Link>
                    </>
                  ) : (
                    "No invoices yet."
                  )}
                </TableCell>
              </TableRow>
            ) : (
              result.items.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium text-slate-900">
                    {invoice.invoiceNumber}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">{invoice.customerName}</TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_BADGE[invoice.effectiveStatus] ?? "outline"}
                      className="capitalize"
                    >
                      {invoice.effectiveStatus.replaceAll("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {formatDate(invoice.issueDate)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {formatDate(invoice.dueDate)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-slate-800">
                    {formatMoney(invoice.grandTotal, invoice.currency)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-slate-800">
                    {formatMoney(invoice.paid, invoice.currency)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-slate-800">
                    {formatMoney(invoice.outstanding, invoice.currency)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {result.totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {result.page} of {result.totalPages}
          </p>
          <div className="flex gap-2">
            {result.page > 1 ? (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={qs({ page: String(result.page - 1) })} />}
              >
                Previous
              </Button>
            ) : (
              <span
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "pointer-events-none opacity-50",
                })}
              >
                Previous
              </span>
            )}
            {result.page < result.totalPages ? (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={qs({ page: String(result.page + 1) })} />}
              >
                Next
              </Button>
            ) : (
              <span
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "pointer-events-none opacity-50",
                })}
              >
                Next
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
