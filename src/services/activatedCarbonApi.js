/**
 * Activated Carbon industry API — maps to /api/activated-carbon/*
 * Requires tenant/workspace headers from AppContext (activated carbon workspace).
 */

import api, { formatApiError } from "./api";
import {
  createMesCoreSchedule,
  createMesCoreProduct,
  fetchMesCoreLotFeasibility,
  fetchMesCoreProducts,
  fetchMesCoreResources,
  fetchMesCoreEquipment,
  runMesCoreFeasibilityCheck
} from "./mesCoreApi";
import { isFeasibilityReady, feasibilityLabel } from "../utils/workflowValidation";

import { mergeRawMaterialTypes, saveLocalRawMaterialType, mergeRawProductsFromMaterialTypes } from "../industries/activated-carbon/utils/rawMaterialTypeStore";
import {
  isValidUuid,
  normalizeProductCode
} from "../industries/activated-carbon/utils/acProductUtils";
import {
  mapSchedulePlanToRoutingPlan,
  resolveAcRoutingPlanForLot,
  pendingOperationsForLot
} from "../industries/activated-carbon/utils/acRoutingResolver";

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function asMasterList(value) {
  return Array.isArray(value) ? value : [];
}

/** Ensure list fields are always arrays — API may omit keys or send null. */
export function normalizeAcMastersRecord(data = {}) {
  return {
    customers: asMasterList(data.customers),
    suppliers: asMasterList(data.suppliers),
    raw_products: asMasterList(data.raw_products),
    raw_material_types: asMasterList(data.raw_material_types),
    finished_products: asMasterList(data.finished_products),
    production_orders: asMasterList(data.production_orders),
    production_lots: asMasterList(data.production_lots),
    kilns: asMasterList(data.kilns),
    machines: asMasterList(data.machines),
    tools: asMasterList(data.tools),
    labor_pools: asMasterList(data.labor_pools),
    equipment: asMasterList(data.equipment),
    kiln_parameter_definitions: asMasterList(data.kiln_parameter_definitions),
    routing_master: data.routing_master ?? null
  };
}

function normalizeAcRoutingPlan(data) {
  if (!data || typeof data !== "object") return null;
  if (data.operations?.length || data.routing_id) return data;
  return null;
}

/** Core API blocks on RAW-* product codes — AC uses feedstock → finished-product routing. */
function isRawMaterialRoutingBlock(text) {
  if (!text) return false;
  const s = String(text);
  return /RAW-/i.test(s) && /routing|scheduling|operations|master/i.test(s);
}

function dimensionStatusesOk(result) {
  return ["material", "machine", "tool", "workforce"].every((key) => {
    const st = String(result[`${key}_status`] || "").toUpperCase();
    return !st || st === "OK" || st === "READY" || st === "AVAILABLE" || st.includes("OK");
  });
}

async function reconcileAcFeasibilityResult(lotCode, coreResult) {
  if (isFeasibilityReady(coreResult?.overall_status)) return coreResult;

  const reason = coreResult?.blocked_reason || "";
  const routingCheckBlocked = (coreResult?.checks || []).some(
    (c) =>
      String(c.status || "").toUpperCase() === "BLOCKED" &&
      isRawMaterialRoutingBlock(c.detail || "")
  );

  if (!isRawMaterialRoutingBlock(reason) && !routingCheckBlocked) {
    return coreResult;
  }

  let plan;
  try {
    plan = await fetchAcRoutingPlan(lotCode);
  } catch {
    return coreResult;
  }

  if (!plan?.operations?.length) return coreResult;

  const woCount = plan.generated_work_orders ?? 0;
  if (woCount === 0 && !plan.routing_complete) {
    return {
      ...coreResult,
      overall_status: "READY",
      blocked_reason: null,
      ac_routing_pending_work_orders: plan.pending_work_orders,
      ac_routing_plan: plan.routing_id,
      message:
        "Feasibility checks passed. Generate work orders on Lot Routing before execution."
    };
  }

  if (plan.routing_complete || woCount > 0) {
    if (!dimensionStatusesOk(coreResult)) {
      const machineStatus = String(coreResult?.machine_status || "").toUpperCase();
      const onlyMachineBlocked =
        machineStatus &&
        !["OK", "READY", "AVAILABLE"].some((ok) => machineStatus.includes(ok)) &&
        ["material", "tool", "workforce"].every((key) => {
          const st = String(coreResult[`${key}_status`] || "").toUpperCase();
          return !st || st === "OK" || st === "READY" || st === "AVAILABLE" || st.includes("OK");
        });

      if (onlyMachineBlocked) {
        return {
          ...coreResult,
          overall_status: coreResult.overall_status || "BLOCKED",
          blocked_reason:
            coreResult.blocked_reason ||
            `Kiln/machine not available (${machineStatus}). Release kiln or select another lot.`
        };
      }
      return coreResult;
    }
  } else {
    return coreResult;
  }

  const feedstock = plan.raw_material_code || "feedstock";
  const finished = plan.part_id || "finished product";
  const routingId = plan.routing_id || "routing";

  return {
    ...coreResult,
    overall_status: "READY",
    blocked_reason: null,
    ac_routing_resolved: true,
    checks: (coreResult.checks || []).map((c) => {
      const detail = c.detail || "";
      if (
        String(c.status || "").toUpperCase() === "BLOCKED" &&
        isRawMaterialRoutingBlock(detail)
      ) {
        return {
          ...c,
          status: "OK",
          detail: `Fixed routing ${routingId} for ${finished} applies to ${feedstock} (raw material type master).`
        };
      }
      return c;
    })
  };
}

