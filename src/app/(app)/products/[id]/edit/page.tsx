import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductForm } from "../../product-form";
import { getProduct, getProductFormOptions } from "@/lib/queries/products";
import { getCompany, getSessionUser, requirePermission } from "@/lib/session";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Edit item" };
export const instant = false;

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.PRODUCT_EDIT);
  const company = await getCompany();
  const user = await getSessionUser();
  const { id } = await params;

  const [product, options] = await Promise.all([
    getProduct(company.id, id),
    getProductFormOptions(company.id),
  ]);
  if (!product) notFound();

  const showCost = Boolean(
    user && hasPermission(user.permissions, PERMISSIONS.PRODUCT_COST)
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Edit {product.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Changes here do not alter quotations or invoices that were already issued.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <ProductForm
          product={{
            id: product.id,
            kind: product.kind,
            sku: product.sku,
            name: product.name,
            description: product.description,
            categoryId: product.categoryId,
            unit: product.unit,
            unitPrice: product.unitPrice,
            costPrice: showCost ? product.costPrice : null,
            discountType: product.discountType,
            discountValue: product.discountValue,
            taxRateId: product.taxRateId,
            notes: product.notes,
          }}
          options={options}
          showCost={showCost}
        />
      </div>
    </div>
  );
}
