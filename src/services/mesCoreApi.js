/**
 * nyra_mes_core multi-tenant API (/api/*).
 * Maps mes_core responses to legacy field names the UI already expects.
 */

import api from "./api";
import { normalizeOeeTrendPoints } from "../utils/oeeTrend";

const defaultTenant = import.meta.env.VITE_TENANT_CODE;
const defaultWorkspace = import.meta.env.VITE_WORKSPACE_CODE;
if (defaultTenant) {
  api.defaults.headers.common["X-Tenant-Code"] = defaultTenant;
}
if (defaultWorkspace) {
  api.defaults.headers.common["X-Workspace-Code"] = defaultWorkspace;
}

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function mapOrderStatus(status) {
  const key = String(status || "Created").toUpperCase();
  if (key === "CREATED") return "OPEN";
  if (key === "PLANNED") return "PLANNED";
  return key;
}

export function toLegacyCustomer(row) {
  if (!row) return row;
  return {
    ...row,
    customer_id: row.customer_id,
    customer_code: row.customer_code,
    customer_name: row.customer_name,
    customer_type: row.customer_type ?? row.metadata?.segment ?? "Customer",
  };
}

export function toLegacyProduct(row) {
  if (!row) return row;
  const code = row.product_code ?? row.part_code;
  return {
    ...row,
    product_id: row.product_id,
    part_code: code,
    part_id: code ?? row.part_id,
    part_name: row.product_name ?? row.part_name,
    part_type: (row.product_type ?? row.part_type ?? "").toLowerCase(),
    unit_of_measure: row.uom ?? row.unit_of_measure,
  };
}

export function toLegacyOrder(row) {
  if (!row) return row;
  return {
    ...row,
    order_id: row.order_code ?? row.order_id,
    customer_id: row.customer_id,
    customer_code: row.customer_code ?? row.customer_id,
    order_date: row.order_date,
    delivery_date: row.delivery_date,
    status: row.status,
    lines: row.lines,
  };
}

/** Order line: UUID in order_line_id (FK), sequence code in order_line_code. */
export function toLegacyOrderLine(row, order = null) {
  if (!row) return row;
  const orderCode = order?.order_code ?? row.order_code ?? order?.order_id;
  const partCode = row.product_code ?? row.part_code;
  return {
    ...row,
    order_line_id: row.order_line_id,
    order_line_code: row.line_code ?? row.order_line_code,
    order_id: orderCode,
    part_code: partCode,
    part_id: partCode ?? row.part_id,
    product_id: row.product_id,
    quantity: Number(row.quantity),
    line_quantity: Number(row.quantity),
    status: row.status,
    order_status: order?.status,
  };
}

export function toLegacyProductionOrder(row) {
  if (!row) return row;
  const productCode = row.product_code ?? row.part_code;
  return {
    ...row,
    production_order_id: row.production_order_code ?? row.production_order_id,
    production_order_pk: row.production_order_id,
    order_line_id: row.order_line_id,
    order_line_code: row.order_line_code,
    product_code: productCode,
    part_code: productCode,
    planned_quantity: Number(row.planned_quantity),
    status: row.status,
  };
}

export function toLegacyProductionLot(row) {
  if (!row) return row;
  return {
    ...row,
    lot_id: row.lot_code ?? row.lot_id,
    production_lot_id: row.production_lot_id,
    production_order_id: row.production_order_code ?? row.production_order_id,
    production_order_pk: row.production_order_id,
    lot_quantity: Number(row.lot_quantity),
    status: row.status,
  };
}

export function toLegacyRouting(row) {
  if (!row) return row;
  return {
    ...row,
    routing_id: row.routing_code ?? row.routing_id,
    routing_code: row.routing_code,
    product_id: row.product_id,
    part_id: row.product_id,
    routing_version: row.routing_version,
    process_type: row.process_family,
    is_active: row.is_active,
    operations: row.operations ?? [],
  };
}

