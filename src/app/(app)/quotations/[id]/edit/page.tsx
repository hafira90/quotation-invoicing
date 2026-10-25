import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { QuotationForm } from "../../quotation-form";
import { getQuotationDetail, getQuotationFormOptions } from "@/lib/queries/quotations";
import { getCompany, requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Edit quotation" };
export const instant = false;

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.QUOTATION_EDIT);
  const company = await getCompany();
  const { id } = await params;

  const [detail, options] = await Promise.all([
    getQuotationDetail(company.id, id),
    getQuotationFormOptions(company.id),
  ]);
  if (!detail) notFound();

  // Issued documents are immutable — send the user to the detail page where
  // the valid actions live, rather than silently allowing an edit.
  if (detail.quotation.status !== "draft") redirect(`/quotations/${id}`);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Edit {detail.quotation.quotationNumber}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Draft only — once issued, a quotation can no longer be edited.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <QuotationForm
          quotation={{
            id: detail.quotation.id,
            customerId: detail.quotation.customerId,
            issueDate: detail.quotation.issueDate,
            expiryDate: detail.quotation.expiryDate,
            currency: detail.quotation.currency,
            customerPo: detail.quotation.customerPo,
            notes: detail.quotation.notes,
            terms: detail.quotation.terms,
            internalNotes: detail.quotation.internalNotes,
            documentDiscountType: detail.quotation.documentDiscountType,
            documentDiscountValue: detail.quotation.documentDiscountValue,
          }}
          initialLines={detail.items.map((i) => ({
            productId: i.productId,
            name: i.name,
            description: i.description,
            unit: i.unit,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discountType: i.discountType,
            discountValue: i.discountValue,
            taxRateId: i.taxRateId,
          }))}
          options={options}
        />
      </div>
    </div>
  );
}
