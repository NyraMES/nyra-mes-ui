/** True when a string looks like a UUID (internal PK), not a business code. */
export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value ?? "")
  );
}

/** Prefer human-readable sequence codes (PART00001) over UUIDs in the UI. */
export function displayBusinessCode(value, codeFallback) {
  const code = codeFallback ?? value;
  if (code && !isUuid(code)) return String(code);
  if (value && !isUuid(value)) return String(value);
  return codeFallback || value || "—";
}
