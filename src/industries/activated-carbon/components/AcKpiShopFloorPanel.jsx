import { useEffect, useMemo, useState } from "react";

import {
  fetchAcFinishedGoodsStock,
  fetchAcKilnFeedLots,
  fetchAcRawMaterialInward,
  fetchAcRawMaterialQc,
  fetchAcScreening
} from "../../../services/activatedCarbonApi";
import { buildAcIsa95KpisFromDashboard, computeAcStockBuckets, getAcKpisByLevel } from "../constants/acIsa95Kpis";
import useAcOntologyConfig from "../hooks/useAcOntologyConfig";
import {
  buildAcStockDetailBundle,
  buildCharcoalSimpleBars
} from "../utils/acStockAnalytics";
import { getImpurityChartConfig } from "../utils/acOntologyConfigStore";
import AcGradeStockAlert from "../components/AcGradeStockAlert";
import AcDispatchSummary from "../components/AcDispatchSummary";
import {
  AcCharcoalStockChart,
  AcFlowStageBar,
  AcGcharcoalStockChart,
  AcGradeWiseStockChart,
  AcImpuritiesChart,
  AcSimpleVerticalBarChart
} from "./AcProductionStockCharts";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function formatHeadline(value, unit) {
  if (value === "—" || value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (unit === "%") return `${n.toFixed(1)}%`;
  if (unit === "kg") return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
  return n.toLocaleString();
}

function StockPanel({ title, children, className = "" }) {
  return (
    <div
      className={`rounded-xl border border-slate-600/40 bg-slate-800/30 flex flex-col min-h-[360px] ${className}`}
    >
      <div className="px-4 py-3 border-b border-slate-600/30 bg-slate-900/40">
        <h3 className="text-base font-semibold text-slate-50">{title}</h3>
      </div>
      <div className="flex-1 p-4 min-h-0">{children}</div>
    </div>
  );
}

function KpiHeadlineTile({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-600/40 bg-slate-800/40 px-4 py-3 text-center">
      <div className="text-xs text-slate-400 leading-snug">{label}</div>
      <div className="text-2xl font-bold text-slate-50 tabular-nums mt-1">{value}</div>
      {hint ? <div className="text-[11px] text-slate-500 mt-1">{hint}</div> : null}
    </div>
  );
}

function AcKpiShopFloorPanel({ dashboard, readOnly = false }) {
  const { config: ontologyConfig } = useAcOntologyConfig();
  const impurityFields = useMemo(() => getImpurityChartConfig(ontologyConfig), [ontologyConfig]);

  const [detail, setDetail] = useState(null);
  const [charcoalBars, setCharcoalBars] = useState([]);
  const [loading, setLoading] = useState(false);

  const headlines = useMemo(() => {
    const kpis = buildAcIsa95KpisFromDashboard(dashboard);
    const byId = Object.fromEntries(getAcKpisByLevel(kpis, "L1").map((k) => [k.id, k]));
    const lotLines = dashboard?.lot_lines || [];
    const lotsInKiln = lotLines.filter(
      (row) => String(row.status || "").toUpperCase() === "IN_PROGRESS"
    ).length;
    const kilnsRunning = (dashboard?.kilns || []).filter(
      (k) => String(k.status || "").toUpperCase() === "RUNNING"
    ).length;
    const activeLines = Math.max(lotsInKiln, kilnsRunning);
    const dispatchCount = Number(dashboard?.dispatch_count || 0);
    const dispatchedKg = Number(dashboard?.dispatched_kg_total || 0);
    const buckets = computeAcStockBuckets(dashboard);
    const inStockKg = buckets.finalGradeStock;
    const yieldVal =
      dashboard?.yield_summary?.average_yield_pct != null
        ? Number(dashboard.yield_summary.average_yield_pct)
        : byId["ac-yield-pct"]?.value;

    return [
      {
        label: "Plant yield",
        value:
          yieldVal === "—" || yieldVal == null
            ? "—"
            : formatHeadline(yieldVal, "%"),
        hint: "FG output ÷ raw charged (when stocked)"
      },
      {
        label: "Lines running",
        value: activeLines > 0 ? `${activeLines} active` : "Idle",
        hint:
          lotsInKiln > 0
            ? `${lotsInKiln} lot(s) on kiln`
            : kilnsRunning > 0
              ? `${kilnsRunning} kiln(s) running`
              : "No kiln charge in progress"
      },
      {
        label: "FG in stock",
        value: formatHeadline(inStockKg, "kg"),
        hint: "Available for customer PO / dispatch"
      },
      {
        label: "Dispatched",
        value:
          dispatchCount > 0
            ? `${formatHeadline(dispatchedKg, "kg")} · ${dispatchCount} load${dispatchCount === 1 ? "" : "s"}`
            : "None yet",
        hint: "Shipped to customers — reduces in-stock"
      }
    ];
  }, [dashboard]);

  useEffect(() => {
    if (!dashboard) {
      setDetail(null);
      setCharcoalBars([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [inward, qc, kilnLots, finishedGoods, screening] = await Promise.all([
          fetchAcRawMaterialInward().catch(() => []),
          fetchAcRawMaterialQc().catch(() => []),
          fetchAcKilnFeedLots().catch(() => []),
          fetchAcFinishedGoodsStock().catch(() => []),
          fetchAcScreening().catch(() => [])
        ]);
        if (cancelled) return;
        setDetail(
          buildAcStockDetailBundle({
            dashboard,
            inwardOrders: inward,
            qcRows: qc,
            kilnLots,
            finishedGoods,
            screeningRows: screening,
            impurityFields
          })
        );
        setCharcoalBars(buildCharcoalSimpleBars(inward));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dashboard, impurityFields]);

  const charcoalDisplay = useMemo(() => {
    if (charcoalBars.length) return charcoalBars;
    const stage = detail?.stages?.find((s) => s.id === "charcoal");
    if (stage && Number(stage.value) > 0) {
      return [{ name: "Charcoal stock", total: Number(stage.value) }];
    }
    return [];
  }, [charcoalBars, detail]);

  const useSimpleCharcoal = charcoalDisplay.length <= 3;

  return (
    <WfCard>
      <WfCardHeader
        title="Production & stock"
        subtitle="Stock levels and quality at a glance — same view as the plant floor board"
        icon={<IconStock />}
      />
      <WfCardBody className="space-y-5">
        {!dashboard || loading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading production stock…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {headlines.map((tile) => (
                <KpiHeadlineTile key={tile.label} label={tile.label} value={tile.value} hint={tile.hint} />
              ))}
            </div>

            <AcGradeStockAlert
              gradeStock={dashboard?.grade_stock || []}
              openOrders={dashboard?.open_customer_orders || []}
              readOnly={readOnly}
            />

            <AcDispatchSummary dashboard={dashboard} readOnly={readOnly} />

            {detail?.stages?.length ? (
              <div>
                <p className="text-xs text-slate-400 mb-2">Stock by process stage (kg)</p>
                <AcFlowStageBar stages={detail.stages} />
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <StockPanel title="Charcoal stock" className="lg:col-span-5">
                {useSimpleCharcoal ? (
                  <AcSimpleVerticalBarChart
                    data={charcoalDisplay}
                    categoryKey="name"
                    dataKey="total"
                    barColor="#fb923c"
                    emptyMessage="No charcoal in stock yet — record a supplier inward."
                  />
                ) : (
                  <AcCharcoalStockChart chart={detail?.charcoal} />
                )}
              </StockPanel>

              <StockPanel title="GC stock" className="lg:col-span-5">
                {detail?.gcharcoal?.data?.length ? (
                  <AcGcharcoalStockChart chart={detail.gcharcoal} />
                ) : detail?.exkilnPipeline?.data?.length ? (
                  <>
                    <p className="text-[11px] text-slate-400 mb-2">
                      No lots awaiting kiln — kiln / shop-floor WIP by lot (matches Exkiln KPI).
                    </p>
                    <AcSimpleVerticalBarChart
                      data={detail.exkilnPipeline.data}
                      categoryKey="name"
                      dataKey="total"
                      barColor="#38bdf8"
                      emptyMessage="No material on kiln."
                    />
                  </>
                ) : (
                  <AcGcharcoalStockChart chart={detail?.gcharcoal} />
                )}
              </StockPanel>

              <StockPanel title="Grade-wise stock" className="lg:col-span-2">
                <AcGradeWiseStockChart grades={detail?.grades || []} />
              </StockPanel>
            </div>

            {impurityFields.length > 0 ? (
              <StockPanel title="Impurities by inward" className="min-h-0">
                <AcImpuritiesChart
                  rows={detail?.impurities || []}
                  colors={detail?.impurityColors}
                  seriesKeys={detail?.impuritySeries}
                />
              </StockPanel>
            ) : null}
          </>
        )}
      </WfCardBody>
    </WfCard>
  );
}

function IconStock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7 12 3l9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
    </svg>
  );
}

export default AcKpiShopFloorPanel;
