import { mergeIndustrySelectionFallback } from "../../../config/industrySelection";

const AC_TENANT_CODES = new Set(["SAM_CARBONS", "SAM_CARBONS_DEMO"]);

/** True when tenant/workspace headers are set enough to call AC APIs. */
export function isAcContextReady(context, contextLoading = false) {
  if (contextLoading) return false;
  return Boolean(context?.loaded || context?.tenant_code);
}

/** Whether the loaded app context belongs to the Activated Carbon module. */
export function isActivatedCarbonContext(context) {
  if (!context) return false;
  const tenant = String(context.tenant_code || "").trim().toUpperCase();
  return (
    context.module_code === "activated-carbon" ||
    context.industry_template_code === "ACTIVATED_CARBON" ||
    AC_TENANT_CODES.has(tenant)
  );
}

/**
 * Apply industry default capabilities when the context API is unavailable or
 * returns an empty capability list (common in local dev without backend).
 */
export function resolveAcAppContext(context) {
  if (!isActivatedCarbonContext(context)) return context;
  return mergeIndustrySelectionFallback(context, "activated-carbon");
}
