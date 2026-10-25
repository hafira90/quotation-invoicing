import type { Metadata } from "next";
import Link from "next/link";

import { ImportForm } from "./import-form";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Import catalogue" };
export const instant = false;

export default async function ImportProductsPage() {
  await requirePermission(PERMISSIONS.PRODUCT_IMPORT);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Import catalogue from CSV
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Every row is validated individually — you get a line-by-line report, and a failure
          never leaves a half-imported file behind.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <ImportForm />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        <h2 className="font-medium text-slate-800">Expected columns</h2>
        <p className="mt-1">
          Required: <code className="rounded bg-slate-200 px-1">name</code>,{" "}
          <code className="rounded bg-slate-200 px-1">unitPrice</code>.
        </p>
        <p className="mt-2">Optional:</p>
        <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs ring-1 ring-slate-200">{`kind,sku,description,unit,discountType,discountValue,costPrice,notes

kind: product | service | labour | consultancy | subscription | delivery | misc
discountType: none | percent | amount`}</pre>
        <p className="mt-2 text-xs text-slate-500">
          Rows whose SKU already exists are skipped and reported, never overwritten.
        </p>
      </div>

      <Button variant="outline" size="sm" render={<Link href="/products" />}>
        Back to catalogue
      </Button>
    </div>
  );
}
