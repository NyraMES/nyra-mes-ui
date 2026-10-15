import { computeAcStockBuckets } from "../constants/acIsa95Kpis";

const CHART_COLORS = [
  "#38bdf8",
  "#fbbf24",
  "#34d399",
  "#a78bfa",
  "#fb923c",
  "#f472b6",
  "#22d3ee",
  "#64748b"
];

const IMPURITY_COLORS = {
  Stones: "#87CEEB",
  Unburnt: "#10B981",
  Minus20: "#FFB74D"
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function shortLabel(value, fallback = "Unknown") {
  const text = String(value || "").trim();
  return text || fallback;
}

function kgFromPct(quantityKg, pct) {
  const q = num(quantityKg);
  const p = num(pct);
  if (q <= 0 || p <= 0) return 0;
  return Math.round((q * p) / 100);
}

function impurityKg(row, kgField, pctField) {
  const explicit = num(row[kgField]);
  if (explicit > 0) return explicit;
  const qty = num(row.quantity ?? row.inward_quantity_kg);
  return kgFromPct(qty, row[pctField]);
}

function rmsLossPctFromQc(row) {
  const qty = num(row.quantity ?? row.inward_quantity_kg);
  const stones = impurityKg(row, "stones_kg", "foreign_matter_pct");
  const unburnt = impurityKg(row, "unburnt_kg", "ash_pct");
  const minus20 = impurityKg(row, "minus20_kg", "moisture_pct");
  const lossKg = stones + unburnt + minus20;
  if (lossKg > 0 && qty > 0) {
    return Math.min(100, Math.round((lossKg / qty) * 10000) / 100);
  }
  return Math.min(100, num(row.foreign_matter_pct) + num(row.ash_pct) + num(row.moisture_pct));
}

export function buildAcFlowStages(dashboard) {
  const buckets = computeAcStockBuckets(dashboard);
  return [
    { id: "charcoal", label: "Charcoal Stock", value: buckets.charcoalStock },
    { id: "gcharcoal", label: "GCharcoal Stock", value: buckets.gcharcoalStock },
    { id: "exkiln-stone", label: "Exkiln With Stone", value: buckets.exkilnWithStone },
    { id: "exkiln-no-stone", label: "Exkiln Without Stone", value: buckets.exkilnWithoutStone },
    { id: "final-grade", label: "Final Grade Stock", value: buckets.finalGradeStock }
  ];
}

/** Supplier-wise charcoal stock — stacked by raw material product (testbed Charcoal Stock chart). */
export function buildCharcoalStockChart(inwardOrders = []) {
  const bySupplier = new Map();
  const keys = new Set();

  for (const order of inwardOrders) {
    const qty = num(order.available_quantity_kg ?? order.inward_quantity_kg);
    if (qty <= 0) continue;
    const supplier = shortLabel(order.supplier_name || order.supplier_code, "Unassigned");
    const material = shortLabel(
      order.raw_product_code || order.product_code || order.product_name,
      "Raw material"
    );
    keys.add(material);
    const row = bySupplier.get(supplier) || { supplier, total: 0 };
    row[material] = num(row[material]) + qty;
    row.total += qty;
    bySupplier.set(supplier, row);
  }

  const keyList = [...keys].sort();
  const data = [...bySupplier.values()].sort((a, b) => b.total - a.total);
  return { data, keys: keyList, colors: keyList.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]) };
}

