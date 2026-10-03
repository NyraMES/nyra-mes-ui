/**
 * Default capture parameters per workspace routing operation.
 * Shown on Execution (Routing Builder can override per operation).
 */

function defineParam(code, name, opts = {}) {
  return {
    parameter_id: `def-${String(code).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    parameter_code: code,
    parameter_name: name,
    data_type: opts.type || "number",
    unit: opts.unit || "",
    min_value: opts.min ?? null,
    max_value: opts.max ?? null,
    mandatory: opts.mandatory !== false
  };
}

export const OPERATION_PARAMETER_DEFAULTS = {
  RAW_MATERIAL_INWARD: [
    defineParam("RECEIVED_QTY_KG", "Received quantity", { unit: "kg", min: 0 }),
    defineParam("DC_NUMBER", "DC number", { type: "string", mandatory: false }),
    defineParam("SUPPLIER_WEIGHT_KG", "Supplier weight", { unit: "kg", min: 0, mandatory: false }),
    defineParam("SUPPLIER_VALUE_INR", "Supplier value", { unit: "INR", min: 0, mandatory: false }),
    defineParam("MOISTURE_PCT", "Moisture", { unit: "%", min: 0, max: 100 }),
    defineParam("SUPPLIER_BATCH", "Supplier batch ID", { type: "string", mandatory: false })
  ],
  RAW_MATERIAL_QC: [
    defineParam("MOISTURE_PCT", "Moisture", { unit: "%", min: 0, max: 100 }),
    defineParam("ASH_PCT", "Ash content", { unit: "%", min: 0, max: 100 }),
    defineParam("VISUAL_DUST_PCT", "Visual dust", { unit: "%", min: 0, max: 100 }),
    defineParam("QC_PASS", "QC pass", { type: "boolean" })
  ],
  FEASIBILITY_GATE: [
    defineParam("MATERIAL_OK", "Material available", { type: "boolean" }),
    defineParam("KILN_OK", "Kiln available", { type: "boolean" }),
    defineParam("CREW_OK", "Crew available", { type: "boolean" }),
    defineParam("GATE_REMARKS", "Remarks", { type: "string", mandatory: false })
  ],
  KILN_FEED: [
    defineParam("CHARGE_KG", "Charge weight", { unit: "kg", min: 0 }),
    defineParam("BED_LEVEL_PCT", "Bed level", { unit: "%", min: 0, max: 100 }),
    defineParam("FEED_RATE_KG_H", "Feed rate", { unit: "kg/h", min: 0 })
  ],
  KILN_ACTIVATION: [
    defineParam("ZONE1_TEMP_C", "Zone 1 temperature", { unit: "°C", min: 0 }),
    defineParam("ZONE2_TEMP_C", "Zone 2 temperature", { unit: "°C", min: 0 }),
    defineParam("STEAM_FLOW_KG_H", "Steam flow", { unit: "kg/h", min: 0 }),
    defineParam("RESIDENCE_TIME_MIN", "Residence time", { unit: "min", min: 0 }),
    defineParam("O2_PCT", "O₂ level", { unit: "%", min: 0, max: 21 })
  ],
  COOLING: [
    defineParam("COOLING_TIME_MIN", "Cooling time", { unit: "min", min: 0 }),
    defineParam("DISCHARGE_TEMP_C", "Discharge temperature", { unit: "°C", min: 0 })
  ],
  SCREENING: [
    defineParam("MESH_SIZE", "Mesh size", { type: "string" }),
    defineParam("GOOD_KG", "Good fraction", { unit: "kg", min: 0 }),
    defineParam("OVERS_KG", "Overs", { unit: "kg", min: 0 }),
    defineParam("FINES_KG", "Fines", { unit: "kg", min: 0 })
  ],
  GRADE_SEPARATION: [
    defineParam("GRADE_CODE", "Grade code", { type: "string" }),
    defineParam("YIELD_PCT", "Yield", { unit: "%", min: 0, max: 100 }),
    defineParam("SEPARATED_KG", "Separated mass", { unit: "kg", min: 0 })
  ],
  QUALITY_TESTING: [
    defineParam("IODINE_MG_G", "Iodine number", { unit: "mg/g", min: 0 }),
    defineParam("ASH_PCT", "Ash", { unit: "%", min: 0, max: 100 }),
    defineParam("MOISTURE_PCT", "Moisture", { unit: "%", min: 0, max: 100 }),
    defineParam("BULK_DENSITY", "Bulk density", { type: "string", mandatory: false }),
    defineParam("QC_REMARKS", "Remarks", { type: "string", mandatory: false })
  ],
  FINISHED_GOODS_PACKING: [
    defineParam("PACKED_QTY_KG", "Packed quantity", { unit: "kg", min: 0 }),
    defineParam("BAG_COUNT", "Bag count", { min: 0 })
  ],
  DISPATCH: [
    defineParam("DISPATCH_QTY_KG", "Dispatch quantity", { unit: "kg", min: 0 }),
    defineParam("VEHICLE_NO", "Vehicle number", { type: "string" }),
    defineParam("TRANSPORTER", "Transporter", { type: "string", mandatory: false })
  ]
};

export function getDefaultParametersForOperation(operationCode) {
  const code = String(operationCode || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
  const rows = OPERATION_PARAMETER_DEFAULTS[code];
  return rows ? rows.map((row) => ({ ...row })) : [];
}

/** Fill empty parameter lists (and missing resource flags) from industry defaults. */
export function enrichOperationWithDefaults(operation) {
  if (!operation || typeof operation !== "object") return operation;

  const code = String(operation.operation_code || "").trim();
  const defaults = getDefaultParametersForOperation(code);
  const parameters =
    operation.parameters?.length > 0
      ? operation.parameters
      : defaults.map((p) => ({ ...p }));

  return {
    ...operation,
    parameters,
    requires_machine:
      operation.requires_machine != null ? operation.requires_machine : undefined,
    requires_labor:
      operation.requires_labor != null ? operation.requires_labor : undefined,
    requires_tools:
      operation.requires_tools != null ? operation.requires_tools : undefined
  };
}

export function enrichRoutingOperations(operations = []) {
  return operations.map(enrichOperationWithDefaults);
}
