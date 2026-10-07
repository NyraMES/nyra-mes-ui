import { test } from "@playwright/test";
import { expectScreenLoads, openActivatedCarbonFromLanding } from "./helpers.js";

/** Every AC screen — smoke load only (no save actions). */
const AC_ROUTES = [
  { path: "/activated-carbon/dashboard", heading: "Operational Intelligence Hub" },
  { path: "/activated-carbon/raw-material-inward", heading: "Raw Material Inward" },
  { path: "/activated-carbon/raw-material-qc", heading: "Raw Material QC" },
  { path: "/activated-carbon/bag-tracing", heading: "Bag traceability" },
  { path: "/activated-carbon/kiln-feed", heading: "Kiln Feed" },
  { path: "/activated-carbon/feasibility", heading: /Can this lot run right now/i },
  { path: "/activated-carbon/routing", heading: /Operation sequence per lot/i },
  { path: "/activated-carbon/execution", heading: "Execution" },
  { path: "/activated-carbon/screening", heading: "Execution" },
  { path: "/activated-carbon/kiln-parameters", heading: "Execution" },
  { path: "/activated-carbon/quality-testing", heading: "Execution" },
  { path: "/activated-carbon/customer-sales", heading: "Customer purchase order" },
  { path: "/activated-carbon/dispatch", heading: "Dispatch" },
  { path: "/activated-carbon/reports", heading: "Production reports" },
  { path: "/activated-carbon/yield-analysis", heading: "Operational Intelligence Hub" },
  { path: "/activated-carbon/traceability", heading: "Operational Intelligence Hub" },
  { path: "/activated-carbon/masters", heading: "Masters" },
  { path: "/activated-carbon/routing-builder", heading: "Routing Builder" },
  { path: "/activated-carbon/masters?tab=ontology-ui", heading: /Triplet ontology|Ontology/i }
];

test.describe("Activated Carbon — route smoke", () => {
  test.beforeEach(async ({ page }) => {
    await openActivatedCarbonFromLanding(page);
  });

  for (const route of AC_ROUTES) {
    test(`loads ${route.path}`, async ({ page }) => {
      await expectScreenLoads(page, route.path, route.heading);
    });
  }
});
