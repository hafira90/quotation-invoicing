import type { Metadata } from "next";

import { QuotationForm } from "../quotation-form";
import { getQuotationFormOptions } from "@/lib/queries/quotations";
import { getCompany, requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "New quotation" };
export const instant = false;

export default async function NewQuotationPage() {
  await requirePermission(PERMISSIONS.QUOTATION_CREATE);
  const company = await getCompany();
  const options = await getQuotationFormOptions(company.id);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">New quotation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Saved as a draft — issue it when it is ready to send.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <QuotationForm options={options} />
      </div>
    </div>
  );
}
