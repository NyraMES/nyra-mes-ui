/**
 * Activated Carbon ISA-95 KPI ontology (L1 Executive → L2 Process Stability → L3 Operational).
 * L3 stock-stage names align with activated carbon material flow stages.
 */

export const AC_ISA95_KPI_ONTOLOGY = {
  version: "1.0",
  domain: "activated_carbon_manufacturing",
  standard: "ISA-95",
  levels: {
    L1: { name: "L1 Executive", description: "Business impact — yield, dispatch, plant throughput" },
    L2: { name: "L2 Process Stability", description: "Material balance, kiln stability, quality gates" },
    L3: { name: "L3 Operational Control", description: "Shop-floor stock stages and equipment state" }
  },
  thresholds: { green: 90, amber: 70, red: 69 }
};

export const AC_ISA95_DEFAULT_UTILIZATION_RAG = {
  green_min_pct: AC_ISA95_KPI_ONTOLOGY.thresholds.green,
  amber_min_pct: AC_ISA95_KPI_ONTOLOGY.thresholds.amber,
  red_below_pct: AC_ISA95_KPI_ONTOLOGY.thresholds.amber
};

export function utilizationRagBand(pct, rag = AC_ISA95_DEFAULT_UTILIZATION_RAG) {
  if (pct == null || !Number.isFinite(Number(pct))) return "neutral";
  const value = Number(pct);
  const green = Number(rag?.green_min_pct ?? AC_ISA95_DEFAULT_UTILIZATION_RAG.green_min_pct);
  const amber = Number(rag?.amber_min_pct ?? AC_ISA95_DEFAULT_UTILIZATION_RAG.amber_min_pct);
  if (value >= green) return "green";
  if (value >= amber) return "amber";
  return "red";
}

