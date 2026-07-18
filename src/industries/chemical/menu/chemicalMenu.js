/** Capability codes returned by GET /api/context enabled_capabilities. */
export const CHEM_CAPABILITIES = {
  RAW_MATERIAL_RECEIPT: "CHEM_RAW_MATERIAL_RECEIPT",
  RAW_MATERIAL_QC: "CHEM_RAW_MATERIAL_QC",
  REACTOR_CHARGE: "CHEM_REACTOR_CHARGE",
  REACTOR_PARAMETERS: "CHEM_REACTOR_PARAMETERS",
  BLEND_FORMULATION: "CHEM_BLEND_FORMULATION",
  BATCH_QC: "CHEM_BATCH_QC",
  BATCH_ANALYTICS: "CHEM_BATCH_ANALYTICS",
  TRACEABILITY: "CHEM_TRACEABILITY",
  ROUTING_BUILDER: "CHEM_ROUTING_BUILDER"
};

const BASE = "/chemical";

export const CHEMICAL_MENU = [
  {
    id: "dashboard",
    to: `${BASE}/dashboard`,
    label: "Dashboard",
    end: true,
    capability: null
  },
  {
    id: "raw-material-receipt",
    to: `${BASE}/raw-material-receipt`,
    label: "Raw Material Receipt",
    capability: CHEM_CAPABILITIES.RAW_MATERIAL_RECEIPT
  },
  {
    id: "reactor-parameters",
    to: `${BASE}/reactor-parameters`,
    label: "Reactor Parameters",
    capability: CHEM_CAPABILITIES.REACTOR_PARAMETERS
  },
  {
    id: "batch-qc",
    to: `${BASE}/batch-qc`,
    label: "Batch QC",
    capability: CHEM_CAPABILITIES.BATCH_QC
  },
  {
    id: "batch-analytics",
    to: `${BASE}/batch-analytics`,
    label: "Batch Analytics",
    capability: CHEM_CAPABILITIES.BATCH_ANALYTICS
  },
  {
    id: "traceability",
    to: `${BASE}/traceability`,
    label: "Traceability",
    capability: CHEM_CAPABILITIES.TRACEABILITY
  }
];

export function getChemicalMenu(enabledCapabilities = []) {
  const caps = new Set(enabledCapabilities || []);
  return CHEMICAL_MENU.filter((item) => !item.capability || caps.has(item.capability));
}
