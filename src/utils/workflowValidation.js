/** Shared workflow gate / quantity validation helpers. */

export function isFeasibilityReady(status) {
  if (!status) return false;
  const key = String(status).toUpperCase().trim();
  return key === "OK" || key === "READY" || key.includes("READY");
}

export function feasibilityLabel(status) {
  if (!status) return "Not checked";
  return isFeasibilityReady(status) ? "Ready to schedule" : "Blocked";
}

export function quantitiesBalanced(total, target) {
  const t = Number(target);
  const s = Number(total);
  if (!Number.isFinite(t) || t <= 0) return false;
  if (!Number.isFinite(s)) return false;
  return s === t;
}

export function quantityDelta(total, target) {
  const t = Number(target);
  const s = Number(total);
  if (!Number.isFinite(t) || !Number.isFinite(s)) return null;
  return s - t;
}