export async function runAcFeasibilityCheck(lotCode) {
  try {
    const res = await api.post(
      `/api/activated-carbon/lots/${encodeURIComponent(lotCode)}/feasibility/run`
    );
    if (res.data) {
      return reconcileAcFeasibilityResult(lotCode, res.data);
    }
  } catch (error) {
    const status = error?.response?.status;
    if (status && status >= 500) throw error;
  }

  const core = await runMesCoreFeasibilityCheck(lotCode);
  return reconcileAcFeasibilityResult(lotCode, core);
}

async function generateAcRouteFallback(lotCode) {
  const pending = await pendingOperationsForLot(lotCode);

  if (!pending.length) {
    return {
      message: "All routing operations already have work orders",
      lot_id: lotCode,
      operation_count: 0,
      operations: [],
      feasibility: await runAcFeasibilityCheck(lotCode).catch(() => null)
    };
  }

  const created = [];
  const errors = [];
  const baseMs = Date.now();

  for (let i = 0; i < pending.length; i += 1) {
    const op = pending[i];
    const start = new Date(baseMs + i * 3 * 60 * 60 * 1000);
    const durationMin = op.estimated_duration_minutes || 60;
    const end = new Date(start.getTime() + durationMin * 60 * 1000);
    try {
      const row = await createMesCoreSchedule({
        lot_id: lotCode,
        operation_id: op.operation_id || op.operation_code,
        assigned_machine_id: op.suggested_machine_id || undefined,
        assigned_work_center_id: op.suggested_work_center_id || undefined,
        planned_start_time: start.toISOString(),
        planned_end_time: end.toISOString(),
        schedule_status: "Scheduled"
      });
      created.push({
        work_order_id: row.schedule_id,
        operation_sequence: op.operation_sequence,
        operation_code: op.operation_id || op.operation_code,
        operation_name: op.operation_name,
        status: "Released"
      });
    } catch (e) {
      errors.push(
        `${op.operation_code || op.operation_id}: ${
          e.response?.data?.detail || e.message || "schedule failed"
        }`
      );
    }
  }

  if (!created.length && errors.length) {
    throw new Error(
      `Could not generate work orders. ${errors.join(" · ")}. ` +
        "Run Feasibility Gate for this lot first, then try Generate Route again."
    );
  }

  const feasibility = await runAcFeasibilityCheck(lotCode).catch(() => null);
  return {
    message: created.length ? "Route generated for lot" : "No new work orders created",
    lot_id: lotCode,
    operation_count: created.length,
    operations: created,
    feasibility,
    errors: errors.length ? errors : undefined
  };
}

async function fetchAcMastersFromCore() {
  const [resources, equipment] = await Promise.all([
    fetchMesCoreResources(),
    fetchMesCoreEquipment().catch(() => [])
  ]);
  const list = Array.isArray(resources) ? resources : [];
  const equipmentList = Array.isArray(equipment) ? equipment : [];
  const kilns = list.filter((r) => String(r.resource_code || "").startsWith("RES-KILN"));
  const machines = list.filter((r) => (r.resource_type || "").toUpperCase() === "MACHINE");
  const tools = list.filter((r) => (r.resource_type || "").toUpperCase() === "TOOL");
  const labor_pools = list.filter((r) => (r.resource_type || "").toUpperCase() === "LABOR");
  return {
    customers: [],
    suppliers: [],
    raw_products: [],
    finished_products: [],
    production_orders: [],
    production_lots: [],
    kilns,
    machines,
    tools,
    labor_pools,
    equipment: equipmentList,
    kiln_parameter_definitions: [],
    routing_master: null
  };
}

export async function fetchAcMasters() {
  let data = {};
  try {
    const res = await api.get("/api/activated-carbon/masters");
    data = res.data || {};
  } catch (e) {
    if (e?.response?.status !== 404) throw e;
    data = await fetchAcMastersFromCore();
  }

  const base = normalizeAcMastersRecord(data);

  const typeSource = base.raw_material_types.length
    ? base.raw_material_types
    : await fetchAcRawMaterialTypes().catch(() => []);
  const types = mergeRawMaterialTypes(typeSource);

  const [catalogProducts, suppliers, customers] = await Promise.all([
    fetchMesCoreProducts().catch(() => []),
    base.suppliers.length
      ? Promise.resolve(base.suppliers)
      : fetchAcSuppliers().catch(() => []),
    base.customers.length
      ? Promise.resolve(base.customers)
      : fetchAcCustomers().catch(() => [])
  ]);

  return normalizeAcMastersRecord({
    ...base,
    customers,
    suppliers,
    raw_material_types: types,
    raw_products: mergeRawProductsFromMaterialTypes(
      base.raw_products,
      types,
      catalogProducts
    )
  });
}

