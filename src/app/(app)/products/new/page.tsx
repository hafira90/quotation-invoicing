import type { Metadata } from "next";

import { ProductForm } from "../product-form";
import { getProductFormOptions } from "@/lib/queries/products";
import { getCompany, requirePermission } from "@/lib/session";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "New item" };
export const instant = false;

export default async function NewProductPage() {
  const user = await requirePermission(PERMISSIONS.PRODUCT_CREATE);
  const company = await getCompany();
  const options = await getProductFormOptions(company.id);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">New item</h1>
        <p className="mt-1 text-sm text-slate-500">
          Catalogue entries can be selected when building quotations and invoices.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <ProductForm
          options={options}
          showCost={hasPermission(user.permissions, PERMISSIONS.PRODUCT_COST)}
        />
      </div>
    </div>
  );
}
