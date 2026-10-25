import { NextResponse } from "next/server";

import { writeAudit } from "@/lib/audit";
import { toCsv, safeFilename } from "@/lib/csv";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { getCompany, getSessionUser } from "@/lib/session";
import { listProductsForExport } from "@/lib/queries/products";

/**
 * Catalogue CSV export. Same rules as the customer export: JSON auth
 * failures (never an HTML redirect for a file download), company-scoped
 * query, formula-injection escaping on every value.
 *
 * Cost price is only included for users holding product.cost.
 */
export async function GET(): Promise<Response> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(user.permissions, PERMISSIONS.PRODUCT_EXPORT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const company = await getCompany();
    const rows = await listProductsForExport(company.id);
    const withCost = hasPermission(user.permissions, PERMISSIONS.PRODUCT_COST);

    const headers = [
      "name",
      "kind",
      "sku",
      "description",
      "unit",
      "unitPrice",
      "discountType",
      "discountValue",
      "category",
      "taxCode",
      "status",
      "createdAt",
      ...(withCost ? ["costPrice"] : []),
    ];

    const csv = toCsv(
      headers,
      rows.map((p) => {
        const base: unknown[] = [
          p.name,
          p.kind,
          p.sku,
          p.description,
          p.unit,
          p.unitPrice,
          p.discountType,
          p.discountValue,
          p.categoryName,
          p.taxCode,
          p.status,
          p.createdAt,
        ];
        return withCost ? [...base, p.costPrice] : base;
      })
    );

    await writeAudit({
      action: "product.exported",
      entityType: "product",
      companyId: company.id,
      actorUserId: user.id,
      actorLabel: user.email,
      after: { rows: rows.length },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename("products")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[products/export] failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
