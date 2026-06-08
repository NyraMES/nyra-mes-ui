import { chromium } from "playwright";

const BASE = "https://nyraservices-testbed.net/mes";
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
const failedReqs = [];

page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("requestfailed", (r) =>
  failedReqs.push(`${r.url()} (${r.failure()?.errorText || "failed"})`)
);

// 1. Landing page
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2000);
const landingText = await page.locator("body").innerText();
const rootLen = (await page.locator("#root").innerHTML()).length;
record("Landing page renders", rootLen > 500 && landingText.includes("Nyra Services"), `root=${rootLen}`);
record("No JS page errors on landing", pageErrors.length === 0, pageErrors.join("; ") || "ok");

// 2. Login page
await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 90000 });
const loginText = await page.locator("body").innerText();
record("Login page renders", loginText.includes("Sign in") || loginText.includes("Login") || loginText.includes("Cognito"), `len=${loginText.length}`);

// 3. API reachable from browser context
const apiHealth = await page.evaluate(async () => {
  const res = await fetch("https://nyraservices-testbed.net/mes/api/health");
  return { status: res.status, body: await res.json() };
});
record("API health from browser", apiHealth.status === 200 && apiHealth.body?.status === "ok", JSON.stringify(apiHealth.body));

const apiAuth = await page.evaluate(async () => {
  const res = await fetch("https://nyraservices-testbed.net/mes/api/auth/config");
  return { status: res.status, body: await res.json() };
});
record("Auth config from browser", apiAuth.status === 200 && apiAuth.body?.auth_enabled === true, JSON.stringify(apiAuth.body));

// 4. Protected route redirects to login
await page.goto(`${BASE}/activated-carbon/dashboard`, { waitUntil: "networkidle", timeout: 90000 });
const protectedUrl = page.url();
const protectedText = await page.locator("body").innerText();
record(
  "AC dashboard unauthenticated",
  protectedUrl.includes("/login") || protectedText.includes("Sign in") || protectedText.includes("Cognito"),
  `url=${protectedUrl}`
);

// 5. Failed network requests
const assetFails = failedReqs.filter((u) => u.includes("/mes/assets/"));
record("No failed asset requests", assetFails.length === 0, assetFails.join("; ") || "ok");

console.log("\n=== SUMMARY ===");
const failed = results.filter((r) => !r.ok);
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.log("Failed checks:");
  failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
  process.exitCode = 1;
}

await browser.close();
