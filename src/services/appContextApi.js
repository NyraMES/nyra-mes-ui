import { apiBaseUrl } from "../auth/cognitoConfig";

import {
  ACTIVATED_CARBON_DEV_TENANT,
  mergeIndustrySelectionFallback
} from "../config/industrySelection";
import {
  DEFAULT_WORKSPACE_BY_TENANT,
  resolveDefaultWorkspaceCode
} from "./mesCorePaths";

/** Safe defaults when GET /api/context is unavailable. */
export const DEFAULT_APP_CONTEXT = {
  tenant_id: null,
  tenant_code: null,
  tenant_name: "Demo Plant",
  tenant_display_name: "Demo Plant",
  workspace_id: null,
  workspace_code: null,
  workspace_name: null,
  template_id: null,
  template_name: "Manufacturing",
  template_display_name: "Manufacturing Template",
  industry_template_code: null,
  industry_template_name: null,
  module_code: null,
  landing_page: null,
  ui_module_name: null,
  api_module_name: null,
  icon_name: null,
  dashboard_component: null,
  enabled_capabilities: [],
  plant_id: "NY-FOUNDRY-01",
  industry: "generic",
  loaded: false,
  fromFallback: true,
  loadError: null
};

function contextPaths() {
  const base = String(apiBaseUrl || "").replace(/\/$/, "");
  const inActivatedCarbon =
    typeof window !== "undefined" &&
    window.location.pathname.includes("/activated-carbon");
  // AC shell must use nyra_mes_core only — legacy /context is blocked by legacyApiGuard.
  if (inActivatedCarbon || base.endsWith("/api")) {
    return ["/api/context"];
  }
  return ["/api/context", "/context"];
}

function asCapabilityList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function normalizeAppContext(data) {
  if (!data || typeof data !== "object") {
    return { ...DEFAULT_APP_CONTEXT, fromFallback: true };
  }

  const tenant = data.tenant || {};
  const template = data.template || data.industry_template || {};
  const workspace = data.workspace || {};

  const industryTemplateCode =
    data.industry_template_code ?? template.code ?? template.industry_template_code ?? null;
  const industryTemplateName =
    data.industry_template_name ?? template.name ?? template.industry_template_name ?? null;

  return applyAcDisplayBranding({
    tenant_id: data.tenant_id ?? tenant.id ?? tenant.tenant_id ?? null,
    tenant_code: data.tenant_code ?? tenant.code ?? tenant.tenant_code ?? null,
    tenant_name:
      data.tenant_name ??
      tenant.name ??
      tenant.tenant_name ??
      DEFAULT_APP_CONTEXT.tenant_name,
    tenant_display_name:
      data.tenant_display_name ??
      tenant.display_name ??
      data.tenant_name ??
      tenant.name ??
      DEFAULT_APP_CONTEXT.tenant_display_name,
    workspace_id: data.workspace_id ?? workspace.id ?? workspace.workspace_id ?? null,
    workspace_code:
      data.workspace_code ?? workspace.code ?? workspace.workspace_code ?? null,
    workspace_name:
      data.workspace_name ?? workspace.name ?? workspace.workspace_name ?? null,
    template_id:
      data.template_id ??
      industryTemplateCode ??
      template.id ??
      template.template_id ??
      null,
    template_name:
      industryTemplateName ??
      data.template_name ??
      template.name ??
      template.template_name ??
      DEFAULT_APP_CONTEXT.template_name,
    template_display_name:
      data.template_display_name ??
      industryTemplateName ??
      template.display_name ??
      data.template_name ??
      template.name ??
      DEFAULT_APP_CONTEXT.template_display_name,
    industry_template_code: industryTemplateCode,
    industry_template_name: industryTemplateName,
    module_code: data.module_code ?? template.module_code ?? data.ui_module_name ?? null,
    landing_page: data.landing_page ?? template.landing_page ?? null,
    ui_module_name: data.ui_module_name ?? template.ui_module_name ?? null,
    api_module_name: data.api_module_name ?? template.api_module_name ?? null,
    icon_name: data.icon_name ?? template.icon_name ?? null,
    dashboard_component:
      data.dashboard_component ?? template.dashboard_component ?? null,
    enabled_capabilities: asCapabilityList(
      data.enabled_capabilities ??
        data.capabilities ??
        template.enabled_capabilities ??
        template.capabilities
    ),
    plant_id:
      data.plant_id ??
      workspace.plant_id ??
      data.plant?.id ??
      data.plant?.plant_id ??
      DEFAULT_APP_CONTEXT.plant_id,
    industry:
      data.industry ??
      template.industry ??
      tenant.industry ??
      DEFAULT_APP_CONTEXT.industry,
    demo_mode: Boolean(data.demo_mode),
    demo_read_only: Boolean(data.demo_read_only),
    demo_watermark: data.demo_watermark ?? null,
    menus: data.menus ?? template.menus ?? null,
    loaded: true,
    fromFallback: false,
    loadError: null,
    raw: data
  });
}

/** Replace legacy tenant/workspace labels that include customer-specific branding. */
function stripLegacyPlantBranding(name, fallback) {
  const text = String(name || "").trim();
  if (!text || /sam\s*carbons/i.test(text)) return fallback;
  return (
    text
      .replace(/\s*[—–-]\s*SAM Carbons.*$/i, "")
      .replace(/SAM Carbons\s*[—–-]\s*/i, "")
      .trim() || fallback
  );
}

