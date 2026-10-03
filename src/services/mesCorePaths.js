import { apiBaseUrl } from "../auth/cognitoConfig";

/** Default workspace when API context omits workspace_code. */
export const DEFAULT_WORKSPACE_BY_TENANT = {
  GR_CARBONS: "GR_CARBONS_ACTIVATED_CARBON",
  SAM_CARBONS: "SAM_CARBONS_ACTIVATED_CARBON",
  SAM_CARBONS_DEMO: "SAM_CARBONS_DEMO_WS"
};

export function resolveDefaultWorkspaceCode(tenantCode) {
  const code = String(tenantCode || "").trim();
  if (!code) return null;
  return DEFAULT_WORKSPACE_BY_TENANT[code] || null;
}

export function apiBaseEndsWithApiSegment() {
  const base = String(apiBaseUrl || "").replace(/\/$/, "");
  return base.endsWith("/api");
}

/** Paths sent after stripping /api when VITE_API_BASE_URL ends with /api (testbed nginx). */
const PROXY_STRIPPED_MES_CORE_PREFIXES = [
  "/context",
  "/activated-carbon/",
  "/templates/",
  "/workspaces/",
  "/customers",
  "/products",
  "/customer-orders",
  "/production-orders",
  "/production-lots",
  "/routings",
  "/routing-operations",
  "/resources",
  "/equipment",
  "/schedules",
  "/feasibility",
  "/operation-executions",
  "/inspection-results",
  "/ncrs",
  "/dispatches",
  "/kg/",
  "/oee/",
  "/intelligence/",
  "/ask"
];

export function isProxiedMesCoreApiPath(path) {
  if (!apiBaseEndsWithApiSegment()) return false;
  const normalized = String(path || "");
  if (!normalized.startsWith("/")) return false;
  return PROXY_STRIPPED_MES_CORE_PREFIXES.some(
    (prefix) => normalized === prefix.replace(/\/$/, "") || normalized.startsWith(prefix)
  );
}

/**
 * When VITE_API_BASE_URL ends with /api (e.g. https://host/mes/api),
 * request paths must NOT repeat the /api prefix.
 */
export function normalizeMesCoreRequestPath(url) {
  const path = String(url || "");
  if (!path || !apiBaseEndsWithApiSegment()) return path;
  if (path.startsWith("/api/")) return path.slice(4);
  if (path === "/api") return "/";
  return path;
}