/** GC stock by supplier — CREATED lots awaiting kiln (matches GCharcoal KPI). */
export function buildGcharcoalStockChart(kilnLots = [], inwardOrders = []) {
  const inwardByPo = new Map();
  for (const order of inwardOrders) {
    const po = order.production_order_code || order.po_code;
    if (po) inwardByPo.set(String(po), order);
  }

  const bySupplier = new Map();
  const keys = new Set();

  for (const lot of kilnLots) {
    if (String(lot.status || "").toUpperCase() !== "CREATED") continue;
    const qty = num(lot.lot_quantity);
    if (qty <= 0) continue;
    const linked = inwardByPo.get(String(lot.production_order_code));
    const supplier = shortLabel(
      lot.supplier_name || linked?.supplier_name || linked?.supplier_code,
      "Awaiting kiln"
    );
    const kiln = shortLabel(lot.kiln_resource_code || lot.resource_code || lot.kiln_name, "Kiln");
    keys.add(kiln);
    const row = bySupplier.get(supplier) || { supplier, total: 0 };
    row[kiln] = num(row[kiln]) + qty;
    row.total += qty;
    bySupplier.set(supplier, row);
  }

  if (!bySupplier.size) {
    const charged = num(inwardOrders.reduce((sum, row) => sum + num(row.allocated_to_production_kg), 0));
    if (charged > 0) {
      return {
        data: [{ supplier: "Released to production", total: charged, Released: charged }],
        keys: ["Charged"],
        colors: [CHART_COLORS[0]]
      };
    }
  }

  const keyList = [...keys].sort();
  const data = [...bySupplier.values()].sort((a, b) => b.total - a.total);
  return { data, keys: keyList, colors: keyList.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]) };
}

function lotStatusUpper(row) {
  return String(row?.status || "").toUpperCase();
}

function lotStageLower(row) {
  return String(row?.pipeline_stage || "").toLowerCase();
}

