import api from "../../../services/api";
import {
  fetchMesCoreExecutionSummary,
  fetchMesCoreProductionLots,
  fetchMesCoreProductionOrders,
  fetchMesCoreProductionOrderByRef,
  fetchMesCoreSchedulePlan
} from "../../../services/mesCoreApi";
import { mergeRawMaterialTypes, findRawMaterialType } from "./rawMaterialTypeStore";
import { isGrCoconutShellType, keepGrCoconutShellTypes } from "./acGrCoconutShell";
import { fetchActiveWorkspaceRouting } from "../services/acRoutingBuilderApi";
import { createTemplateRoutingReference } from "../constants/defaultActivatedCarbonRoute";
import { normalizeCode } from "./acExecutionOperations";

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function execIndex(summary) {
  const byOp = {};
  for (const ex of summary?.operations || []) {
    const key = normalizeCode(ex.operation_code || ex.operation_id);
    if (key) byOp[key] = ex;
  }
  return byOp;
}

export function mapSchedulePlanToRoutingPlan(plan, executionSummary) {
  const execByOp = execIndex(executionSummary);

  const planOps = (plan.operations || []).map((op) => {
    const opCode = op.operation_id || op.operation_code;
    const scheduled = Boolean(op.already_scheduled);
    const exec = execByOp[normalizeCode(opCode)];
    const workOrderId = op.existing_schedule_id || exec?.work_order_id || null;

    let uiStatus = "Pending";
    if (exec?.status) uiStatus = exec.status;
    else if (scheduled) uiStatus = "Ready";

    return {
      operation_id: opCode,
      operation_code: opCode,
      operation_sequence: op.operation_sequence,
      operation_name: op.operation_name,
      process_id: null,
      process_name: null,
      work_order_id: workOrderId,
      work_order_generated: scheduled || Boolean(exec),
      status: uiStatus
    };
  });

  const generatedCount = planOps.filter((o) => o.work_order_generated).length;
  const pendingCount = planOps.length - generatedCount;

  return {
    lot_id: plan.lot_id,
    part_id: plan.part_id,
    part_name: plan.part_name,
    routing_id: plan.routing_id,
    routing_version: plan.routing_version,
    operations: planOps,
    total_operations: planOps.length,
    generated_work_orders: generatedCount,
    pending_work_orders: pendingCount,
    can_generate: pendingCount > 0,
    routing_complete: pendingCount === 0 && planOps.length > 0
  };
}

function buildRoutingPlanFromWorkspaceRoute(lotCode, routing, executionSummary, materialType) {
  const execByOp = execIndex(executionSummary);

  const planOps = (routing.operations || []).map((op) => {
    const opCode = op.operation_code;
    const exec = execByOp[normalizeCode(opCode)];
    const workOrderId = exec?.work_order_id || exec?.schedule_id || null;
    const generated = Boolean(workOrderId || exec);

    let uiStatus = "Pending";
    if (exec?.status) uiStatus = exec.status;
    else if (generated) uiStatus = "Ready";

    return {
      operation_id: opCode,
      operation_code: opCode,
      operation_sequence: op.operation_seq ?? op.operation_sequence,
      operation_name: op.operation_name,
      process_id: op.gate_type || null,
      process_name: op.gate_type || null,
      work_order_id: workOrderId,
      work_order_generated: generated,
      status: uiStatus
    };
  });

  const generatedCount = planOps.filter((o) => o.work_order_generated).length;
  const pendingCount = planOps.length - generatedCount;

  return {
    lot_id: lotCode,
    part_id: materialType?.finished_product_code || null,
    part_name:
      materialType?.finished_product_name ||
      materialType?.finished_product_code ||
      null,
    raw_material_code: materialType?.product_code || null,
    raw_material_name: materialType?.product_name || null,
    routing_id: routing.routing_code || routing.routing_id,
    routing_version: 1,
    operations: planOps,
    total_operations: planOps.length,
    generated_work_orders: generatedCount,
    pending_work_orders: pendingCount,
    can_generate: pendingCount > 0,
    routing_complete: pendingCount === 0 && planOps.length > 0,
    resolved_from: "workspace_routing"
  };
}