/** Static KPI tree — values filled by buildAcIsa95KpisFromDashboard(). */
export const AC_ISA95_KPI_DEFINITIONS = [
  {
    id: "ac-yield-pct",
    level: "L1",
    title: "Plant Yield",
    unit: "%",
    visualType: "gauge",
    target: 22,
    isa95Area: "Area:KilnActivation",
    drillTo: ["ac-process-loss", "ac-material-balance"]
  },
  {
    id: "ac-production-availability",
    level: "L1",
    title: "Production Availability",
    unit: "%",
    visualType: "gauge",
    target: 90,
    isa95Area: "Site:AC_Plant",
    drillTo: ["ac-kiln-utilization", "ac-material-readiness", "ac-quality-coverage"]
  },
  {
    id: "ac-material-flow",
    level: "L1",
    title: "Material Flow (WIP)",
    unit: "kg",
    visualType: "number",
    target: 1,
    higherIsBetter: true,
    isa95Area: "Area:RawMaterial",
    drillTo: [
      "ac-charcoal-stock",
      "ac-gcharcoal-stock",
      "ac-exkiln-with-stone",
      "ac-exkiln-without-stone",
      "ac-final-grade-stock"
    ]
  },
  {
    id: "ac-dispatch-performance",
    level: "L1",
    title: "Dispatch Performance",
    unit: "%",
    visualType: "gauge",
    target: 100,
    isa95Area: "Area:Logistics",
    drillTo: ["ac-dispatch-count", "ac-active-lots"]
  },
  {
    id: "ac-process-loss",
    level: "L2",
    title: "Process Loss",
    unit: "%",
    visualType: "number",
    target: 5,
    higherIsBetter: false,
    isa95Area: "Area:PostProcessing",
    drillTo: ["ac-rms-loss-pct"]
  },
  {
    id: "ac-material-balance",
    level: "L2",
    title: "Material Balance",
    unit: "%",
    visualType: "number",
    target: 95,
    isa95Area: "Area:RawMaterial",
    drillTo: ["ac-ordered-mass", "ac-charged-mass"]
  },
  {
    id: "ac-kiln-utilization",
    level: "L2",
    title: "Kiln Utilization",
    unit: "%",
    visualType: "number",
    target: 85,
    isa95Area: "Unit:Kiln01",
    drillTo: ["ac-kilns-running", "ac-kiln-feed-mass"]
  },
  {
    id: "ac-material-readiness",
    level: "L2",
    title: "Material Readiness",
    unit: "%",
    visualType: "number",
    target: 95,
    isa95Area: "Area:RawMaterial",
    drillTo: ["ac-pending-load", "ac-open-orders"]
  },
  {
    id: "ac-quality-coverage",
    level: "L2",
    title: "Quality Coverage",
    unit: "%",
    visualType: "number",
    target: 100,
    isa95Area: "Area:QualityLab",
    drillTo: ["ac-quality-checks", "ac-lots-in-qc"]
  },
  {
    id: "ac-dispatch-count",
    level: "L2",
    title: "Dispatches",
    unit: "count",
    visualType: "number",
    target: 1,
    isa95Area: "Area:Logistics",
    drillTo: []
  },
  {
    id: "ac-active-lots",
    level: "L2",
    title: "Active Lots",
    unit: "count",
    visualType: "number",
    target: 1,
    isa95Area: "Material:ProductionLot",
    drillTo: ["ac-lots-in-progress"]
  },
  {
    id: "ac-charcoal-stock",
    level: "L3",
    title: "Charcoal Stock",
    unit: "kg",
    visualType: "number",
    target: 1,
    isa95Area: "Area:RawMaterial",
    processStep: "RAW_MATERIAL_INWARD",
    drillTo: []
  },
  {
    id: "ac-gcharcoal-stock",
    level: "L3",
    title: "GCharcoal Stock",
    unit: "kg",
    visualType: "number",
    target: 1,
    isa95Area: "Cell:KilnLine",
    processStep: "KILN_FEED",
    drillTo: []
  },
  {
    id: "ac-exkiln-with-stone",
    level: "L3",
    title: "Exkiln With Stone",
    unit: "kg",
    visualType: "number",
    target: 1,
    isa95Area: "Area:KilnActivation",
    processStep: "KILN_ACTIVATION",
    drillTo: []
  },
  {
    id: "ac-exkiln-without-stone",
    level: "L3",
    title: "Exkiln Without Stone",
    unit: "kg",
    visualType: "number",
    target: 1,
    isa95Area: "Cell:Screening",
    processStep: "SCREENING",
    drillTo: []
  },
  {
    id: "ac-final-grade-stock",
    level: "L3",
    title: "Final Grade Stock",
    unit: "kg",
    visualType: "number",
    target: 1,
    isa95Area: "Area:FinishedGoods",
    processStep: "FG_PACKING",
    drillTo: []
  },
  {
    id: "ac-rms-loss-pct",
    level: "L3",
    title: "RMS Total Loss",
    unit: "%",
    visualType: "number",
    target: 5,
    higherIsBetter: false,
    isa95Area: "Area:PostProcessing",
    drillTo: []
  },
  {
    id: "ac-ordered-mass",
    level: "L3",
    title: "Ordered Mass",
    unit: "kg",
    visualType: "number",
    target: 1,
    drillTo: []
  },
  {
    id: "ac-charged-mass",
    level: "L3",
    title: "Charged Mass",
    unit: "kg",
    visualType: "number",
    target: 1,
    drillTo: []
  },
  {
    id: "ac-kilns-running",
    level: "L3",
    title: "Kilns Running",
    unit: "count",
    visualType: "number",
    target: 1,
    drillTo: []
  },
  {
    id: "ac-kiln-feed-mass",
    level: "L3",
    title: "Kiln Feed Mass",
    unit: "kg",
    visualType: "number",
    target: 1,
    drillTo: []
  },
  {
    id: "ac-pending-load",
    level: "L3",
    title: "Yet to Load",
    unit: "kg",
    visualType: "number",
    target: 0,
    higherIsBetter: false,
    drillTo: []
  },
  {
    id: "ac-open-orders",
    level: "L3",
    title: "Open Orders",
    unit: "count",
    visualType: "number",
    target: 0,
    higherIsBetter: false,
    drillTo: []
  },
  {
    id: "ac-quality-checks",
    level: "L3",
    title: "Quality Checks",
    unit: "count",
    visualType: "number",
    target: 1,
    drillTo: []
  },
  {
    id: "ac-lots-in-qc",
    level: "L3",
    title: "Lots in QC",
    unit: "count",
    visualType: "number",
    target: 0,
    higherIsBetter: false,
    drillTo: []
  },
  {
    id: "ac-lots-in-progress",
    level: "L3",
    title: "Lots In Progress",
    unit: "count",
    visualType: "number",
    target: 1,
    drillTo: []
  }
];

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sumLotKg(lotLines, predicate) {
  return (lotLines || []).reduce((sum, row) => {
    if (!predicate(row)) return sum;
    return sum + num(row.lot_quantity);
  }, 0);
}

