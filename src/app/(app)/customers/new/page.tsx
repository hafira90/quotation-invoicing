import type { Metadata } from "next";

import { CustomerForm } from "../customer-form";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "New customer" };
export const instant = false;

export default async function NewCustomerPage() {
  await requirePermission(PERMISSIONS.CUSTOMER_CREATE);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">New customer</h1>
        <p className="mt-1 text-sm text-slate-500">
          You will be warned if a similar customer already exists.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <CustomerForm />
      </div>
    </div>
  );
}
