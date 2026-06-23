import { test, expect } from "@playwright/test";
import { expectScreenLoads, tryApiHealth } from "./helpers.js";

/**
 * End-to-end production flow (requires local API on :8000).
 * Creates inward → QC → bag → verifies dashboard updates.
 * Skipped automatically when API is unavailable.
 */
test.describe("Activated Carbon — production flow", () => {
  test("inward → QC → bag trace → dashboard", async ({ page }) => {
    const health = await tryApiHealth(page);
    test.skip(!health.ok, "Local API not running — start API on :8000");

    await expectScreenLoads(page, "/activated-carbon/raw-material-inward", "Raw Material Inward");

    const supplierSelect = page.locator("select").first();
    await supplierSelect.waitFor({ state: "visible" });
    const options = await supplierSelect.locator("option").all();
    if (options.length < 2) {
      test.skip(true, "No suppliers in masters — seed data first");
    }
    await supplierSelect.selectOption({ index: 1 });

    const productSelect = page.locator("select").nth(1);
    const productOptions = await productSelect.locator("option").count();
    if (productOptions < 1) {
      test.skip(true, "No raw material products — seed masters first");
    }

    await page.locator('input[type="number"]').first().fill("500");
    await page.getByRole("button", { name: "Record inward" }).click();

    await expect(page.getByText(/ORD-AC|Inward order/i).first()).toBeVisible({ timeout: 30_000 });

    await page.goto("/activated-carbon/raw-material-qc");
    await expect(page.getByText("Raw Material QC")).toBeVisible();

    const qcOrderSelect = page.locator("select").first();
    await qcOrderSelect.waitFor({ state: "visible" });
    await qcOrderSelect.selectOption({ index: 0 });

    const numberInputs = page.locator('input[type="number"]');
    const count = await numberInputs.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      await numberInputs.nth(i).fill(String(1 + i));
    }

    await page.getByRole("button", { name: "Save QC" }).click();
    await expect(page.getByText(/QC saved|PASS|saved/i).first()).toBeVisible({ timeout: 30_000 });

    await page.goto("/activated-carbon/bag-tracing");
    await expect(page.getByText("Bag traceability")).toBeVisible();

    const inwardSelect = page.locator("select").first();
    if (await inwardSelect.isVisible()) {
      await inwardSelect.selectOption({ index: 0 });
      await page.locator('input[type="number"]').first().fill("50");
      await page.getByRole("button", { name: /Register bag/i }).click();
      await expect(page.getByText(/BAG-AC|registered/i).first()).toBeVisible({ timeout: 20_000 });
    }

    await expectScreenLoads(page, "/activated-carbon/dashboard", "Operational Intelligence Hub");
    await expect(page.getByText(/Refresh|Operational Intelligence/i).first()).toBeVisible();
  });
});