/** Kilograms of this lot still on the floor, after shipment and In Stock bags. */
function lotStillInProcessKg(row) {
  return Math.max(0, num(row.lot_quantity) - num(row.dispatched_kg) - num(row.in_stock_kg));
}

function countLots(lotLines, predicate) {
  return (lotLines || []).filter(predicate).length;
}

function pct(numerator, denominator) {
  const d = num(denominator);
  if (d <= 0) return null;
  return Math.round((num(numerator) / d) * 1000) / 10;
}

function round1(n) {
  return Math.round(num(n) * 10) / 10;
}

/** Compute stock buckets from dashboard lot lines (mutually exclusive stages). */
export function computeAcStockBuckets(dashboard) {
  const lotLines = dashboard?.lot_lines || [];
  const raw = dashboard?.raw_material || {};

  const lotStatus = (row) => String(row.status || "").toUpperCase();

  // Raw charcoal at dock — QC-passed inward not yet released to production.
  const charcoalStock = num(raw.pending_kg);

  // Released lots awaiting kiln (CREATED). Shipped or In Stock kg is not counted here.
  const gcharcoalStock = (lotLines || []).reduce((sum, row) => {
    if (lotStatus(row) !== "CREATED") return sum;
    return sum + lotStillInProcessKg(row);
  }, 0);

  // On kiln / shop floor. Lot quantity minus what has shipped and what is already In Stock.
  const exkilnWithStone = (lotLines || []).reduce((sum, row) => {
    const status = lotStatus(row);
    const stage = lotStage(row);
    const inProcess =
      status === "IN_PROGRESS" ||
      stage.includes("kiln feed") ||
      stage.includes("routing / execution") ||
      (stage.includes("execution (") && !stage.includes("execution complete"));
    if (!inProcess || status === "CREATED") return sum;
    return sum + lotStillInProcessKg(row);
  }, 0);

  // Shop-floor complete, not yet in finished-goods stock.
  const exkilnWithoutStone = (lotLines || []).reduce((sum, row) => {
    const status = lotStatus(row);
    const stage = lotStage(row);
    if (status === "CREATED" || status === "IN_PROGRESS") return sum;
    const done =
      status === "COMPLETED" ||
      status === "QC_PENDING" ||
      stage.includes("execution complete") ||
      stage.includes("shop-floor complete");
    if (!done) return sum;
    return sum + lotStillInProcessKg(row);
  }, 0);

  const stockedFromLots = sumLotKg(lotLines, (row) => lotStatus(row) === "STOCKED");
  const gradeFromApi = (dashboard?.grade_stock || []).reduce(
    (sum, row) => sum + num(row.quantity_kg),
    0
  );
  // Prefer lot-based grade stock — product metadata.fg_stock_kg can drift after backfill/dispatch.
  const finalGradeStock =
    gradeFromApi > 0 ? gradeFromApi : stockedFromLots > 0 ? stockedFromLots : num(dashboard?.finished_goods_stock_kg);

  const wipTotal =
    charcoalStock + gcharcoalStock + exkilnWithStone + exkilnWithoutStone + finalGradeStock;

  return {
    charcoalStock,
    gcharcoalStock,
    exkilnWithStone,
    exkilnWithoutStone,
    finalGradeStock,
    wipTotal
  };
}

