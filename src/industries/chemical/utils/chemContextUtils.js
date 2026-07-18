import { mergeIndustrySelectionFallback } from "../../../config/industrySelection";

export function resolveChemAppContext(context) {
  return mergeIndustrySelectionFallback(context || {}, "chemical");
}

export function isChemContextReady(resolved, loading) {
  if (loading) return false;
  if (!resolved?.tenant_code) return false;
  return Boolean(resolved.loaded || resolved.fromFallback);
}
