import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomerForm } from "../../customer-form";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCompany, requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Edit customer" };
export const instant = false;

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.CUSTOMER_EDIT);
  const company = await getCompany();
  const { id } = await params;

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.companyId, company.id)));

  if (!customer) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Edit {customer.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Changing contact details does not alter documents that were already issued.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <CustomerForm customer={customer} />
      </div>
    </div>
  );
}
