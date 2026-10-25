import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

import { ensureTestUser, TEST_EMAIL } from "./helpers";

/**
 * Full-stack check for the catalogue module: real browser → real form →
 * server action → Postgres, plus CSV import/export through the actual routes.
 */
test.describe("products module", () => {
  const sku = `SKU-${randomUUID().slice(0, 8).toUpperCase()}`;
  const productName = `E2E Test Item ${randomUUID().slice(0, 8)}`;

  async function login(page: import("@playwright/test").Page) {
    const { password } = await ensureTestUser();
    await page.goto("/login");
    await page.fill("#email", TEST_EMAIL);
    await page.fill("#password", password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  }

  test("creates an item and it persists in the catalogue", async ({ page }) => {
    await login(page);

    await page.goto("/products/new");
    await expect(page.getByRole("heading", { name: "New item" })).toBeVisible();

    await page.fill("#name", productName);
    await page.fill("#sku", sku);
    await page.fill("#unitPrice", "1234.56");
    await page.fill("#costPrice", "700");
    await page.getByRole("button", { name: "Create item" }).click();

    await page.waitForURL(/\/products$/, { timeout: 30_000 });

    // Search server-side: the row must come back from Postgres.
    await page.fill("#q", sku);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("link", { name: productName })).toBeVisible();
    await expect(page.getByText("RM1,234.56")).toBeVisible();
    await expect(page.getByText("RM700.00")).toBeVisible();
  });

  test("warns on a duplicate SKU instead of saving twice", async ({ page }) => {
    await login(page);

    await page.goto("/products/new");
    await page.fill("#name", productName);
    await page.fill("#sku", sku);
    await page.fill("#unitPrice", "99.90");
    await page.getByRole("button", { name: "Create item" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "already exists" })).toBeVisible({
      timeout: 20_000,
    });
    expect(page.url()).toContain("/products/new");
  });

  test("imports a CSV with a per-row report", async ({ page }) => {
    await login(page);

    const importName = `E2E Import Item ${randomUUID().slice(0, 8)}`;
    const csv = [
      "name,unitPrice,kind,sku,unit",
      `"${importName}",42.50,service,IMP-${randomUUID().slice(0, 6).toUpperCase()},hour`,
      `"Broken Row",not-a-number,service,IMP-BAD,hour`,
    ].join("\n");

    await page.goto("/products/import");
    await expect(page.getByRole("heading", { name: "Import catalogue from CSV" })).toBeVisible();

    await page.setInputFiles("#file", {
      name: "catalogue.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });
    await page.getByRole("button", { name: "Import" }).click();

    // One good row, one reported failure — with its line number.
    await expect(page.getByText(/Imported 1 item, skipped 1/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Imported", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Must be a positive number/)).toBeVisible();

    // The imported item is queryable through the list.
    await page.goto("/products");
    await page.fill("#q", importName);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("link", { name: importName })).toBeVisible();
  });

  test("CSV export returns escaped rows to an authorised user", async ({ page }) => {
    await login(page);

    const res = await page.request.get("/api/products/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");

    const body = await res.text();
    expect(body).toContain("name,kind,sku");
    expect(body).toContain(productName);
    expect(body).toContain("costPrice"); // super_admin holds product.cost
  });

  test("a signed-out visitor cannot reach the catalogue or its export", async ({ page }) => {
    await page.goto("/products");
    expect(page.url()).toContain("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    const res = await page.request.get("/api/products/export");
    expect(res.status()).toBe(401);
  });
});