function applyAcDisplayBranding(ctx) {
  const isActivatedCarbon = ctx.industry_template_code === "ACTIVATED_CARBON";
  if (!isActivatedCarbon) return ctx;
  return {
    ...ctx,
    tenant_name: stripLegacyPlantBranding(ctx.tenant_name, "Activated Carbon Plant"),
    tenant_display_name: stripLegacyPlantBranding(
      ctx.tenant_display_name,
      "Activated Carbon Plant"
    ),
    workspace_name: stripLegacyPlantBranding(ctx.workspace_name, "Activated Carbon")
  };
}

/**
 * @param {import('axios').AxiosInstance} apiClient
 * @param {{ tenant_code?: string | null, workspace_code?: string | null }} [scope]
 */
export async function fetchAppContext(apiClient, scope = {}) {
  const paths = contextPaths();
  let lastError = null;

  const headers = {};
  if (scope.tenant_code) {
    headers["X-Tenant-Code"] = scope.tenant_code;
  }
  if (scope.workspace_code) {
    headers["X-Workspace-Code"] = scope.workspace_code;
  }

  const requestConfig = Object.keys(headers).length ? { headers } : undefined;

  for (const path of paths) {
    try {
      const res = await apiClient.get(path, requestConfig);
      return normalizeAppContext(res.data);
    } catch (e) {
      // Keep the first HTTP/API error; later legacy-route blocks are misleading.
      if (
        !lastError ||
        (e?.response && !lastError?.response) ||
        lastError?.isLegacyApiBlocked
      ) {
        lastError = e;
      }
    }
  }

  const envTenant = scope.tenant_code || import.meta.env.VITE_TENANT_CODE || null;
  const envWorkspace =
    scope.workspace_code || import.meta.env.VITE_WORKSPACE_CODE || null;
  const detail =
    lastError?.response?.data?.detail ||
    (lastError?.response?.status === 403
      ? "Your account tenant does not match this plant. For AC admin use admin1 with SAM_CARBONS_DEMO (see scripts/provision_ac_admin1.ps1)."
      : null) ||
    (lastError?.response?.status === 500
      ? "Server error loading workspace context — check API database connection."
      : null) ||
    lastError?.message ||
    "Context API unavailable";

  // Unauthenticated visitors cannot call /api/context — not an error on public pages.
  if (
    lastError?.response?.status === 401 &&
    typeof detail === "string" &&
    detail.toLowerCase().includes("bearer token")
  ) {
    return {
      ...DEFAULT_APP_CONTEXT,
      fromFallback: false,
      loadError: null,
      loaded: false
    };
  }

  const isAcTenant =
    envTenant === "GR_CARBONS" ||
    envTenant === "SAM_CARBONS" ||
    envTenant === "SAM_CARBONS_DEMO";

  let fallback = applyAcDisplayBranding({
    ...DEFAULT_APP_CONTEXT,
    tenant_code: envTenant,
    workspace_code: envWorkspace,
    industry_template_code: isAcTenant ? "ACTIVATED_CARBON" : null,
    industry_template_name: isAcTenant ? "Activated Carbon" : null,
    tenant_name: isAcTenant ? "Activated Carbon Plant" : DEFAULT_APP_CONTEXT.tenant_name,
    tenant_display_name: isAcTenant
      ? "Activated Carbon Plant"
      : DEFAULT_APP_CONTEXT.tenant_display_name,
    workspace_name: isAcTenant ? "Activated Carbon" : null,
    module_code: isAcTenant ? "activated-carbon" : null,
    fromFallback: true,
    loaded: Boolean(envTenant),
    loadError: typeof detail === "string" ? detail : "Context API unavailable"
  });

  if (isAcTenant) {
    fallback = mergeIndustrySelectionFallback(fallback, "activated-carbon");
  }

  return fallback;
}

export function applyTenantHeaders(apiClient, context) {
  let tenantCode = context?.tenant_code || import.meta.env.VITE_TENANT_CODE || null;
  let workspaceCode =
    context?.workspace_code || import.meta.env.VITE_WORKSPACE_CODE || null;
  const defaultWs = tenantCode ? resolveDefaultWorkspaceCode(tenantCode) : null;

  if (tenantCode && !workspaceCode && defaultWs) {
    workspaceCode = defaultWs;
  }

  if (!workspaceCode && tenantCode === ACTIVATED_CARBON_DEV_TENANT.tenant_code) {
    workspaceCode = ACTIVATED_CARBON_DEV_TENANT.workspace_code;
  }

  // Prevent cross-tenant workspace headers when env tenant does not match session.
  if (defaultWs && workspaceCode && workspaceCode !== defaultWs) {
    const knownTenants = Object.keys(DEFAULT_WORKSPACE_BY_TENANT);
    if (knownTenants.includes(tenantCode)) {
      workspaceCode = defaultWs;
    }
  }

  if (tenantCode) {
    apiClient.defaults.headers.common["X-Tenant-Code"] = tenantCode;
  } else {
    delete apiClient.defaults.headers.common["X-Tenant-Code"];
  }
  if (context?.tenant_id) {
    apiClient.defaults.headers.common["X-Tenant-Id"] = context.tenant_id;
  } else {
    delete apiClient.defaults.headers.common["X-Tenant-Id"];
  }
  if (workspaceCode) {
    apiClient.defaults.headers.common["X-Workspace-Code"] = workspaceCode;
  } else {
    delete apiClient.defaults.headers.common["X-Workspace-Code"];
  }
  if (context?.workspace_id) {
    apiClient.defaults.headers.common["X-Workspace-Id"] = context.workspace_id;
  } else {
    delete apiClient.defaults.headers.common["X-Workspace-Id"];
  }
  if (context?.template_id) {
    apiClient.defaults.headers.common["X-Template-Id"] = context.template_id;
  } else {
    delete apiClient.defaults.headers.common["X-Template-Id"];
  }
}