/** Material on kiln / shop floor — matches Exkiln-with-stone KPI. */
export function buildExkilnPipelineChart(lotLines = []) {
  const byLot = new Map();

  for (const row of lotLines) {
    const status = lotStatusUpper(row);
    const stage = lotStageLower(row);
    const inPipeline =
      status === "IN_PROGRESS" ||
      stage.includes("kiln feed") ||
      stage.includes("routing / execution") ||
      (stage.includes("execution (") && !stage.includes("execution complete"));
    if (!inPipeline) continue;
    const qty = num(row.lot_quantity);
    if (qty <= 0) continue;
    const label = shortLabel(row.lot_code, "Lot");
    byLot.set(label, num(byLot.get(label)) + qty);
  }

  return {
    data: [...byLot.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  };
}

/** Grade-wise finished stock — prefers API grade_stock (stocked lots). */
export function buildGradeWiseStock(
  finishedGoods = [],
  lotLines = [],
  screeningRows = [],
  gradeStockFromApi = []
) {
  const GRADE_COLORS = ["#87CEEB", "#FFA500"];

  if (gradeStockFromApi?.length) {
    return gradeStockFromApi
      .filter((row) => num(row.quantity_kg) > 0)
      .map((row, idx) => ({
        grade: shortLabel(row.grade_label || row.product_name || row.product_code, "Grade"),
        weight: num(row.quantity_kg),
        color: GRADE_COLORS[idx % GRADE_COLORS.length]
      }))
      .sort((a, b) => b.weight - a.weight);
  }

  const grades = new Map();

  for (const row of finishedGoods) {
    const label = shortLabel(row.product_name || row.product_code, "Finished");
    const qty = num(row.quantity_kg);
    if (qty <= 0) continue;
    grades.set(label, num(grades.get(label)) + qty);
  }

  for (const row of screeningRows) {
    const label = shortLabel(row.mesh_size || row.grade_code, null);
    if (!label) continue;
    const qty = num(row.good_kg ?? row.overs_kg) + num(row.fines_kg);
    if (qty <= 0) continue;
    grades.set(label, num(grades.get(label)) + qty);
  }

  if (!grades.size) {
    for (const row of lotLines) {
      const stage = String(row.pipeline_stage || row.status || "").toLowerCase();
      if (!stage.includes("finished") && String(row.status || "").toUpperCase() !== "STOCKED") continue;
      const label = shortLabel(row.lot_code, "Lot");
      const qty = num(row.lot_quantity);
      if (qty <= 0) continue;
      grades.set(label, num(grades.get(label)) + qty);
    }
  }

  return [...grades.entries()]
    .map(([grade, weight], idx) => ({
      grade,
      weight,
      color: GRADE_COLORS[idx % GRADE_COLORS.length]
    }))
    .sort((a, b) => b.weight - a.weight);
}

/** Simple vertical bars — one bar per supplier (total kg), testbed Charcoal Stock style. */
export function buildCharcoalSimpleBars(inwardOrders = []) {
  const bySupplier = new Map();
  for (const order of inwardOrders) {
    const qty = num(order.available_quantity_kg ?? order.inward_quantity_kg);
    if (qty <= 0) continue;
    const name = shortLabel(order.supplier_name || order.supplier_code, "In stock");
    bySupplier.set(name, num(bySupplier.get(name)) + qty);
  }
  return [...bySupplier.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

function weightedEfficiency(recoveryPct, labPassPct, weighMatchPct) {
  const weighScore = weighMatchPct == null ? null : Math.max(0, 100 - Math.abs(100 - weighMatchPct));
  const parts = [
    [recoveryPct, 0.5],
    [labPassPct, 0.3],
    [weighScore, 0.2]
  ].filter(([value]) => value != null);
  const weightSum = parts.reduce((sum, [, weight]) => sum + weight, 0);
  if (weightSum <= 0) return null;
  return Math.round((parts.reduce((sum, [value, weight]) => sum + value * weight, 0) / weightSum) * 10) / 10;
}

function roundPct(numerator, denominator) {
  const d = num(denominator);
  if (d <= 0) return null;
  return Math.round((num(numerator) / d) * 1000) / 10;
}

function labOutcome(status) {
  const st = String(status || "").toUpperCase();
  if (st === "DENIED" || st === "FAIL" || st === "REJECTED") return "deny";
  if (st === "COMPLETED" || st === "PASS" || st === "APPROVED" || st === "QC_PASSED") return "pass";
  return "pending";
}

/**
 * Supplier efficiency from inward receipts:
 * recovery = released to production / plant weighbridge kg
 * weigh match = plant kg / supplier DC kg (100% = claim matched)
 * lab pass = completed lab approvals / lab decisions
 */
export function buildSupplierPerformance(inwardOrders = []) {
  const bySupplier = new Map();

  for (const order of inwardOrders) {
    const name = shortLabel(order.supplier_name || order.supplier_code, "Unassigned");
    const receivedKg = num(order.our_weight_kg ?? order.inward_quantity_kg);
    const claimedKg = num(order.supplier_weight_kg);
    const releasedKg = num(order.allocated_to_production_kg);
    const outcome = labOutcome(order.lab_status);
    const row = bySupplier.get(name) || {
      name,
      receipts: 0,
      receivedKg: 0,
      claimedKg: 0,
      releasedKg: 0,
      labDone: 0,
      labPass: 0,
      labDeny: 0
    };
    row.receipts += 1;
    row.receivedKg += receivedKg;
    row.claimedKg += claimedKg;
    row.releasedKg += releasedKg;
    if (outcome === "pass") {
      row.labDone += 1;
      row.labPass += 1;
    } else if (outcome === "deny") {
      row.labDone += 1;
      row.labDeny += 1;
    }
    bySupplier.set(name, row);
  }

  const rows = [...bySupplier.values()]
    .map((row) => {
      const recoveryPct = roundPct(row.releasedKg, row.receivedKg);
      const weighMatchPct = roundPct(row.receivedKg, row.claimedKg);
      const labPassPct = roundPct(row.labPass, row.labDone);
      const efficiencyPct = weightedEfficiency(recoveryPct, labPassPct, weighMatchPct);
      return { ...row, recoveryPct, weighMatchPct, labPassPct, efficiencyPct };
    })
    .sort(
      (a, b) =>
        (b.efficiencyPct ?? -1) - (a.efficiencyPct ?? -1) ||
        (b.recoveryPct ?? -1) - (a.recoveryPct ?? -1) ||
        b.receivedKg - a.receivedKg
    );

  const totals = rows.reduce(
    (acc, row) => {
      acc.receipts += row.receipts;
      acc.receivedKg += row.receivedKg;
      acc.claimedKg += row.claimedKg;
      acc.releasedKg += row.releasedKg;
      acc.labDone += row.labDone;
      acc.labPass += row.labPass;
      acc.labDeny += row.labDeny;
      return acc;
    },
    { receipts: 0, receivedKg: 0, claimedKg: 0, releasedKg: 0, labDone: 0, labPass: 0, labDeny: 0 }
  );

  const best = rows.find((row) => row.efficiencyPct != null) || null;
  const recoveryPct = roundPct(totals.releasedKg, totals.receivedKg);
  const labPassPct = roundPct(totals.labPass, totals.labDone);
  const weighMatchPct = roundPct(totals.receivedKg, totals.claimedKg);
  const efficiencyPct = weightedEfficiency(recoveryPct, labPassPct, weighMatchPct);

  return {
    efficiencyPct,
    rows,
    bars: rows
      .filter((row) => row.efficiencyPct != null)
      .map((row) => ({ name: row.name, pct: row.efficiencyPct, fill: "#0D3A6E" })),
    best,
    tiles: [
      {
        label: "Best supplier",
        value: best?.name || "—",
        hint: best?.efficiencyPct != null ? `${best.efficiencyPct.toFixed(1)}% efficiency` : "Need inward + release"
      },
      {
        label: "Usable recovery",
        value: recoveryPct == null ? "—" : `${recoveryPct.toFixed(1)}%`,
        hint: "Released ÷ plant weighbridge"
      },
      {
        label: "Lab pass",
        value: labPassPct == null ? "—" : `${labPassPct.toFixed(1)}%`,
        hint:
          totals.labDeny > 0
            ? `${totals.labPass} pass · ${totals.labDeny} deny`
            : totals.labDone > 0
              ? `${totals.labPass} of ${totals.labDone} lab lots`
              : "No lab decision yet"
      },
      {
        label: "Weigh match",
        value: weighMatchPct == null ? "—" : `${weighMatchPct.toFixed(1)}%`,
        hint: "Plant kg ÷ supplier DC kg"
      }
    ]
  };
}

const DEFAULT_IMPURITY_FIELDS = [
  { key: "stones_kg", series: "Stones", color: "#87CEEB", pctFallbackKey: "foreign_matter_pct" },
  { key: "unburnt_kg", series: "Unburnt", color: "#10B981", pctFallbackKey: "ash_pct" },
  { key: "minus20_kg", series: "Minus20", color: "#FFB74D", pctFallbackKey: "moisture_pct" }
];

/** Impurities by inward — series driven by ontology QC config (kg fields with chartSeries). */
export function buildImpuritiesChart(qcRows = [], impurityFields = DEFAULT_IMPURITY_FIELDS) {
  const fields = impurityFields?.length ? impurityFields : DEFAULT_IMPURITY_FIELDS;

  return qcRows
    .map((row) => {
      const chartRow = {
        inward_number: shortLabel(row.order_code, "Inward"),
        supplier_name: row.supplier_name || "",
        total: 0
      };
      for (const field of fields) {
        const value = impurityKg(row, field.key, field.pctFallbackKey);
        chartRow[field.series] = value;
        chartRow.total += value;
      }
      return chartRow;
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function buildImpurityColors(impurityFields = DEFAULT_IMPURITY_FIELDS) {
  const colors = { ...IMPURITY_COLORS };
  for (const field of impurityFields) {
    if (field.series && field.color) {
      colors[field.series] = field.color;
    }
  }
  return colors;
}

function isCompletedQc(row) {
  const status = String(row.qc_status || "").toUpperCase();
  return ["PASS", "FAIL", "QC_PASSED", "QC_FAILED"].includes(status);
}

/** RMS total loss % per inward (last 30 days window) from QC composition. */
export function buildRmsLossLast30(qcRows = []) {
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  const completed = qcRows.filter(isCompletedQc);
  const inWindow = completed.filter((row) => {
    if (!row.qc_at) return true;
    const ts = new Date(row.qc_at).getTime();
    return !Number.isNaN(ts) && ts >= cutoff;
  });
  const source = inWindow.length ? inWindow : completed;

  const rows = source
    .map((row) => {
      const lossPct = rmsLossPctFromQc(row);
      return {
        inward_number: shortLabel(row.order_code, "Inward"),
        rms_total_loss_pct: Math.round(lossPct * 100) / 100,
        completed_at: row.qc_at || null
      };
    })
    .filter((row) => row.rms_total_loss_pct > 0);

  const avg =
    rows.length > 0
      ? rows.reduce((sum, row) => sum + row.rms_total_loss_pct, 0) / rows.length
      : 0;

  return { rows, avgPct: Math.round(avg * 100) / 100 };
}

/** Kiln yield — bar chart per kiln, or trend by lot when enough completions exist. */
export function buildKilnYieldSeries(dashboard, kilnLots = [], lotLines = []) {
  const yieldPct = num(dashboard?.yield_summary?.average_yield_pct);
  const kilns = dashboard?.kilns || [];

  const completedLots = (lotLines || []).filter((row) => {
    const st = String(row.status || "").toUpperCase();
    return ["STOCKED", "DISPATCHED", "QC_PENDING", "COMPLETED"].includes(st);
  });

  if (completedLots.length >= 2 && yieldPct > 0) {
    const recent = completedLots.slice(0, 8).reverse();
    return {
      mode: "trend",
      dates: recent.map((row) => shortLabel(row.lot_code, "Lot")),
      series: [
        {
          label: "Plant yield",
          color: CHART_COLORS[0],
          data: recent.map(() => yieldPct)
        }
      ],
      averages: { "Plant yield": yieldPct }
    };
  }

  const kilnNames = kilns.length
    ? kilns.map((k) => shortLabel(k.resource_name || k.resource_code, "Kiln"))
    : [...new Set(kilnLots.map((lot) => shortLabel(lot.kiln_resource_code, "Kiln")).filter(Boolean))];

  if (!kilnNames.length && yieldPct > 0) {
    kilnNames.push("Plant yield");
  }

  if (!kilnNames.length || yieldPct <= 0) {
    return { mode: "empty", dates: [], series: [], averages: {} };
  }

  return {
    mode: "snapshot",
    dates: kilnNames,
    series: [
      {
        label: "Yield %",
        color: CHART_COLORS[0],
        data: kilnNames.map(() => yieldPct)
      }
    ],
    averages: { "Yield %": yieldPct }
  };
}

function enrichQcWithInward(qcRows = [], inwardOrders = []) {
  const inwardById = new Map(
    inwardOrders.map((row) => [String(row.customer_order_id), row])
  );
  return qcRows.map((row) => {
    const inward = inwardById.get(String(row.customer_order_id));
    return {
      ...row,
      supplier_name: row.supplier_name || inward?.supplier_name || inward?.supplier_code,
      inward_quantity_kg: row.inward_quantity_kg ?? inward?.inward_quantity_kg
    };
  });
}

export function buildAcStockDetailBundle({
  dashboard,
  inwardOrders = [],
  qcRows = [],
  kilnLots = [],
  finishedGoods = [],
  screeningRows = [],
  impurityFields = null
}) {
  const enrichedQc = enrichQcWithInward(qcRows, inwardOrders);
  const fields = impurityFields?.length ? impurityFields : DEFAULT_IMPURITY_FIELDS;
  return {
    stages: buildAcFlowStages(dashboard),
    charcoal: buildCharcoalStockChart(inwardOrders),
    gcharcoal: buildGcharcoalStockChart(kilnLots, inwardOrders),
    exkilnPipeline: buildExkilnPipelineChart(dashboard?.lot_lines || []),
    grades: buildGradeWiseStock(
      finishedGoods,
      dashboard?.lot_lines || [],
      screeningRows,
      dashboard?.grade_stock || []
    ),
    impurities: buildImpuritiesChart(enrichedQc, fields),
    impurityColors: buildImpurityColors(fields),
    impuritySeries: fields.map((f) => f.series)
  };
}

export function buildAcYieldDetailBundle({ dashboard, qcRows = [], kilnLots = [], inwardOrders = [] }) {
  const yieldSummary = dashboard?.yield_summary || {};
  const yieldPct = yieldSummary.average_yield_pct != null ? num(yieldSummary.average_yield_pct) : null;
  const rmsLoss = buildRmsLossLast30(enrichQcWithInward(qcRows, inwardOrders));
  const kilnYield = buildKilnYieldSeries(dashboard, kilnLots, dashboard?.lot_lines || []);

  return {
    yieldPct,
    processLoss: yieldPct != null ? Math.max(0, 100 - yieldPct) : null,
    rmsLoss,
    kilnYield,
    lotCount: num(yieldSummary.lot_count),
    totalLotKg: num(yieldSummary.total_lot_quantity)
  };
}