export function buildRoutingPlanFromMaterialType(lotCode, materialType, executionSummary) {
  const execByOp = execIndex(executionSummary);

  const planOps = (materialType.operations || []).map((op) => {
    const opCode = op.operation_code || op.operation_id;
    const exec = execByOp[normalizeCode(opCode)];
    const workOrderId = exec?.work_order_id || exec?.schedule_id || null;
    const generated = Boolean(workOrderId || exec);

    let uiStatus = "Pending";
    if (exec?.status) uiStatus = exec.status;
    else if (generated) uiStatus = "Ready";

    return {
      operation_id: opCode,
      operation_code: opCode,
      operation_sequence: op.operation_sequence,
      operation_name: op.operation_name,
      process_id: op.process_step || null,
      process_name: op.process_step || null,
      work_order_id: workOrderId,
      work_order_generated: generated,
      status: uiStatus
    };
  });

  const generatedCount = planOps.filter((o) => o.work_order_generated).length;
  const pendingCount = planOps.length - generatedCount;

  return {
    lot_id: lotCode,
    part_id: materialType.finished_product_code,
    part_name: materialType.finished_product_name || materialType.finished_product_code,
    raw_material_code: materialType.product_code,
    raw_material_name: materialType.product_name,
    routing_id: materialType.routing_code,
    routing_version: materialType.routing_version ?? 1,
    operations: planOps,
    total_operations: planOps.length,
    generated_work_orders: generatedCount,
    pending_work_orders: pendingCount,
    can_generate: pendingCount > 0,
    routing_complete: pendingCount === 0 && planOps.length > 0,
    resolved_from: "raw_material_type"
  };
}

async function fetchRawMaterialTypes() {
  try {
    const res = await api.get("/api/activated-carbon/masters/raw-material-types");
    return mergeRawMaterialTypes(normalizeList(res.data));
  } catch (error) {
    if (error?.response?.status === 404) {
      return mergeRawMaterialTypes([]);
    }
    return mergeRawMaterialTypes([]);
  }
}

async function fetchKilnFeedLots() {
  try {
    const res = await api.get("/api/activated-carbon/kiln-feed");
    return normalizeList(res.data);
  } catch {
    return [];
  }
}

async function loadCanonicalWorkspaceRouting() {
  const active = await fetchActiveWorkspaceRouting().catch(() => null);
  if (active?.operations?.length) return active;
  return createTemplateRoutingReference();
}

async function resolveLotProductCode(lotCode, lots, orders, kilnLots, types) {
  const summary = await fetchMesCoreExecutionSummary(lotCode, { sync: false }).catch(() => null);
  const fromSummary = summary?.part_id || summary?.product_code || summary?.part_code;
  if (fromSummary) return fromSummary;

  const lot =
    lots.find((l) => l.lot_id === lotCode || l.lot_code === lotCode) ||
    kilnLots.find((l) => l.lot_code === lotCode || l.lot_id === lotCode);

  if (lot?.product_code) return lot.product_code;
  if (lot?.part_code) return lot.part_code;

  let poRef =
    lot?.production_order_id ||
    lot?.production_order_code ||
    lot?.production_order_pk;

  if (poRef) {
    let po = orders.find(
      (p) =>
        p.production_order_id === poRef ||
        p.production_order_code === poRef ||
        p.production_order_pk === poRef
    );
    if (!po && String(poRef).match(/^PO-/i)) {
      po = await fetchMesCoreProductionOrderByRef(poRef);
    }
    if (po?.product_code || po?.part_code) {
      return po.product_code || po.part_code;
    }
  }

  const rawTypes = (types || []).filter((t) =>
    String(t.product_code || "").toUpperCase().startsWith("RAW-")
  );
  if (rawTypes.length === 1) {
    return rawTypes[0].product_code;
  }

  return null;
}

