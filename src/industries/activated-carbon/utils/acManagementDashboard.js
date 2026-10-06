import { computeAcStockBuckets } from "../constants/acIsa95Kpis";
import { buildCharcoalSimpleBars } from "./acStockAnalytics";

export const AC_MGMT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "raw-material", label: "Raw Material" },
  { id: "activation", label: "Activation" },
  { id: "post-activation", label: "Post activation" },
  { id: "machine-utilization", label: "Machine utilization" }
];

export const AC_POST_ACTIVATION_MACHINES = [
  { id: "screening", label: "Screening" },
  { id: "dedusting", label: "De-dusting" },
  { id: "crushing", label: "Crushing" },
  { id: "demagnetisation", label: "De-magnetisation" },
  { id: "blending", label: "Blending" },
  { id: "fg_qc", label: "Finished Goods" }
];

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pct(numerator, denominator) {
  const d = num(denominator);
  if (d <= 0) return null;
  return Math.round((num(numerator) / d) * 1000) / 10;
}

function formatKg(value) {
  const n = num(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
}

function formatPct(value) {
  if (value == null || value === "—") return "—";
  const n = num(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)} min ago`;
  if (diffMs < 24 * 3600_000) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function kilnNowPct(status) {
  const st = String(status || "").toUpperCase();
  if (st === "RUNNING") return 100;
  if (st === "COOLING") return 50;
  return 0;
}

function stationNowPct(state) {
  const loaded = num(state?.loader_count);
  const capacity = Math.max(num(state?.loader_capacity), 1);
  if (loaded <= 0 && num(state?.loaded_kg) <= 0) return 0;
  return Math.min(100, Math.round((loaded / Math.max(capacity, 1)) * 1000) / 10);
}

function lastStationAt(state) {
  const events = state?.load_events || [];
  const stamps = events
    .map((row) => row.loaded_at)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((ms) => Number.isFinite(ms));
  if (!stamps.length) return null;
  return new Date(Math.max(...stamps)).toISOString();
}

export function buildAcManagementModel({ dashboard, inwardOrders = [], stations = {} } = {}) {
  const raw = dashboard?.raw_material || {};
  const buckets = computeAcStockBuckets(dashboard);
  const kilns = dashboard?.kilns || [];
  const kilnsRunning = kilns.filter((k) => String(k.status || "").toUpperCase() === "RUNNING").length;
  const yieldPct =
    dashboard?.yield_summary?.average_yield_pct != null
      ? num(dashboard.yield_summary.average_yield_pct)
      : null;
  const openPos = (dashboard?.open_customer_orders || []).filter((row) => num(row.remaining_kg) > 0);
  const openPoKg = openPos.reduce((sum, row) => sum + num(row.remaining_kg), 0);

  const plant = [
    { label: "Plant yield", value: formatPct(yieldPct), hint: "Finished output ÷ raw charged", raw: yieldPct },
    { label: "Material in plant", value: formatKg(buckets.wipTotal), hint: "Charcoal through finished stock", raw: buckets.wipTotal },
    { label: "FG in stock", value: formatKg(buckets.finalGradeStock), hint: "Ready for customer PO", raw: buckets.finalGradeStock },
    {
      label: "Dispatched",
      value: formatKg(dashboard?.dispatched_kg_total),
      hint:
        num(dashboard?.dispatch_count) > 0
          ? `${num(dashboard.dispatch_count)} shipment${num(dashboard.dispatch_count) === 1 ? "" : "s"}`
          : "No shipments yet",
      raw: num(dashboard?.dispatched_kg_total)
    }
  ];

  const flowStages = [
    { name: "Charcoal", kg: buckets.charcoalStock, fill: "#0D3A6E" },
    { name: "GC", kg: buckets.gcharcoalStock, fill: "#0284c7" },
    { name: "Exklin + stone", kg: buckets.exkilnWithStone, fill: "#f59e0b" },
    { name: "Exklin − stone", kg: buckets.exkilnWithoutStone, fill: "#10b981" },
    { name: "FG stock", kg: buckets.finalGradeStock, fill: "#6366f1" }
  ];

  const rawMaterial = {
    tiles: [
      { label: "Charcoal stock", value: formatKg(buckets.charcoalStock), hint: "Received, not released" },
      { label: "Released to production", value: formatKg(raw.charged_kg), hint: "Allocated to kiln / lots" },
      { label: "GC awaiting kiln", value: formatKg(buckets.gcharcoalStock), hint: "Released lots not yet loaded" },
      {
        label: "Inwards",
        value: String(num(raw.open_order_count)),
        hint: `${formatKg(raw.ordered_kg)} received`
      }
    ],
    balancePct: pct(num(raw.charged_kg) + num(raw.pending_kg), raw.ordered_kg),
    charcoalBars: buildCharcoalSimpleBars(inwardOrders),
    mix: [
      { name: "Charcoal", kg: buckets.charcoalStock, fill: "#0D3A6E" },
      { name: "Released", kg: num(raw.charged_kg), fill: "#0284c7" },
      { name: "GC", kg: buckets.gcharcoalStock, fill: "#f59e0b" }
    ]
  };

  const activation = {
    tiles: [
      { label: "GC awaiting kiln", value: formatKg(buckets.gcharcoalStock), hint: "CREATED lots" },
      { label: "Exklin with stone", value: formatKg(buckets.exkilnWithStone), hint: "On kiln / shop floor" },
      { label: "Exklin without stone", value: formatKg(buckets.exkilnWithoutStone), hint: "Shop-floor complete" },
      {
        label: "Kilns running",
        value: `${kilnsRunning} / ${Math.max(kilns.length, 0)}`,
        hint: formatPct(pct(kilnsRunning, Math.max(kilns.length, 1)))
      }
    ],
    yieldPct,
    mix: [
      { name: "GC", kg: buckets.gcharcoalStock, fill: "#0284c7" },
      { name: "With stone", kg: buckets.exkilnWithStone, fill: "#f59e0b" },
      { name: "Without stone", kg: buckets.exkilnWithoutStone, fill: "#10b981" }
    ],
    kilns: kilns.map((kiln) => ({
      code: kiln.resource_code,
      name: kiln.resource_name || kiln.resource_code,
      status: String(kiln.status || "IDLE").toUpperCase(),
      loadedKg: num(kiln.loaded_kg ?? kiln.active_lot_kg),
      lastAt: kiln.last_reading_at,
      nowPct: kilnNowPct(kiln.status)
    }))
  };

  const postActivation = {
    tiles: [
      { label: "In stock", value: formatKg(buckets.finalGradeStock), hint: "Destoning / post-activation bags" },
      {
        label: "Open customer POs",
        value: String(openPos.length),
        hint: openPoKg > 0 ? `${formatKg(openPoKg)} remaining` : "No open demand"
      },
      { label: "Shipments", value: String(num(dashboard?.dispatch_count)), hint: "Dispatch records" },
      { label: "Dispatched", value: formatKg(dashboard?.dispatched_kg_total), hint: "Shipped to customers" }
    ],
    grades: (dashboard?.grade_stock || [])
      .filter((row) => num(row.quantity_kg) > 0)
      .map((row, idx) => ({
        name: row.grade_label || row.grade_code,
        label: row.grade_label || row.grade_code,
        kg: num(row.quantity_kg),
        fill: ["#0D3A6E", "#0284c7", "#10b981", "#f59e0b", "#6366f1"][idx % 5]
      })),
    recent: (dashboard?.recent_dispatches || []).slice(0, 5),
    dispatchBars: (dashboard?.recent_dispatches || []).slice(0, 5).map((row) => ({
      name: row.order_code || row.dispatch_id || "Dispatch",
      kg: num(row.quantity_kg)
    }))
  };

  const postMachines = AC_POST_ACTIVATION_MACHINES.map((spec) => {
    const state = stations[spec.id] || null;
    const loaded = num(state?.loader_count);
    return {
      id: spec.id,
      group: "Post activation",
      name: state?.process_label || spec.label,
      status: loaded > 0 || num(state?.loaded_kg) > 0 ? "RUNNING" : "IDLE",
      nowPct: stationNowPct(state),
      load: formatKg(state?.loaded_kg),
      loadKg: num(state?.loaded_kg),
      detail: state
        ? `${loaded} / ${num(state.loader_capacity) || 1} machines · last ${formatWhen(lastStationAt(state))}`
        : `No ${spec.label.toLowerCase()} loads yet`
    };
  });

  const machines = [
    ...activation.kilns.map((kiln) => ({
      id: kiln.code,
      group: "Kiln",
      name: kiln.name,
      status: kiln.status,
      nowPct: kiln.nowPct,
      load: formatKg(kiln.loadedKg),
      loadKg: kiln.loadedKg,
      detail: kiln.lastAt ? `Last activity ${formatWhen(kiln.lastAt)}` : "No kiln activity yet"
    })),
    ...postMachines
  ];

  const kilnUtil = pct(kilnsRunning, Math.max(kilns.length, 1));
  const stationsRunning = postMachines.filter((m) => m.status === "RUNNING").length;
  const stationUtil = pct(stationsRunning, Math.max(postMachines.length, 1));
  const stationLoadKg = postMachines.reduce((sum, row) => sum + num(row.loadKg), 0);

  return {
    plant,
    flowStages,
    yieldPct,
    rawMaterial,
    activation,
    postActivation,
    machines,
    machineHeadlines: [
      { label: "Kiln utilization now", value: formatPct(kilnUtil), hint: `${kilnsRunning} kiln(s) running` },
      {
        label: "Post-activation in use",
        value: `${stationsRunning} / ${postMachines.length}`,
        hint: formatPct(stationUtil)
      },
      {
        label: "Loaded on stations",
        value: formatKg(stationLoadKg),
        hint: "All post-activation machines"
      },
      { label: "Stations in use", value: formatPct(stationUtil), hint: "Screening through finished goods" }
    ]
  };
}

export { formatKg, formatPct, formatWhen };
