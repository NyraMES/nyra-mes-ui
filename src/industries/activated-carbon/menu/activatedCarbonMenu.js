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
    to: `${BASE}/raw-material-inward`,
    label: "Raw Material Inward",
    capability: AC_CAPABILITIES.RAW_MATERIAL_INWARD
  },
  {
    id: "raw-material-qc",
    to: `${BASE}/raw-material-qc`,
    label: "Raw Material QC",
    capability: AC_CAPABILITIES.RAW_MATERIAL_QC
  },
  {
    id: "bag-tracing",
    to: `${BASE}/bag-tracing`,
    label: "Bag traceability",
    capability: AC_CAPABILITIES.BAG_TRACING
  },
  {
    id: "feasibility",
    to: `${BASE}/feasibility`,
    label: "Feasibility Gate",
    capability: null
  },
  {
    id: "kiln-feed",
    to: `${BASE}/kiln-feed`,
    label: "Kiln Feed",
    capability: AC_CAPABILITIES.KILN_FEED
  },
  {
    id: "routing",
    to: `${BASE}/routing`,
    label: "Lot Routing",
    capability: null
  },
  {
    id: "execution",
    to: `${BASE}/execution`,
    label: "Execution",
    capability: null
  },
  {
    id: "screening",
    to: `${BASE}/screening`,
    label: "Screening",
    capability: AC_CAPABILITIES.SCREENING
  },
  {
    id: "kiln-parameters",
    to: `${BASE}/kiln-parameters`,
    label: "Kiln Parameters",
    capability: AC_CAPABILITIES.HOURLY_KILN_PARAMETERS
  },
  {
    id: "quality-testing",
    to: `${BASE}/quality-testing`,
    label: "Quality Testing",
    capability: AC_CAPABILITIES.QUALITY_TESTING
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
    id: "yield",
    to: `${BASE}/yield-analysis`,
    label: "Yield Analysis",
    capability: AC_CAPABILITIES.YIELD_ANALYSIS
  },
  {
    id: "traceability",
    to: `${BASE}/traceability`,
    label: "Traceability",
    capability: AC_CAPABILITIES.TRACEABILITY
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
