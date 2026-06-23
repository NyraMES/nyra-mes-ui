import { test, expect } from "@playwright/test";
import { expectScreenLoads, tryApiHealth } from "./helpers.js";

test.describe("Global smoke", () => {
  test("landing page renders", async ({ page }) => {
    await expectScreenLoads(page, "/", /Nyra Services|Manufacturing Workflow/i);
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const url = page.url();
    const text = await page.locator("body").innerText();

    // Auth disabled in .env.ac — login redirects to landing or dashboard.
    if (!url.includes("/login")) {
      expect(text.length).toBeGreaterThan(80);
      expect(text).toMatch(/Nyra|Dashboard|Operational|Manufacturing|Activated Carbon/i);
      return;
    }

    expect(text.length).toBeGreaterThan(50);
    expect(text).toMatch(/Sign in|Login|Password|Cognito/i);
  });

  test("API health reachable when backend is running", async ({ page }) => {
    const health = await tryApiHealth(page);
    test.skip(!health.ok, "Local API not running on :8000 — start with run_local_api.ps1");
    expect(health.status).toBe(200);
    expect(health.body?.status).toBe("ok");
  });

  test("legacy dashboard route loads", async ({ page }) => {
    await expectScreenLoads(page, "/dashboard", /Dashboard|MES|Operational/i);
  });
});