async function resolveAcProductUuid({ product_id, product_code, product_name }) {
  if (isValidUuid(String(product_id || ""))) {
    return String(product_id);
  }

  let code =
    product_code ||
    (!isValidUuid(String(product_id || "")) ? product_id : null);
  if (!code) {
    throw new Error("Select a raw material product before recording inward.");
  }

  const types = await fetchAcRawMaterialTypes().catch(() => mergeRawMaterialTypes([]));
  const nameKey = normalizeProductCode(product_name || code);
  const alias = types.find(
    (t) =>
      normalizeProductCode(t.product_code) === normalizeProductCode(code) ||
      normalizeProductCode(t.product_name) === nameKey
  );
  if (alias?.product_code) {
    code = alias.product_code;
  }

  if (!normalizeProductCode(code).startsWith("RAW-")) {
    const slug = normalizeProductCode(code).replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
    code = slug ? `RAW-${slug}` : code;
  }

  const normalized = normalizeProductCode(code);
  const products = await fetchMesCoreProducts().catch(() => []);
  const match = products.find(
    (p) => normalizeProductCode(p.product_code || p.part_code) === normalized
  );
  if (match?.product_id && isValidUuid(String(match.product_id))) {
    return String(match.product_id);
  }

  const created = await createMesCoreProduct({
    product_code: code,
    product_name: product_name || alias?.product_name || code,
    product_type: "RAW_MATERIAL",
    uom: "KG"
  });
  if (!created?.product_id || !isValidUuid(String(created.product_id))) {
    throw new Error(`Could not register product ${code} in the product master.`);
  }
  return String(created.product_id);
}

export async function fetchAcRawMaterialTypes({ activeOnly = false } = {}) {
  try {
    const params = activeOnly ? { active_only: true } : undefined;
    const res = await api.get("/api/activated-carbon/masters/raw-material-types", { params });
    return mergeRawMaterialTypes(normalizeList(res.data));
  } catch (error) {
    if (error?.response?.status === 404) {
      return mergeRawMaterialTypes([]);
    }
    throw error;
  }
}

export async function fetchAcRawMaterialType(productId) {
  const res = await api.get(
    `/api/activated-carbon/masters/raw-material-types/${encodeURIComponent(productId)}`
  );
  return res.data;
}

export async function createAcRawMaterialType(payload) {
  try {
    const res = await api.post("/api/activated-carbon/masters/raw-material-types", payload);
    return res.data;
  } catch (error) {
    if (error?.response?.status === 404) {
      saveLocalRawMaterialType(payload);
      return payload;
    }
    throw error;
  }
}

export async function updateAcRawMaterialType(productId, payload) {
  const res = await api.put(
    `/api/activated-carbon/masters/raw-material-types/${encodeURIComponent(productId)}`,
    payload
  );
  return res.data;
}

export async function markAcRawMaterialTypeObsolete(productId) {
  const res = await api.post(
    `/api/activated-carbon/masters/raw-material-types/${encodeURIComponent(productId)}/obsolete`
  );
  return res.data;
}

/** @deprecated use fetchAcMasters — kept for direct calls */
export async function fetchAcMastersRaw() {
  const res = await api.get("/api/activated-carbon/masters");
  return res.data;
}

function isIncompleteApiRoutingPlan(data) {
  if (!data || typeof data !== "object") return true;
  const part = String(data.part_id || data.part_code || "");
  const ops = data.operations || [];
  if (part.toUpperCase().startsWith("RAW-") && ops.length === 0) return true;
  if (ops.length === 0 && !data.routing_complete) return true;
  return false;
}

export async function fetchAcRoutingPlan(lotCode) {
  let apiPlan = null;
  try {
    const res = await api.get(
      `/api/activated-carbon/lots/${encodeURIComponent(lotCode)}/routing-plan`
    );
    if (!isIncompleteApiRoutingPlan(res.data)) {
      apiPlan = res.data;
    }
  } catch (error) {
    const status = error?.response?.status;
    if (status && status >= 500) throw error;
  }

  const resolved = await resolveAcRoutingPlanForLot(lotCode);

  if (!apiPlan) return resolved;

  if ((apiPlan.generated_work_orders ?? 0) > (resolved.generated_work_orders ?? 0)) {
    return {
      ...resolved,
      ...apiPlan,
      operations: apiPlan.operations?.length ? apiPlan.operations : resolved.operations,
      raw_material_code: resolved.raw_material_code,
      raw_material_name: resolved.raw_material_name,
      resolved_from: resolved.resolved_from || apiPlan.resolved_from
    };
  }

  return resolved;
}

