import { test } from "@playwright/test";
import { expectScreenLoads } from "./helpers.js";

const WORKFLOW_ROUTES = [
  { path: "/workflow", heading: "Operational Intelligence Hub" },
  { path: "/workflow/customer-order", heading: /Capture customer demand/i },
  { path: "/workflow/production-order", heading: /Release production/i },
  { path: "/workflow/lot-split", heading: /Divide demand into manufacturable lots/i },
  { path: "/workflow/routing", heading: /Operation sequence|Process Routing/i },
  { path: "/workflow/feasibility", heading: /Can this lot run right now/i },
  { path: "/workflow/scheduling", heading: /Assign route operations/i },
  { path: "/workflow/execution", heading: /Shop floor/i },
  { path: "/workflow/inspection", heading: /Quality gate|Inspection/i },
  { path: "/workflow/dispatch", heading: /Ship only|Dispatch/i },
  { path: "/workflow/traceability", heading: /Manufacturing genealogy|Genealogy/i },
  { path: "/workflow/oee", heading: /OEE/i },
  { path: "/workflow/ontology", heading: /Domain Graph/i },
  { path: "/workflow/kg", heading: /Staged KG Triples/i },
  { path: "/workflow/masters/customers", heading: /Customer/i },
  { path: "/workflow/masters/parts", heading: /Part/i },
  { path: "/workflow/masters/routings", heading: /Routing/i }
];

test.describe("Workflow Intelligence — route smoke", () => {
  for (const route of WORKFLOW_ROUTES) {
    test(`loads ${route.path}`, async ({ page }) => {
      await expectScreenLoads(page, route.path, route.heading);
    });
  }
});