export async function fetchMesCoreCustomers() {
  const res = await api.get("/api/customers");
  return normalizeList(res.data).map(toLegacyCustomer);
}

export async function createMesCoreCustomer(payload) {
  const body = {
    customer_name: payload.customer_name,
    status: "ACTIVE",
  };
  if (payload.customer_id || payload.customer_code) {
    body.customer_code = payload.customer_id || payload.customer_code;
  }
  const res = await api.post("/api/customers", body);
  return toLegacyCustomer(res.data);
}

export async function fetchMesCoreProducts() {
  const res = await api.get("/api/products");
  return normalizeList(res.data).map(toLegacyProduct);
}

export async function createMesCoreProduct(payload) {
  const body = {
    product_name: payload.part_name ?? payload.product_name,
    product_type: (payload.part_type ?? payload.product_type ?? "OTHER").toUpperCase(),
    uom: payload.unit_of_measure ?? payload.uom ?? "EA",
    status: "ACTIVE",
  };
  if (payload.part_id || payload.product_code) {
    body.product_code = payload.part_id || payload.product_code;
  }
  const res = await api.post("/api/products", body);
  return toLegacyProduct(res.data);
}

export async function fetchMesCoreCustomerOrders() {
  const res = await api.get("/api/customer-orders");
  return normalizeList(res.data).map((row) => {
    const order = toLegacyOrder(row);
    if (Array.isArray(row.lines)) {
      order.lines = row.lines.map((line) => toLegacyOrderLine(line, order));
    }
    return order;
  });
}

export async function fetchMesCoreOrderLines() {
  const res = await api.get("/api/customer-orders");
  const orders = normalizeList(res.data);
  return orders.flatMap((order) =>
    (order.lines || []).map((line) => toLegacyOrderLine(line, order))
  );
}

export async function createMesCoreCustomerOrder(payload) {
  const res = await api.post("/api/customer-orders", {
    customer_id: payload.customer_id,
    status: mapOrderStatus(payload.status),
    delivery_date: payload.delivery_date,
    line: {
      product_id: payload.product_id,
      quantity: Number(payload.quantity),
      uom: payload.uom ?? "EA",
      status: mapOrderStatus(payload.line_status ?? payload.status ?? "OPEN"),
    },
  });
  return {
    order: toLegacyOrder(res.data.order),
    line: toLegacyOrderLine(res.data.line, res.data.order),
  };
}

export async function fetchMesCoreProductionOrders() {
  const res = await api.get("/api/production-orders");
  return normalizeList(res.data).map(toLegacyProductionOrder);
}

export async function fetchMesCoreProductionOrderByRef(ref) {
  if (!ref) return null;
  try {
    const res = await api.get(`/api/production-orders/by-code/${encodeURIComponent(ref)}`);
    return toLegacyProductionOrder(res.data);
  } catch {
    const orders = await fetchMesCoreProductionOrders();
    return (
      orders.find((po) => po.production_order_id === ref || po.production_order_pk === ref) ||
      null
    );
  }
}

export async function createMesCoreProductionOrder(payload) {
  const res = await api.post("/api/production-orders", {
    order_line_id: payload.order_line_id,
    planned_quantity: Number(payload.planned_quantity),
    status: mapOrderStatus(payload.status ?? "Planned"),
  });
  return toLegacyProductionOrder(res.data);
}

export async function fetchMesCoreProductionLots() {
  const res = await api.get("/api/production-lots");
  return normalizeList(res.data).map(toLegacyProductionLot);
}

export async function splitMesCoreProductionLots(productionOrderRef, lots) {
  const ordersRes = await api.get("/api/production-orders");
  const orders = normalizeList(ordersRes.data);
  const match = orders.find(
    (po) =>
      po.production_order_code === productionOrderRef ||
      po.production_order_id === productionOrderRef
  );
  if (!match) {
    throw new Error(`Production order '${productionOrderRef}' not found`);
  }
  const res = await api.post(
    `/api/production-orders/${match.production_order_id}/split-lots`,
    {
      lots: lots.map((lot) => ({
        lot_quantity: Number(lot.lot_quantity ?? lot.qty),
        status: lot.status ?? "CREATED",
      })),
    }
  );
  return (res.data.lots || []).map(toLegacyProductionLot);
}

