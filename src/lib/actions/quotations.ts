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
  paymentMilestones,
  products,
  quotationItems,
  quotations,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requirePermission, requireUser, getCompany } from "@/lib/session";
import { PERMISSIONS, type PermissionCode } from "@/lib/permissions";
import { quotationSchema, formatZodErrors } from "@/lib/validation";
import { priceDocument, resolveTaxRates, type PricedLine } from "@/lib/documents";
import { allocateDocumentNumber } from "@/lib/numbering";
import type { DocumentResult } from "@/lib/calc";

export interface QuotationActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: string[];
  id?: string;
  number?: string;
  /** Set by convert so the UI can navigate to the new invoice. */
  invoiceId?: string;
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

/** Resolve product SKUs so documents print the catalogue code verbatim. */
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

export async function saveQuotationAction(
  _prev: QuotationActionState,
  formData: FormData
): Promise<QuotationActionState> {
  const isEdit = Boolean(formData.get("id"));
  const user = await requirePermission(
    isEdit ? PERMISSIONS.QUOTATION_EDIT : PERMISSIONS.QUOTATION_CREATE
  );
  const company = await getCompany();

  const parsed = quotationSchema.safeParse({
    id: formData.get("id")?.toString() || undefined,
    customerId: formData.get("customerId")?.toString() ?? "",
    issueDate: formData.get("issueDate")?.toString() ?? "",
    expiryDate: formData.get("expiryDate")?.toString() ?? "",
    currency: (formData.get("currency")?.toString() ?? "MYR").toUpperCase(),
    customerPo: formData.get("customerPo")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
    terms: formData.get("terms")?.toString() ?? "",
    internalNotes: formData.get("internalNotes")?.toString() ?? "",
    documentDiscountType: formData.get("documentDiscountType") || "none",
    documentDiscountValue: formData.get("documentDiscountValue")?.toString() ?? "",
    lines: parseJsonArray(formData, "linesJson"),
    charges: parseJsonArray(formData, "chargesJson"),
    milestones: parseJsonArray(formData, "milestonesJson"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: formatZodErrors(parsed.error) };
  }

  const data = parsed.data;

  /* Authoritative pricing: every rate is looked up from the company's own
     tax table, then the shared engine recalculates everything. A tax-exempt
     customer forces every line to zero tax regardless of what was posted. */
  const [customerRow] = await db
    .select({ taxExempt: customers.taxExempt })
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
    expiryDate: emptyToUndefined(data.expiryDate) ?? null,
    currency: data.currency,
    customerPo: emptyToUndefined(data.customerPo) ?? null,
    notes: emptyToUndefined(data.notes) ?? null,
    terms: emptyToUndefined(data.terms) ?? null,
    internalNotes: emptyToUndefined(data.internalNotes) ?? null,
    documentDiscountType: data.documentDiscountType,
    documentDiscountValue: data.documentDiscountValue || "0",
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
          .select({ id: quotations.id, status: quotations.status })
          .from(quotations)
          .where(and(eq(quotations.id, data.id!), eq(quotations.companyId, company.id)))
          .for("update");
        if (!existing) return { error: "Quotation not found." };
        if (existing.status !== "draft") {
          return { error: "Only draft quotations can be edited. Issue, duplicate or cancel this one instead." };
        }

        await tx
          .update(quotations)
          .set(headerValues)
          .where(eq(quotations.id, data.id!));

        // Lines/charges are replaced wholesale — a draft has no history yet.
        await tx.delete(quotationItems).where(eq(quotationItems.quotationId, data.id!));
        await tx
          .delete(documentCharges)
          .where(
            and(
              eq(documentCharges.documentType, "quotation"),
              eq(documentCharges.documentId, data.id!)
            )
          );
        await tx
          .delete(paymentMilestones)
          .where(
            and(
              eq(paymentMilestones.documentType, "quotation"),
              eq(paymentMilestones.documentId, data.id!)
            )
          );

        await insertQuotationLines(tx, company.id, data.id!, priced, result, skus);
        await insertCharges(tx, company.id, "quotation", data.id!, data.charges);
        await insertMilestones(tx, company.id, "quotation", data.id!, data.milestones);
        return { id: data.id! };
      });

      if (outcome.error) return { ok: false, error: outcome.error };

      await writeAudit({
        action: "quotation.updated",
        entityType: "quotation",
        entityId: outcome.id!,
        companyId: company.id,
        actorUserId: user.id,
        actorLabel: user.email,
        after: { grandTotal: result.grandTotal, lines: priced.length },
      });

      revalidatePath("/quotations");
      revalidatePath(`/quotations/${outcome.id}`);
      return { ok: true, id: outcome.id };
    }

    const outcome = await db.transaction(async (tx) => {
      const number = await allocateDocumentNumber(tx, {
        companyId: company.id,
        docType: "quotation",
      });
      const [created] = await tx
        .insert(quotations)
        .values({
          companyId: company.id,
          quotationNumber: number,
          status: "draft",
          createdBy: user.id,
          ...headerValues,
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .returning();

      await insertQuotationLines(tx, company.id, created!.id, priced, result, skus);
      await insertCharges(tx, company.id, "quotation", created!.id, data.charges);
      await insertMilestones(tx, company.id, "quotation", created!.id, data.milestones);
      return { id: created!.id, number };
    });

    await writeAudit({
      action: "quotation.created",
      entityType: "quotation",
      entityId: outcome.id,
      companyId: company.id,
      actorUserId: user.id,
      actorLabel: user.email,
      after: { number: outcome.number, grandTotal: result.grandTotal },
    });

    revalidatePath("/quotations");
    return { ok: true, id: outcome.id, number: outcome.number };
  } catch (err) {
    console.error("[quotations/save] failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Could not save the quotation. No changes were committed." };
  }
}