function mapApiRoutingPlanToUi(lotCode, apiPlan, summary, materialType) {
  if (!apiPlan?.operations?.length) return null;
  const execByOp = execIndex(summary);
  const planOps = apiPlan.operations.map((op) => {
    const opCode = op.operation_code || op.operation_id;
    const exec = execByOp[normalizeCode(opCode)];
    const generated = Boolean(
      op.work_order_generated || op.work_order_id || exec?.work_order_id
    );
    let uiStatus = op.status || "Pending";
    if (exec?.status) uiStatus = exec.status;
    else if (generated) uiStatus = "Ready";
    return {
      operation_id: opCode,
      operation_code: opCode,
      operation_sequence: op.operation_sequence,
      operation_name: op.operation_name,
      process_id: op.process_id,
      process_name: op.process_name,
      work_order_id: op.work_order_id || exec?.work_order_id,
      work_order_generated: generated,
      status: uiStatus
    };
  });
  const generatedCount =
    apiPlan.generated_work_orders ??
    planOps.filter((o) => o.work_order_generated).length;
  const total = apiPlan.total_operations ?? planOps.length;
  const pendingCount = apiPlan.pending_work_orders ?? total - generatedCount;
  return {
    lot_id: apiPlan.lot_id || lotCode,
    part_id: apiPlan.part_id,
    part_name: apiPlan.part_name,
    raw_material_code: materialType?.product_code || null,
    raw_material_name: materialType?.product_name || null,
    routing_id: apiPlan.routing_id,
    routing_version: apiPlan.routing_version,
    operations: planOps,
    total_operations: total,
    generated_work_orders: generatedCount,
    pending_work_orders: pendingCount,
    can_generate: apiPlan.can_generate ?? pendingCount > 0,
    routing_complete: apiPlan.routing_complete ?? (pendingCount === 0 && total > 0),
    resolved_from: "mes_core_api"
  };
}

export async function resolveAcRoutingPlanForLot(lotCode) {
  const [types, lots, orders, kilnLots, summary] = await Promise.all([
    fetchRawMaterialTypes(),
    fetchMesCoreProductionLots().catch(() => []),
    fetchMesCoreProductionOrders().catch(() => []),
    fetchKilnFeedLots(),
    fetchMesCoreExecutionSummary(lotCode, { sync: false }).catch(() => null)
  ]);

  const productCode = await resolveLotProductCode(
    lotCode,
    lots,
    orders,
    kilnLots,
    types
  );
  const materialType = findRawMaterialType(types, productCode);

  try {
    const res = await api.get(
      `/api/activated-carbon/lots/${encodeURIComponent(lotCode)}/routing-plan`
    );
    const mapped = mapApiRoutingPlanToUi(lotCode, res.data, summary, materialType);
    if (mapped?.operations?.length) {
      return mapped;
    }
  } catch {
    // fall through
  }

  try {
    const plan = await fetchMesCoreSchedulePlan(lotCode);
    if (plan?.routing_id && (plan.operations || []).length) {
      return mapSchedulePlanToRoutingPlan(plan, summary);
    }
  } catch {
    // fall through
  }

  if (materialType?.operations?.length) {
    return buildRoutingPlanFromMaterialType(lotCode, materialType, summary);
  }

  const workspaceRouting = await loadCanonicalWorkspaceRouting();
  if (workspaceRouting?.operations?.length) {
    return buildRoutingPlanFromWorkspaceRoute(
      lotCode,
      workspaceRouting,
      summary,
      materialType
    );
  }

  if (productCode) {
    throw new Error(
      `Raw material ${productCode} has no routing configured. ` +
        "Copy the workspace route in Routing Builder or configure Masters."
    );
  }

  throw new Error(
    `Could not determine product for lot ${lotCode}. Create kiln feed from a production order first.`
  );
}

