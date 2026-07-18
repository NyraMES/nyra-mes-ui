import { DEFAULT_RAW_MATERIAL_TYPES } from "../constants/defaultRawMaterialTypes";
import { isValidUuid, normalizeProductCode } from "./acProductUtils";

const STORAGE_KEY = "nyra_ac_raw_material_types_v1";

function readLocalTypes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalTypes(types) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
}

/**
 * Merge API types with defaults and locally saved types (API wins on code collision).
 */
export function mergeRawMaterialTypes(apiTypes = []) {
  const byCode = new Map();

  for (const row of DEFAULT_RAW_MATERIAL_TYPES) {
    byCode.set(row.product_code, { ...row, source: "default" });
  }
  for (const row of readLocalTypes()) {
    const base = byCode.get(row.product_code);
    byCode.set(row.product_code, { ...(base || {}), ...row, source: "local" });
  }
  for (const row of apiTypes) {
    const code = row.product_code;
    const base = byCode.get(code);
    byCode.set(code, { ...(base || {}), ...row, source: "api" });
  }

  return Array.from(byCode.values()).sort((a, b) =>
    String(a.product_code).localeCompare(String(b.product_code))
  );
}

/**
 * Raw Material Inward dropdown uses raw_products from GET /masters; new types from
 * Masters may exist only in raw_material_types (API or local). Merge so every type
 * appears as a selectable product.
 */
export function mergeRawProductsFromMaterialTypes(
  rawProducts = [],
  materialTypes = [],
  catalogProducts = []
) {
  const byCode = new Map();
  const uuidByCode = new Map();

  for (const product of [...rawProducts, ...catalogProducts]) {
    const code = product?.product_code ?? product?.part_code;
    if (!code) continue;
    const normalized = normalizeProductCode(code);
    if (product.product_id && isValidUuid(String(product.product_id))) {
      uuidByCode.set(normalized, String(product.product_id));
    }
  }

  for (const product of rawProducts) {
    const code = product?.product_code;
    if (!code) continue;
    const normalized = normalizeProductCode(code);
    const productId =
      (isValidUuid(String(product.product_id || "")) && String(product.product_id)) ||
      uuidByCode.get(normalized) ||
      null;
    byCode.set(normalized, {
      ...product,
      product_code: code,
      product_id: productId
    });
  }

  for (const type of materialTypes) {
    const code = type?.product_code;
    if (!code) continue;
    if (type.is_obsolete || String(type.status || "").toUpperCase() === "OBSOLETE") {
      continue;
    }
    const normalized = normalizeProductCode(code);
    if (byCode.has(normalized)) continue;

    const productId =
      (type.product_id && isValidUuid(String(type.product_id)) && String(type.product_id)) ||
      uuidByCode.get(normalized) ||
      null;

    byCode.set(normalized, {
      product_id: productId,
      product_code: code,
      product_name: type.product_name || code,
      from_material_type: true
    });
  }

  return Array.from(byCode.values()).sort((a, b) =>
    String(a.product_code).localeCompare(String(b.product_code))
  );
}

export function saveLocalRawMaterialType(payload) {
  const existing = readLocalTypes().filter((t) => t.product_code !== payload.product_code);
  writeLocalTypes([...existing, { ...payload, saved_at: new Date().toISOString() }]);
}

export function findRawMaterialType(types, productCode) {
  if (!productCode) return null;
  const key = normalizeProductCode(productCode);
  return (
    (types || []).find((t) => normalizeProductCode(t.product_code) === key) || null
  );
}

export function findRawMaterialTypeByProductId(types, rawProducts, productId) {
  if (!productId) return null;
  const product = (rawProducts || []).find(
    (p) => String(p.product_id) === String(productId) || p.product_code === productId
  );
  if (product?.product_code) {
    return findRawMaterialType(types, product.product_code);
  }
  return findRawMaterialType(types, productId);
}
