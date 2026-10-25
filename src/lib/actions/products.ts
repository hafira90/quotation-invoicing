"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ilike } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requirePermission, requireUser, getCompany } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { productSchema, formatZodErrors, type ProductInput } from "@/lib/validation";
import { parseCsv } from "@/lib/csv";

export interface ProductActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: string[];
  /** Duplicate candidates the user should confirm before saving. */
  duplicateWarning?: string;
  id?: string;
  saved?: boolean;
}

function emptyToUndefined(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : undefined;
}

export async function saveProductAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const isEdit = Boolean(formData.get("id"));
  const user = await requirePermission(
    isEdit ? PERMISSIONS.PRODUCT_EDIT : PERMISSIONS.PRODUCT_CREATE
  );
  const company = await getCompany();

  /* The form uses a "__none" sentinel for the optional relation selects so
     a user can explicitly clear them — translate it before validation. */
  const uuidOrEmpty = (v: FormDataEntryValue | null): string => {
    const s = v?.toString().trim() ?? "";
    return s === "__none" ? "" : s;
  };

  const parsed = productSchema.safeParse({
    id: formData.get("id")?.toString() || undefined,
    kind: formData.get("kind") || "product",
    sku: formData.get("sku")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    categoryId: uuidOrEmpty(formData.get("categoryId")),
    unit: formData.get("unit")?.toString() ?? "unit",
    unitPrice: formData.get("unitPrice")?.toString() ?? "",
    costPrice: formData.get("costPrice")?.toString() ?? "",
    discountType: formData.get("discountType") || "none",
    discountValue: formData.get("discountValue")?.toString() ?? "",
    taxRateId: uuidOrEmpty(formData.get("taxRateId")),
    notes: formData.get("notes")?.toString() ?? "",
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: formatZodErrors(parsed.error) };
  }

  const data = parsed.data;
  const sku = emptyToUndefined(data.sku) ?? null;

  /* Duplicate detection: a repeated SKU is caught here with a friendlier
     message than the unique index, and a repeated name warns like customers. */
  const force = formData.get("force") === "true";
  if (!force) {
    const existing = await db
      .select({ id: products.id, name: products.name, sku: products.sku })
      .from(products)
      .where(
        and(
          eq(products.companyId, company.id),
          sku
            ? ilike(products.sku, sku)
            : ilike(products.name, data.name.trim())
        )
      )
      .limit(1);
    const match = existing[0];
    if (match && match.id !== data.id) {
      return {
        ok: false,
        duplicateWarning:
          `A similar item already exists: “${match.name}”` +
          (match.sku ? ` (SKU ${match.sku})` : "") +
          ". Press Save again to create this record anyway.",
      };
    }
  }

  /* Cost price is a restricted field: users without product.cost cannot set
     it — on edit the stored value is simply preserved. */
  const canSeeCost = user.permissions.includes(PERMISSIONS.PRODUCT_COST);

  const values = {
    companyId: company.id,
    kind: data.kind,
    sku,
    name: data.name.trim(),
    description: emptyToUndefined(data.description) ?? null,
    categoryId: emptyToUndefined(data.categoryId) ?? null,
    unit: data.unit.trim() || "unit",
    unitPrice: emptyToUndefined(data.unitPrice) ?? "0",
    discountType: data.discountType,
    discountValue: emptyToUndefined(data.discountValue) ?? "0",
    taxRateId: emptyToUndefined(data.taxRateId) ?? null,
    notes: emptyToUndefined(data.notes) ?? null,
    updatedAt: new Date(),
  };

  if (data.id) {
    const [before] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, data.id), eq(products.companyId, company.id)));
    if (!before) return { ok: false, error: "Product not found." };

    const costPrice = canSeeCost
      ? emptyToUndefined(data.costPrice) ?? null
      : before.costPrice;

    const [updated] = await db
      .update(products)
      .set({ ...values, costPrice })
      .where(eq(products.id, data.id))
      .returning();

    await writeAudit({
      action: "product.updated",
      entityType: "product",
      entityId: data.id,
      companyId: company.id,
      actorUserId: user.id,
      actorLabel: user.email,
      before: {
        name: before.name,
        unitPrice: before.unitPrice,
        status: before.status,
      },
      after: { name: values.name, unitPrice: values.unitPrice },
    });

    revalidatePath("/products");
    return { ok: true, saved: true, id: updated!.id };
  }

  const [created] = await db
    .insert(products)
    .values({
      ...values,
      costPrice: canSeeCost ? emptyToUndefined(data.costPrice) ?? null : null,
      createdBy: user.id,
    })
    .returning();

  await writeAudit({
    action: "product.created",
    entityType: "product",
    entityId: created!.id,
    companyId: company.id,
    actorUserId: user.id,
    actorLabel: user.email,
    after: { name: created!.name, sku: created!.sku, unitPrice: created.unitPrice },
  });

  revalidatePath("/products");
  return { ok: true, saved: true, id: created!.id };
}

