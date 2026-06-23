/**
 * Activated Carbon workspace routing builder API.
 * Uses mes_core granular endpoints with localStorage fallback when offline.
 */

import api, { formatApiError } from "../../../services/api";
import {
  createWorkspaceRoutingFromTemplate,
  sortOperations
} from "../constants/defaultActivatedCarbonRoute";
import { enrichRoutingOperations } from "../constants/defaultOperationParameters";

const STORAGE_PREFIX = "nyra_ac_active_routing_v1";

function storageKey(workspaceCode) {
  return `${STORAGE_PREFIX}:${workspaceCode || "default"}`;
}

function readLocalRouting(workspaceCode) {
  try {
    const raw = localStorage.getItem(storageKey(workspaceCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.operations?.length) return null;
    return normalizeRouting(parsed);
  } catch {
    return null;
  }
}

function writeLocalRouting(routing, workspaceCode) {
  localStorage.setItem(storageKey(workspaceCode), JSON.stringify(routing));
  return routing;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function resolveGateType(row) {
  if (row.gate_type ?? row.gate) return row.gate_type ?? row.gate;
  if (row.is_feasibility_gate) return "feasibility_gate";
  if (row.is_quality_gate) return "quality_gate";
  return null;
}

function normalizeParameter(row) {
  if (!row || typeof row !== "object") return null;
  return {
    parameter_id: row.parameter_id ?? row.id ?? null,
    parameter_code: row.parameter_code ?? row.code ?? "",
    parameter_name: row.parameter_name ?? row.name ?? "",
    data_type: row.data_type ?? row.type ?? "string",
    unit: row.unit ?? "",
    min_value: row.min_value ?? row.min ?? null,
    max_value: row.max_value ?? row.max ?? null,
    mandatory: Boolean(row.mandatory ?? row.is_mandatory)
  };
}

function normalizeRequirement(row) {
  if (!row || typeof row !== "object") return null;
  return {
    requirement_id: row.requirement_id ?? null,
    routing_operation_id: row.routing_operation_id ?? null,
    resource_id: row.resource_id ?? null,
    resource_code: row.resource_code ?? "",
    resource_name: row.resource_name ?? "",
    resource_type: row.resource_type ?? "",
    requirement_type: row.requirement_type ?? "",
    quantity: row.quantity ?? 1,
    uom: row.uom ?? "EA"
  };
}

function normalizeOperation(row) {
  if (!row || typeof row !== "object") return null;
  const gateType = resolveGateType(row);
  const isCustom = Boolean(row.is_custom ?? row.custom ?? row.is_customized);
  const opId = row.routing_operation_id ?? row.operation_id ?? row.id ?? null;
  return {
    operation_id: opId,
    routing_operation_id: opId,
    operation_code: row.operation_code ?? row.code ?? "",
    operation_name: row.operation_name ?? row.name ?? "",
    operation_seq: Number(row.operation_seq ?? row.operation_sequence ?? row.sequence ?? 0),
    gate_type: isCustom && !gateType ? "custom" : gateType,
    is_custom: isCustom,
    is_quality_gate: Boolean(row.is_quality_gate),
    is_feasibility_gate: Boolean(row.is_feasibility_gate),
    parameters: (row.parameters || row.operation_parameters || [])
      .map(normalizeParameter)
      .filter(Boolean),
    resource_requirements: (row.resource_requirements || [])
      .map(normalizeRequirement)
      .filter(Boolean),
    requires_machine: row.requires_machine != null ? Boolean(row.requires_machine) : undefined,
    requires_labor: row.requires_labor != null ? Boolean(row.requires_labor) : undefined,
    requires_tools: row.requires_tools != null ? Boolean(row.requires_tools) : undefined
  };
}

export function normalizeRouting(data) {
  if (!data || typeof data !== "object") return null;
  const ops = (data.operations || data.routing_operations || [])
    .map(normalizeOperation)
    .filter(Boolean);
  const isTemplateRoute = Boolean(data.is_template ?? data.is_template_route);
  const isWorkspaceCopy = Boolean(data.is_template_copy);
  return {
    routing_id: data.routing_id ?? data.id ?? null,
    routing_code: data.routing_code ?? data.code ?? "",
    routing_name: data.routing_name ?? data.name ?? "Activated Carbon Route",
    source: data.source ?? (isTemplateRoute ? "template" : "workspace"),
    is_template: isTemplateRoute,
    is_editable: isWorkspaceCopy || (data.is_editable !== false && !isTemplateRoute),
    copied_from_template_id: data.copied_from_template_id ?? data.template_routing_id ?? null,
    operations: sortOperations(enrichRoutingOperations(ops))
  };
}

function mergeOperationFromApi(existing, apiRow) {
  const normalized = normalizeOperation(apiRow);
  if (!normalized) return existing;
  return {
    ...existing,
    ...normalized,
    parameters:
      normalized.parameters?.length > 0
        ? normalized.parameters
        : existing?.parameters || [],
    resource_requirements:
      normalized.resource_requirements?.length > 0
        ? normalized.resource_requirements
        : existing?.resource_requirements || []
  };
}

export async function fetchActiveWorkspaceRouting(workspaceCode) {
  try {
    const res = await api.get("/api/routings/active");
    const routing = normalizeRouting(res.data?.routing ?? res.data);
    if (routing?.operations?.length) {
      if (routing.is_editable) {
        writeLocalRouting(routing, workspaceCode);
      }
      return routing;
    }
  } catch (e) {
    if (e.response?.status === 404) {
      return readLocalRouting(workspaceCode) || null;
    }
    const local = readLocalRouting(workspaceCode);
    if (local) return local;
    throw e;
  }

  return readLocalRouting(workspaceCode) || null;
}

export async function copyRoutingFromTemplate(workspaceCode) {
  try {
    const res = await api.post("/api/routings/copy-from-template", {
      template_routing_code: "AC_STANDARD_PROCESS"
    });
    const routing = normalizeRouting(res.data?.routing ?? res.data);
    if (routing?.operations?.length) {
      const editable = { ...routing, is_editable: true, is_template: false, source: "workspace" };
      writeLocalRouting(editable, workspaceCode);
      return editable;
    }
  } catch (e) {
    if (e.response?.status && e.response.status !== 404 && e.response.status !== 422) {
      const local = readLocalRouting(workspaceCode);
      if (local?.operations?.length) return local;
    }
  }

  const routing = createWorkspaceRoutingFromTemplate();
  writeLocalRouting(routing, workspaceCode);
  return routing;
}

export async function createRoutingOperation(payload) {
  const res = await api.post("/api/routing-operations", {
    operation_code: payload.operation_code || undefined,
    operation_name: payload.operation_name,
    operation_seq: payload.operation_seq,
    operation_type: payload.operation_type || undefined,
    process_step: payload.process_step || undefined,
    is_quality_gate: Boolean(payload.is_quality_gate),
    is_feasibility_gate: Boolean(payload.is_feasibility_gate)
  });
  return normalizeOperation(res.data);
}

export async function updateRoutingOperation(operationId, payload) {
  if (!isUuid(operationId)) {
    throw new Error("Save the operation to the workspace route before editing.");
  }
  const res = await api.put(`/api/routing-operations/${operationId}`, {
    operation_name: payload.operation_name,
    operation_type: payload.operation_type,
    is_quality_gate: payload.is_quality_gate,
    is_feasibility_gate: payload.is_feasibility_gate
  });
  return normalizeOperation(res.data);
}

export async function patchOperationSequence(operationId, operationSeq) {
  if (!isUuid(operationId)) {
    throw new Error("Save the operation to the workspace route before reordering.");
  }
  const res = await api.patch(`/api/routing-operations/${operationId}/sequence`, {
    operation_seq: operationSeq
  });
  return normalizeOperation(res.data);
}

export async function deleteRoutingOperation(operationId) {
  if (!isUuid(operationId)) {
    return false;
  }
  await api.delete(`/api/routing-operations/${operationId}`);
  return true;
}

export async function addOperationParameter(operationId, parameter) {
  if (!isUuid(operationId)) {
    throw new Error("Save the operation to the workspace route before adding parameters.");
  }
  const res = await api.post(`/api/routing-operations/${operationId}/parameters`, {
    parameter_code: parameter.parameter_code,
    parameter_name: parameter.parameter_name,
    data_type: parameter.data_type,
    unit: parameter.unit || undefined,
    min_value: parameter.min_value,
    max_value: parameter.max_value,
    is_mandatory: Boolean(parameter.mandatory),
    display_order: parameter.display_order
  });
  return normalizeParameter(res.data);
}

export async function updateOperationParameter(operationId, parameterId, parameter) {
  if (!isUuid(operationId) || !isUuid(parameterId)) {
    throw new Error("Parameter must be saved on the workspace route before editing.");
  }
  const res = await api.patch(
    `/api/routing-operations/${operationId}/parameters/${parameterId}`,
    {
      parameter_name: parameter.parameter_name,
      data_type: parameter.data_type,
      unit: parameter.unit || undefined,
      min_value: parameter.min_value,
      max_value: parameter.max_value,
      is_mandatory: Boolean(parameter.mandatory),
      display_order: parameter.display_order
    }
  );
  return normalizeParameter(res.data);
}

export async function deleteOperationParameter(operationId, parameterId) {
  if (!isUuid(operationId) || !isUuid(parameterId)) {
    return false;
  }
  await api.delete(`/api/routing-operations/${operationId}/parameters/${parameterId}`);
  return true;
}

export async function setOperationResourceRequirements(operationId, requirements) {
  if (!isUuid(operationId)) {
    throw new Error("Save the operation to the workspace route before assigning resources.");
  }
  const res = await api.put(
    `/api/routing-operations/${operationId}/resource-requirements`,
    { requirements: requirements || [] }
  );
  return (res.data || []).map(normalizeRequirement).filter(Boolean);
}

export async function fetchOperationResourceRequirements(operationId) {
  if (!isUuid(operationId)) return [];
  const res = await api.get(
    `/api/routing-operations/${operationId}/resource-requirements`
  );
  return (res.data || []).map(normalizeRequirement).filter(Boolean);
}

/** Local-only fallback when mes_core is unavailable. */
export async function saveWorkspaceRoutingLocal(routing, workspaceCode) {
  if (!routing?.is_editable) {
    throw new Error("Template route cannot be edited.");
  }
  const payload = {
    ...routing,
    operations: sortOperations(routing.operations || [])
  };
  writeLocalRouting(payload, workspaceCode);
  return payload;
}

export async function persistRoutingChange(routing, workspaceCode) {
  return saveWorkspaceRoutingLocal(routing, workspaceCode);
}

export function createOperationDraft({
  operation_seq,
  operation_name,
  operation_code,
  is_custom = true,
  requires_machine = false,
  requires_labor = true,
  requires_tools = false
}) {
  const stamp = Date.now();
  return {
    operation_id: `custom-op-${stamp}`,
    operation_code: operation_code || `CUSTOM_${operation_seq}`,
    operation_name: operation_name || "New Operation",
    operation_seq: Number(operation_seq),
    gate_type: is_custom ? "custom" : null,
    is_custom: Boolean(is_custom),
    requires_machine: Boolean(requires_machine),
    requires_labor: Boolean(requires_labor),
    requires_tools: Boolean(requires_tools),
    parameters: [],
    resource_requirements: []
  };
}

export function createParameterDraft() {
  return {
    parameter_id: `param-${Date.now()}`,
    parameter_code: "",
    parameter_name: "",
    data_type: "number",
    unit: "",
    min_value: null,
    max_value: null,
    mandatory: false
  };
}

export { formatApiError, mergeOperationFromApi, isUuid };
