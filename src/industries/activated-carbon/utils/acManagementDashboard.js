import { computeAcStockBuckets, utilizationRagBand, AC_ISA95_DEFAULT_UTILIZATION_RAG } from "../constants/acIsa95Kpis";
import { buildCharcoalSimpleBars, buildSupplierPerformance } from "./acStockAnalytics";

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

/** Temporary plant standard — monthly designed output per machine (kg). */
export const AC_MACHINE_MONTHLY_CAPACITY_KG = 15000;

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

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthLabel() {
  return new Date().toLocaleString(undefined, { month: "short", year: "numeric" });
}

function isInCurrentMonth(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return monthKey(date) === monthKey();
}

function monthToDateOutputKg(bags = []) {
  return (bags || []).reduce((sum, bag) => {
    const stamp = bag.created_at || bag.saved_at;
    if (!isInCurrentMonth(stamp)) return sum;
    return sum + num(bag.quantity_kg);
  }, 0);
}

function bagsFromKilnOutput(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.bags)) return payload.bags;
  return [];
}

export function buildAcManagementModel({
  dashboard,
  inwardOrders = [],
  stations = {},
  kilnOutputs = {}
} = {}) {
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
    { label: "Plant yield", value: formatPct(yieldPct), hint: "In Stock + dispatched ÷ raw charged (max 100%)", raw: yieldPct },
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
    supplierPerformance: buildSupplierPerformance(inwardOrders),
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
      nowPct: kilnNowPct(kiln.status),
      designedKg: num(kiln.monthly_capacity_kg, AC_MACHINE_MONTHLY_CAPACITY_KG) || AC_MACHINE_MONTHLY_CAPACITY_KG
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

  const monthName = currentMonthLabel();
  const rag = dashboard?.utilization_rag || AC_ISA95_DEFAULT_UTILIZATION_RAG;

  const postMachines = AC_POST_ACTIVATION_MACHINES.map((spec) => {
    const state = stations[spec.id] || null;
    const loaded = num(state?.loader_count);
    const designedKg =
      num(state?.monthly_capacity_kg, AC_MACHINE_MONTHLY_CAPACITY_KG) || AC_MACHINE_MONTHLY_CAPACITY_KG;
    const outputMonthKg = monthToDateOutputKg(state?.output_bags);
    const monthPct = pct(outputMonthKg, designedKg);
    return {
      id: spec.id,
      group: "Post activation",
      name: state?.process_label || spec.label,
      status: loaded > 0 || num(state?.loaded_kg) > 0 ? "RUNNING" : "IDLE",
      nowPct: Math.min(100, monthPct || 0),
      monthPct,
      ragBand: utilizationRagBand(monthPct, rag),
      load: formatKg(outputMonthKg),
      loadKg: num(state?.loaded_kg),
      outputMonthKg,
      designedKg,
      loadCaption: `Output ${monthName}`,
      utilLabel: "Month vs designed",
      detail: `of ${formatKg(designedKg)} designed · loaded ${formatKg(state?.loaded_kg)}`
    };
  });

  const machines = [
    ...activation.kilns.map((kiln) => {
      const designedKg = kiln.designedKg || AC_MACHINE_MONTHLY_CAPACITY_KG;
      const outputMonthKg = monthToDateOutputKg(bagsFromKilnOutput(kilnOutputs[kiln.code]));
      const monthPct = pct(outputMonthKg, designedKg);
      return {
        id: kiln.code,
        group: "Kiln",
        name: kiln.name,
        status: kiln.status,
        nowPct: Math.min(100, monthPct || 0),
        monthPct,
        ragBand: utilizationRagBand(monthPct, rag),
        load: formatKg(outputMonthKg),
        loadKg: kiln.loadedKg,
        outputMonthKg,
        designedKg,
        loadCaption: `Output ${monthName}`,
        utilLabel: "Month vs designed",
        detail: `of ${formatKg(designedKg)} designed · loaded ${formatKg(kiln.loadedKg)}`
      };
    }),
    ...postMachines
  ];

  const outputMonthKg = machines.reduce((sum, row) => sum + num(row.outputMonthKg), 0);
  const designedTotalKg = machines.reduce((sum, row) => sum + num(row.designedKg), 0);
  const vsDesigned = pct(outputMonthKg, designedTotalKg);
  const currentlyLoadedKg = machines.reduce((sum, row) => sum + num(row.loadKg), 0);

  return {
    plant,
    flowStages,
    yieldPct,
    rawMaterial,
    activation,
    postActivation,
    machines,
    utilizationRag: rag,
    machineHeadlines: [
      {
        label: `Designed ${monthName}`,
        value: formatKg(designedTotalKg),
        hint: "From Masters · Machines & kilns"
      },
      {
        label: "Output this month",
        value: formatKg(outputMonthKg),
        hint: "Recorded output bags"
      },
      {
        label: "vs designed",
        value: formatPct(vsDesigned),
        hint: `${formatKg(outputMonthKg)} of ${formatKg(designedTotalKg)}`
      },
      {
        label: "Currently loaded",
        value: formatKg(currentlyLoadedKg),
        hint: "On kilns and stations now"
      }
    ]
  };
}

export { formatKg, formatPct, formatWhen };