/* ------------------------------------------------------------------ */  
/* Persistence helpers                                                 */
/* ------------------------------------------------------------------ */

type Tx = PgDatabase<any, any, any>;

async function insertQuotationLines(
  tx: Tx,
  companyId: string,
  quotationId: string,
  priced: PricedLine[],
  result: DocumentResult,
  skus: Map<string, string>
) {
  const rows = priced.map((line, i) => {
    const calc = result.lines[i]!;
    return {
      companyId,
      quotationId,
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
  if (rows.length > 0) await tx.insert(quotationItems).values(rows);
}

async function insertCharges(
  tx: Tx,
  companyId: string,
  documentType: "quotation" | "invoice",
  documentId: string,
  charges: { label: string; amount: string; taxable: boolean }[]
) {
  const rows = charges.map((c, i) => ({
    companyId,
    documentType,
    documentId,
    label: c.label,
    amount: c.amount || "0",
    taxable: c.taxable,
    sortOrder: i,
  }));
  if (rows.length > 0) await tx.insert(documentCharges).values(rows);
}

async function insertMilestones(
  tx: Tx,
  companyId: string,
  documentType: "quotation" | "invoice",
  documentId: string,
  milestones: { label: string; percent: string; dueOn?: string; notes?: string }[]
) {
  const rows = milestones.map((m, i) => ({
    companyId,
    documentType,
    documentId,
    label: m.label,
    percent: m.percent,
    dueOn: emptyToUndefined(m.dueOn) ?? null,
    notes: emptyToUndefined(m.notes) ?? null,
    sortOrder: i,
  }));
  if (rows.length > 0) await tx.insert(paymentMilestones).values(rows);
}

/* ------------------------------------------------------------------ */
/* Status transitions                                                  */
/* ------------------------------------------------------------------ */

export type QuotationTransition =
  | "issue"
  | "send"
  | "accept"
  | "reject"
  | "expire"
  | "cancel";

const ALLOWED: Record<QuotationTransition, string[]> = {
  issue: ["draft"],
  send: ["issued"],
  accept: ["issued", "sent"],
  reject: ["issued", "sent"],
  expire: ["draft", "issued", "sent"],
  cancel: ["draft", "issued", "sent", "accepted", "rejected", "expired"],
};

const PERMISSION_FOR: Record<QuotationTransition, PermissionCode> = {
  issue: PERMISSIONS.QUOTATION_ISSUE,
  send: PERMISSIONS.QUOTATION_ISSUE,
  accept: PERMISSIONS.QUOTATION_DECIDE,
  reject: PERMISSIONS.QUOTATION_DECIDE,
  expire: PERMISSIONS.QUOTATION_ISSUE,
  cancel: PERMISSIONS.QUOTATION_ARCHIVE,
};

export async function quotationTransitionAction(
  quotationId: string,
  transition: QuotationTransition,
  payload?: {
    acceptanceName?: string;
    acceptanceDesignation?: string;
    rejectionReason?: string;
  }
): Promise<QuotationActionState> {
  await requirePermission(PERMISSION_FOR[transition]);
  const user = await requireUser();
  const company = await getCompany();

  try {
    const outcome = await db.transaction(async (tx) => {
      const [q] = await tx
        .select({
          id: quotations.id,
          status: quotations.status,
          quotationNumber: quotations.quotationNumber,
        })
        .from(quotations)
        .where(and(eq(quotations.id, quotationId), eq(quotations.companyId, company.id)))
        .for("update");
      if (!q) return { error: "Quotation not found." };

      const previousStatus = q.status;
      if (!ALLOWED[transition].includes(q.status)) {
        return {
          error: `Cannot ${transition} a quotation in status “${q.status}”.`,
        };
      }

      const now = new Date();
      const patch: Record<string, unknown> = { updatedBy: user.id, updatedAt: now };

      switch (transition) {
        case "issue":
          patch.status = "issued";
          patch.issuedAt = now;
          patch.issuedBy = user.id;
          break;
        case "send":
          patch.status = "sent";
          break;
        case "accept":
          if (!payload?.acceptanceName?.trim()) {
            return { error: "Record who accepted the quotation." };
          }
          patch.status = "accepted";
          patch.acceptedAt = now;
          patch.acceptedBy = user.id;
          patch.acceptanceName = payload.acceptanceName.trim();
          patch.acceptanceDesignation = payload.acceptanceDesignation?.trim() || null;
          break;
        case "reject":
          if (!payload?.rejectionReason?.trim()) {
            return { error: "A rejection reason is required." };
          }
          patch.status = "rejected";
          patch.rejectedAt = now;
          patch.rejectedBy = user.id;
          patch.rejectionReason = payload.rejectionReason.trim();
          break;
        case "expire":
          patch.status = "expired";
          patch.expiredAt = now;
          break;
        case "cancel":
          patch.status = "cancelled";
          patch.archivedAt = now;
          break;
      }

      const [updated] = await tx
        .update(quotations)
        .set(patch as never)
        .where(eq(quotations.id, quotationId))
        .returning({ id: quotations.id, status: quotations.status });
      return {
        id: updated!.id,
        status: updated!.status,
        number: q.quotationNumber,
        previousStatus,
      };
    });

    if (outcome.error) return { ok: false, error: outcome.error };

    await writeAudit({
      action: `quotation.${transition}`,
      entityType: "quotation",
      entityId: outcome.id!,
      companyId: company.id,
      actorUserId: user.id,
      actorLabel: user.email,
      before: { status: outcome.previousStatus },
      after: { status: outcome.status, number: outcome.number },
    });

    revalidatePath("/quotations");
    revalidatePath(`/quotations/${quotationId}`);
    return { ok: true, id: outcome.id, number: outcome.number };
  } catch (err) {
    console.error("[quotations/transition] failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Could not update the quotation." };
  }
}

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

/**
 * Convert an accepted quotation into a draft invoice, atomically.
 *
 * Double-click protection has two layers: the row lock serialises
 * concurrent requests, and the unique index on invoice.quotation_id
 * (plus an explicit existence check inside the same transaction) means
 * the second request fails instead of creating a second invoice.
 */
export async function convertQuotationToInvoiceAction(
  quotationId: string
): Promise<QuotationActionState> {
  await requirePermission(PERMISSIONS.QUOTATION_CONVERT);
  const user = await requireUser();
  const company = await getCompany();

  try {
    const outcome = await db.transaction(async (tx) => {
      const [q] = await tx
        .select()
        .from(quotations)
        .where(and(eq(quotations.id, quotationId), eq(quotations.companyId, company.id)))
        .for("update");
      if (!q) return { error: "Quotation not found." };
      if (q.status === "converted") {
        return { error: "This quotation has already been converted to an invoice." };
      }
      if (q.status !== "accepted") {
        return { error: "Only accepted quotations can be converted to invoices." };
      }

      const existing = await tx
        .select({ id: invoices.id })
        .from(invoices)
        .where(eq(invoices.quotationId, quotationId))
        .limit(1);
      if (existing[0]) {
        return { error: "An invoice already exists for this quotation." };
      }

      const number = await allocateDocumentNumber(tx, {
        companyId: company.id,
        docType: "invoice",
      });

      // Due date: customer payment terms, else 30 days from issue.
      const [customer] = await tx
        .select({ paymentTermsDays: customers.paymentTermsDays })
        .from(customers)
        .where(eq(customers.id, q.customerId));
      const termsDays = customer?.paymentTermsDays ?? 30;
      const due = new Date();
      due.setUTCDate(due.getUTCDate() + termsDays);

      const [invoice] = await tx
        .insert(invoices)
        .values({
          companyId: company.id,
          invoiceNumber: number,
          customerId: q.customerId,
          quotationId: q.id,
          status: "draft",
          issueDate: new Date().toISOString().slice(0, 10),
          dueDate: due.toISOString().slice(0, 10),
          currency: q.currency,
          customerPo: q.customerPo,
          internalNotes: q.internalNotes,
          notes: q.notes,
          terms: q.terms,
          documentDiscountType: q.documentDiscountType,
          documentDiscountValue: q.documentDiscountValue,
          subtotal: q.subtotal,
          discountTotal: q.discountTotal,
          shippingTotal: q.shippingTotal,
          taxTotal: q.taxTotal,
          grandTotal: q.grandTotal,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      // Copy lines verbatim: descriptions, quantities, prices, discounts and
      // the tax snapshots travel with the conversion.
      const lines = await tx
        .select()
        .from(quotationItems)
        .where(eq(quotationItems.quotationId, quotationId));
      if (lines.length > 0) {
        await tx.insert(invoiceItems).values(
          lines.map((l) => ({
            companyId: company.id,
            invoiceId: invoice!.id,
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

      const charges = await tx
        .select()
        .from(documentCharges)
        .where(
          and(
            eq(documentCharges.documentType, "quotation"),
            eq(documentCharges.documentId, quotationId)
          )
        );
      if (charges.length > 0) {
        await tx.insert(documentCharges).values(
          charges.map((c) => ({
            companyId: company.id,
            documentType: "invoice" as const,
            documentId: invoice!.id,
            label: c.label,
            amount: c.amount,
            taxable: c.taxable,
            sortOrder: c.sortOrder,
          }))
        );
      }

      await tx
        .update(quotations)
        .set({ status: "converted", convertedAt: new Date(), updatedBy: user.id })
        .where(eq(quotations.id, quotationId));

      return { invoiceId: invoice!.id, number, quotationNumber: q.quotationNumber };
    });

    if (outcome.error) return { ok: false, error: outcome.error };

    await writeAudit({
      action: "quotation.converted",
      entityType: "quotation",
      entityId: quotationId,
      companyId: company.id,
      actorUserId: user.id,
      actorLabel: user.email,
      after: { invoiceId: outcome.invoiceId, invoiceNumber: outcome.number },
    });

    revalidatePath("/quotations");
    revalidatePath(`/quotations/${quotationId}`);
    return { ok: true, id: quotationId, invoiceId: outcome.invoiceId, number: outcome.number };
  } catch (err) {
    console.error("[quotations/convert] failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Could not convert the quotation. No invoice was created." };
  }
}

/** Duplicate a quotation as a fresh draft with today's dates. */
export async function duplicateQuotationAction(
  quotationId: string
): Promise<QuotationActionState> {
  await requirePermission(PERMISSIONS.QUOTATION_CREATE);
  const user = await requireUser();
  const company = await getCompany();

  try {
    const outcome = await db.transaction(async (tx) => {
      const [q] = await tx
        .select()
        .from(quotations)
        .where(and(eq(quotations.id, quotationId), eq(quotations.companyId, company.id)));
      if (!q) return { error: "Quotation not found." };

      const number = await allocateDocumentNumber(tx, {
        companyId: company.id,
        docType: "quotation",
      });

      const today = new Date().toISOString().slice(0, 10);
      const [copy] = await tx
        .insert(quotations)
        .values({
          companyId: company.id,
          quotationNumber: number,
          customerId: q.customerId,
          status: "draft",
          issueDate: today,
          expiryDate: null,
          currency: q.currency,
          customerPo: q.customerPo,
          internalNotes: q.internalNotes,
          notes: q.notes,
          terms: q.terms,
          documentDiscountType: q.documentDiscountType,
          documentDiscountValue: q.documentDiscountValue,
          subtotal: q.subtotal,
          discountTotal: q.discountTotal,
          shippingTotal: q.shippingTotal,
          taxTotal: q.taxTotal,
          grandTotal: q.grandTotal,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      const lines = await tx
        .select()
        .from(quotationItems)
        .where(eq(quotationItems.quotationId, quotationId));
      if (lines.length > 0) {
        await tx.insert(quotationItems).values(
          lines.map((l) => ({
            companyId: company.id,
            quotationId: copy!.id,
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

      const charges = await tx
        .select()
        .from(documentCharges)
        .where(
          and(
            eq(documentCharges.documentType, "quotation"),
            eq(documentCharges.documentId, quotationId)
          )
        );
      if (charges.length > 0) {
        await tx.insert(documentCharges).values(
          charges.map((c) => ({
            companyId: company.id,
            documentType: "quotation" as const,
            documentId: copy!.id,
            label: c.label,
            amount: c.amount,
            taxable: c.taxable,
            sortOrder: c.sortOrder,
          }))
        );
      }

      return { id: copy!.id, number };
    });

    if (outcome.error) return { ok: false, error: outcome.error };

    await writeAudit({
      action: "quotation.duplicated",
      entityType: "quotation",
      entityId: outcome.id,
      companyId: company.id,
      actorUserId: user.id,
      actorLabel: user.email,
      after: { sourceId: quotationId, number: outcome.number },
    });

    revalidatePath("/quotations");
    return { ok: true, id: outcome.id, number: outcome.number };
  } catch (err) {
    console.error("[quotations/duplicate] failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Could not duplicate the quotation." };
  }
}
