import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  events: [] as string[],
  getCompany: vi.fn(),
  listInvoices: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/queries/invoices", () => ({
  INVOICE_STATUSES: ["draft", "issued", "sent", "partially_paid", "paid", "overdue", "void"],
  listInvoices: mocks.listInvoices,
}));

vi.mock("@/lib/session", () => ({
  getCompany: mocks.getCompany,
  requirePermission: mocks.requirePermission,
}));

import InvoicesPage from "@/app/(app)/invoices/page";
import { PERMISSIONS } from "@/lib/permissions";

type SearchParams = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

async function renderPage(searchParams: SearchParams) {
  return renderToStaticMarkup(
    await InvoicesPage({ searchParams: Promise.resolve(searchParams) })
  );
}

describe("InvoicesPage", () => {
  beforeEach(() => {
    mocks.events.length = 0;
    mocks.getCompany.mockClear();
    mocks.listInvoices.mockClear();
    mocks.requirePermission.mockClear();
    mocks.listInvoices.mockImplementation(async () => {
      mocks.events.push("list");
      return {
        items: [
          {
            id: "invoice-1",
            invoiceNumber: "INV-2026-0001",
            status: "issued",
            effectiveStatus: "overdue",
            issueDate: "2026-09-25",
            dueDate: "2026-10-01",
            grandTotal: "120.00",
            currency: "MYR",
            customerName: "Acme Supplies",
            paid: "20.00",
            outstanding: "100.00",
            createdAt: new Date("2026-09-25T00:00:00.000Z"),
          },
        ],
        page: 1,
        pageSize: 20,
        total: 21,
        totalPages: 2,
      };
    });
    mocks.getCompany.mockImplementation(async () => {
      mocks.events.push("company");
      return { id: "company-1" };
    });
    mocks.requirePermission.mockImplementation(async () => {
      mocks.events.push("permission");
    });
  });

  it("renders invoice financial data and requests the current company's latest invoices", async () => {
    const markup = await renderPage({});

    expect(markup).toContain("INV-2026-0001");
    expect(markup).toContain("Acme Supplies");
    expect(markup).toContain("overdue");
    expect(markup).toContain("25 Sept 2026");
    expect(markup).toContain("01 Oct 2026");
    expect(markup).toContain("RM120.00");
    expect(markup).toContain("RM20.00");
    expect(markup).toContain("RM100.00");
    expect(mocks.requirePermission).toHaveBeenCalledWith(PERMISSIONS.INVOICE_VIEW);
    expect(mocks.listInvoices).toHaveBeenCalledWith({
      companyId: "company-1",
      q: undefined,
      status: undefined,
      from: undefined,
      to: undefined,
      sort: "created",
      dir: "desc",
      page: 1,
      pageSize: 20,
    });
  });

  it("preserves active filters when requesting the next page", async () => {
    const markup = await renderPage({
      q: "Acme",
      status: "overdue",
      from: "2026-09-01",
      to: "2026-10-31",
      sort: "issueDate",
      dir: "asc",
      page: "1",
    });

    expect(mocks.listInvoices).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "Acme",
        status: "overdue",
        from: "2026-09-01",
        to: "2026-10-31",
        sort: "issueDate",
        dir: "asc",
        page: 1,
      })
    );
    const links = Array.from(markup.matchAll(/href="([^"]+)"/g), (match) => match[1]);
    expect(links[1]).toBe(
      "?q=Acme&amp;status=overdue&amp;from=2026-09-01&amp;to=2026-10-31&amp;sort=issueDate&amp;dir=asc&amp;page=2"
    );
  });

  it("shows an empty state without linking to missing invoice screens", async () => {
    mocks.listInvoices.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    });

    const markup = await renderPage({});

    expect(markup).toContain("No invoices yet");
    expect(markup).not.toContain('href="/invoices/new"');
    expect(markup).not.toContain('href="/invoices/invoice-1"');
  });

  it("checks invoice permission before querying the list", async () => {
    await renderPage({ status: "overdue" });

    expect(mocks.events.indexOf("permission")).toBeGreaterThanOrEqual(0);
    expect(mocks.events.indexOf("permission")).toBeLessThan(mocks.events.indexOf("list"));
    expect(mocks.listInvoices).toHaveBeenCalledWith(
      expect.objectContaining({ status: "overdue" })
    );
  });
});