export function toLegacyRoutingOperation(row) {
  if (!row) return row;
  return {
    ...row,
    operation_id: row.operation_code ?? row.operation_id,
    operation_sequence: row.operation_sequence,
    operation_name: row.operation_name,
    process_id: row.process_id ?? row.metadata?.process_id,
    standard_cycle_time_minutes: row.standard_cycle_min,
    inspection_required: row.inspection_required ?? row.metadata?.inspection_required,
  };
}

export async function createMesCoreRoutingWithOperations(payload) {
  const version = String(payload.routing_version || "1").replace(/^v/i, "");
  const res = await api.post("/api/routings/with-operations", {
    product_id: payload.product_id,
    routing_code: payload.routing_code || null,
    routing_version: version,
    process_family: payload.process_type || payload.process_family || null,
    is_active: payload.is_active !== false,
    operations: (payload.operations || []).map((op) => ({
      operation_code: op.operation_id || op.operation_code || null,
      operation_sequence: Number(op.operation_sequence),
      operation_name: op.operation_name,
      process_id: op.process_id != null ? String(op.process_id) : null,
      process_code: op.process_code || null,
      process_name: op.process_name || null,
      process_type: op.process_type || null,
      standard_cycle_time_minutes: op.standard_cycle_time_minutes,
      inspection_required: !!op.inspection_required,
    })),
  });
  return {
    routing: toLegacyRouting(res.data.routing),
    operations: (res.data.operations || []).map(toLegacyRoutingOperation),
  };
}

export async function fetchMesCoreRoutings() {
  const res = await api.get("/api/routings");
  return normalizeList(res.data).map(toLegacyRouting);
}

export async function fetchMesCoreResources() {
  const res = await api.get("/api/resources");
  return normalizeList(res.data);
}

export async function createMesCoreResource(payload) {
  const res = await api.post("/api/resources", payload);
  return res.data;
}

export async function fetchMesCoreEquipment() {
  const res = await api.get("/api/equipment");
  return normalizeList(res.data);
}

export async function fetchMesCoreTriples() {
  const res = await api.get("/api/kg/triples");
  return normalizeList(res.data);
}

export function toLegacyMachine(equipment, resources = []) {
  if (!equipment) return equipment;
  const resource = resources.find((r) => r.resource_id === equipment.resource_id);
  return {
    machine_id: equipment.equipment_code,
    machine_name: equipment.equipment_name,
    work_center_id: resource?.resource_code ?? "",
    status: equipment.status ?? "Available",
  };
}

export function toLegacyWorkCenter(resource) {
  if (!resource) return resource;
  return {
    work_center_id: resource.resource_code,
    work_center_name: resource.resource_name,
    status: resource.status ?? "Active",
  };
}

export async function fetchMesCoreMachines() {
  const [equipment, resources] = await Promise.all([
    fetchMesCoreEquipment(),
    fetchMesCoreResources(),
  ]);
  if (equipment.length > 0) {
    return equipment.map((eq) => toLegacyMachine(eq, resources));
  }
  return resources
    .filter((r) => {
      const t = String(r.resource_type || "").toUpperCase();
      return t === "MACHINE" || t === "WORKCELL" || t === "LINE";
    })
    .map((r) => ({
      machine_id: r.resource_code,
      machine_name: r.resource_name,
      work_center_id: r.resource_code,
      status: r.status ?? "Available",
    }));
}

export async function fetchMesCoreWorkCenters() {
  const resources = await fetchMesCoreResources();
  return resources
    .filter((r) => {
      const t = String(r.resource_type || "").toUpperCase();
      return t === "WORKCELL" || t === "MACHINE" || t === "LINE";
    })
    .map(toLegacyWorkCenter);
}

