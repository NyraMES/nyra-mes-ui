import { AC_TRIPLET_PREDICATES } from "./acTripletOntology";

/** Default inward receipt fields — staged as triplets on POST raw-material-inward. */
export const DEFAULT_AC_INWARD_RECEIPT_PARAMETERS = [
  {
    key: "dc_number",
    label: "DC number",
    unit: "",
    fieldType: "text",
    ontologyPredicate: "captures",
    enabled: true,
    sortOrder: 1
  },
  {
    key: "supplier_weight_kg",
    label: "Supplier weight",
    unit: "kg",
    fieldType: "number",
    step: 0.01,
    min: 0,
    ontologyPredicate: "captures",
    enabled: true,
    sortOrder: 2
  },
  {
    key: "our_weight_kg",
    label: "Our weight",
    unit: "kg",
    fieldType: "number",
    step: 0.01,
    min: 0,
    ontologyPredicate: "captures",
    enabled: true,
    sortOrder: 3
  },
  {
    key: "supplier_value_inr",
    label: "Supplier value",
    unit: "INR",
    fieldType: "number",
    step: 0.01,
    min: 0,
    ontologyPredicate: "captures",
    enabled: true,
    sortOrder: 3
  }
];

/** Default raw material QC field catalog — maps to triplet predicates on save (API stages triples). */
export const DEFAULT_AC_QC_PARAMETERS = [
  {
    key: "moisture_pct",
    label: "Moisture",
    unit: "%",
    fieldType: "number",
    step: 0.01,
    ontologyPredicate: "captures",
    chartSeries: null,
    chartColor: null,
    enabled: true,
    sortOrder: 1
  },
  {
    key: "ash_pct",
    label: "Ash",
    unit: "%",
    fieldType: "number",
    step: 0.01,
    ontologyPredicate: "captures",
    chartSeries: null,
    chartColor: null,
    enabled: true,
    sortOrder: 2
  },
  {
    key: "foreign_matter_pct",
    label: "Foreign matter",
    unit: "%",
    fieldType: "number",
    step: 0.01,
    ontologyPredicate: "captures",
    chartSeries: null,
    chartColor: null,
    enabled: true,
    sortOrder: 3
  },
  {
    key: "stones_kg",
    label: "Stones",
    unit: "kg",
    fieldType: "number",
    step: 0.1,
    min: 0,
    ontologyPredicate: "hasStonesKg",
    chartSeries: "Stones",
    chartColor: "#87CEEB",
    enabled: true,
    sortOrder: 4
  },
  {
    key: "unburnt_kg",
    label: "Unburnt",
    unit: "kg",
    fieldType: "number",
    step: 0.1,
    min: 0,
    ontologyPredicate: "hasUnburntKg",
    chartSeries: "Unburnt",
    chartColor: "#10B981",
    enabled: true,
    sortOrder: 5
  },
  {
    key: "minus20_kg",
    label: "-20 mesh fines",
    unit: "kg",
    fieldType: "number",
    step: 0.1,
    min: 0,
    ontologyPredicate: "hasMinus20Kg",
    chartSeries: "Minus20",
    chartColor: "#FFB74D",
    enabled: true,
    sortOrder: 6
  },
  {
    key: "operator_remarks",
    label: "Operator remarks",
    unit: "",
    fieldType: "textarea",
    ontologyPredicate: null,
    chartSeries: null,
    chartColor: null,
    enabled: true,
    sortOrder: 7
  }
];

/** Finished-goods quality test fields — triplet-linked on save (Quality Testing page). */
export const DEFAULT_AC_QUALITY_PARAMETERS = [
  {
    key: "iodine_mg_g",
    label: "Iodine number",
    unit: "mg/g",
    fieldType: "number",
    step: 0.1,
    min: 0,
    ontologyPredicate: "captures",
    enabled: true,
    sortOrder: 1
  },
  {
    key: "ash_pct",
    label: "Ash",
    unit: "%",
    fieldType: "number",
    step: 0.01,
    ontologyPredicate: "captures",
    enabled: true,
    sortOrder: 2
  },
  {
    key: "moisture_pct",
    label: "Moisture",
    unit: "%",
    fieldType: "number",
    step: 0.01,
    ontologyPredicate: "captures",
    enabled: true,
    sortOrder: 3
  },
  {
    key: "bulk_density",
    label: "Bulk density",
    unit: "g/cm³",
    fieldType: "text",
    placeholder: "e.g. 0.52",
    ontologyPredicate: "captures",
    enabled: true,
    sortOrder: 4
  },
  {
    key: "remarks",
    label: "Remarks",
    unit: "",
    fieldType: "textarea",
    ontologyPredicate: null,
    enabled: true,
    sortOrder: 5
  }
];

/** Dashboard panel manifest — toggled from Masters → Ontology & UI. */
export const DEFAULT_AC_DASHBOARD_PANELS = [
  { id: "kpi-shop-floor", label: "Production & stock", enabled: true, colSpan: 8, sortOrder: 1 },
  { id: "isa95-sidebar", label: "Production KPIs (sidebar)", enabled: true, colSpan: 4, sortOrder: 2 },
  { id: "flow-pipeline", label: "Live pipeline", enabled: true, colSpan: 12, sortOrder: 3 },
  { id: "kiln-live-load", label: "Kiln live load", enabled: true, colSpan: 12, sortOrder: 4 },
  { id: "yield-reports", label: "Yield reports", enabled: true, colSpan: 12, sortOrder: 5 },
  { id: "lot-registry", label: "Production lots", enabled: true, colSpan: 12, sortOrder: 6 }
];

export const AC_ONTOLOGY_PREDICATE_OPTIONS = [
  { value: "", label: "— (no triple)" },
  ...Object.entries(AC_TRIPLET_PREDICATES).map(([key, uri]) => ({
    value: key,
    label: `${key} → ${uri}`
  }))
];

export function getDefaultAcOntologyConfig() {
  return {
    version: 2,
    qcParameters: DEFAULT_AC_QC_PARAMETERS.map((row) => ({ ...row })),
    qualityParameters: DEFAULT_AC_QUALITY_PARAMETERS.map((row) => ({ ...row })),
    dashboardPanels: DEFAULT_AC_DASHBOARD_PANELS.map((row) => ({ ...row }))
  };
}