/** Bind live dashboard API data onto the static ISA-95 KPI definitions. */
export function buildAcIsa95KpisFromDashboard(dashboard) {
  const raw = dashboard?.raw_material || {};
  const yieldSummary = dashboard?.yield_summary || {};
  const lotLines = dashboard?.lot_lines || [];
  const kilns = dashboard?.kilns || [];
  const activeOrders = dashboard?.active_orders || [];

  const buckets = computeAcStockBuckets(dashboard);
  const yieldPct = yieldSummary.average_yield_pct != null ? num(yieldSummary.average_yield_pct) : null;
  const processLoss = yieldPct != null ? round1(Math.max(0, 100 - yieldPct)) : null;
  const lotCount = num(yieldSummary.lot_count);
  const dispatchCount = num(dashboard?.dispatch_count);
  const qcCount = num(dashboard?.quality_check_count);
  const orderedKg = num(raw.ordered_kg);
  const chargedKg = num(raw.charged_kg);
  const pendingKg = num(raw.pending_kg);
  const openOrders = num(raw.open_order_count);
  const kilnsRunning = kilns.filter((k) => (k.status || "").toUpperCase() === "RUNNING").length;
  const kilnTotal = Math.max(kilns.length, 1);
  const lotsInKiln = countLots(lotLines, (row) => lotStatusUpper(row) === "IN_PROGRESS");
  const lotsAwaitingKiln = countLots(lotLines, (row) => lotStatusUpper(row) === "CREATED");
  const lotsStocked = countLots(lotLines, (row) => lotStatusUpper(row) === "STOCKED");
  const lotsInQc = countLots(lotLines, (row) => lotStage(row).includes("quality"));
  const activeLotCount =
    activeOrders.length ||
    countLots(lotLines, (row) => {
      const st = lotStatusUpper(row);
      return !["DISPATCHED", "CLOSED", "CANCELLED"].includes(st);
    });
  const linesRunningCount = Math.max(lotsInKiln, kilnsRunning);
  const linesRunningPct =
    activeLotCount > 0
      ? pct(linesRunningCount, activeLotCount)
      : pct(kilnsRunning, kilnTotal);

  const values = {
    "ac-yield-pct": yieldPct,
    "ac-production-availability": linesRunningPct,
    "ac-material-flow": round1(buckets.wipTotal),
    "ac-dispatch-performance":
      dispatchCount > 0 ? pct(dispatchCount, Math.max(lotsStocked, dispatchCount, 1)) : 0,
    "ac-process-loss": processLoss,
    "ac-material-balance": pct(chargedKg + pendingKg, orderedKg || chargedKg + pendingKg || 1),
    "ac-kiln-utilization": pct(kilnsRunning, kilnTotal),
    "ac-material-readiness": pct(chargedKg, orderedKg || chargedKg || 1),
    "ac-quality-coverage": pct(qcCount, lotCount || qcCount || 1),
    "ac-dispatch-count": dispatchCount,
    "ac-active-lots": activeLotCount,
    "ac-charcoal-stock": round1(buckets.charcoalStock),
    "ac-gcharcoal-stock": round1(buckets.gcharcoalStock),
    "ac-exkiln-with-stone": round1(buckets.exkilnWithStone),
    "ac-exkiln-without-stone": round1(buckets.exkilnWithoutStone),
    "ac-final-grade-stock": round1(buckets.finalGradeStock),
    "ac-rms-loss-pct": processLoss,
    "ac-ordered-mass": round1(orderedKg),
    "ac-charged-mass": round1(chargedKg),
    "ac-kilns-running": kilnsRunning,
    "ac-kiln-feed-mass": round1(buckets.gcharcoalStock + buckets.exkilnWithStone),
    "ac-pending-load": round1(pendingKg),
    "ac-open-orders": openOrders,
    "ac-quality-checks": qcCount,
    "ac-lots-in-qc": lotsInQc,
    "ac-lots-in-progress": activeLotCount
  };

  const definitions = AC_ISA95_KPI_DEFINITIONS || [];
  return definitions.map((defn) => ({
    ...defn,
    value: values[defn.id] ?? "—"
  }));
}

export function getAcKpiById(kpis, id) {
  return (kpis || []).find((k) => k.id === id);
}

