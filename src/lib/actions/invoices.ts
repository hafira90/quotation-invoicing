"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  customers,
  documentCharges,
  invoiceItems,
  invoices,
  products,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requirePermission, requireUser, getCompany } from "@/lib/session";
import { PERMISSIONS, type PermissionCode } from "@/lib/permissions";
import { invoiceSchema, formatZodErrors } from "@/lib/validation";
import { priceDocument, resolveTaxRates, type PricedLine } from "@/lib/documents";
import { allocateDocumentNumber } from "@/lib/numbering";
import type { DocumentResult } from "@/lib/calc";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tx = PgDatabase<any, any, any>;

export interface InvoiceActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: string[];
  id?: string;
  number?: string;
}

function emptyToUndefined(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : undefined;
}

function parseJsonArray(formData: FormData, key: string): unknown[] {
  const raw = formData.get(key)?.toString() ?? "[]";
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function resolveSkus(
  companyId: string,
  lines: { productId?: string }[]
): Promise<Map<string, string>> {
  const ids = [...new Set(lines.map((l) => l.productId).filter(Boolean))] as string[];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: products.id, sku: products.sku })
    .from(products)
    .where(inArray(products.id, ids));
  const map = new Map<string, string>();
  for (const r of rows) if (r.sku) map.set(r.id, r.sku);
  return map;
}

export async function saveInvoiceAction(
  _prev: InvoiceActionState,
  formData: FormData
): Promise<InvoiceActionState> {
  const isEdit = Boolean(formData.get("id"));
  const user = await requirePermission(
    isEdit ? PERMISSIONS.INVOICE_EDIT : PERMISSIONS.INVOICE_CREATE
  );
  const company = await getCompany();

  const parsed = invoiceSchema.safeParse({
    id: formData.get("id")?.toString() || undefined,
    customerId: formData.get("customerId")?.toString() ?? "",
    issueDate: formData.get("issueDate")?.toString() ?? "",
    dueDate: formData.get("dueDate")?.toString() ?? "",
    currency: (formData.get("currency")?.toString() ?? "MYR").toUpperCase(),
    customerPo: formData.get("customerPo")?.toString() ?? "",
    projectReference: formData.get("projectReference")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
    terms: formData.get("terms")?.toString() ?? "",
    internalNotes: formData.get("internalNotes")?.toString() ?? "",
    paymentInstructions: formData.get("paymentInstructions")?.toString() ?? "",
    documentDiscountType: formData.get("documentDiscountType") || "none",
    documentDiscountValue: formData.get("documentDiscountValue")?.toString() ?? "",
    depositAmount: formData.get("depositAmount")?.toString() ?? "",
    lines: parseJsonArray(formData, "linesJson"),
    charges: parseJsonArray(formData, "chargesJson"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: formatZodErrors(parsed.error) };
  }

  const data = parsed.data;

  const [customerRow] = await db
    .select({ taxExempt: customers.taxExempt, paymentTermsDays: customers.paymentTermsDays })
    .from(customers)
    .where(and(eq(customers.id, data.customerId), eq(customers.companyId, company.id)));
  if (!customerRow) {
    return { ok: false, fieldErrors: ["customerId: Select a valid customer"] };
  }

  const rates = customerRow.taxExempt
    ? new Map()
    : await resolveTaxRates(
        db,
        company.id,
        data.lines.map((l) => l.taxRateId ?? "").filter(Boolean)
      );

  const { priced, result } = priceDocument(
    data.lines,
    data.charges,
    { type: data.documentDiscountType, value: data.documentDiscountValue || "0" },
    rates,
    data.currency
  );
  const skus = await resolveSkus(company.id, data.lines);

  const headerValues = {
    customerId: data.customerId,
    issueDate: data.issueDate,
    dueDate: emptyToUndefined(data.dueDate) ?? null,
    currency: data.currency,
    customerPo: emptyToUndefined(data.customerPo) ?? null,
    projectReference: emptyToUndefined(data.projectReference) ?? null,
    notes: emptyToUndefined(data.notes) ?? null,
    terms: emptyToUndefined(data.terms) ?? null,
    internalNotes: emptyToUndefined(data.internalNotes) ?? null,
    paymentInstructions: emptyToUndefined(data.paymentInstructions) ?? null,
    documentDiscountType: data.documentDiscountType,
    documentDiscountValue: data.documentDiscountValue || "0",
    depositAmount: data.depositAmount || "0",
    subtotal: result.lineSubtotal,
    discountTotal: result.discountTotal,
    shippingTotal: result.chargesTotal,
    taxTotal: result.taxTotal,
    grandTotal: result.grandTotal,
    updatedBy: user.id,
    updatedAt: new Date(),
  };

  try {
    if (data.id) {
      const outcome = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: invoices.id, status: invoices.status })
          .from(invoices)
          .where(and(eq(invoices.id, data.id!), eq(invoices.companyId, company.id)))
          .for("update");
        if (!existing) return { error: "Invoice not found." };
        if (existing.status !== "draft") {
          return {
            error:
              "Only draft invoices can be edited. Issue, void or credit this one instead.",
          };
        }

        await tx.update(invoices).set(headerValues).where(eq(invoices.id, data.id!));
        await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, data.id!));
        await tx
          .delete(documentCharges)
          .where(
            and(
              eq(documentCharges.documentType, "invoice"),
              eq(documentCharges.documentId, data.id!)
            )
          );

        await insertInvoiceLines(tx, company.id, data.id!, priced, result, skus);
        await insertCharges(tx, company.id, data.id!, data.charges);
        return { id: data.id! };
      });

      if (outcome.error) return { ok: false, error: outcome.error };

      await writeAudit({
        action: "invoice.updated",
        entityType: "invoice",
        entityId: outcome.id!,
        companyId: company.id,
        actorUserId: user.id,
        actorLabel: user.email,
        after: { grandTotal: result.grandTotal, lines: priced.length },
      });

      revalidatePath("/invoices");
      revalidatePath(`/invoices/${outcome.id}`);
      return { ok: true, id: outcome.id };
    }

    const outcome = await db.transaction(async (tx) => {
      const number = await allocateDocumentNumber(tx, {
        companyId: company.id,
        docType: "invoice",
      });
      const [created] = await tx
        .insert(invoices)
        .values({
          companyId: company.id,
          invoiceNumber: number,
          status: "draft",
          createdBy: user.id,
          ...headerValues,
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .returning();

      await insertInvoiceLines(tx, company.id, created!.id, priced, result, skus);
      await insertCharges(tx, company.id, created!.id, data.charges);
      return { id: created!.id, number };
    });

    await writeAudit({
      action: "invoice.created",
      entityType: "invoice",
      entityId: outcome.id,
      companyId: company.id,
      actorUserId: user.id,
      actorLabel: user.email,
      after: { number: outcome.number, grandTotal: result.grandTotal },
    });

    revalidatePath("/invoices");
    return { ok: true, id: outcome.id, number: outcome.number };
  } catch (err) {
    console.error("[invoices/save] failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Could not save the invoice. No changes were committed." };
  }
}

