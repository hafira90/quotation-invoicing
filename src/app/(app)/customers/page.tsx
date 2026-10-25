import Link from "next/link";
import type { Metadata } from "next";

import { CustomerRowActions } from "./row-actions";
import { listCustomers } from "@/lib/queries/customers";
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

export const metadata: Metadata = { title: "Customers" };
export const instant = false;

type Search = {
  q?: string;
  status?: string;
  type?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePermission(PERMISSIONS.CUSTOMER_VIEW);
  const company = await getCompany();
  const sp = await searchParams;

  const result = await listCustomers({
    companyId: company.id,
    q: sp.q,
    status: (sp.status as "active" | "archived" | "all") ?? "active",
    type: (sp.type as "individual" | "company" | "all") ?? "all",
    sort: (sp.sort as "name" | "created" | "updated") ?? "updated",
    dir: (sp.dir as "asc" | "desc") ?? "desc",
    page: Number(sp.page ?? 1) || 1,
    pageSize: 20,
  });

  const canCreate = true; // enforced below via the same permission set

  const qs = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      q: sp.q,
      status: sp.status,
      type: sp.type,
      sort: sp.sort,
      dir: sp.dir,
      page: sp.page,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all") params.set(k, v);
    }
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            {result.total} customer{result.total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<a href="/api/customers/export" />}>
            Export CSV
          </Button>
          <Button size="sm" render={<Link href="/customers/new" />}>
            New customer
          </Button>
        </div>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1 space-y-1.5">
          <label htmlFor="q" className="text-sm font-medium text-slate-700">
            Search
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Name, email, registration no., phone…"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="status" className="text-sm font-medium text-slate-700">
            Status
          </label>
          <Select name="status" defaultValue={sp.status ?? "active"}>
            <SelectTrigger id="status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="type" className="text-sm font-medium text-slate-700">
            Type
          </label>
          <Select name="type" defaultValue={sp.type ?? "all"}>
            <SelectTrigger id="type" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="company">Company</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {sp.q ? (
          <Button type="button" variant="ghost" render={<Link href="/customers" />}>
            Clear
          </Button>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Link href={qs({ sort: "name", dir: sp.sort === "name" && sp.dir === "asc" ? "desc" : "asc" })}>
                  Name
                </Link>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Invoiced</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                  {sp.q ? (
                    <>
                      No customers match “{sp.q}”.{" "}
                      <Link href="/customers" className="font-medium text-slate-700 underline">
                        Clear search
                      </Link>
                    </>
                  ) : (
                    <>
                      No customers yet.{" "}
                      <Link href="/customers/new" className="font-medium text-slate-700 underline">
                        Create the first one
                      </Link>
                      .
                    </>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              result.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/customers/${c.id}`} className="font-medium text-slate-900 hover:underline">
                      {c.name}
                    </Link>
                    {c.registrationNumber ? (
                      <p className="text-xs text-slate-400">{c.registrationNumber}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {c.customerType}
                    </Badge>
                    {c.status === "archived" ? (
                      <Badge variant="secondary" className="ml-1">
                        Archived
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-sm text-slate-600">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-slate-700">
                    {formatMoney(c.invoicedTotal)}
                    <p className="text-xs text-slate-400">{c.invoiceCount} invoice(s)</p>
                  </TableCell>
                  <TableCell>
                    <CustomerRowActions id={c.id} />
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

      <p className="text-xs text-slate-400">
        Showing {result.items.length} of {result.total} · last updated{" "}
        {result.items[0] ? formatDate(result.items[0].updatedAt.toISOString().slice(0, 10)) : "—"}
        {canCreate ? "" : ""}
      </p>
    </div>
  );
}
