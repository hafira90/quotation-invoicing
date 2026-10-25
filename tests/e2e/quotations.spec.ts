import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

import { ensureTestUser, TEST_EMAIL } from "./helpers";

/**
 * The core quotation lifecycle through the real UI: draft → issued →
 * accepted → converted, proving the server-side transition rules, the
 * atomic conversion and the shared calculation engine end to end.
 *
 * Every test creates its own customer so tests never depend on each other
 * or on module-scope random values.
 */
test.describe("quotations workflow", () => {
  const unique = () => randomUUID().slice(0, 8).toUpperCase();

  async function login(page: import("@playwright/test").Page) {
    const { password } = await ensureTestUser();
    await page.goto("/login");
    await page.fill("#email", TEST_EMAIL);
    await page.fill("#password", password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  }

  async function createCustomer(page: import("@playwright/test").Page, name: string) {
    await page.goto("/customers/new");
    await page.fill("#name", name);
    await page.getByRole("button", { name: "Create customer" }).click();
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  }

  async function pickCustomer(page: import("@playwright/test").Page, name: string) {
    await page.getByRole("combobox", { name: "Customer" }).click();
    await page.getByRole("option", { name }).click();
  }

  test("draft → issue → accept → convert to invoice", async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);

    const customerName = `E2E Quote Cust ${unique()}`;
    const lineName = `E2E Service ${unique()}`;
    await createCustomer(page, customerName);

    /* Draft ------------------------------------------------------------- */
    await page.goto("/quotations/new");
    await expect(page.getByRole("heading", { name: "New quotation" })).toBeVisible();

    await pickCustomer(page, customerName);
    await page.fill('input[aria-label="Line 1 name"]', lineName);
    await page.fill('input[aria-label="Line 1 quantity"]', "2");
    await page.fill('input[aria-label="Line 1 unit price"]', "150.50");

    // Live total: 2 × 150.50 = 301.00 (shown per line and in the summary)
    await expect(page.getByText("RM301.00").first()).toBeVisible();

    await page.getByRole("button", { name: "Save as draft" }).click();
    await page.waitForURL(/\/quotations\/[0-9a-f-]{36}/, { timeout: 30_000 });

    const quotationId = page.url().match(/quotations\/([0-9a-f-]{36})/)![1];
    await expect(page.getByRole("heading", { name: /QUO-/ })).toBeVisible();
    await expect(page.getByText("draft", { exact: true })).toBeVisible();
    await expect(page.getByText(lineName)).toBeVisible();

    /* Issue ------------------------------------------------------------- */
    await page.getByRole("button", { name: "Issue", exact: true }).click();
    await expect(page.getByText("issued", { exact: true })).toBeVisible({ timeout: 20_000 });

    // Issued quotations are immutable: no Edit link (exact match — substring
    // would hit "Credit Notes" in the sidebar).
    await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);

    /* Accept ------------------------------------------------------------ */
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await page.fill("#acceptanceName", "E2E Approver");
    await page.getByRole("button", { name: "Confirm acceptance" }).click();
    await expect(page.getByText("accepted", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Accepted by E2E Approver/)).toBeVisible();

    /* Convert ----------------------------------------------------------- */
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Convert to invoice" }).click();
    await expect(page.getByText(/Converted to invoice/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: /INV-\d{4}-\d+/ })).toBeVisible();
    await expect(page.getByText("converted", { exact: true })).toBeVisible();

    /* Second conversion is impossible ----------------------------------- */
    await expect(page.getByRole("button", { name: "Convert to invoice" })).toHaveCount(0);

    /* Editing a converted quotation redirects to the detail page --------- */
    await page.goto(`/quotations/${quotationId}/edit`);
    await page.waitForURL(new RegExp(`/quotations/${quotationId}$`));
    await expect(page.getByText(lineName)).toBeVisible();
  });

  test("draft-only guards are enforced on the server", async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);

    const customerName = `E2E Guard Cust ${unique()}`;
    await createCustomer(page, customerName);

    await page.goto("/quotations/new");
    await pickCustomer(page, customerName);
    await page.fill('input[aria-label="Line 1 name"]', "Guard test line");
    await page.fill('input[aria-label="Line 1 unit price"]', "10");
    await page.getByRole("button", { name: "Save as draft" }).click();
    await page.waitForURL(/\/quotations\/[0-9a-f-]{36}/, { timeout: 30_000 });

    await page.getByRole("button", { name: "Issue", exact: true }).click();
    await expect(page.getByText("issued", { exact: true })).toBeVisible({ timeout: 20_000 });

    // Editing an issued quotation redirects to the detail page — server side.
    const id = page.url().match(/quotations\/([0-9a-f-]{36})/)![1];
    await page.goto(`/quotations/${id}/edit`);
    await page.waitForURL(new RegExp(`/quotations/${id}$`));
    await expect(page.getByRole("heading", { name: /QUO-/ })).toBeVisible();

    // A random UUID 404s instead of showing another company's document.
    const missing = await page.goto(
      "/quotations/00000000-0000-0000-0000-000000000000"
    );
    expect(missing?.status()).toBe(404);
  });

  test("a signed-out visitor cannot reach quotations", async ({ page }) => {
    await page.goto("/quotations");
    expect(page.url()).toContain("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});
