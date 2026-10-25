import { and, asc, desc, eq, ilike, or, sql, count } from "drizzle-orm";

import { db } from "@/db";
import { productCategories, products, taxRates } from "@/db/schema";

export interface ProductListParams {
  companyId: string;
  q?: string;
  status?: "active" | "archived" | "all";
  kind?: string;
  sort?: "name" | "created" | "updated" | "price";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ProductListRow {
  id: string;
  kind: string;
  sku: string | null;
  name: string;
  unit: string;
  unitPrice: string;
  costPrice: string | null;
  discountType: "none" | "percent" | "amount";
  discountValue: string;
  status: "active" | "archived";
  categoryName: string | null;
  taxLabel: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function listProducts(params: ProductListParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 20));
  const q = params.q?.trim();

  const conditions = [eq(products.companyId, params.companyId)];

  if (params.status && params.status !== "all") {
    conditions.push(eq(products.status, params.status));
  } else if (!params.status) {
    conditions.push(eq(products.status, "active"));
  }

  if (params.kind) {
    conditions.push(eq(products.kind, params.kind as never));
  }

  if (q) {
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    conditions.push(
      or(
        ilike(products.name, like),
        ilike(products.sku, like),
        ilike(products.description, like)
      )!
    );
  }

  const where = and(...conditions);

  const sortColumn =
    params.sort === "created"
      ? products.createdAt
      : params.sort === "updated"
        ? products.updatedAt
        : params.sort === "price"
          ? products.unitPrice
          : products.name;
  const direction = params.dir === "desc" ? desc : asc;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: products.id,
        kind: products.kind,
        sku: products.sku,
        name: products.name,
        unit: products.unit,
        unitPrice: products.unitPrice,
        costPrice: products.costPrice,
        discountType: products.discountType,
        discountValue: products.discountValue,
        status: products.status,
        categoryName: productCategories.name,
        taxLabel: taxRates.name,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
      .leftJoin(taxRates, eq(taxRates.id, products.taxRateId))
      .where(where)
      .orderBy(direction(sortColumn))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(products).where(where),
  ]);

  const total = totalRow[0]?.total ?? 0;

  return {
    items: rows as ProductListRow[],
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getProduct(companyId: string, id: string) {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.companyId, companyId)));
  return row ?? null;
}

/** Dropdown data for the product form (tax rates and categories). */
export async function getProductFormOptions(companyId: string) {
  const [rates, categories] = await Promise.all([
    db
      .select({
        id: taxRates.id,
        code: taxRates.code,
        name: taxRates.name,
        rate: taxRates.rate,
        isInclusive: taxRates.isInclusive,
      })
      .from(taxRates)
      .where(and(eq(taxRates.companyId, companyId), eq(taxRates.active, true)))
      .orderBy(asc(taxRates.code)),
    db
      .select({ id: productCategories.id, name: productCategories.name })
      .from(productCategories)
      .where(and(eq(productCategories.companyId, companyId), eq(productCategories.active, true)))
      .orderBy(asc(productCategories.name)),
  ]);

  return { rates, categories };
}

export async function listProductsForExport(companyId: string) {
  return db
    .select({
      id: products.id,
      kind: products.kind,
      sku: products.sku,
      name: products.name,
      description: products.description,
      unit: products.unit,
      unitPrice: products.unitPrice,
      costPrice: products.costPrice,
      discountType: products.discountType,
      discountValue: products.discountValue,
      status: products.status,
      categoryName: productCategories.name,
      taxCode: taxRates.code,
      createdAt: products.createdAt,
    })
    .from(products)
    .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
    .leftJoin(taxRates, eq(taxRates.id, products.taxRateId))
    .where(eq(products.companyId, companyId))
    .orderBy(desc(products.createdAt));
}