async function insertInvoiceLines(
  tx: Tx,
  companyId: string,
  invoiceId: string,
  priced: PricedLine[],
  result: DocumentResult,
  skus: Map<string, string>
) {
  const rows = priced.map((line, i) => {
    const calc = result.lines[i]!;
    return {
      companyId,
      invoiceId,
      lineNo: i + 1,
      productId: emptyToUndefined(line.productId) ?? null,
      sku: (line.productId ? skus.get(line.productId) : undefined) ?? null,
      name: line.name,
      description: emptyToUndefined(line.description) ?? null,
      unit: line.unit || "unit",
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountType: line.discountType,
      discountValue: line.discountValue || "0",
      taxRateId: emptyToUndefined(line.taxRateId) ?? null,
      taxRate: line.taxRateSnapshot,
      taxInclusive: line.taxInclusive,
      taxAmount: calc.taxAfterDocumentDiscount,
      lineSubtotal: calc.netAfterDocumentDiscount,
      lineTotal: calc.total,
    };
  });
  if (rows.length > 0) await tx.insert(invoiceItems).values(rows);
}

async function insertCharges(
  tx: Tx,
  companyId: string,
  invoiceId: string,
  charges: { label: string; amount: string; taxable: boolean }[]
) {
  const rows = charges.map((c, i) => ({
    companyId,
    documentType: "invoice" as const,
    documentId: invoiceId,
    label: c.label,
    amount: c.amount || "0",
    taxable: c.taxable,
    sortOrder: i,
  }));
  if (rows.length > 0) await tx.insert(documentCharges).values(rows);
}

/* ------------------------------------------------------------------ */
/* Status transitions                                                  */
/* ------------------------------------------------------------------ */

export type InvoiceTransition = "issue" | "send" | "void";

const ALLOWED: Record<InvoiceTransition, string[]> = {
  issue: ["draft"],
  send: ["issued"],
  // A void is a deliberate, audited act on any live document.
  void: ["draft", "issued", "sent", "partially_paid", "paid"],
};

const PERMISSION_FOR: Record<InvoiceTransition, PermissionCode> = {
  issue: PERMISSIONS.INVOICE_ISSUE,
  send: PERMISSIONS.INVOICE_SEND,
  void: PERMISSIONS.INVOICE_VOID,
};

