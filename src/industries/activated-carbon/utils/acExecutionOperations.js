/** Align execution / routing UI with workspace routing builder (seq 10–110). */

import { displayOperationLabel } from "../constants/processSteps";

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
}

export function isAcQcOperation(operation) {
  if (!operation) return false;
  const code = normalizeCode(operation.operation_code || operation.operation_id);
  const name = String(operation.operation_name || "").toLowerCase();
  if (operation.gate_type === "quality_gate") return true;
  if (code.includes("QC") || code.includes("QUALITY")) return true;
  if (name.includes("quality testing") || name.includes("raw material qc")) return true;
  if (name.includes(" qc") || name.startsWith("qc ")) return true;
  return false;
}

export function isAcFeasibilityGateOperation(operation) {
  if (!operation) return false;
  if (operation.gate_type === "feasibility_gate") return true;
  const code = normalizeCode(operation.operation_code || operation.operation_id);
  const name = String(operation.operation_name || "").toLowerCase();
  return code.includes("FEASIBILITY") || name.includes("feasibility gate");
}

/** Default execution resource needs when not set on the operation (legacy routes). */
function inferRequiresMachine(operation, gateOrInspection) {
  if (gateOrInspection) return false;
  if (operation?.requires_machine != null) return Boolean(operation.requires_machine);
  const code = normalizeCode(operation?.operation_code || operation?.operation_id);
  return (
    code.startsWith("OP_") ||
    code.startsWith("OP-") ||
    code.includes("KILN") ||
    code.includes("PYROLYSIS") ||
    code.includes("ACTIVATION") ||
    code.includes("SCREEN") ||
    code.includes("COOL") ||
    code.includes("GRADE")
  );
}

function inferRequiresLabor(operation, gateOrInspection) {
  if (gateOrInspection) return false;
  if (operation?.requires_labor != null) return Boolean(operation.requires_labor);
  return true;
}

function inferRequiresTools(operation, gateOrInspection) {
  if (gateOrInspection) return false;
  if (operation?.requires_tools != null) return Boolean(operation.requires_tools);
  return false;
}

/** Which execution fields to show for Activated Carbon steps. */
export function getAcExecutionUiFlags(operation) {
  const qc = isAcQcOperation(operation);
  const feasibility = isAcFeasibilityGateOperation(operation);
  const gateOrInspection = qc || feasibility;

  const requiresMachine = inferRequiresMachine(operation, gateOrInspection);
  const requiresLabor = inferRequiresLabor(operation, gateOrInspection);
  const requiresTools = inferRequiresTools(operation, gateOrInspection);

  return {
    skip_operator: true,
    skip_machine: !requiresMachine,
    skip_tools: !requiresTools,
    skip_labor: !requiresLabor,
    machine_required: requiresMachine,
    labor_required: requiresLabor,
    tools_required: requiresTools,
    is_qc_step: qc,
    is_feasibility_step: feasibility,
    is_gate_step: gateOrInspection
  };
}

/** MES core still requires operator_name on start/complete; map from labor pool for AC. */
export function resolveAcExecutionOperatorName(operation, laborPoolCode = "") {
  const pool = String(laborPoolCode || operation?.actual_labor_pool_code || "").trim();
  if (pool) return pool;
  const flags = getAcExecutionUiFlags(operation);
  return flags.is_gate_step ? "AC-GATE" : "AC-EXEC";
}

function attachAcExecutionFlags(op, routeOp) {
  const flags = getAcExecutionUiFlags(routeOp || op);
  return {
    ...op,
    ...flags,
    skip_machine: flags.skip_machine,
    is_qc_step: flags.is_qc_step
  };
}

export function recomputeSequentialCanStart(ops) {
  const sorted = [...ops].sort((a, b) => (a.seq ?? 999999) - (b.seq ?? 999999));
  return sorted.map((op) => {
    if (op.status !== "Ready") return { ...op, can_start: false };
    const seq = op.seq ?? 999999;
    const blocked = sorted.some(
      (prev) => (prev.seq ?? 999999) < seq && prev.status !== "Completed"
    );
    return { ...op, can_start: !blocked };
  });
}

/** Shop-floor steps (OP-*) — not workspace menu steps (KILN_FEED, RAW_MATERIAL_INWARD, …). */
function isShopFloorRouteOperation(routeOp) {
  const code = normalizeCode(routeOp?.operation_code);
  if (code.startsWith("OP_") || code.startsWith("OP-")) return true;
  const step = normalizeCode(routeOp?.process_step || routeOp?.process_id);
  return [
    "PYROLYSIS",
    "KILN_FEED",
    "ACTIVATION",
    "DESTONING",
    "SCREENING",
    "GRADE_SEPARATION",
    "QC"
  ].includes(step);
}

function sortExecOps(execOps) {
  const sorted = [...execOps]
    .map((op) =>
      attachAcExecutionFlags({
        ...op,
        seq: op.seq ?? op.operation_sequence ?? op.operation_seq
      })
    )
    .sort((a, b) => (a.seq ?? 999999) - (b.seq ?? 999999));
  return recomputeSequentialCanStart(sorted);
}

