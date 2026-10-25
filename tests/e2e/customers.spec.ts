import { expect, test } from "@playwright/test";

import { ensureTestUser, uniqueCustomerName, TEST_EMAIL } from "./helpers";
import { randomUUID } from "crypto";

/**
 * Full-stack check: real browser → real form → server action → Postgres.
 * This is the acceptance evidence that the customers module is wired up,
 * not just rendered.
 */
test.describe("customers module", () => {
  const customerName = uniqueCustomerName();
  const customerEmail = `apac-${randomUUID().slice(0, 8)}@example.com`;
  // Unique per run: a repeated phone would (correctly) trip duplicate detection.
  const customerPhone = `+601${String(Math.floor(Math.random() * 100000000)).padStart(8, "0")}`;

  test("login, create a customer, and see it persist", async ({ page }) => {
    const { password } = await ensureTestUser();

    /* Login ------------------------------------------------------------- */
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    await page.fill("#email", TEST_EMAIL);
    await page.fill("#password", password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    /* Create ------------------------------------------------------------- */
    await page.goto("/customers/new");
    await expect(page.getByRole("heading", { name: "New customer" })).toBeVisible();

    await page.fill("#name", customerName);
    await page.fill("#email", customerEmail);
    await page.fill("#phone", customerPhone);
    await page.fill("#billingAddress", "Level 28, Menara Contoso\nJalan Ampang\n50450 Kuala Lumpur");
    await page.getByRole("button", { name: "Create customer" }).click();

    // Lands on the detail page for the new record.
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: customerName })).toBeVisible();
    await expect(page.getByText(customerEmail)).toBeVisible();

    /* Persisted across a fresh navigation -------------------------------- */
    await page.goto("/customers");
    await page.fill("#q", customerName);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("link", { name: customerName })).toBeVisible();

    /* Server-side search by email too ------------------------------------ */
    await page.fill("#q", customerEmail);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("link", { name: customerName })).toBeVisible();
  });

  test("editing keeps the record and shows updated values", async ({ page }) => {
    const { password } = await ensureTestUser();

    await page.goto("/login");
    await page.fill("#email", TEST_EMAIL);
    await page.fill("#password", password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    await page.goto("/customers");
    await page.fill("#q", customerName);
    await page.getByRole("button", { name: "Apply" }).click();
    await page.getByRole("link", { name: customerName }).click();

    await page.waitForURL(/\/customers\/[0-9a-f-]{36}/);
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await page.waitForURL(/\/edit/);

    const reference = `PO-${randomUUID().slice(0, 8).toUpperCase()}`;
    await page.fill("#customerReference", reference);
    await page.getByRole("button", { name: "Save changes" }).click();

    await page.waitForURL(/\/customers\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByText(reference)).toBeVisible();
  });

  test("warns about a possible duplicate before creating", async ({ page }) => {
    const { password } = await ensureTestUser();
    // Self-contained: this test creates its own record, then repeats the
    // exact same name so the duplicate path is deterministic.
    const name = uniqueCustomerName();

    await page.goto("/login");
    await page.fill("#email", TEST_EMAIL);
    await page.fill("#password", password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    await page.goto("/customers/new");
    await page.fill("#name", name);
    await page.getByRole("button", { name: "Create customer" }).click();
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}/, { timeout: 30_000 });

    // Same name again → server must warn instead of saving.
    await page.goto("/customers/new");
    await page.fill("#name", name);
    await page.getByRole("button", { name: "Create customer" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "already exists" })).toBeVisible({
      timeout: 20_000,
    });
    expect(page.url()).toContain("/customers/new");
  });

  test("a signed-out visitor cannot reach the customers list", async ({ page }) => {
    const response = await page.goto("/customers");
    // Either a redirect to /login or a login-rendered page — never the data.
    expect(page.url()).toContain("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(await page.locator("text=" + customerName).count()).toBe(0);
    void response;
  });
});
