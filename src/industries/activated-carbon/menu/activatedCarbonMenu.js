/** Capability codes returned by GET /api/context enabled_capabilities. */
export const AC_CAPABILITIES = {
  RAW_MATERIAL_INWARD: "AC_RAW_MATERIAL_INWARD",
  RAW_MATERIAL_QC: "AC_RAW_MATERIAL_QC",
  KILN_FEED: "AC_KILN_FEED",
  HOURLY_KILN_PARAMETERS: "AC_HOURLY_KILN_PARAMETERS",
  SCREENING: "AC_SCREENING",
  BAG_TRACING: "AC_BAG_TRACING",
  REPORTS: "AC_REPORTS",
  QUALITY_TESTING: "AC_QUALITY_TESTING",
  YIELD_ANALYSIS: "AC_YIELD_ANALYSIS",
  TRACEABILITY: "AC_TRACEABILITY",
  DISPATCH: "AC_DISPATCH",
  ROUTING_BUILDER: "AC_ROUTING_BUILDER",
  MASTERS: "AC_MASTERS"
};

const BASE = "/activated-carbon";

/** All menu items; filtered at runtime by enabled capabilities. */
export const ACTIVATED_CARBON_MENU = [
  {
    id: "dashboard",
    to: `${BASE}/dashboard`,
    label: "Dashboard",
    end: true,
    capability: null
  },
  {
    id: "kiln-telemetry",
    to: `${BASE}/kiln-telemetry`,
    label: "Kiln Telemetry",
    capability: null
  },
  {
    id: "raw-material",
    to: `${BASE}/raw-material?tab=inward`,
    label: "Raw Material",
    capability: AC_CAPABILITIES.RAW_MATERIAL_INWARD
  },
  {
    id: "bag-tracing",
    to: `${BASE}/bag-tracing`,
    label: "Bag traceability",
    capability: AC_CAPABILITIES.BAG_TRACING
  },
  {
    id: "execution",
    to: `${BASE}/execution`,
    label: "Execution",
    capability: null
  },
  {
    id: "customer-sales",
    to: `${BASE}/customer-sales`,
    label: "Customer PO",
    capability: null
  },
  {
    id: "dispatch",
    to: `${BASE}/dispatch`,
    label: "Dispatch",
    capability: null
  },
  {
    id: "reports",
    to: `${BASE}/reports`,
    label: "Reports",
    capability: AC_CAPABILITIES.REPORTS
  },
  {
    id: "users",
    to: `${BASE}/users`,
    label: "Users",
    capability: null
  },
  {
    id: "masters",
    to: `${BASE}/masters`,
    label: "Masters",
    capability: null
  },
  {
    id: "routing-builder",
    to: `${BASE}/routing-builder`,
    label: "Routing Builder",
    capability: null
  }
];

/**
 * @param {string[] | null | undefined} enabledCapabilities
 */
export function getActivatedCarbonMenu(enabledCapabilities) {
  const caps = new Set(enabledCapabilities || []);
  return ACTIVATED_CARBON_MENU.filter(
    (item) => !item.capability || caps.has(item.capability)
  );
}