function mergeExecWithRoute(ex, routeOp, index) {
  const processStep = routeOp?.process_step || routeOp?.process_id || ex.process_step;
  return attachAcExecutionFlags(
    {
      ...ex,
      seq: routeOp?.operation_seq ?? routeOp?.operation_sequence ?? ex.seq ?? index + 1,
      operation_sequence: routeOp?.operation_sequence ?? ex.operation_sequence,
      operation_code: routeOp?.operation_code || ex.operation_code,
      operation_id: routeOp?.operation_code || routeOp?.operation_id || ex.operation_id,
      operation_name: displayOperationLabel({
        process_step: processStep,
        operation_name: routeOp?.operation_name || ex.operation_name
      }),
      process_step: processStep,
      gate_type: routeOp?.gate_type ?? ex.gate_type,
      parameters: (ex.parameters?.length ? ex.parameters : null) || routeOp?.parameters || [],
      requires_machine: routeOp?.requires_machine ?? ex.requires_machine,
      requires_labor: routeOp?.requires_labor ?? ex.requires_labor,
      requires_tools: routeOp?.requires_tools ?? ex.requires_tools,
      is_mandatory: routeOp?.is_mandatory !== false && ex.is_mandatory !== false,
      status: ex.status || (ex.work_order_id || ex.lot_operation_id ? "Ready" : "Pending")
    },
    routeOp || ex
  );
}

/**
 * Masters process flow is the source of truth for what appears and in what order.
 * Work orders only supply status / capture state for matching operation codes.
 */
export function normalizeAcExecutionOperations(execOps = [], productRouting) {
  const routeOps = productRouting?.operations || [];
  const execByCode = new Map();
  for (const ex of execOps) {
    const code = normalizeCode(ex.operation_code || ex.operation_id);
    if (code && !execByCode.has(code)) execByCode.set(code, ex);
  }

  if (routeOps.length) {
    const merged = routeOps.map((routeOp, index) => {
      const code = normalizeCode(routeOp.operation_code || routeOp.operation_id);
      return mergeExecWithRoute(execByCode.get(code) || {}, routeOp, index);
    });
    return sortExecOps(merged);
  }

  if (!execOps.length) return [];
  return sortExecOps(execOps.map((ex, index) => mergeExecWithRoute(ex, null, index)));
}

/** Map AC capture form values to nyra_mes_core exec.parameter_reading rows. */
export function buildAcParameterReadings(parameters = [], values = {}) {
  const readings = [];
  for (const param of parameters) {
    const code = param.parameter_code || param.parameter_id;
    if (!code) continue;
    const key = param.parameter_code || param.parameter_id || param.parameter_name;
    const raw = values[key];

    if (param.data_type === "boolean") {
      if (raw === true || raw === false) {
        readings.push({
          parameter_code: String(code),
          reading_text: raw ? "true" : "false"
        });
      }
      continue;
    }

    if (raw === "" || raw === null || raw === undefined) continue;

    if (param.data_type === "number") {
      const num = Number(raw);
      if (!Number.isNaN(num)) {
        readings.push({ parameter_code: String(code), reading_value: num });
      }
      continue;
    }

    readings.push({ parameter_code: String(code), reading_text: String(raw) });
  }
  return readings;
}

export function summarizeAcExecution(summary, ops) {
  if (!summary) return summary;
  return {
    ...summary,
    operations_total: ops.length,
    operations_completed: ops.filter((o) => o.status === "Completed").length,
    operations_ready: ops.filter((o) => o.status === "Ready").length,
    operations_on_hold: ops.filter((o) => o.status === "On Hold").length,
    schedules_count: ops.filter((o) => o.work_order_id || o.lot_operation_id).length
  };
}

export { normalizeCode };

/** Resolve shop-floor process step from an execution operation row. */
export function resolveAcProcessStep(operation) {
  if (!operation) return "";
  const metaStep = operation.process_step || operation.process_id;
  if (metaStep) return normalizeCode(metaStep);
  const code = normalizeCode(operation.operation_code || operation.operation_id);
  if (code.includes("KILN") && code.includes("FEED")) return "KILN_FEED";
  if (code.includes("DESTON")) return "DESTONING";
  if (code.includes("PYROLYSIS") || code.includes("CARBON")) return "PYROLYSIS";
  if (code.includes("ACTIVATION")) return "ACTIVATION";
  if (code.includes("SCREEN")) return "SCREENING";
  if (code.includes("GRADE")) return "GRADE_SEPARATION";
  if (code.includes("QC") || code.includes("QUALITY")) return "QC";
  return code.replace(/^OP[-_]/, "");
}

export function isAcKilnChargeStep(operation) {
  const step = resolveAcProcessStep(operation);
  return (
    step === "KILN_FEED" ||
    step === "PYROLYSIS" ||
    step === "KILN_ACTIVATION" ||
    step === "ACTIVATION"
  );
}

export function isAcOptionalOperation(operation) {
  return operation?.is_mandatory === false;
}

/** Steps with a dedicated Execution panel — hide generic empty parameter block. */
export function hasAcStepSpecificCapture(processStep) {
  const step = normalizeCode(processStep);
  return ["SCREENING", "QC", "KILN_FEED", "PYROLYSIS", "ACTIVATION", "DESTONING", "GRADE_SEPARATION"].includes(step);
}
