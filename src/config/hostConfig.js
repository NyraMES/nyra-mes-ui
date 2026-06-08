/**
 * Hostname → industry and optional client tenant bindings.
 * Activated Carbon is an industry; client tenants (e.g. SAM_CARBONS) are set per
 * deployment via VITE_TENANT_CODE or HOST_TENANT_MAP — not baked into ac.localhost.
 */

import {
  ACTIVATED_CARBON_DEV_TENANT,
  getIndustrySelection,
  resolveIndustryTenantScope
} from "./industrySelection";
import { apiBaseUrl } from "../auth/cognitoConfig";
import { resolveDefaultWorkspaceCode } from "../services/mesCorePaths";

/** Industry-only dev hosts; tenant resolved from env or generic AC demo. */
const BUILTIN_BINDINGS = {
  "ac.localhost": {
    industry_key: "activated-carbon"
  },
  "oem.localhost": {
    tenant_code: "AUTO_OEM_DEMO",
    workspace_code: null,
    industry_key: "automotive-oem"
  },
  "demo.localhost": {
    tenant_code: "NYRA_VIDEO_DEMO",
    workspace_code: null,
    industry_key: "automotive-oem"
  }
};

function normalizeHost(host) {
  const value = String(host || "").trim().toLowerCase();
  if (!value) return "";
  return value.includes(":") ? value.split(":")[0] : value;
}

function industryKeyForTenant(tenantCode) {
  const code = String(tenantCode || "").toUpperCase();
  if (code === "AUTO_OEM_DEMO" || code === "NYRA_VIDEO_DEMO") return "automotive-oem";
  return null;
}

function parseHostTenantMap(raw) {
  const parsed = {};
  String(raw || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const eq = entry.indexOf("=");
      if (eq < 0) return;
      const host = normalizeHost(entry.slice(0, eq));
      const parts = entry
        .slice(eq + 1)
        .split(":")
        .map((segment) => segment.trim())
        .filter(Boolean);
      if (!host) return;

      if (parts.length === 1 && parts[0] === "activated-carbon") {
        parsed[host] = { industry_key: "activated-carbon" };
        return;
      }

      if (!parts.length) return;
      parsed[host] = {
        tenant_code: parts[0],
        workspace_code: parts[1] || null,
        industry_key: parts[2] || industryKeyForTenant(parts[0])
      };
    });
  return parsed;
}

function mergedBindings() {
  const fromEnv = parseHostTenantMap(import.meta.env.VITE_HOST_TENANT_MAP || "");
  return { ...BUILTIN_BINDINGS, ...fromEnv };
}

function resolveBindingTenantScope(row) {
  if (row.tenant_code) {
    let workspace = row.workspace_code ?? null;
    if (!workspace) {
      workspace = resolveDefaultWorkspaceCode(row.tenant_code);
    }
    return { tenant_code: row.tenant_code, workspace_code: workspace };
  }

  const industryKey = row.industry_key || null;
  return resolveIndustryTenantScope(industryKey);
}

export function resolveHostBinding(host = typeof window !== "undefined" ? window.location.hostname : "") {
  const normalized = normalizeHost(host);
  if (!normalized) return null;
  const row = mergedBindings()[normalized];
  if (!row) return null;

  const industryKey = row.industry_key || industryKeyForTenant(row.tenant_code);
  if (!industryKey && !row.tenant_code) return null;

  const scope = resolveBindingTenantScope(row);
  if (!scope.tenant_code) return null;

  const selection = industryKey ? getIndustrySelection(industryKey) : null;

  return {
    host: normalized,
    tenant_code: scope.tenant_code,
    workspace_code: scope.workspace_code,
    industry_key: industryKey,
    landing_path: selection?.landing_path || null,
    tenant_name: selection?.tenant_name || null,
    workspace_name: selection?.workspace_name || null,
    lock_industry: Boolean(industryKey)
  };
}

export function resolveAppHostBinding() {
  if (typeof window === "undefined") return null;
  return resolveHostBinding(window.location.hostname);
}

/**
 * @param {{ tenant_code?: string | null } | null | undefined} user
 * @param {{ tenant_code?: string | null } | null | undefined} binding
 */
export function userMatchesHostTenant(user, binding) {
  if (!binding?.tenant_code) return true;
  if (!user?.tenant_code) return false;
  return String(user.tenant_code).trim() === String(binding.tenant_code).trim();
}

export function tenantMismatchMessage(binding) {
  const plant =
    binding?.tenant_name ||
    binding?.workspace_name ||
    binding?.tenant_code ||
    "this plant";
  return `This account is not authorized for ${plant}. Use the sign-in URL for your assigned plant.`;
}

/**
 * Optional server override (API HOST_TENANT_MAP). Falls back to local map on 404.
 * @param {import('axios').AxiosInstance} apiClient
 * @param {string} [host]
 */
export async function fetchHostBinding(apiClient, host) {
  const normalized = normalizeHost(host || window.location.hostname);
  const local = resolveHostBinding(normalized);
  if (!apiClient || !normalized) return local;

  try {
    const base = String(apiBaseUrl || "").replace(/\/$/, "");
    const path = base.endsWith("/api") ? "/auth/host-config" : "/api/auth/host-config";
    const res = await apiClient.get(path, { params: { host: normalized } });
    const data = res.data || {};
    const industryKey = data.industry_key || industryKeyForTenant(data.tenant_code);
    const mergedRow = {
      tenant_code: data.tenant_code || null,
      workspace_code: data.workspace_code ?? null,
      industry_key: industryKey
    };
    const scope = resolveBindingTenantScope(mergedRow);
    if (!scope.tenant_code && !industryKey) return local;

    const selection = industryKey ? getIndustrySelection(industryKey) : null;
    const resolvedScope = scope.tenant_code
      ? scope
      : resolveIndustryTenantScope(industryKey);

    return {
      host: normalized,
      tenant_code: resolvedScope.tenant_code,
      workspace_code: resolvedScope.workspace_code,
      industry_key: industryKey,
      landing_path: selection?.landing_path || null,
      tenant_name: selection?.tenant_name || null,
      workspace_name: selection?.workspace_name || null,
      lock_industry: Boolean(industryKey)
    };
  } catch {
    return local;
  }
}
