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

function mergeExecWithRoute(ex, routeOp, index, processParameters = []) {
  const processStep = routeOp?.process_step || routeOp?.process_id || ex.process_step;
  const mappedParams = processMapParamsForOperation(
    { ...ex, ...routeOp, process_step: processStep },
    processParameters
  );
  return attachAcExecutionFlags(
    {
      ...ex,
      seq: routeOp?.operation_seq ?? routeOp?.operation_sequence ?? ex.seq ?? index + 1,
      operation_sequence: routeOp?.operation_sequence ?? ex.operation_sequence,
      operation_code: routeOp?.operation_code || ex.operation_code,
      operation_id: routeOp?.operation_code || routeOp?.operation_id || ex.operation_id,
      operation_name:
        String(routeOp?.operation_name || ex.operation_name || "").trim() ||
        displayOperationLabel({
          process_step: processStep,
          operation_name: routeOp?.operation_name || ex.operation_name
        }),
      process_step: processStep,
      gate_type: routeOp?.gate_type ?? ex.gate_type,
      parameters:
        (ex.parameters?.length ? ex.parameters : null) ||
        (routeOp?.parameters?.length ? routeOp.parameters : null) ||
        mappedParams,
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
  const processParameters = productRouting?.process_parameters || [];
  const execByCode = new Map();
  for (const ex of execOps) {
    const code = normalizeCode(ex.operation_code || ex.operation_id);
    if (code && !execByCode.has(code)) execByCode.set(code, ex);
  }

  if (routeOps.length) {
    const merged = routeOps.map((routeOp, index) => {
      const code = normalizeCode(routeOp.operation_code || routeOp.operation_id);
      return mergeExecWithRoute(execByCode.get(code) || {}, routeOp, index, processParameters);
    });
    return sortExecOps(merged);
  }

  if (!execOps.length) return [];
  return sortExecOps(execOps.map((ex, index) => mergeExecWithRoute(ex, null, index, processParameters)));
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

/** Live kiln loader only — QC / temp / other KILN_FEED process-map steps stay as tabs. */
export function isAcKilnFeedUiStep(operation) {
  if (!operation) return false;
  const code = normalizeCode(operation.operation_code || operation.operation_id);
  if (code.includes("QC") || code.includes("QUALITY") || code.includes("TEMP")) return false;
  const name = String(operation.operation_name || "").toLowerCase();
  if (/(quality|qc|temp|telemetry)/.test(name)) return false;
  if (code === "OP_KILN_FEED" || code === "KILN_FEED" || code.endsWith("_KILN_FEED")) return true;
  return name.includes("kiln feed") && (name.includes("load") || name.includes("charge"));
}

export function acProcessTabKey(operation) {
  return (
    operation?.work_order_id ||
    operation?.lot_operation_id ||
    operation?.operation_code ||
    operation?.operation_id ||
    operation?.process_step ||
    ""
  );
}

export function isAcFgQcStep(operation) {
  if (!operation) return false;
  const code = normalizeCode(operation.operation_code || operation.operation_id);
  const name = String(operation.operation_name || "").toLowerCase();
  if (code.includes("FG") && (code.includes("QC") || code.includes("QUALITY"))) return true;
  return name.includes("finished goods") || name.includes("fg qc");
}

export function isAcPostActivationQualityStep(operation) {
  if (!operation) return false;
  const code = normalizeCode(operation.operation_code || operation.operation_id);
  if (code === "OP_POST_QC" || code.includes("POST_QC")) return true;
  return String(operation.operation_name || "").trim().toLowerCase() === "quality";
}

export const AC_POST_QUALITY_TAB = {
  operation_code: "OP-POST-QC",
  operation_name: "Quality",
  process_step: "POST_QC",
  seq: 10.6,
  status: "Ready"
};

export function postActivationProcessKey(operation) {
  if (!operation || isAcPostActivationQualityStep(operation)) return "";
  if (isAcPostScreeningStep(operation)) return "screening";
  if (isAcFgQcStep(operation)) return "fg_qc";
  const code = normalizeCode(operation.operation_code || operation.operation_id);
  const name = String(operation.operation_name || "").toLowerCase();
  if (code.includes("CRUSH") || name.includes("crush")) return "crushing";
  if (code.includes("DEDUST") || name.includes("de-dust") || name.includes("dedust")) return "dedusting";
  if (code.includes("DEMAG") || name.includes("magnet")) return "demagnetisation";
  if (code.includes("BLEND") || name.includes("blend")) return "blending";
  return "";
}

export function isAcPostActivationLiveStep(operation) {
  return Boolean(postActivationProcessKey(operation));
}

export function acProcessTabLabel(operation) {
  if (isAcPostActivationQualityStep(operation)) return "Quality";
  if (isAcKilnTempStep(operation)) return "Kiln Parameters";
  const code = normalizeCode(operation?.operation_code || operation?.operation_id);
  if (code.includes("POST") && code.includes("SCREEN")) return "Screening";
  if (isAcFgQcStep(operation)) return "Finished Goods";
  const name = String(operation?.operation_name || "").trim();
  if (!name) return displayOperationLabel(operation);
  const stripped = name
    .replace(/^P\d+(-\d+)?\s+/i, "")
    .replace(/^Final\s+[—-]\s+/i, "")
    .replace(/kiln temperature\s*&\s*telemetry/i, "Kiln temperature");
  const compact = stripped.split(" — ")[0].split(" (")[0].trim();
  return compact || stripped || name;
}

export function processMapParamsForOperation(operation, processParameters = []) {
  const code = normalizeCode(operation?.operation_code || operation?.operation_id);
  const step = normalizeCode(operation?.process_step || operation?.process_id);
  const destonQuality =
    (code.includes("DESTON") && (code.includes("QC") || code.includes("QUALITY"))) ||
    (String(operation?.operation_name || "").toLowerCase().includes("deston") &&
      /(quality|qc)/.test(String(operation?.operation_name || "").toLowerCase()));
  return (processParameters || [])
    .filter((row) => {
      const used = String(row.used_at || "execution").toLowerCase();
      if (used === "inward" || used === "inbound") return false;
      const bound = normalizeCode(row.operation_code);
      const key = String(row.key || row.parameter_code || "").toLowerCase();
      if (
        destonQuality &&
        (bound === "OP-DESTON-QC" || key.startsWith("deston_qc") || key === "deston_copy_from_kiln_bag")
      ) {
        return true;
      }
      if (bound) return bound === code;
      const ps = normalizeCode(row.process_step);
      return Boolean(ps && step && ps === step);
    })
    .map((row) => {
      const datatype = String(row.object_datatype || row.data_type || "");
      let data_type = row.data_type || "number";
      if (datatype.includes("string") || datatype === "text") data_type = "text";
      if (datatype.includes("boolean")) data_type = "boolean";
      return {
        parameter_code: row.key || row.parameter_code,
        parameter_name: row.label || row.parameter_name || row.key,
        data_type,
        unit: row.unit || "",
        mandatory: Boolean(row.mandatory || row.is_mandatory)
      };
    })
    .filter((row) => row.parameter_code);
}

export function isAcKilnFeedQualityStep(operation) {
  if (!operation) return false;
  const code = normalizeCode(operation.operation_code || operation.operation_id);
  if (code.includes("KILN") && code.includes("FEED") && (code.includes("QC") || code.includes("QUALITY"))) {
    return true;
  }
  const name = String(operation.operation_name || "").toLowerCase();
  return name.includes("kiln feed") && (name.includes("quality") || name.includes("qc"));
}

export function isAcDestoningQualityStep(operation) {
  if (!operation) return false;
  const code = normalizeCode(operation.operation_code || operation.operation_id);
  if (code.includes("DESTON") && (code.includes("QC") || code.includes("QUALITY"))) {
    return true;
  }
  const name = String(operation.operation_name || "").toLowerCase();
  return name.includes("deston") && (name.includes("quality") || name.includes("qc"));
}

export function isAcDestoningStep(operation) {
  if (!operation) return false;
  const code = normalizeCode(operation.operation_code || operation.operation_id);
  if (code.includes("QC") || code.includes("QUALITY")) return false;
  if (code.includes("DESTON")) return true;
  const name = String(operation.operation_name || "").toLowerCase();
  return name.includes("deston") && !name.includes("quality") && !name.includes("qc");
}

export function isAcKilnOutputQualityStep(operation) {
  if (!operation) return false;
  const code = normalizeCode(operation.operation_code || operation.operation_id);
  if (code.includes("FEED")) return false;
  if (code.includes("KILN") && (code.includes("OUT") || code.includes("OUTPUT")) && (code.includes("QC") || code.includes("QUALITY"))) {
    return true;
  }
  const name = String(operation.operation_name || "").toLowerCase();
  if (name.includes("kiln feed")) return false;
  return name.includes("kiln output") && (name.includes("quality") || name.includes("qc"));
}

export function isAcKilnTempStep(operation) {
  if (!operation) return false;
  const code = normalizeCode(operation.operation_code || operation.operation_id);
  if (code.includes("KILN") && (code.includes("TEMP") || code.includes("TELEMETRY") || code.includes("PARAM"))) {
    return true;
  }
  const name = String(operation.operation_name || "").toLowerCase();
  return name.includes("kiln") && (name.includes("temp") || name.includes("telemetry") || name.includes("param"));
}

export function isAcActivationStageStep(operation) {
  return (
    isAcKilnFeedUiStep(operation) ||
    isAcKilnFeedQualityStep(operation) ||
    isAcKilnOutputQualityStep(operation) ||
    isAcDestoningStep(operation) ||
    isAcDestoningQualityStep(operation) ||
    isAcKilnTempStep(operation)
  );
}

export function acExecutionStageOf(operation) {
  return isAcActivationStageStep(operation) ? "activation" : "post_activation";
}

function activationTabRank(operation) {
  if (isAcKilnFeedUiStep(operation)) return 1;
  if (isAcKilnFeedQualityStep(operation)) return 2;
  if (isAcKilnOutputQualityStep(operation)) return 3;
  if (isAcDestoningStep(operation)) return 4;
  if (isAcDestoningQualityStep(operation)) return 5;
  if (isAcKilnTempStep(operation)) return 6;
  return 50;
}

export function isAcPostScreeningStep(operation) {
  if (
    !operation ||
    isAcDestoningStep(operation) ||
    isAcDestoningQualityStep(operation) ||
    isAcFgQcStep(operation)
  ) {
    return false;
  }
  const code = normalizeCode(operation.operation_code || operation.operation_id);
  if (
    code.includes("DEDUST") ||
    code.includes("DESTON") ||
    code.includes("CRUSH") ||
    code.includes("DEMAG") ||
    code.includes("BLEND") ||
    code.includes("FG")
  ) {
    return false;
  }
  if (code.includes("POST") && code.includes("SCREEN")) return true;
  const name = String(operation.operation_name || "").toLowerCase();
  if (
    name.includes("screening bin") ||
    name.includes("de-dust") ||
    name.includes("dedust") ||
    name.includes("finished goods")
  ) {
    return false;
  }
  return code.includes("SCREEN") && !name.includes("deston");
}

function postActivationTabRank(operation) {
  if (isAcPostScreeningStep(operation)) return 1;
  const code = normalizeCode(operation.operation_code || operation.operation_id);
  const name = String(operation.operation_name || "").toLowerCase();
  if (code.includes("DEDUST") || name.includes("de-dust") || name.includes("dedust")) return 2;
  if (code.includes("CRUSH") || name.includes("crush")) return 3;
  if (code.includes("DEMAG") || name.includes("magnet")) return 4;
  if (code.includes("BLEND") || name.includes("blend")) return 5;
  if (isAcPostActivationQualityStep(operation)) return 6;
  if (isAcFgQcStep(operation)) return 7;
  return 50 + (operation.seq ?? operation.operation_sequence ?? 999);
}

export function acProcessTabsForStage(operations = [], stage = "activation") {
  const rows = acProcessMapTabs(operations).filter((op) => acExecutionStageOf(op) === stage);
  if (stage === "activation") {
    return [...rows]
      .filter((op) => !isAcKilnTempStep(op))
      .sort((a, b) => activationTabRank(a) - activationTabRank(b));
  }
  const next = [...rows];
  if (next.length && !next.some(isAcPostActivationQualityStep)) {
    next.push(AC_POST_QUALITY_TAB);
  }
  return next.sort((a, b) => {
    const rank = postActivationTabRank(a) - postActivationTabRank(b);
    if (rank !== 0) return rank;
    return (a.seq ?? a.operation_sequence ?? 999) - (b.seq ?? b.operation_sequence ?? 999);
  });
}

export function acProcessMapTabs(operations = []) {
  const rows = (operations || []).filter((op) => !isAcFeasibilityGateOperation(op));
  return [...rows].sort((a, b) => {
    const aFeed = isAcKilnFeedUiStep(a) ? 0 : 1;
    const bFeed = isAcKilnFeedUiStep(b) ? 0 : 1;
    if (aFeed !== bFeed) return aFeed - bFeed;
    return (a.seq ?? a.operation_sequence ?? 999) - (b.seq ?? b.operation_sequence ?? 999);
  });
}

/** Shop steps after kiln feed — continue from kiln output bags. */
export function acStepsAfterKilnOutput(operations = []) {
  const sorted = [...(operations || [])].sort(
    (a, b) =>
      (a.seq ?? a.operation_sequence ?? 0) - (b.seq ?? b.operation_sequence ?? 0)
  );
  const feedIdx = sorted.findIndex(isAcKilnFeedUiStep);
  const rest = feedIdx >= 0 ? sorted.slice(feedIdx + 1) : acProcessMapTabs(sorted);
  return rest.filter((op) => !isAcKilnFeedUiStep(op) && !isAcFeasibilityGateOperation(op));
}

/** Remaining process-map steps can run in any order. */
export function unlockAcAnyOrderStart(operations = []) {
  return (operations || []).map((op) => {
    if (isAcKilnFeedUiStep(op)) return { ...op, can_start: false };
    if (op.status === "Ready") return { ...op, can_start: true };
    return op;
  });
}

export function isAcOptionalOperation(operation) {
  return operation?.is_mandatory === false;
}

/** Steps with a dedicated Execution panel — hide generic empty parameter block. */
export function hasAcStepSpecificCapture(processStep) {
  const step = normalizeCode(processStep);
  return ["SCREENING", "QC", "POST_QC", "KILN_FEED", "PYROLYSIS", "ACTIVATION", "DESTONING", "GRADE_SEPARATION"].includes(step);
}
