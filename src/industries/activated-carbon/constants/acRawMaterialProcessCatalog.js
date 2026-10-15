import { defaultOperationForStep, nextOperationSequence } from "./processSteps";
import { defaultExecutionParametersForStep } from "./processTripletTemplates";

/** Fixed start/end of every inbound path — not shop-floor execution. */
export const AC_INBOUND_FIXED_START = {
  id: "RAW_MATERIAL_INWARD",
  operation_name: "Raw Material Inward",
  process_step: "RAW_MATERIAL_INWARD",
  is_mandatory: true,
  fixed: true,
  description: "Gate receipt and lot creation"
};

export const AC_INBOUND_FIXED_END = {
  id: "RAW_MATERIAL_QC",
  operation_name: "Release to Production",
  process_step: "RAW_MATERIAL_QC",
  is_mandatory: true,
  fixed: true,
  description: "Inbound prep complete — RM QC is not required; release creates the lot"
};

/** Legacy alias — fixed anchors only (configurable prep is inbound_operations). */
export const AC_MANDATORY_PRE_PROCESSES = [AC_INBOUND_FIXED_START, AC_INBOUND_FIXED_END];

/** Terminal state after finished-goods QC passes. */
export const AC_TERMINAL_INSTOCK = {
  id: "INSTOCK",
  operation_name: "In stock",
  process_step: "INSTOCK",
  description: "Finished goods released to inventory after QC passes"
};

/**
 * Standard shop-floor steps Super Admin can apply per raw material.
 * Kiln feed → screening → destoning → QC (each configurable mandatory/optional).
 */
export const STANDARD_SHOP_FLOOR_TEMPLATE = [
  {
    ...defaultOperationForStep("KILN_FEED", 1),
    is_mandatory: true,
    parameters: defaultExecutionParametersForStep("KILN_FEED")
  },
  {
    ...defaultOperationForStep("ACTIVATION", 2),
    is_mandatory: true,
    parameters: defaultExecutionParametersForStep("ACTIVATION")
  },
  {
    ...defaultOperationForStep("SCREENING", 3),
    is_mandatory: true,
    parameters: defaultExecutionParametersForStep("SCREENING")
  },
  {
    ...defaultOperationForStep("GRADE_SEPARATION", 4),
    is_mandatory: false,
    parameters: defaultExecutionParametersForStep("GRADE_SEPARATION")
  },
  {
    ...defaultOperationForStep("DESTONING", 5),
    is_mandatory: false,
    parameters: defaultExecutionParametersForStep("DESTONING")
  },
  {
    ...defaultOperationForStep("QC", 6),
    is_mandatory: true,
    parameters: defaultExecutionParametersForStep("QC")
  }
];

export function buildStandardShopFloorOperations(existingOps = []) {
  const baseSeq = nextOperationSequence(existingOps);
  return STANDARD_SHOP_FLOOR_TEMPLATE.map((op, index) => ({
    ...op,
    operation_sequence: baseSeq + index,
    operation_code: op.operation_code || `OP-${op.process_step}`
  }));
}

export function buildDefaultInboundCrushingOperation() {
  return {
    ...defaultOperationForStep("CRUSHING", 1),
    operation_code: "IN-CRUSHING",
    is_mandatory: true,
    parameters: defaultExecutionParametersForStep("CRUSHING").map((p) => ({
      ...p,
      used_at: "inbound"
    }))
  };
}

export function isFixedPreProcess(processStep) {
  const step = String(processStep || "").toUpperCase();
  return [AC_INBOUND_FIXED_START.process_step, AC_INBOUND_FIXED_END.process_step].includes(
    step
  );
}

export function isInboundPrepProcessStep(processStep) {
  const step = String(processStep || "").toUpperCase();
  return step && !isFixedPreProcess(step);
}

/** Last routing step: formal FG QC before the In stock terminal (not kiln/destoning QC). */
export function isTerminalFinishedGoodsQc(op, index, operations = []) {
  if (!op || !operations.length || index !== operations.length - 1) return false;
  const code = String(op.operation_code || "").toUpperCase();
  if (code === "OP-FG-QC") return true;
  if (String(op.process_step || "").toUpperCase() !== "QC") return false;
  return /finished goods|final.*qc/i.test(String(op.operation_name || ""));
}

export function splitTerminalFinishedGoodsQc(operations = []) {
  if (!operations.length) {
    return { routeOperations: [], terminalFgQc: null };
  }
  const lastIndex = operations.length - 1;
  const last = operations[lastIndex];
  if (isTerminalFinishedGoodsQc(last, lastIndex, operations)) {
    return { routeOperations: operations.slice(0, lastIndex), terminalFgQc: last };
  }
  return { routeOperations: operations, terminalFgQc: null };
}