export async function setProductStatusAction(
  productId: string,
  status: "active" | "archived"
): Promise<{ ok: boolean; error?: string }> {
  await requirePermission(PERMISSIONS.PRODUCT_ARCHIVE);
  const user = await requireUser();
  const company = await getCompany();

  const [existing] = await db
    .select({ id: products.id, name: products.name, status: products.status })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.companyId, company.id)));
  if (!existing) return { ok: false, error: "Product not found." };

  /* Archiving hides the item from pickers but never removes it: documents
     that reference it keep their data, and restore is always possible. */
  await db
    .update(products)
    .set({
      status,
      archivedAt: status === "archived" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));

  await writeAudit({
    action: status === "archived" ? "product.archived" : "product.restored",
    entityType: "product",
    entityId: productId,
    companyId: company.id,
    actorUserId: user.id,
    actorLabel: user.email,
    before: { status: existing.status },
    after: { status },
  });

  revalidatePath("/products");
  return { ok: true };
}

export interface ImportRowResult {
  row: number;
  ok: boolean;
  name?: string;
  error?: string;
}

export interface ImportResultState {
  ok: boolean;
  error?: string;
  imported: number;
  skipped: number;
  rows: ImportRowResult[];
}

/**
 * CSV import for the catalogue. Every row is validated independently and
 * reported back with its line number; valid rows are inserted in one
 * transaction so a mid-file failure never leaves a partial import.
 */
export async function importProductsAction(
  _prev: ImportResultState,
  formData: FormData
): Promise<ImportResultState> {
  await requirePermission(PERMISSIONS.PRODUCT_IMPORT);
  const user = await requireUser();
  const company = await getCompany();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a CSV file to import.", imported: 0, skipped: 0, rows: [] };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "File is larger than 2 MB.", imported: 0, skipped: 0, rows: [] };
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return {
      ok: false,
      error: "The file needs a header row plus at least one data row.",
      imported: 0,
      skipped: 0,
      rows: [],
    };
  }

  const header = rows[0]!.map((h) => h.trim());
  const nameIdx = header.indexOf("name");
  const priceIdx = header.indexOf("unitPrice");
  if (nameIdx === -1 || priceIdx === -1) {
    return {
      ok: false,
      error: 'Header must include "name" and "unitPrice" columns.',
      imported: 0,
      skipped: 0,
      rows: [],
    };
  }

  const MAX_ROWS = 1000;
  const results: ImportRowResult[] = [];
  const valid: ProductInput[] = [];

  for (let r = 1; r < rows.length && r <= MAX_ROWS; r++) {
    const cells = rows[r]!;
    const raw: Record<string, string> = {};
    header.forEach((h, i) => {
      raw[h] = (cells[i] ?? "").trim();
    });

    const parsed = productSchema.safeParse({
      kind: raw.kind || "product",
      sku: raw.sku ?? "",
      name: raw.name ?? "",
      description: raw.description ?? "",
      unit: raw.unit || "unit",
      unitPrice: raw.unitPrice ?? "",
      costPrice: raw.costPrice ?? "",
      discountType: raw.discountType || "none",
      discountValue: raw.discountValue ?? "",
      notes: raw.notes ?? "",
    });

    if (!parsed.success) {
      results.push({
        row: r,
        ok: false,
        name: raw.name,
        error: formatZodErrors(parsed.error).join("; "),
      });
      continue;
    }

    // SKU conflicts are reported rather than silently overwriting.
    const sku = emptyToUndefined(parsed.data.sku);
    if (sku) {
      const [dupe] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.companyId, company.id), ilike(products.sku, sku)))
        .limit(1);
      if (dupe) {
        results.push({
          row: r,
          ok: false,
          name: parsed.data.name,
          error: `SKU “${sku}” already exists`,
        });
        continue;
      }
    }

    results.push({ row: r, ok: true, name: parsed.data.name });
    valid.push({ ...parsed.data, sku: sku ?? "" });
  }

  const overLimit = rows.length - 1 > MAX_ROWS;
  const imported = valid.length;
  let inserted = 0;

  if (valid.length > 0) {
    await db.transaction(async (tx) => {
      for (const v of valid) {
        await tx.insert(products).values({
          companyId: company.id,
          kind: v.kind,
          sku: emptyToUndefined(v.sku) ?? null,
          name: v.name,
          description: emptyToUndefined(v.description) ?? null,
          unit: v.unit || "unit",
          unitPrice: emptyToUndefined(v.unitPrice) ?? "0",
          costPrice: emptyToUndefined(v.costPrice) ?? null,
          discountType: v.discountType,
          discountValue: emptyToUndefined(v.discountValue) ?? "0",
          notes: emptyToUndefined(v.notes) ?? null,
          createdBy: user.id,
        });
        inserted += 1;
      }
    });
  }

  await writeAudit({
    action: "product.imported",
    entityType: "product",
    companyId: company.id,
    actorUserId: user.id,
    actorLabel: user.email,
    after: { imported: inserted, skipped: results.filter((r) => !r.ok).length },
  });

  revalidatePath("/products");

  return {
    ok: true,
    error: overLimit ? `File has more than ${MAX_ROWS} data rows; only the first ${MAX_ROWS} were processed.` : undefined,
    imported: inserted,
    skipped: results.filter((r) => !r.ok).length,
    rows: results,
  };
}
