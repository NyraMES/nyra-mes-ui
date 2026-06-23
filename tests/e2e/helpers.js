import { expect } from "@playwright/test";

/** Collect uncaught page errors during navigation. */
export function trackPageErrors(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

/**
 * Navigate and assert the screen rendered (no blank page, no JS crash).
 * @param {import('@playwright/test').Page} page
 * @param {string} path
 * @param {string | RegExp} [heading] - visible text expected on screen
 */
export async function expectScreenLoads(page, path, heading) {
  const errors = trackPageErrors(page);
  const response = await page.goto(path, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });

  expect(response, `No response for ${path}`).not.toBeNull();
  expect(response.status(), `HTTP ${response.status()} for ${path}`).toBeLessThan(400);

  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

  const rootHtml = await page.locator("#root").innerHTML();
  expect(rootHtml.length, `#root empty on ${path}`).toBeGreaterThan(200);

  const bodyText = await page.locator("body").innerText();
  expect(bodyText.length, `body empty on ${path}`).toBeGreaterThan(80);

  if (heading instanceof RegExp) {
    await expect(page.getByText(heading).first()).toBeVisible();
  } else if (heading) {
    await expect(page.getByText(heading, { exact: false }).first()).toBeVisible();
  }

  expect(errors, `JS errors on ${path}: ${errors.join("; ")}`).toEqual([]);
}

/** Open Activated Carbon module from landing (auth disabled local mode). */
export async function openActivatedCarbonFromLanding(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const tile = page.getByRole("button", { name: /Activated Carbon Plant/i });
  if (await tile.isVisible().catch(() => false)) {
    await tile.click();
    await page.waitForURL(/activated-carbon/, { timeout: 45_000 });
  } else {
    await page.goto("/activated-carbon/dashboard");
  }
}

/** Optional API health check — skips assertion when API is down. */
export async function tryApiHealth(page, apiBase = "http://127.0.0.1:8000") {
  return page.evaluate(async (base) => {
    try {
      const res = await fetch(`${base}/api/health`);
      return { ok: res.ok, status: res.status, body: await res.json().catch(() => null) };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }, apiBase);
}
