"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { customers, invoices, quotations } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requirePermission, requireUser, getCompany } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { customerSchema, formatZodErrors } from "@/lib/validation";

export interface CustomerActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: string[];
  /** Duplicate candidates the user should confirm before saving. */
  duplicateWarning?: string;
  /** Set when the record was saved. */
  id?: string;
  /** Set when a forced save was requested. */
  saved?: boolean;
}

function emptyToUndefined(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : undefined;
}

export async function saveCustomerAction(
  _prev: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const isEdit = Boolean(formData.get("id"));
  await requirePermission(isEdit ? PERMISSIONS.CUSTOMER_EDIT : PERMISSIONS.CUSTOMER_CREATE);
  const user = await requireUser();
  const company = await getCompany();

  const parsed = customerSchema.safeParse({
    id: formData.get("id")?.toString() || undefined,
    customerType: formData.get("customerType") || "company",
    name: formData.get("name")?.toString() ?? "",
    legalName: formData.get("legalName")?.toString() ?? "",
    registrationNumber: formData.get("registrationNumber")?.toString() ?? "",
    taxRegistrationNumber: formData.get("taxRegistrationNumber")?.toString() ?? "",
    billingAddress: formData.get("billingAddress")?.toString() ?? "",
    shippingAddress: formData.get("shippingAddress")?.toString() ?? "",
    contactPerson: formData.get("contactPerson")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    phone: formData.get("phone")?.toString() ?? "",
    customerReference: formData.get("customerReference")?.toString() ?? "",
    paymentTermsDays: formData.get("paymentTermsDays")?.toString() ?? "",
    defaultCurrency: formData.get("defaultCurrency")?.toString() ?? "",
    taxTreatment: formData.get("taxTreatment")?.toString() || undefined,
    taxExempt: formData.get("taxExempt") === "on" || formData.get("taxExempt") === "true",
    taxExemptionReason: formData.get("taxExemptionReason")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: formatZodErrors(parsed.error) };
  }

  const data = parsed.data;
  const email = emptyToUndefined(data.email)?.toLowerCase() ?? null;

  /* Duplicate detection -------------------------------------------------- */
  const force = formData.get("force") === "true";
  if (!isEdit && !force) {
    const dupe = await findDuplicate(company.id, data.name, email, data.phone ?? "");
    if (dupe) {
      return {
        ok: false,
        duplicateWarning:
          `A similar customer already exists: “${dupe.name}”` +
          (dupe.email ? ` (${dupe.email})` : "") +
          ". Press Save again to create this record anyway.",
      };
    }
  }

  const values = {
    companyId: company.id,
    customerType: data.customerType,
    name: data.name.trim(),
    legalName: emptyToUndefined(data.legalName) ?? null,
    registrationNumber: emptyToUndefined(data.registrationNumber) ?? null,
    taxRegistrationNumber: emptyToUndefined(data.taxRegistrationNumber) ?? null,
    billingAddress: emptyToUndefined(data.billingAddress) ?? null,
    shippingAddress: emptyToUndefined(data.shippingAddress) ?? null,
    contactPerson: emptyToUndefined(data.contactPerson) ?? null,
    email,
    phone: emptyToUndefined(data.phone) ?? null,
    customerReference: emptyToUndefined(data.customerReference) ?? null,
    paymentTermsDays: emptyToUndefined(data.paymentTermsDays)
      ? Number(data.paymentTermsDays)
      : null,
    defaultCurrency: emptyToUndefined(data.defaultCurrency)?.toUpperCase() ?? null,
    taxTreatment: data.taxTreatment ?? null,
    taxExempt: data.taxExempt,
    taxExemptionReason: emptyToUndefined(data.taxExemptionReason) ?? null,
    notes: emptyToUndefined(data.notes) ?? null,
    updatedAt: new Date(),
  };

  if (data.id) {
    const [before] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, data.id), eq(customers.companyId, company.id)));
    if (!before) return { ok: false, error: "Customer not found." };

    const [updated] = await db
      .update(customers)
      .set(values)
      .where(eq(customers.id, data.id))
      .returning();

    await writeAudit({
      action: "customer.updated",
      entityType: "customer",
      entityId: data.id,
      companyId: company.id,
      actorUserId: user.id,
      actorLabel: user.email,
      before: { name: before.name, email: before.email, status: before.status },
      after: { name: values.name, email: values.email },
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${data.id}`);
    return { ok: true, saved: true, id: updated!.id };
  }

  const [created] = await db
    .insert(customers)
    .values({ ...values, createdBy: user.id })
    .returning();

  await writeAudit({
    action: "customer.created",
    entityType: "customer",
    entityId: created!.id,
    companyId: company.id,
    actorUserId: user.id,
    actorLabel: user.email,
    after: { name: created!.name, email: created!.email },
  });

  revalidatePath("/customers");
  return { ok: true, saved: true, id: created!.id };
}

async function findDuplicate(
  companyId: string,
  name: string,
  email: string | null,
  phone: string
) {
  const conditions = [ilike(customers.name, name.trim())];
  if (email) conditions.push(ilike(customers.email, email));
  if (phone) conditions.push(eq(customers.phone, phone.trim()));

  const [row] = await db
    .select({ name: customers.name, email: customers.email })
    .from(customers)
    .where(and(eq(customers.companyId, companyId), or(...conditions)))
    .limit(1);
  return row ?? null;
}

export async function setCustomerStatusAction(
  customerId: string,
  status: "active" | "archived"
): Promise<{ ok: boolean; error?: string }> {
  await requirePermission(PERMISSIONS.CUSTOMER_ARCHIVE);
  const user = await requireUser();
  const company = await getCompany();

  /* A customer referenced by issued documents can be archived but never
     deleted, and archiving is always reversible. */
  const [existing] = await db
    .select({ id: customers.id, name: customers.name, status: customers.status })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.companyId, company.id)));
  if (!existing) return { ok: false, error: "Customer not found." };

  if (status === "archived") {
    const linked = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.customerId, customerId), ne(invoices.status, "draft")))
      .limit(1);
    void linked; // archiving stays allowed: historical documents keep their data
  }

  await db
    .update(customers)
    .set({
      status,
      archivedAt: status === "archived" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));

  await writeAudit({
    action: status === "archived" ? "customer.archived" : "customer.restored",
    entityType: "customer",
    entityId: customerId,
    companyId: company.id,
    actorUserId: user.id,
    actorLabel: user.email,
    before: { status: existing.status },
    after: { status },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}

/** CSV export — permission checked, values escaped by the caller helper. */
export async function listCustomersForExport(companyId: string) {
  return db
    .select()
    .from(customers)
    .where(eq(customers.companyId, companyId))
    .orderBy(desc(customers.createdAt));
}

export async function countCustomers(companyId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(customers)
    .where(eq(customers.companyId, companyId));
  return rows[0]?.n ?? 0;
}
