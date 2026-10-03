/** Standard AC process steps for routing nodes. */
export const AC_PROCESS_STEP_OPTIONS = [
  { value: "KILN_FEED", label: "Kiln Feed / Charge" },
  { value: "PYROLYSIS", label: "Pyrolysis / Carbonization" },
  { value: "ACTIVATION", label: "Steam Activation" },
  { value: "DRYING", label: "Drying" },
  { value: "GRINDING", label: "Grinding / Milling" },
  { value: "DESTONING", label: "Destoning" },
  { value: "SCREENING", label: "Screening & Classification" },
  { value: "GRADE_SEPARATION", label: "Grade separation" },
  { value: "QC", label: "Quality Testing (→ in stock)" },
  { value: "PACKING", label: "Packing" }
];

/** Admin-configurable steps between inward receipt and release. */
export const AC_INBOUND_PROCESS_STEP_OPTIONS = [
  { value: "CRUSHING", label: "Crushing / Sizing" },
  { value: "DRYING", label: "Drying" },
  { value: "GRINDING", label: "Grinding / Milling" },
  { value: "DESTONING", label: "Destoning" },
  { value: "SCREENING", label: "Pre-QC Screening" },
  { value: "PACKING", label: "Re-bagging / Packing" }
];

export function defaultOperationForStep(processStep, sequence) {
  const opt = AC_PROCESS_STEP_OPTIONS.find((o) => o.value === processStep);
  const code = `OP-${processStep}`;
  return {
    operation_sequence: sequence,
    operation_name: opt?.label || processStep,
    operation_code: code,
    process_step: processStep
  };
}

export function nextOperationSequence(operations) {
  if (!operations?.length) return 1;
  return Math.max(...operations.map((o) => Number(o.operation_sequence) || 0)) + 1;
}

export function suggestOperationCode(processStep, sequence) {
  return `OP-${(processStep || "STEP").toUpperCase().replace(/\s+/g, "-")}`;
}

/** User-facing label — legacy routings use PYROLYSIS for the kiln charge step. */
export function displayOperationLabel(operation) {
  const step = String(operation?.process_step || "").toUpperCase();
  const name = String(operation?.operation_name || "").trim();
  if (step === "KILN_FEED") return name || "Kiln Feed / Charge";
  if (step === "PYROLYSIS") {
    return name.toLowerCase().includes("kiln") ? name : "Kiln Feed (Pyrolysis)";
  }
  return name || step || "Process step";
}

/** Shop-floor / inbound list label from an operation name or process_step code. */
export function displayInboundStepLabel(stepOrName) {
  if (stepOrName && typeof stepOrName === "object") {
    const name = String(stepOrName.operation_name || "").trim();
    if (name) return name;
    stepOrName = stepOrName.process_step;
  }
  const raw = String(stepOrName || "").trim();
  if (!raw) return "Inbound step";
  const code = raw.toUpperCase().replace(/\s+/g, "_");
  const opt =
    AC_INBOUND_PROCESS_STEP_OPTIONS.find((o) => o.value === code) ||
    AC_PROCESS_STEP_OPTIONS.find((o) => o.value === code);
  return opt?.label || raw;
}

/** Lab capture — moisture, dust, AD, approve/deny. Do not inherit other SCREENING fields. */
export const AC_LAB_INBOUND_PARAMETERS = [
  { key: "moisture_pct", label: "Moisture", unit: "%" },
  { key: "dust_pct", label: "Dust", unit: "%" },
  { key: "ad_value", label: "AD value" },
  { key: "qc_decision", label: "Approve / deny" }
];

/** Inward crusher performance mesh shares — % (keep grade / rotary / dust / moisture). */
export const AC_CRUSHER_MESH_PCT_FIELDS = [
  { key: "mesh_plus_2_pct", label: "+2", unit: "%" },
  { key: "mesh_2_3_pct", label: "2/3", unit: "%" },
  { key: "mesh_3_4_pct", label: "3/4", unit: "%" },
  { key: "mesh_4_6_pct", label: "4/6", unit: "%" },
  { key: "mesh_6_10_pct", label: "6/10", unit: "%" },
  { key: "mesh_10_12_pct", label: "10/12", unit: "%" },
  { key: "mesh_12_14_pct", label: "12/14", unit: "%" },
  { key: "mesh_minus_14_pct", label: "-14", unit: "%" }
];

function _isInboundUsedAt(usedAt) {
  const used = String(usedAt || "").toLowerCase();
  return !used || used === "inbound" || used === "both";
}

/**
 * Tracking fields for one inbound prep step (from raw-material type masters).
 * Prefer operation_code when several inbound ops share the same process_step.
 */
export function inboundProcessParameters(materialType, processStep, operationCode) {
  if (!materialType) return [];
  const step = String(processStep || "").toUpperCase();
  const code = String(operationCode || "").toUpperCase();

  const fromOps = [];
  for (const op of materialType.inbound_operations || []) {
    const opCode = String(op.operation_code || "").toUpperCase();
    const opStep = String(op.process_step || "").toUpperCase();
    const matchCode = Boolean(code && opCode && opCode === code);
    const matchStep = Boolean(step && opStep === step && (!code || !opCode || opCode === code));
    if (!matchCode && !matchStep) continue;
    for (const p of op.parameters || []) {
      if (p?.key) fromOps.push(p);
    }
  }

  const fromType = (materialType.process_parameters || []).filter((p) => {
    if (!_isInboundUsedAt(p.used_at)) return false;
    const ps = String(p.process_step || "").toUpperCase();
    const bound = String(p.operation_code || "").toUpperCase();
    if (code && bound) return bound === code && Boolean(p.key);
    if (code && !bound) return false;
    if (step && ps && ps !== step) return false;
    if (step && !ps && !bound) return false;
    return Boolean(p.key);
  });

  const merged = [];
  const seen = new Set();
  for (const p of [...fromOps, ...fromType]) {
    if (seen.has(p.key)) continue;
    seen.add(p.key);
    merged.push(p);
  }
  return merged;
}