export async function invoiceTransitionAction(
  invoiceId: string,
  transition: InvoiceTransition,
  payload?: { voidReason?: string }
): Promise<InvoiceActionState> {
  await requirePermission(PERMISSION_FOR[transition]);
  const user = await requireUser();
  const company = await getCompany();

  try {
    const outcome = await db.transaction(async (tx) => {
      const [inv] = await tx
        .select({
          id: invoices.id,
          status: invoices.status,
          invoiceNumber: invoices.invoiceNumber,
        })
        .from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, company.id)))
        .for("update");
      if (!inv) return { error: "Invoice not found." };

      const previousStatus = inv.status;
      if (!ALLOWED[transition].includes(inv.status)) {
        return { error: `Cannot ${transition} an invoice in status “${inv.status}”.` };
      }

      const now = new Date();
      const patch: Record<string, unknown> = { updatedBy: user.id, updatedAt: now };

      if (transition === "issue") {
        patch.status = "issued";
        patch.issuedAt = now;
        patch.issuedBy = user.id;
      } else if (transition === "send") {
        patch.status = "sent";
      } else {
        const reason = payload?.voidReason?.trim();
        if (!reason) return { error: "A void reason is required." };
        patch.status = "void";
        patch.voidedAt = now;
        patch.voidedBy = user.id;
        patch.voidReason = reason;
      }

      const [updated] = await tx
        .update(invoices)
        .set(patch as never)
        .where(eq(invoices.id, invoiceId))
        .returning({ id: invoices.id, status: invoices.status });
      return {
        id: updated!.id,
        status: updated!.status,
        number: inv.invoiceNumber,
        previousStatus,
      };
    });

    if (outcome.error) return { ok: false, error: outcome.error };

    await writeAudit({
      action: `invoice.${transition}`,
      entityType: "invoice",
      entityId: outcome.id,
      companyId: company.id,
      actorUserId: user.id,
      actorLabel: user.email,
      before: { status: outcome.previousStatus },
      after: {
        status: outcome.status,
        number: outcome.number,
        reason: payload?.voidReason,
      },
    });

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    return { ok: true, id: outcome.id, number: outcome.number };
  } catch (err) {
    console.error("[invoices/transition] failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Could not update the invoice." };
  }
}

/** Copy a draft invoice as a new draft. Issued invoices stay untouched. */
export async function duplicateInvoiceAction(
  invoiceId: string
): Promise<InvoiceActionState> {
  await requirePermission(PERMISSIONS.INVOICE_CREATE);
  const user = await requireUser();
  const company = await getCompany();

  try {
    const outcome = await db.transaction(async (tx) => {
      const [src] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, company.id)));
      if (!src) return { error: "Invoice not found." };

      const number = await allocateDocumentNumber(tx, {
        companyId: company.id,
        docType: "invoice",
      });

      const today = new Date().toISOString().slice(0, 10);
      const [copy] = await tx
        .insert(invoices)
        .values({
          companyId: company.id,
          invoiceNumber: number,
          customerId: src.customerId,
          status: "draft",
          issueDate: today,
          dueDate: src.dueDate,
          currency: src.currency,
          customerPo: src.customerPo,
          projectReference: src.projectReference,
          internalNotes: src.internalNotes,
          notes: src.notes,
          terms: src.terms,
          paymentInstructions: src.paymentInstructions,
          documentDiscountType: src.documentDiscountType,
          documentDiscountValue: src.documentDiscountValue,
          subtotal: src.subtotal,
          discountTotal: src.discountTotal,
          shippingTotal: src.shippingTotal,
          taxTotal: src.taxTotal,
          grandTotal: src.grandTotal,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      const lines = await tx
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoiceId));
      if (lines.length > 0) {
        await tx.insert(invoiceItems).values(
          lines.map((l) => ({
            companyId: company.id,
            invoiceId: copy!.id,
            lineNo: l.lineNo,
            productId: l.productId,
            sku: l.sku,
            name: l.name,
            description: l.description,
            unit: l.unit,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountType: l.discountType,
            discountValue: l.discountValue,
            taxRateId: l.taxRateId,
            taxRate: l.taxRate,
            taxInclusive: l.taxInclusive,
            taxAmount: l.taxAmount,
            lineSubtotal: l.lineSubtotal,
            lineTotal: l.lineTotal,
          }))
        );
      }

      return { id: copy!.id, number };
    });

    if (outcome.error) return { ok: false, error: outcome.error };

    await writeAudit({
      action: "invoice.duplicated",
      entityType: "invoice",
      entityId: outcome.id,
      companyId: company.id,
      actorUserId: user.id,
      actorLabel: user.email,
      after: { sourceId: invoiceId, number: outcome.number },
    });

    revalidatePath("/invoices");
    return { ok: true, id: outcome.id, number: outcome.number };
  } catch (err) {
    console.error("[invoices/duplicate] failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Could not duplicate the invoice." };
  }
}