export async function generateAcRoute(lotCode) {
  const feasibility = () => runAcFeasibilityCheck(lotCode).catch(() => null);

  try {
    const res = await api.post(
      `/api/activated-carbon/lots/${encodeURIComponent(lotCode)}/generate-route`
    );
    const count = res.data?.operation_count ?? res.data?.operations?.length ?? 0;
    return {
      ...res.data,
      operation_count: count,
      feasibility: await feasibility()
    };
  } catch (error) {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail || error?.message;
    if (status && status >= 500) throw error;
    if (status === 404) {
      // Older API — try mes_core generate-route
      try {
        const res = await api.post(
          `/api/production-lots/by-code/${encodeURIComponent(lotCode)}/generate-route`
        );
        return { ...res.data, feasibility: await feasibility() };
      } catch (inner) {
        throw new Error(inner?.response?.data?.detail || inner?.message || detail);
      }
    }
    if (status && status >= 400) {
      throw new Error(
        detail ||
          "Generate route failed — re-run Feasibility Gate for this lot, then try again."
      );
    }
  }

  return generateAcRouteFallback(lotCode);
}

export { mapSchedulePlanToRoutingPlan };

export async function createAcKilnParameter(payload) {
  const res = await api.post("/api/activated-carbon/masters/kiln-parameters", {
    key: payload.key,
    label: payload.label,
    unit: payload.unit || null
  });
  return res.data;
}

