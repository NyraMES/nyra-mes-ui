/** Industry template routing — read-only reference, not edited in the UI. */

import {
  enrichOperationWithDefaults,
  getDefaultParametersForOperation
} from "./defaultOperationParameters";

export const AC_TEMPLATE_ROUTING_ID = "AC_ACTIVATED_CARBON_TEMPLATE";

const BASE_OPERATIONS = [
  {
    operation_code: "RAW_MATERIAL_INWARD",
    operation_name: "Raw Material Inward",
    operation_seq: 10,
    gate_type: null,
    requires_machine: false,
    requires_labor: true
  },
  {
    operation_code: "RAW_MATERIAL_QC",
    operation_name: "Raw Material QC",
    operation_seq: 20,
    gate_type: null,
    requires_machine: false,
    requires_labor: false
  },
  {
    operation_code: "FEASIBILITY_GATE",
    operation_name: "Feasibility Gate",
    operation_seq: 30,
    gate_type: "feasibility_gate",
    requires_machine: false,
    requires_labor: false
  },
  {
    operation_code: "KILN_FEED",
    operation_name: "Kiln Feed",
    operation_seq: 40,
    gate_type: null,
    requires_machine: true,
    requires_labor: true
  },
  {
    operation_code: "KILN_ACTIVATION",
    operation_name: "Kiln Activation",
    operation_seq: 50,
    gate_type: null,
    requires_machine: true,
    requires_labor: true
  },
  {
    operation_code: "COOLING",
    operation_name: "Cooling",
    operation_seq: 60,
    gate_type: null,
    requires_machine: true,
    requires_labor: true
  },
  {
    operation_code: "SCREENING",
    operation_name: "Screening",
    operation_seq: 70,
    gate_type: null,
    requires_machine: true,
    requires_labor: true
  },
  {
    operation_code: "GRADE_SEPARATION",
    operation_name: "Grade Separation",
    operation_seq: 80,
    gate_type: null,
    requires_machine: true,
    requires_labor: true
  },
  {
    operation_code: "QUALITY_TESTING",
    operation_name: "Quality Testing",
    operation_seq: 90,
    gate_type: "quality_gate",
    requires_machine: false,
    requires_labor: false
  },
  {
    operation_code: "FINISHED_GOODS_PACKING",
    operation_name: "Finished Goods Packing",
    operation_seq: 100,
    gate_type: null,
    requires_machine: false,
    requires_labor: true
  },
  {
    operation_code: "DISPATCH",
    operation_name: "Dispatch",
    operation_seq: 110,
    gate_type: null,
    requires_machine: false,
    requires_labor: true
  }
];

function withIds(operations, prefix) {
  return operations.map((op) =>
    enrichOperationWithDefaults({
      ...op,
      operation_id: `${prefix}-${op.operation_seq}`,
      is_custom: false,
      parameters: op.parameters?.length
        ? op.parameters
        : getDefaultParametersForOperation(op.operation_code)
    })
  );
}

export function createTemplateRoutingReference() {
  return {
    routing_id: AC_TEMPLATE_ROUTING_ID,
    routing_code: "AC_ACTIVATED_CARBON_TEMPLATE",
    routing_name: "Activated Carbon Industry Template Route",
    source: "template",
    is_template: true,
    is_editable: false,
    operations: withIds(BASE_OPERATIONS, "tpl-op")
  };
}

export function createWorkspaceRoutingFromTemplate() {
  const template = createTemplateRoutingReference();
  const stamp = Date.now();
  return {
    routing_id: `ws-routing-${stamp}`,
    routing_code: "AC_ACTIVATED_CARBON_WS",
    routing_name: "Activated Carbon Workspace Route",
    source: "workspace",
    is_template: false,
    is_editable: true,
    copied_from_template_id: AC_TEMPLATE_ROUTING_ID,
    operations: template.operations.map((op) => ({
      ...op,
      operation_id: `ws-op-${op.operation_seq}-${stamp}`,
      parameters: (op.parameters || []).map((p) => ({ ...p }))
    }))
  };
}

/**
 * Suggested sequence between two adjacent operations (e.g. 75 between 70 and 80).
 */
export function suggestInsertSequence(beforeSeq, afterSeq) {
  if (beforeSeq == null && afterSeq != null) return Math.max(1, afterSeq - 5);
  if (afterSeq == null && beforeSeq != null) return beforeSeq + 10;
  if (beforeSeq != null && afterSeq != null) {
    const mid = Math.floor((beforeSeq + afterSeq) / 2);
    return mid === beforeSeq ? beforeSeq + 1 : mid;
  }
  return 10;
}

export function sortOperations(operations = []) {
  return [...operations].sort(
    (a, b) => Number(a.operation_seq) - Number(b.operation_seq)
  );
}
