import Link from "next/link";
import type { Metadata } from "next";

import { ProductRowActions } from "./row-actions";
import { listProducts } from "@/lib/queries/products";
import { getCompany, getSessionUser, requirePermission } from "@/lib/session";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { formatMoney } from "@/lib/format";
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

export const metadata: Metadata = { title: "Products & Services" };
export const instant = false;

type Search = {
  q?: string;
  status?: string;
  kind?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

const KIND_LABELS: Record<string, string> = {
  product: "Product",
  service: "Service",
  labour: "Labour",
  consultancy: "Consultancy",
  subscription: "Subscription",
  delivery: "Delivery",
  misc: "Misc",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePermission(PERMISSIONS.PRODUCT_VIEW);
  const company = await getCompany();
  const user = await getSessionUser();
  const sp = await searchParams;

  const result = await listProducts({
    companyId: company.id,
    q: sp.q,
    status: (sp.status as "active" | "archived" | "all") ?? "active",
    kind: sp.kind && sp.kind !== "all" ? sp.kind : undefined,
    sort: (sp.sort as "name" | "created" | "updated" | "price") ?? "updated",
    dir: (sp.dir as "asc" | "desc") ?? "desc",
    page: Number(sp.page ?? 1) || 1,
    pageSize: 20,
  });

  const canSeeCost = user && hasPermission(user.permissions, PERMISSIONS.PRODUCT_COST);

  const qs = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      q: sp.q,
      status: sp.status,
      kind: sp.kind,
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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Products &amp; Services</h1>
          <p className="mt-1 text-sm text-slate-500">
            {result.total} item{result.total === 1 ? "" : "s"} in the catalogue
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<Link href="/products/import" />}>
            Import CSV
          </Button>
          <Button variant="outline" size="sm" render={<a href="/api/products/export" />}>
            Export CSV
          </Button>
          <Button size="sm" render={<Link href="/products/new" />}>
            New item
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
            placeholder="Name, SKU or description…"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="status" className="text-sm font-medium text-slate-700">
            Status
          </label>
          <Select name="status" defaultValue={sp.status ?? "active"}>
            <SelectTrigger id="status" className="w-36">
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
          <label htmlFor="kind" className="text-sm font-medium text-slate-700">
            Type
          </label>
          <Select name="kind" defaultValue={sp.kind ?? "all"}>
            <SelectTrigger id="kind" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {sp.q ? (
          <Button type="button" variant="ghost" render={<Link href="/products" />}>
            Clear
          </Button>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Link
                  href={qs({ sort: "name", dir: sp.sort === "name" && sp.dir === "asc" ? "desc" : "asc" })}
                >
                  Name
                </Link>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">
                <Link
                  href={qs({
                    sort: "price",
                    dir: sp.sort === "price" && sp.dir === "asc" ? "desc" : "asc",
                  })}
                >
                  Price
                </Link>
              </TableHead>
              {canSeeCost ? <TableHead className="text-right">Cost</TableHead> : null}
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canSeeCost ? 7 : 6}
                  className="py-10 text-center text-sm text-slate-500"
                >
                  {sp.q ? (
                    <>
                      No items match “{sp.q}”.{" "}
                      <Link href="/products" className="font-medium text-slate-700 underline">
                        Clear search
                      </Link>
                    </>
                  ) : (
                    <>
                      The catalogue is empty.{" "}
                      <Link href="/products/new" className="font-medium text-slate-700 underline">
                        Add the first item
                      </Link>{" "}
                      or{" "}
                      <Link href="/products/import" className="font-medium text-slate-700 underline">
                        import a CSV
                      </Link>
                      .
                    </>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              result.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/products/${p.id}/edit`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.taxLabel ? (
                      <p className="text-xs text-slate-400">{p.taxLabel}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{KIND_LABELS[p.kind] ?? p.kind}</Badge>
                    {p.status === "archived" ? (
                      <Badge variant="secondary" className="ml-1">
                        Archived
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{p.sku ?? "—"}</TableCell>
                  <TableCell className="text-sm text-slate-600">{p.unit}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-slate-700">
                    {formatMoney(p.unitPrice)}
                    {Number(p.discountValue) > 0 ? (
                      <p className="text-xs text-slate-400">
                        {p.discountType === "percent"
                          ? `${p.discountValue}% off`
                          : `${formatMoney(p.discountValue)} off`}
                      </p>
                    ) : null}
                  </TableCell>
                  {canSeeCost ? (
                    <TableCell className="text-right text-sm tabular-nums text-slate-600">
                      {p.costPrice ? formatMoney(p.costPrice) : "—"}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <ProductRowActions id={p.id} />
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
              <Button variant="outline" size="sm" render={<Link href={qs({ page: String(result.page + 1) })} />}>
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
