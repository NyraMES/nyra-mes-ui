/**
 * Landing-page industry tile → module/template metadata.
 * Tenant/workspace are client-specific — set via env (VITE_TENANT_CODE), host
 * domain map, or Cognito custom:tenant_code — not hardcoded per industry.
 */

import { resolveDefaultWorkspaceCode } from "../services/mesCorePaths";

/** Generic Activated Carbon dev tenant (migration 003); not a client deployment. */
export const ACTIVATED_CARBON_DEV_TENANT = {
  tenant_code: "SAM_CARBONS_DEMO",
  workspace_code: "SAM_CARBONS_DEMO_WS"
};

/** Generic Chemical Processing dev tenant (migration 008). */
export const CHEMICAL_DEV_TENANT = {
  tenant_code: "CHEM_DEMO",
  workspace_code: "CHEM_DEMO_WS"
};

export const INDUSTRY_SELECTION = {
  "activated-carbon": {
    landing_path: "/activated-carbon/dashboard",
    module_code: "activated-carbon",
    tenant_name: "Activated Carbon Plant",
    workspace_name: "Activated Carbon",
    industry_template_code: "ACTIVATED_CARBON",
    industry_template_name: "Activated Carbon",
    default_enabled_capabilities: [
      "AC_RAW_MATERIAL_INWARD",
      "AC_RAW_MATERIAL_QC",
      "AC_BAG_TRACING",
      "AC_KILN_FEED",
      "AC_HOURLY_KILN_PARAMETERS",
      "AC_SCREENING",
      "AC_QUALITY_TESTING",
      "AC_REPORTS",
      "AC_YIELD_ANALYSIS",
      "AC_TRACEABILITY",
      "AC_DISPATCH",
      "AC_ROUTING_BUILDER"
    ]
  },
  "automotive-oem": {
    tenant_code: "AUTO_OEM_DEMO",
    workspace_code: null,
    landing_path: "/automotive-oem/dashboard",
    module_code: "automotive-oem"
  },
  chemical: {
    landing_path: "/chemical/dashboard",
    module_code: "chemical",
    tenant_code: "CHEM_DEMO",
    workspace_code: "CHEM_DEMO_WS",
    tenant_name: "Chemical Processing Demo Plant",
    workspace_name: "Chemical Demo Workspace",
    industry_template_code: "CHEMICAL",
    industry_template_name: "Chemical Processing",
    default_enabled_capabilities: [
      "CHEM_RAW_MATERIAL_RECEIPT",
      "CHEM_RAW_MATERIAL_QC",
      "CHEM_REACTOR_CHARGE",
      "CHEM_REACTOR_PARAMETERS",
      "CHEM_BLEND_FORMULATION",
      "CHEM_BATCH_QC",
      "CHEM_BATCH_ANALYTICS",
      "CHEM_TRACEABILITY",
      "CHEM_ROUTING_BUILDER"
    ]
  }
};

/**
 * @param {string} industryKey
 * @returns {typeof INDUSTRY_SELECTION[string] | undefined}
 */
export function getIndustrySelection(industryKey) {
  return INDUSTRY_SELECTION[industryKey];
}

/** Infer industry module slug from a client route path. */
export function inferIndustryFromPath(pathname = "") {
  const path = String(pathname || "");
  if (path.includes("/activated-carbon")) return "activated-carbon";
  if (path.includes("/chemical")) return "chemical";
  if (path.includes("/automotive-oem") || path.includes("/workflow")) {
    return "automotive-oem";
  }
  return null;
}

/** Tenants allowed to open the Activated Carbon module. */
export const ACTIVATED_CARBON_TENANT_CODES = new Set([
  "SAM_CARBONS",
  "SAM_CARBONS_DEMO"
]);

/** Tenants allowed to open Automotive OEM / workflow module. */
export const AUTOMOTIVE_OEM_TENANT_CODES = new Set([
  "AUTO_OEM_DEMO",
  "NYRA_VIDEO_DEMO"
]);

/** Tenants allowed to open the Chemical Processing module. */
export const CHEMICAL_TENANT_CODES = new Set(["CHEM_DEMO"]);

/**
 * Infer industry module from tenant code (Cognito custom:tenant_code).
 * @param {string | null | undefined} tenantCode
 */