/** Ontology-linked UI config: QC parameters + dashboard panels (per tenant/workspace). */
export async function fetchAcOntologyConfig() {
  try {
    const res = await api.get("/api/activated-carbon/masters/ontology-config");
    return res.data;
  } catch (error) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function saveAcOntologyConfig(payload) {
  try {
    const res = await api.post("/api/activated-carbon/masters/ontology-config", payload);
    return res.data;
  } catch (error) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function createAcResource(payload) {
  const res = await api.post("/api/activated-carbon/masters/resources", payload);
  return res.data;
}

export async function createAcKiln(payload) {
  const res = await api.post("/api/activated-carbon/masters/kilns", {
    kiln_name: payload.kiln_name,
    status: payload.status ?? "ACTIVE"
  });
  return res.data;
}

export async function fetchAcDashboard() {
  try {
    const res = await api.get("/api/activated-carbon/dashboard");
    return res.data;
  } catch (error) {
    if (error?.response?.status !== 404) throw error;
    const [yieldSummary, masters, lots, qc] = await Promise.all([
      fetchAcYieldAnalysis(),
      fetchAcMasters(),
      fetchAcKilnFeedLots(),
      fetchAcQualityTesting()
    ]);
    const charged = lots.reduce((sum, l) => sum + Number(l.lot_quantity || 0), 0);
    return {
      yield_summary: yieldSummary,
      raw_material: {
        ordered_kg: 0,
        charged_kg: charged,
        pending_kg: 0,
        open_order_count: 0
      },
      kilns: (masters.kilns || []).map((k) => ({
        resource_code: k.resource_code,
        resource_name: k.resource_name,
        status: "IDLE",
        active_lot_code: null,
        active_lot_kg: null,
        last_reading_at: null
      })),
      process_steps: [],
      lot_lines: [],
      grade_stock: [],
      open_customer_orders: [],
      recent_dispatches: [],
      dispatched_kg_total: 0,
      finished_goods_stock_kg: 0,
      quality_check_count: qc?.length ?? 0,
      dispatch_count: 0,
      kiln_parameter_definitions: masters.kiln_parameter_definitions || []
    };
  }
}

export async function fetchAcCustomers() {
  try {
    const res = await api.get("/api/activated-carbon/customers");
    return normalizeList(res.data);
  } catch (error) {
    if (error?.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

export async function createAcCustomer(payload) {
  const res = await api.post("/api/activated-carbon/customers", {
    customer_name: payload.customer_name,
    status: payload.status || "ACTIVE"
  });
  return res.data;
}

export async function fetchAcSuppliers() {
  try {
    const res = await api.get("/api/activated-carbon/suppliers");
    return normalizeList(res.data);
  } catch (error) {
    if (error?.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

export async function createAcSupplier(payload) {
  try {
    const res = await api.post("/api/activated-carbon/suppliers", {
      supplier_name: payload.supplier_name,
      status: payload.status || "ACTIVE"
    });
    return res.data;
  } catch (error) {
    if (error?.response?.status === 404) {
      throw new Error(
        "Supplier API not available — restart the backend (nyra-mes-api) to load the latest routes."
      );
    }
    throw error;
  }
}

export async function fetchAcDispatches() {
  const res = await api.get("/api/activated-carbon/dispatches");
  return normalizeList(res.data);
}

export async function createAcDispatch(payload) {
  const res = await api.post("/api/activated-carbon/dispatches", payload);
  return res.data;
}

export const AC_QC_PASS_STATUSES = new Set([
  "PASS",
  "PASSED",
  "QC_PASSED",
  "APPROVED",
  "CLOSED"
]);

/** True when raw material inward has passed QC (order status or QC metadata). */
export function isAcInwardQcPassed(order) {
  if (!order || typeof order !== "object") return false;
  const orderStatus = String(order.status || "").toUpperCase();
  if (orderStatus === "QC_PASSED") return true;
  const qcStatus = String(
    order.qc_status ||
      order.metadata?.raw_material_qc?.qc_status ||
      ""
  ).toUpperCase();
  return AC_QC_PASS_STATUSES.has(qcStatus);
}

export function enrichAcInwardOrder(order) {
  if (!order || typeof order !== "object") return order;
  const rawLine = (order.lines || []).find((line) => {
    const code = String(line.product_code || "").toUpperCase();
    return code.startsWith("RAW-");
  });
  const qty = Number(
    order.inward_quantity_kg ?? rawLine?.quantity ?? 0
  );
  const allocated = Number(order.allocated_to_production_kg ?? 0);
  const available = Number(
    order.available_quantity_kg ?? Math.max(qty - allocated, 0)
  );
  const qcStatus =
    order.qc_status ||
    order.metadata?.raw_material_qc?.qc_status ||
    (String(order.status || "").toUpperCase() === "QC_PASSED" ? "QC_PASSED" : null);
  return {
    ...order,
    raw_product_code: order.raw_product_code || rawLine?.product_code,
    inward_quantity_kg: qty,
    allocated_to_production_kg: allocated,
    available_quantity_kg: available,
    qc_status: qcStatus,
    production_order_code:
      order.production_order_code ||
      order.metadata?.production_order_code ||
      null
  };
}

/** QC-passed inward orders eligible for release-to-production on the feasibility gate. */
export async function fetchAcReleaseEligibleInward() {
  const rows = await fetchAcRawMaterialQc();
  return rows.filter(isAcInwardQcPassed).map(enrichAcInwardOrder);
}

function mapInwardOrderToQcRow(order) {
  const enriched = enrichAcInwardOrder(order);
  if (!enriched || typeof enriched !== "object") return null;
  const rawLine = (enriched.lines || []).find((line) => {
    const code = String(line.product_code || "").toUpperCase();
    return code.startsWith("RAW-");
  });
  if (!rawLine && !enriched.inward_quantity_kg) return null;
  const meta = enriched.metadata?.raw_material_qc || enriched.raw_material_qc || {};
  return {
    customer_order_id: enriched.customer_order_id,
    order_code: enriched.order_code,
    product_code: enriched.raw_product_code || rawLine?.product_code,
    product_name: rawLine?.product_name,
    quantity: enriched.inward_quantity_kg ?? rawLine?.quantity,
    available_quantity_kg: enriched.available_quantity_kg,
    allocated_to_production_kg: enriched.allocated_to_production_kg,
    uom: rawLine?.uom || "KG",
    moisture_pct: meta.moisture_pct ?? null,
    ash_pct: meta.ash_pct ?? null,
    foreign_matter_pct: meta.foreign_matter_pct ?? null,
    stones_kg: meta.stones_kg ?? null,
    unburnt_kg: meta.unburnt_kg ?? null,
    minus20_kg: meta.minus20_kg ?? null,
    operator_remarks: meta.operator_remarks ?? null,
    qc_status: enriched.qc_status || meta.qc_status || "PENDING",
    qc_at: meta.qc_at ?? null
  };
}

export async function fetchAcRawMaterialInward() {
  const res = await api.get("/api/activated-carbon/raw-material-inward");
  return normalizeList(res.data).map(enrichAcInwardOrder);
}

function getAcTenantScope() {
  return {
    tenantCode: api.defaults.headers?.["X-Tenant-Code"] || "default",
    workspaceCode: api.defaults.headers?.["X-Workspace-Code"] || "default"
  };
}

export async function fetchAcInwardBags(orderCode) {
  try {
    const path = orderCode
      ? `/api/activated-carbon/inward-bags?order_code=${encodeURIComponent(orderCode)}`
      : "/api/activated-carbon/inward-bags";
    const res = await api.get(path);
    return normalizeList(res.data);
  } catch (error) {
    if (error?.response?.status === 404) {
      const { listLocalInwardBags } = await import(
        "../industries/activated-carbon/utils/acBagStore"
      );
      const { tenantCode, workspaceCode } = getAcTenantScope();
      return listLocalInwardBags(tenantCode, workspaceCode, orderCode);
    }
    throw error;
  }
}

export async function createAcInwardBag(payload) {
  try {
    const res = await api.post("/api/activated-carbon/inward-bags", payload);
    return res.data;
  } catch (error) {
    if (error?.response?.status === 404) {
      const { createLocalInwardBag } = await import(
        "../industries/activated-carbon/utils/acBagStore"
      );
      const { tenantCode, workspaceCode } = getAcTenantScope();
      return createLocalInwardBag(payload, tenantCode, workspaceCode);
    }
    throw error;
  }
}

export async function createAcRawMaterialInward(payload) {
  const product_id = await resolveAcProductUuid({
    product_id: payload.product_id,
    product_code: payload.product_code,
    product_name: payload.product_name
  });
  if (!payload.supplier_id) {
    throw new Error("Select a supplier before recording inward.");
  }
  const body = {
    supplier_id: String(payload.supplier_id),
    product_id,
    quantity: Number(payload.quantity),
    uom: payload.uom || "KG",
    create_production_order: false
  };
  const res = await api.post("/api/activated-carbon/raw-material-inward", body);
  return res.data;
}

export async function fetchAcRawMaterialQc() {
  let qcRows = [];
  try {
    const res = await api.get("/api/activated-carbon/raw-material-qc");
    qcRows = normalizeList(res.data);
  } catch (error) {
    if (error?.response?.status && error.response.status !== 404) {
      throw error;
    }
  }

  const inward = await fetchAcRawMaterialInward();
  const inwardRows = inward.map(mapInwardOrderToQcRow).filter(Boolean);
  if (!inwardRows.length) {
    return qcRows;
  }

  const byOrderId = new Map(
    inwardRows.map((row) => [String(row.customer_order_id), row])
  );
  for (const row of qcRows) {
    byOrderId.set(String(row.customer_order_id), {
      ...byOrderId.get(String(row.customer_order_id)),
      ...row
    });
  }
  return Array.from(byOrderId.values()).sort((a, b) =>
    String(a.order_code || "").localeCompare(String(b.order_code || ""))
  );
}

export async function createAcRawMaterialQc(payload) {
  try {
    const res = await api.post("/api/activated-carbon/raw-material-qc", payload);
    return res.data;
  } catch (error) {
    if (error?.response?.status === 404) {
      throw new Error(
        "Raw Material QC API not found — restart the local API, then refresh."
      );
    }
    throw error;
  }
}

export async function fetchAcKilnFeedLots() {
  const res = await api.get("/api/activated-carbon/kiln-feed");
  return normalizeList(res.data);
}

export async function createAcKilnFeedLot(payload) {
  const res = await api.post("/api/activated-carbon/kiln-feed", payload);
  return res.data;
}

export async function createAcMakeToStockOrder(payload) {
  const res = await api.post("/api/activated-carbon/manufacturing-orders", payload);
  return res.data;
}

export async function fetchAcFinishedGoodsStock() {
  try {
    const res = await api.get("/api/activated-carbon/finished-goods-stock");
    return normalizeList(res.data);
  } catch (e) {
    if (e?.response?.status !== 404) throw e;
    const products = await fetchMesCoreProducts().catch(() => []);
    return products
      .map((p) => {
        const meta = p.metadata || {};
        const qty = Number(meta.fg_stock_kg ?? 0);
        if (!qty || qty <= 0) return null;
        return {
          product_id: p.product_id,
          product_code: p.product_code || p.part_code,
          product_name: p.product_name || p.part_name,
          quantity_kg: qty,
          uom: p.uom || p.unit_of_measure || "KG"
        };
      })
      .filter(Boolean);
  }
}

export async function fetchAcDeliveryCommitment(finishedProductId, quantity) {
  try {
    const res = await api.get("/api/activated-carbon/customer-orders/commitment", {
      params: {
        finished_product_id: finishedProductId,
        quantity
      }
    });
    return res.data;
  } catch (e) {
    if (e?.response?.status !== 404) throw e;
    const qty = Number(quantity) || 0;
    const stockRows = await fetchAcFinishedGoodsStock();
    const row = stockRows.find(
      (s) => String(s.product_id) === String(finishedProductId)
    );
    const stock = Number(row?.quantity_kg ?? 0);
    const shortfall = Math.max(qty - stock, 0);
    return {
      finished_product_id: finishedProductId,
      product_code: row?.product_code,
      quantity_kg: qty,
      stock_on_hand_kg: stock,
      can_dispatch_from_stock: shortfall <= 0,
      shortfall_kg: shortfall,
      tentative_delivery_date: new Date().toISOString().slice(0, 10),
      manufacturing_lead_days: shortfall > 0 ? 14 : 0,
      message:
        shortfall <= 0
          ? `${stock} KG in stock — can dispatch without new production.`
          : `Stock covers ${stock} KG; need ${shortfall} KG more (restart API for full commitment logic).`
    };
  }
}

export async function createAcCustomerSalesOrder(payload) {
  try {
    const res = await api.post("/api/activated-carbon/customer-sales-orders", payload);
    return res.data;
  } catch (e) {
    if (e?.response?.status !== 404) throw e;
    throw new Error(
      "Customer PO API is not available on the running backend. Restart the API from nyra-mes-api: .\\scripts\\run_local_api.ps1"
    );
  }
}

export async function fetchAcOpenCustomerOrders() {
  const res = await api.get("/api/activated-carbon/customer-sales-orders");
  return normalizeList(res.data);
}

export async function fetchAcGradeStock() {
  const res = await api.get("/api/activated-carbon/grade-stock");
  return normalizeList(res.data);
}

export async function createAcDispatchFromOrder(payload) {
  const res = await api.post("/api/activated-carbon/dispatch-from-order", payload);
  return res.data;
}

export async function fetchAcKilnParameters(lotCode) {
  const params = lotCode ? { lot_code: lotCode } : {};
  const res = await api.get("/api/activated-carbon/kiln-parameters", { params });
  return normalizeList(res.data);
}

export async function createAcKilnParameters(payload) {
  const res = await api.post("/api/activated-carbon/kiln-parameters", payload);
  return res.data;
}

export async function fetchAcScreening() {
  const res = await api.get("/api/activated-carbon/screening");
  return normalizeList(res.data);
}

export async function createAcScreening(payload) {
  const res = await api.post("/api/activated-carbon/screening", payload);
  return res.data;
}

export async function fetchAcQualityTesting() {
  const res = await api.get("/api/activated-carbon/quality-testing");
  return normalizeList(res.data);
}

export async function createAcQualityTest(payload) {
  const res = await api.post("/api/activated-carbon/quality-testing", payload);
  return res.data;
}

export async function fetchAcYieldAnalysis() {
  const res = await api.get("/api/activated-carbon/yield-analysis");
  return res.data;
}

export async function fetchAcTraceability(lotCode) {
  const res = await api.get(
    `/api/activated-carbon/traceability/${encodeURIComponent(lotCode)}`
  );
  return res.data;
}

export { formatApiError as formatAcApiError };

export const AC_DEMO_LOT_COMPLETE = "LOT-AC-002";

function sortAcLotsByCodeSuffix(lots) {
  const suffix = (code) => {
    const m = String(code || "").match(/(\d+)$/);
    return m ? Number(m[1]) : 0;
  };
  return [...lots].sort(
    (a, b) =>
      suffix(b.lot_id || b.lot_code) - suffix(a.lot_id || a.lot_code)
  );
}

/** Map `/open-lots` row to legacy lot shape used by workflow screens. */
export function mapAcOpenLotRow(row) {
  if (!row || typeof row !== "object") return row;
  const lotCode = row.lot_code || row.lot_id;
  return {
    ...row,
    lot_id: lotCode,
    lot_code: lotCode,
    production_lot_id: row.production_lot_id,
    production_order_id: row.production_order_code || row.production_order_id,
    order_code: row.order_code,
    lot_quantity: Number(row.lot_quantity),
    feasibility_ready: isFeasibilityReady(row.feasibility_status),
    routing_complete: Boolean(row.routing_complete)
  };
}

/** Server-filtered open lots — preferred source for AC workflow dropdowns. */
export async function fetchAcOpenLots() {
  try {
    const res = await api.get("/api/activated-carbon/open-lots");
    return sortAcLotsByCodeSuffix(normalizeList(res.data).map(mapAcOpenLotRow));
  } catch (error) {
    if (error?.response?.status === 404) {
      return fetchAcRoutingLots({ excludeRoutingComplete: true });
    }
    throw error;
  }
}

/** Label for lot dropdowns — shows lot code and linked inward order. */
export function formatAcLotOptionLabel(lot) {
  const id = lot?.lot_id || lot?.lot_code || "—";
  const inward = lot?.order_code ? ` · ${lot.order_code}` : "";
  const qty = lot?.lot_quantity != null ? ` · ${lot.lot_quantity} KG` : "";
  const gate = lot?.feasibility_status
    ? ` · ${feasibilityLabel(lot.feasibility_status)}`
    : " · Not checked";
  return `${id}${inward}${qty}${gate}`;
}

/** Lots for routing / execution dropdowns. */
export async function fetchAcRoutingLots(options = {}) {
  const { excludeRoutingComplete = false } = options;
  const { fetchMesCoreProductionLots, fetchMesCoreExecutionSummary } = await import(
    "./mesCoreApi"
  );
  const [core, kiln] = await Promise.all([
    fetchMesCoreProductionLots().catch(() => []),
    fetchAcKilnFeedLots().catch(() => [])
  ]);

  const byCode = new Map();
  for (const lot of core) {
    const id = lot.lot_id || lot.lot_code;
    if (id) byCode.set(id, lot);
  }
  for (const row of kiln) {
    const id = row.lot_code || row.lot_id;
    if (!id || byCode.has(id)) continue;
    byCode.set(id, {
      lot_id: id,
      production_order_id: row.production_order_code || row.production_order_id,
      lot_quantity: row.lot_quantity,
      status: row.status,
      product_code: row.product_code
    });
  }

  const lots = Array.from(byCode.values());
  lots.sort((a, b) => {
    const suffix = (code) => {
      const m = String(code || "").match(/(\d+)$/);
      return m ? Number(m[1]) : 0;
    };
    return suffix(b.lot_id || b.lot_code) - suffix(a.lot_id || a.lot_code);
  });
  const enriched = await Promise.all(
    lots.map(async (lot) => {
      const id = lot.lot_id || lot.lot_code;
      if (!id) return lot;
      let feasibilityStatus = null;
      try {
        const gate = await fetchMesCoreLotFeasibility(id);
        feasibilityStatus = gate?.overall_status || null;
      } catch {
        feasibilityStatus = null;
      }

      let routing_complete = false;
      try {
        const summary = await fetchMesCoreExecutionSummary(id, { sync: false });
        const total = summary?.operations_total ?? 0;
        const completed = summary?.operations_completed ?? 0;
        routing_complete =
          total > 0 && completed >= total && (summary?.execution_ready !== false);
      } catch {
        routing_complete = (lot.status || "").toUpperCase() === "COMPLETED";
      }

      return {
        ...lot,
        feasibility_status: feasibilityStatus,
        feasibility_ready: isFeasibilityReady(feasibilityStatus),
        routing_complete
      };
    })
  );

  if (!excludeRoutingComplete) {
    return enriched;
  }
  const terminalStatuses = new Set([
    "COMPLETED",
    "QC_PENDING",
    "STOCKED",
    "DISPATCHED",
    "CLOSED",
    "CANCELLED"
  ]);
  return enriched.filter((lot) => {
    const status = (lot.status || "").toUpperCase();
    return !lot.routing_complete && !terminalStatuses.has(status);
  });
}

/** Lots ready for unified shop-floor execution (feasibility passed, routing not complete). */
export async function fetchAcExecutionLots() {
  const lots = await fetchAcRoutingLots({ excludeRoutingComplete: true });
  return lots.filter((lot) => {
    const status = (lot.status || "").toUpperCase();
    if (lot.feasibility_ready) return true;
    return status === "IN_PROGRESS" || status === "QC_PENDING";
  });
}

/** Lots eligible for kiln charge (feasibility passed, not yet charged). */
export async function fetchAcKilnChargeLots() {
  const lots = await fetchAcOpenLots();
  return lots.filter((lot) => {
    const status = (lot.status || "").toUpperCase();
    return status === "CREATED" && isFeasibilityReady(lot.feasibility_status);
  });
}

/** Lots awaiting feasibility — released to production, execution not yet started. */
export async function fetchAcFeasibilityLots() {
  const lots = await fetchAcOpenLots();
  return lots.filter((lot) => {
    const stage = (lot.pipeline_stage || "").trim();
    const status = (lot.status || "").toUpperCase();
    if (stage === "Awaiting feasibility") return true;
    if (status === "CREATED" && !lot.routing_complete) return true;
    return false;
  });
}

/** Lots in finished-goods stock — eligible for dispatch (enriched with grade/product). */
export async function fetchAcStockedLots() {
  try {
    const res = await api.get("/api/activated-carbon/stocked-lots");
    return normalizeList(res.data);
  } catch (error) {
    if (error?.response?.status === 404) {
      const { fetchMesCoreProductionLots } = await import("./mesCoreApi");
      const lots = await fetchMesCoreProductionLots().catch(() => []);
      return lots.filter((lot) => (lot.status || "").toUpperCase() === "STOCKED");
    }
    throw error;
  }
}

export function lotMatchesDispatchOrder(lot, order) {
  if (!order) return true;
  if (
    lot.product_id &&
    order.product_id &&
    String(lot.product_id) === String(order.product_id)
  ) {
    return true;
  }
  const lotKey = String(lot.product_code || lot.grade_code || "").toUpperCase();
  const wanted = String(order.product_code || "").toUpperCase();
  if (!wanted || !lotKey) return true;
  return (
    lotKey === wanted ||
    lotKey.includes(wanted) ||
    wanted.includes(lotKey)
  );
}

/** Lots ready for finished-goods quality testing (routing + screening complete, not yet stocked). */
export async function fetchAcCompletedLots() {
  const [lots, screening] = await Promise.all([
    fetchAcRoutingLots(),
    fetchAcScreening().catch(() => [])
  ]);
  const screenedLotIds = new Set(
    (screening || []).map((row) => String(row.production_lot_id))
  );
  return lots.filter((lot) => {
    const status = (lot.status || "").toUpperCase();
    if (status === "STOCKED" || status === "DISPATCHED") return false;
    const routingDone =
      lot.routing_complete || status === "QC_PENDING" || status === "COMPLETED";
    if (!routingDone) return false;
    return screenedLotIds.has(String(lot.production_lot_id));
  });
}

/** Lots awaiting screening after shop-floor execution completes. */
export async function fetchAcLotsAwaitingScreening() {
  const [lots, screening] = await Promise.all([
    fetchAcRoutingLots(),
    fetchAcScreening().catch(() => [])
  ]);
  const screenedLotIds = new Set(
    (screening || []).map((row) => String(row.production_lot_id))
  );
  return lots.filter((lot) => {
    const status = (lot.status || "").toUpperCase();
    if (status === "STOCKED" || status === "DISPATCHED") return false;
    const routingDone =
      lot.routing_complete || status === "QC_PENDING" || status === "COMPLETED";
    return routingDone && !screenedLotIds.has(String(lot.production_lot_id));
  });
}
