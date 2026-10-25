import Link from "next/link";
import type { Metadata } from "next";

import { listQuotations, QUOTATION_STATUSES } from "@/lib/queries/quotations";
import { getCompany, requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDate, formatMoney } from "@/lib/format";
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

export const metadata: Metadata = { title: "Quotations" };
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
  accepted: "default",
  rejected: "destructive",
  expired: "destructive",
  converted: "default",
  cancelled: "secondary",
};

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePermission(PERMISSIONS.QUOTATION_VIEW);
  const company = await getCompany();
  const sp = await searchParams;

  const result = await listQuotations({
    companyId: company.id,
    q: sp.q,
    status: sp.status,
    from: sp.from,
    to: sp.to,
    sort: (sp.sort as "number" | "issueDate" | "total" | "created") ?? "created",
    dir: (sp.dir as "asc" | "desc") ?? "desc",
    page: Number(sp.page ?? 1) || 1,
    pageSize: 20,
  });

  const qs = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: sp.q, status: sp.status, from: sp.from, to: sp.to, sort: sp.sort, dir: sp.dir, page: sp.page, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "all") params.set(k, v);
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Quotations</h1>
          <p className="mt-1 text-sm text-slate-500">
            {result.total} quotation{result.total === 1 ? "" : "s"}
          </p>
        </div>
        <Button size="sm" render={<Link href="/quotations/new" />}>
          New quotation
        </Button>
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
            <SelectTrigger id="status" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {QUOTATION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="capitalize">{s}</span>
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
        {sp.q || sp.status ? (
          <Button type="button" variant="ghost" render={<Link href="/quotations" />}>
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
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                  {sp.q ? (
                    <>
                      No quotations match “{sp.q}”.{" "}
                      <Link href="/quotations" className="font-medium text-slate-700 underline">
                        Clear search
                      </Link>
                    </>
                  ) : (
                    <>
                      No quotations yet.{" "}
                      <Link href="/quotations/new" className="font-medium text-slate-700 underline">
                        Create the first one
                      </Link>
                      .
                    </>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              result.items.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <Link href={`/quotations/${q.id}`} className="font-medium text-slate-900 hover:underline">
                      {q.quotationNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">{q.customerName}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[q.status] ?? "outline"} className="capitalize">
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{formatDate(q.issueDate)}</TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {q.expiryDate ? formatDate(q.expiryDate) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-slate-800">
                    {formatMoney(q.grandTotal, q.currency)}
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
              <Button variant="outline" size="sm" render={<Link href={qs({ page: String(result.page - 1) })} />}>
                Previous
              </Button>
            ) : (
              <span className={buttonVariants({ variant: "outline", size: "sm", className: "pointer-events-none opacity-50" })}>
                Previous
              </span>
            )}
            {result.page < result.totalPages ? (
              <Button variant="outline" size="sm" render={<Link href={qs({ page: String(result.page + 1) })} />}>
                Next
              </Button>
            ) : (
              <span className={buttonVariants({ variant: "outline", size: "sm", className: "pointer-events-none opacity-50" })}>
                Next
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