export async function fetchMesCoreSchedules() {
  const res = await api.get("/api/schedules");
  return normalizeList(res.data);
}

export async function fetchMesCoreLotFeasibility(lotCode) {
  const res = await api.get(
    `/api/production-lots/by-code/${encodeURIComponent(lotCode)}/feasibility`
  );
  return res.data;
}

export async function runMesCoreFeasibilityCheck(lotCode) {
  const res = await api.post(
    `/api/production-lots/by-code/${encodeURIComponent(lotCode)}/feasibility/run`
  );
  return res.data;
}

export async function fetchMesCoreSchedulePlan(lotCode) {
  const res = await api.get(
    `/api/production-lots/by-code/${encodeURIComponent(lotCode)}/schedule-plan`
  );
  return res.data;
}

export async function createMesCoreSchedule(payload) {
  const res = await api.post("/api/schedules", {
    lot_id: payload.lot_id,
    operation_id: payload.operation_id,
    assigned_machine_id: payload.assigned_machine_id,
    assigned_work_center_id: payload.assigned_work_center_id || null,
    planned_start_time: payload.planned_start_time,
    planned_end_time: payload.planned_end_time,
    schedule_status: payload.schedule_status ?? "Scheduled",
  });
  return res.data;
}

export async function fetchMesCoreExecutionSummary(lotCode, { sync = false } = {}) {
  const res = await api.get(
    `/api/production-lots/by-code/${encodeURIComponent(lotCode)}/execution-summary`,
    { params: { sync } }
  );
  return res.data;
}

export async function startMesCoreExecution(executionCode, payload = {}) {
  const res = await api.put(
    `/api/execution/by-code/${encodeURIComponent(executionCode)}/start`,
    payload
  );
  return res.data;
}

export async function holdMesCoreExecution(executionCode, payload) {
  const res = await api.put(
    `/api/execution/by-code/${encodeURIComponent(executionCode)}/hold`,
    payload
  );
  return res.data;
}

export async function resumeMesCoreExecution(executionCode) {
  const res = await api.put(
    `/api/execution/by-code/${encodeURIComponent(executionCode)}/resume`
  );
  return res.data;
}

export async function completeMesCoreExecution(executionCode, payload) {
  const res = await api.put(
    `/api/execution/by-code/${encodeURIComponent(executionCode)}/complete`,
    payload
  );
  return res.data;
}

export async function appendMesCoreParameterReadings(executionCode, parameterReadings) {
  const res = await api.post(
    `/api/execution/by-code/${encodeURIComponent(executionCode)}/parameter-readings`,
    { parameter_readings: parameterReadings }
  );
  return res.data;
}

export function toLegacyInspectionResult(row) {
  if (!row) return row;
  const id = row.inspection_id ?? row.inspection_result_id ?? row.check_code;
  return {
    ...row,
    inspection_id: id,
    inspection_result_id: id,
  };
}

export function toLegacyNcr(row) {
  if (!row) return row;
  return {
    ...row,
    ncr_id: row.ncr_id ?? row.check_code,
    inspection_result_id: row.inspection_id ?? row.inspection_result_id,
  };
}

export async function fetchMesCoreInspectionResults() {
  const res = await api.get("/api/inspection-results");
  return normalizeList(res.data).map(toLegacyInspectionResult);
}

export async function createMesCoreInspectionResult(payload) {
  const res = await api.post("/api/inspection-results", {
    inspection_id: payload.inspection_id || payload.inspection_result_id || null,
    work_order_id: payload.work_order_id || null,
    lot_id: payload.lot_id,
    inspection_plan_id: payload.inspection_plan_id || null,
    inspected_quantity: payload.inspected_quantity,
    accepted_quantity: payload.accepted_quantity,
    rejected_quantity: payload.rejected_quantity,
    inspection_status: payload.inspection_status,
    parameters: payload.parameters || [],
  });
  return toLegacyInspectionResult(res.data);
}

