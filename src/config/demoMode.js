/**
 * Prospect / video demo mode — limits exposed surface in the UI.
 * Build-time: VITE_DEMO_MODE, VITE_DEMO_READ_ONLY
 * Runtime: merged from GET /api/context (demo_mode, demo_read_only, demo_watermark)
 */

const envDemo =
  (import.meta.env.VITE_DEMO_MODE || "false").toLowerCase() === "true";
const envReadOnly =
  (import.meta.env.VITE_DEMO_READ_ONLY || "false").toLowerCase() === "true";

/** Local / client AC tenants — never show video-demo watermark / read-only UX. */
const DEMO_EXEMPT_TENANT_CODES = new Set([
  "SAM_CARBONS_DEMO",
  "SAM_CARBONS",
  "AUTO_OEM_DEMO"
]);

export const DEFAULT_DEMO_WATERMARK =
  "Nyra Demo - Confidential - Fictional data only";

/** @typedef {{ demo_mode?: boolean, demo_read_only?: boolean, demo_watermark?: string | null, tenant_code?: string | null }} DemoContextLike */

function resolveExemptTenantCode(context) {
  return (
    context?.tenant_code ||
    import.meta.env.VITE_TENANT_CODE ||
    null
  );
}

function isDemoExemptTenant(context) {
  const code = resolveExemptTenantCode(context);
  return code && DEMO_EXEMPT_TENANT_CODES.has(code);
}

/**
 * @param {DemoContextLike | null | undefined} context
 */
export function isDemoMode(context) {
  if (isDemoExemptTenant(context)) return false;
  return Boolean(context?.demo_mode ?? envDemo);
}

/**
 * @param {DemoContextLike | null | undefined} context
 */
export function isDemoReadOnly(context) {
  if (isDemoExemptTenant(context)) return false;
  return Boolean(context?.demo_read_only ?? envReadOnly);
}

/**
 * @param {DemoContextLike | null | undefined} context
 */
export function demoWatermark(context) {
  return (
    context?.demo_watermark ||
    (isDemoMode(context) ? DEFAULT_DEMO_WATERMARK : null)
  );
}

/** Sidebar sections hidden in demo — ontology/KG reveal implementation detail. */
export const DEMO_HIDDEN_SECTION_IDS = new Set(["ontology"]);

/** Routes blocked in demo (direct URL access redirects to hub). */
export const DEMO_BLOCKED_PATH_PREFIXES = [
  "/workflow/ontology",
  "/workflow/kg",
  "/process-library",
  "/route-entry",
  "/part-master",
  "/dashboard",
];

/**
 * @param {string} pathname
 */
export function isDemoBlockedPath(pathname) {
  return DEMO_BLOCKED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * @param {import('../config/mesNavigation').WF_SIDEBAR_SECTIONS} sections
 * @param {DemoContextLike | null | undefined} context
 */
export function filterSidebarSections(sections, context) {
  if (!isDemoMode(context)) return sections;
  return sections.filter((s) => !DEMO_HIDDEN_SECTION_IDS.has(s.id));
}
