/** True when tenant/workspace headers are set enough to call AC APIs. */
export function isAcContextReady(context, contextLoading = false) {
  if (contextLoading) return false;
  return Boolean(context?.loaded || context?.tenant_code);
}
