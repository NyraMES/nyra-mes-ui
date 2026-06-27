import { defaultOperationForStep, nextOperationSequence } from "./processSteps";
import { defaultExecutionParametersForStep } from "./processTripletTemplates";

/** Fixed for every raw material — handled on Raw Material page, not in shop-floor execution. */
export const AC_MANDATORY_PRE_PROCESSES = [
  {
    id: "RAW_MATERIAL_INWARD",
    operation_name: "Raw Material Inward",
    process_step: "RAW_MATERIAL_INWARD",
    is_mandatory: true,
    fixed: true,
    description: "Supplier receipt and lot creation"
  },
  {
    id: "RAW_MATERIAL_QC",
    operation_name: "Raw Material QC",
    process_step: "RAW_MATERIAL_QC",
    is_mandatory: true,
    fixed: true,
    description: "Incoming quality check before release to production"
  }
];

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
    ...defaultOperationForStep("DESTONING", 4),
    is_mandatory: false,
    parameters: defaultExecutionParametersForStep("DESTONING")
  },
  {
    ...defaultOperationForStep("QC", 5),
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

export function isFixedPreProcess(processStep) {
  const step = String(processStep || "").toUpperCase();
  return AC_MANDATORY_PRE_PROCESSES.some((p) => p.process_step === step);
}