export async function fetchMesCoreNcrs() {
  const res = await api.get("/api/ncrs");
  return normalizeList(res.data).map(toLegacyNcr);
}

export async function createMesCoreNcr(payload) {
  const res = await api.post("/api/ncrs", {
    ncr_id: payload.ncr_id || null,
    inspection_id: payload.inspection_id || payload.inspection_result_id,
    defect_id: payload.defect_id || null,
    rejected_quantity: payload.rejected_quantity,
    disposition: payload.disposition,
    root_cause: payload.root_cause,
    corrective_action: payload.corrective_action,
    status: payload.status ?? "Open",
  });
  return toLegacyNcr(res.data);
}

export async function fetchMesCoreDispatches() {
  const res = await api.get("/api/dispatches");
  return normalizeList(res.data);
}

export async function createMesCoreDispatch(payload) {
  const res = await api.post("/api/dispatches", {
    customer_id: payload.customer_id,
    order_id: payload.order_id,
    vehicle_number: payload.vehicle_number,
    transporter_name: payload.transporter_name,
    dispatch_status: payload.dispatch_status ?? "Ready",
    lines: payload.lines || [],
  });
  return res.data;
}

export async function fetchMesCoreLotTraceability(lotCode) {
  const res = await api.get(
    `/api/production-lots/by-code/${encodeURIComponent(lotCode)}/traceability`
  );
  return res.data;
}

export async function askMesCoreNyra({ question, lot_id: lotId }) {
  const res = await api.post("/api/ask", {
    question,
    lot_id: lotId || null
  });
  return res.data;
}

export async function fetchMesCoreOeeIntelligence() {
  const res = await api.get("/api/oee/intelligence");
  return res.data;
}

export async function recordMesCoreOeeSummary(payload) {
  const res = await api.post("/api/oee/daily-summary", {
    machine_id: payload.machine_id,
    oee_date: payload.oee_date,
    planned_production_minutes: payload.planned_production_minutes,
    downtime_minutes: payload.downtime_minutes,
    ideal_cycle_time_minutes: payload.ideal_cycle_time_minutes,
    total_quantity: payload.total_quantity,
    good_quantity: payload.good_quantity,
    availability_percent: payload.availability_percent,
    performance_percent: payload.performance_percent,
    quality_percent: payload.quality_percent,
    oee_percent: payload.oee_percent,
  });
  return res.data;
}

export async function fetchMesCoreIntelligenceHub() {
  const res = await api.get("/api/intelligence/hub");
  const data = res.data || {};

  let oeeTrend = normalizeOeeTrendPoints(data.oee_trend, data.oee_summaries);
  let oeeSummaries = Array.isArray(data.oee_summaries) ? data.oee_summaries : [];
  let averageOee = Number(data.kpis?.average_oee) || 0;
  let plantKpis = {
    availability: 0,
    performance: 0,
    quality: 0,
    oee: averageOee
  };

  try {
    const intel = await fetchMesCoreOeeIntelligence();
    if (intel) {
      if (oeeTrend.length === 0) {
        oeeTrend = normalizeOeeTrendPoints(intel.trend, intel.machine_ranking);
      }
      if (Array.isArray(intel.machine_ranking) && intel.machine_ranking.length > 0) {
        oeeSummaries = intel.machine_ranking;
      }
      if (intel.plant) {
        plantKpis = intel.plant;
        if (intel.plant.oee != null) {
          averageOee = Number(intel.plant.oee) || averageOee;
        }
      }
    }
  } catch {
    // Hub payload is still usable without OEE enrichment.
  }

  return {
    ...data,
    kpis: {
      ...(data.kpis || {}),
      average_oee: averageOee
    },
    oee_trend: oeeTrend,
    oee_summaries: oeeSummaries,
    plant_kpis: plantKpis
  };
}
