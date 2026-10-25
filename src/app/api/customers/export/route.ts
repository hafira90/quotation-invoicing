import { NextResponse } from "next/server";

import { writeAudit } from "@/lib/audit";
import { toCsv, safeFilename } from "@/lib/csv";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { getCompany, getSessionUser } from "@/lib/session";
import { listCustomersForExport } from "@/lib/actions/customers";

/**
 * Customer CSV export.
 *
 * Route handlers return JSON auth failures rather than an HTML redirect —
 * a file download should surface a status code, not a login page. The query
 * is company-scoped and every value is escaped against formula injection.
 */
export async function GET(): Promise<Response> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(user.permissions, PERMISSIONS.CUSTOMER_EXPORT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const company = await getCompany();
    const rows = await listCustomersForExport(company.id);

    const csv = toCsv(
      [
        "name",
        "customerType",
        "legalName",
        "registrationNumber",
        "taxRegistrationNumber",
        "email",
        "phone",
        "contactPerson",
        "billingAddress",
        "shippingAddress",
        "customerReference",
        "paymentTermsDays",
        "defaultCurrency",
        "taxExempt",
        "status",
        "createdAt",
      ],
      rows.map((c) => [
        c.name,
        c.customerType,
        c.legalName,
        c.registrationNumber,
        c.taxRegistrationNumber,
        c.email,
        c.phone,
        c.contactPerson,
        c.billingAddress,
        c.shippingAddress,
        c.customerReference,
        c.paymentTermsDays,
        c.defaultCurrency,
        c.taxExempt,
        c.status,
        c.createdAt,
      ])
    );

    await writeAudit({
      action: "customer.exported",
      entityType: "customer",
      companyId: company.id,
      actorUserId: user.id,
      actorLabel: user.email,
      after: { rows: rows.length },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename("customers")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[customers/export] failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
