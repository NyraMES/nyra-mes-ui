const STORAGE_PREFIX = "nyra_ac_inward_bags_v1";

function storageKey(tenantCode, workspaceCode) {
  return `${STORAGE_PREFIX}:${tenantCode || "default"}:${workspaceCode || "default"}`;
}

function readAll(tenantCode, workspaceCode) {
  try {
    const raw = localStorage.getItem(storageKey(tenantCode, workspaceCode));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows, tenantCode, workspaceCode) {
  localStorage.setItem(storageKey(tenantCode, workspaceCode), JSON.stringify(rows));
}

function nextBagCode(rows) {
  const nums = rows
    .map((row) => {
      const match = String(row.bag_code || "").match(/BAG-AC-(\d+)/i);
      return match ? Number(match[1]) : 0;
    })
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 1000) + 1;
  return `BAG-AC-${next}`;
}

export function listLocalInwardBags(tenantCode, workspaceCode, orderCode) {
  const rows = readAll(tenantCode, workspaceCode);
  if (!orderCode) return rows;
  return rows.filter((row) => String(row.order_code) === String(orderCode));
}

export function createLocalInwardBag(payload, tenantCode, workspaceCode) {
  const rows = readAll(tenantCode, workspaceCode);
  const bag_code = nextBagCode(rows);
  const row = {
    bag_id: `local-${Date.now()}`,
    bag_code,
    order_code: payload.order_code,
    customer_order_id: payload.customer_order_id || null,
    weight_kg: Number(payload.weight_kg) || 0,
    label: payload.label || null,
    status: "REGISTERED",
    created_at: new Date().toISOString(),
    source: "local"
  };
  rows.unshift(row);
  writeAll(rows, tenantCode, workspaceCode);
  return row;
}