export function industryKeyForTenantCode(tenantCode) {
  const code = String(tenantCode || "").trim().toUpperCase();
  if (ACTIVATED_CARBON_TENANT_CODES.has(code)) return "activated-carbon";
  if (AUTOMOTIVE_OEM_TENANT_CODES.has(code)) return "automotive-oem";
  if (CHEMICAL_TENANT_CODES.has(code)) return "chemical";
  return null;
}

/**
 * Whether the signed-in user's tenant may open an industry tile.
 * @param {string} industryKey
 * @param {{ tenant_code?: string | null } | null | undefined} user
 */
export function userCanAccessIndustry(industryKey, user) {
  const tenant = String(user?.tenant_code || "").trim().toUpperCase();
  if (!tenant) return true;
  if (industryKey === "activated-carbon") {
    return ACTIVATED_CARBON_TENANT_CODES.has(tenant);
  }
  if (industryKey === "automotive-oem") {
    return AUTOMOTIVE_OEM_TENANT_CODES.has(tenant);
  }
  if (industryKey === "chemical") {
    return CHEMICAL_TENANT_CODES.has(tenant);
  }
  return true;
}

/**
 * Tenant/workspace for API calls.
 * When the user opens a specific industry route, use that industry's demo tenant
 * unless their Cognito tenant is allowed for that industry.
 * @param {string} industryKey
 * @param {{ tenant_code?: string | null } | null | undefined} [user]
 */
export function resolveScopedTenantForIndustry(industryKey, user) {
  const userTenant = String(user?.tenant_code || "").trim();
  if (userTenant && industryKey && userCanAccessIndustry(industryKey, user)) {
    return {
      tenant_code: userTenant,
      workspace_code: resolveDefaultWorkspaceCode(userTenant)
    };
  }
  if (industryKey) {
    return resolveIndustryTenantScope(industryKey);
  }
  if (userTenant) {
    return {
      tenant_code: userTenant,
      workspace_code: resolveDefaultWorkspaceCode(userTenant)
    };
  }
  return resolveIndustryTenantScope(industryKey);
}

/**
 * Resolve tenant/workspace for an industry tile or host binding.
 * Prefers build-time env; Activated Carbon falls back to the generic demo tenant.
 * @param {string} [industryKey]
 */
export function resolveIndustryTenantScope(industryKey) {
  const envTenant = import.meta.env.VITE_TENANT_CODE || null;
  const envWorkspace = import.meta.env.VITE_WORKSPACE_CODE || null;
  if (envTenant) {
    return { tenant_code: envTenant, workspace_code: envWorkspace };
  }

  const selection = industryKey ? getIndustrySelection(industryKey) : null;
  if (selection?.tenant_code) {
    return {
      tenant_code: selection.tenant_code,
      workspace_code: selection.workspace_code ?? null
    };
  }

  if (industryKey === "activated-carbon") {
    return { ...ACTIVATED_CARBON_DEV_TENANT };
  }

  if (industryKey === "automotive-oem") {
    return { tenant_code: "AUTO_OEM_DEMO", workspace_code: null };
  }

  if (industryKey === "chemical") {
    return { ...CHEMICAL_DEV_TENANT };
  }

  return { tenant_code: null, workspace_code: null };
}

/**
 * Merge industry tile metadata when context API returns fallback.
 * @param {object} ctx
 * @param {string} industryKey
 */
export function mergeIndustrySelectionFallback(ctx, industryKey) {
  const selection = getIndustrySelection(industryKey);
  if (!selection) return ctx;

  const caps = ctx.enabled_capabilities?.length
    ? ctx.enabled_capabilities
    : selection.default_enabled_capabilities || [];

  return {
    ...ctx,
    tenant_code: ctx.tenant_code || selection.tenant_code || null,
    workspace_code: ctx.workspace_code ?? selection.workspace_code ?? null,
    tenant_name: ctx.tenant_name || selection.tenant_name || ctx.tenant_name,
    workspace_name: ctx.workspace_name || selection.workspace_name || ctx.workspace_name,
    industry_template_code:
      ctx.industry_template_code || selection.industry_template_code || ctx.industry_template_code,
    industry_template_name:
      ctx.industry_template_name || selection.industry_template_name || ctx.industry_template_name,
    module_code: ctx.module_code || selection.module_code,
    landing_page: ctx.landing_page || selection.landing_path,
    enabled_capabilities: caps,
    loaded: true,
    fromFallback: ctx.fromFallback,
    loadError: ctx.loadError
  };
}
