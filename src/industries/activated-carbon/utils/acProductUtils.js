const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value) {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function normalizeProductCode(value) {
  return String(value || "").trim().toUpperCase();
}

/** Dropdown value: UUID when known, otherwise product_code (resolved before API POST). */
export function rawProductOptionValue(product) {
  if (!product) return "";
  if (isValidUuid(String(product.product_id || ""))) {
    return String(product.product_id);
  }
  return product.product_code || "";
}

export function findRawProductSelection(rawProducts, selectedValue) {
  if (!selectedValue) return null;
  const value = String(selectedValue);
  return (
    (rawProducts || []).find(
      (p) =>
        String(p.product_id) === value ||
        p.product_code === value ||
        normalizeProductCode(p.product_code) === normalizeProductCode(value)
    ) || null
  );
}