export async function pendingOperationsForLot(lotCode) {
  const summary = await fetchMesCoreExecutionSummary(lotCode, { sync: false }).catch(
    () => null
  );

  const done = new Set(
    (summary?.operations || []).map((ex) =>
      normalizeCode(ex.operation_code || ex.operation_id)
    )
  );

  try {
    const res = await api.get(
      `/api/activated-carbon/lots/${encodeURIComponent(lotCode)}/routing-plan`
    );
    const pending = (res.data?.operations || []).filter(
      (op) => !op.work_order_generated && !done.has(normalizeCode(op.operation_code))
    );
    if (pending.length) {
      return pending.map((op) => ({
        operation_id: op.operation_code || op.operation_id,
        operation_code: op.operation_code || op.operation_id,
        operation_sequence: op.operation_sequence,
        operation_name: op.operation_name,
        estimated_duration_minutes: 60
      }));
    }
    if ((res.data?.operations || []).length && res.data?.routing_complete) {
      return [];
    }
  } catch {
    // use schedule plan
  }

  try {
    const plan = await fetchMesCoreSchedulePlan(lotCode);
    if (plan?.routing_id && (plan.operations || []).length) {
      const pending = (plan.operations || []).filter((op) => !op.already_scheduled);
      if (pending.length) {
        return pending.map((op) => ({
          operation_id: op.operation_id || op.operation_code,
          operation_code: op.operation_id || op.operation_code,
          operation_sequence: op.operation_sequence,
          operation_name: op.operation_name,
          estimated_duration_minutes: op.estimated_duration_minutes,
          suggested_machine_id: op.suggested_machine_id,
          suggested_work_center_id: op.suggested_work_center_id
        }));
      }
      return [];
    }
  } catch {
    // use material type
  }

  const types = await fetchRawMaterialTypes();
  const [lots, orders, kilnLots] = await Promise.all([
    fetchMesCoreProductionLots().catch(() => []),
    fetchMesCoreProductionOrders().catch(() => []),
    fetchKilnFeedLots()
  ]);

  const productCode = await resolveLotProductCode(
    lotCode,
    lots,
    orders,
    kilnLots,
    types
  );
  const materialType = findRawMaterialType(types, productCode);
  if (!materialType?.operations?.length) return [];

  return materialType.operations
    .filter((op) => !done.has(normalizeCode(op.operation_code)))
    .map((op) => ({
      operation_id: op.operation_code,
      operation_code: op.operation_code,
      operation_sequence: op.operation_sequence,
      operation_name: op.operation_name,
      estimated_duration_minutes: 60
    }));
}

function shopProcessMapFromMaterialType(materialType) {
  if (!materialType?.operations?.length) return null;
  return {
    routing_code: materialType.routing_code,
    process_parameters: materialType.process_parameters || [],
    resolved_from: "raw_material_type",
    operations: materialType.operations.map((op) => ({
      operation_code: op.operation_code || op.operation_id,
      operation_seq: op.operation_sequence,
      operation_sequence: op.operation_sequence,
      operation_name: op.operation_name,
      process_step: op.process_step || op.process_id,
      parameters: op.parameters || [],
      is_mandatory: op.is_mandatory
    }))
  };
}

/** Raw Material → finished goods shop steps from Masters → Materials & steps. */
export async function loadAcShopProcessMapForExecution(lotCode) {
  const types = keepGrCoconutShellTypes(await fetchRawMaterialTypes());
  const activeTypes = (types || []).filter(
    (t) => !t.is_obsolete && String(t.status || "").toUpperCase() !== "OBSOLETE"
  );
  const cocoType = activeTypes.find(isGrCoconutShellType);
  const fromCoco = shopProcessMapFromMaterialType(cocoType);
  if (fromCoco) return fromCoco;

  const fallback = activeTypes.find((t) => t.operations?.length);
  const fromFallback = shopProcessMapFromMaterialType(fallback);
  if (fromFallback) return fromFallback;

  if (!lotCode) return null;
  return loadAcProductRoutingForExecution(lotCode);
}

/** Product shop-floor routing for a lot — names come from that customer’s process map. */
export async function loadAcProductRoutingForExecution(lotCode) {
  if (!lotCode) return null;
  try {
    const plan = await resolveAcRoutingPlanForLot(lotCode);
    if (!(plan?.operations || []).length) return null;
    return {
      routing_code: plan.routing_id,
      process_parameters: plan.process_parameters || [],
      operations: plan.operations.map((op) => ({
        operation_code: op.operation_code || op.operation_id,
        operation_seq: op.operation_sequence,
        operation_sequence: op.operation_sequence,
        operation_name: op.operation_name,
        process_step: op.process_id || op.process_name || op.process_step,
        parameters: op.parameters || []
      }))
    };
  } catch {
    return null;
  }
}

/** @deprecated use loadAcProductRoutingForExecution — workspace menu steps are not shop-floor WOs */
export async function loadAcWorkspaceRoutingForExecution() {
  return loadAcProductRoutingForExecution();
}