function kpiProgressPct(kpi) {
  if (!kpi || kpi.value === "—") return 0;
  const value = num(kpi.value);
  const target = num(kpi.target, 100);
  const higher = kpi.higherIsBetter !== false;
  if (kpi.unit === "kg") return 0;
  if (higher) return Math.min(100, target > 0 ? (value / target) * 100 : 0);
  return Math.min(100, value <= target ? 100 : target > 0 ? (target / value) * 100 : 0);
}

/** Shop-floor summary cards — one block per L1 KPI with L2 drill metrics + bar weights. */
export function buildAcKpiShopFloorCards(kpis) {
  return getAcKpisByLevel(kpis, "L1").map((parent) => {
    const children = getAcChildKpis(kpis, parent.id);
    const isStockCard = parent.id === "ac-material-flow";
    const stockMax = isStockCard
      ? Math.max(...children.map((child) => num(child.value)), num(parent.value), 1)
      : 1;

    const totalWip = num(parent.value);

    return {
      id: parent.id,
      title: parent.title,
      value: parent.value,
      unit: parent.unit,
      target: parent.target,
      higherIsBetter: parent.higherIsBetter !== false,
      rag: getAcKpiRagStatus(parent),
      /** Share of static ISA-95 target achieved (e.g. 16.8% yield / 22% target → 76%). */
      progressPct: kpiProgressPct(parent),
      stockTargetKg: isStockCard && children.length ? totalWip / children.length : null,
      metrics: children.map((child) => ({
        id: child.id,
        title: child.title,
        value: child.value,
        unit: child.unit,
        target: child.target,
        higherIsBetter: child.higherIsBetter !== false,
        progressPct: isStockCard
          ? Math.min(100, (num(child.value) / stockMax) * 100)
          : kpiProgressPct(child)
      }))
    };
  });
}

export function getAcKpisByLevel(kpis, level) {
  return (kpis || []).filter((k) => k.level === level);
}

export function getAcChildKpis(kpis, parentId) {
  const parent = getAcKpiById(kpis, parentId);
  if (!parent?.drillTo?.length) return [];
  return parent.drillTo.map((id) => getAcKpiById(kpis, id)).filter(Boolean);
}

export function getAcKpiPath(kpis, kpiId) {
  const kpi = getAcKpiById(kpis, kpiId);
  if (!kpi) return [];
  if (kpi.level === "L1") return [kpi];
  for (const l1 of getAcKpisByLevel(kpis, "L1")) {
    if (kpi.level === "L3" && l1.drillTo?.includes(kpiId)) return [l1, kpi];
    const l2s = getAcChildKpis(kpis, l1.id);
    if (kpi.level === "L2" && l2s.some((l2) => l2.id === kpiId)) return [l1, kpi];
    for (const l2 of l2s) {
      const l3s = getAcChildKpis(kpis, l2.id);
      if (l3s.some((l3) => l3.id === kpiId)) return [l1, l2, kpi];
    }
  }
  return [kpi];
}

function lotStage(row) {
  if (row.pipeline_stage) return String(row.pipeline_stage).toLowerCase();
  const st = String(row.status || "").toUpperCase();
  if (st === "DISPATCHED") return "dispatched";
  if (st === "STOCKED") return "finished goods stock";
  if (st === "QC_PENDING") return "quality testing";
  if (st === "COMPLETED") return "shop-floor complete";
  if (st === "IN_PROGRESS") return "kiln feed";
  if (st === "CREATED") return "awaiting feasibility";
  return String(row.status || "").toLowerCase();
}

function lotStatusUpper(row) {
  return String(row.status || "").toUpperCase();
}

export function getAcKpiRagStatus(kpi) {
  if (!kpi || kpi.value === "—") return "neutral";
  const higherIsBetter = kpi.higherIsBetter !== false;
  const target = num(kpi.target, 100);
  const value = num(kpi.value, 0);
  let score;
  if (higherIsBetter) {
    score = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  } else {
    score = value <= target ? 100 : target > 0 ? (target / value) * 100 : 0;
  }
  const t = AC_ISA95_KPI_ONTOLOGY.thresholds;
  if (score >= t.green) return "ok";
  if (score >= t.amber) return "warn";
  return "bad";
}

export const AC_KPI_ACCENTS = {
  L1: "indigo",
  L2: "cyan",
  L3: "emerald"
};
