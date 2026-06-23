import { useEffect, useMemo, useState } from "react";

import {
  buildAcIsa95KpisFromDashboard,
  getAcChildKpis,
  getAcKpiById,
  getAcKpisByLevel
} from "../constants/acIsa95Kpis";
import {
  fetchAcFinishedGoodsStock,
  fetchAcKilnFeedLots,
  fetchAcRawMaterialInward,
  fetchAcRawMaterialQc,
  fetchAcScreening
} from "../../../services/activatedCarbonApi";
import {
  buildAcStockDetailBundle,
  buildAcYieldDetailBundle
} from "../utils/acStockAnalytics";
import {
  AcKpiBarBreakdown,
  AcKpiDetailMetrics,
  AcKpiExecutivePie,
  buildChartSlices,
  buildExecutiveSlices,
  stockSliceColors
} from "./AcKpiMetricChart";
import { AcProductionStockPanel, AcYieldAnalyticsPanel } from "./AcProductionStockCharts";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function formatKpiValue(kpi) {
  if (kpi.value === "—" || kpi.value == null) return "—";
  const n = Number(kpi.value);
  if (!Number.isFinite(n)) return String(kpi.value);
  if (kpi.unit === "%") return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (kpi.unit === "kg") return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString();
}

function AcIsa95KpiPanel({ dashboard, variant = "full" }) {
  const isSidebar = variant === "sidebar";
  const kpis = useMemo(() => buildAcIsa95KpisFromDashboard(dashboard), [dashboard]);
  const [l1DrillId, setL1DrillId] = useState(null);
  const [l2DrillId, setL2DrillId] = useState(null);

  const l1Kpis = getAcKpisByLevel(kpis, "L1");
  const l1Parent = l1DrillId ? getAcKpiById(kpis, l1DrillId) : null;
  const l2Kpis = l1Parent ? getAcChildKpis(kpis, l1Parent.id) : [];
  const l2Parent = l2DrillId ? getAcKpiById(kpis, l2DrillId) : null;
  const l3Kpis = l2Parent ? getAcChildKpis(kpis, l2Parent.id) : [];

  const executiveSlices = useMemo(() => buildExecutiveSlices(l1Kpis), [l1Kpis]);

  const pieCenter = useMemo(() => {
    const keyKpi = l1Kpis.find((k) => k.id === "ac-yield-pct") || l1Kpis[0];
    if (!keyKpi) return { label: "Key KPI", value: "—" };
    const value =
      keyKpi.unit === "%"
        ? `${formatKpiValue(keyKpi)}%`
        : keyKpi.unit === "kg"
          ? `${formatKpiValue(keyKpi)} kg`
          : formatKpiValue(keyKpi);
    return {
      label: keyKpi.title,
      value
    };
  }, [l1Kpis]);

  const l2Slices = useMemo(() => {
    if (!l2Kpis.length) return [];
    if (l1Parent?.id === "ac-material-flow") return stockSliceColors(l2Kpis);
    if (l1Parent?.id === "ac-yield-pct") {
      const y = Number(l1Parent.value);
      if (!Number.isFinite(y)) return buildChartSlices(l2Kpis);
      return [
        { id: "yield-slice", name: "Recovered yield", value: y, unit: "%", color: "#34d399" },
        { id: "loss-slice", name: "Process loss", value: Math.max(0, 100 - y), unit: "%", color: "#475569" }
      ];
    }
    return buildChartSlices(l2Kpis);
  }, [l2Kpis, l1Parent]);

  const l2Center =
    l1Parent?.unit === "%" && l1Parent.value !== "—"
      ? { label: l1Parent.title, value: `${formatKpiValue(l1Parent)}%` }
      : l1Parent?.unit === "kg"
        ? { label: "Total WIP", value: formatKpiValue(l1Parent) }
        : null;

  const openL2 = (kpiId) => {
    setL1DrillId(kpiId);
    setL2DrillId(null);
  };

  const closeModals = () => {
    setL1DrillId(null);
    setL2DrillId(null);
  };

  const showL3Modal = Boolean(l2DrillId && l3Kpis.length > 0);
  const showL2Modal = Boolean(l1DrillId && !showL3Modal);

  const [stockDetail, setStockDetail] = useState(null);
  const [yieldDetail, setYieldDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!showL2Modal || !l1Parent) {
      setStockDetail(null);
      setYieldDetail(null);
      setDetailLoading(false);
      return;
    }

    const needsStock = l1Parent.id === "ac-material-flow";
    const needsYield = l1Parent.id === "ac-yield-pct";
    if (!needsStock && !needsYield) {
      setStockDetail(null);
      setYieldDetail(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const [inward, qc, kilnLots, finishedGoods, screening] = await Promise.all([
          fetchAcRawMaterialInward().catch(() => []),
          fetchAcRawMaterialQc().catch(() => []),
          fetchAcKilnFeedLots().catch(() => []),
          fetchAcFinishedGoodsStock().catch(() => []),
          fetchAcScreening().catch(() => [])
        ]);
        if (cancelled) return;
        if (needsStock) {
          setStockDetail(
            buildAcStockDetailBundle({
              dashboard,
              inwardOrders: inward,
              qcRows: qc,
              kilnLots,
              finishedGoods,
              screeningRows: screening
            })
          );
          setYieldDetail(null);
        } else {
          setYieldDetail(buildAcYieldDetailBundle({ dashboard, qcRows: qc, kilnLots, inwardOrders: inward }));
          setStockDetail(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showL2Modal, l1Parent?.id, dashboard]);

  const openL3FromSlice = (slice) => {
    const kpi = l2Kpis.find((row) => row.id === slice?.id);
    if (kpi?.drillTo?.length) setL2DrillId(kpi.id);
  };

  const renderL2View = () => {
    if (l1Parent?.id === "ac-yield-pct") {
      return (
        <AcYieldAnalyticsPanel
          detail={yieldDetail}
          loading={detailLoading}
          yieldPct={l1Parent.value}
          slices={l2Slices}
        />
      );
    }
    if (l1Parent?.id === "ac-material-flow") {
      return <AcProductionStockPanel detail={stockDetail} loading={detailLoading} />;
    }
    return (
      <AcKpiBarBreakdown
        slices={l2Slices}
        summaryLabel={l2Center?.label}
        summaryValue={l2Center?.value}
        onRowClick={openL3FromSlice}
      />
    );
  };

  const l2ModalWide = l1Parent?.id === "ac-material-flow" || l1Parent?.id === "ac-yield-pct";

  return (
    <>
      <WfCard glow={!isSidebar} className={isSidebar ? "h-full" : undefined}>
        <WfCardHeader
          title="Production KPIs"
          subtitle={isSidebar ? "Key metric in centre — tap slice for detail" : "Click a slice or legend item below the chart to open detail"}
          icon={<IconGauge />}
        />
        <WfCardBody className={isSidebar ? "px-3 py-3" : undefined}>
          <AcKpiExecutivePie
            slices={executiveSlices}
            centerLabel={pieCenter.label}
            centerValue={pieCenter.value}
            size={isSidebar ? 168 : 240}
            compact={isSidebar}
            onSliceClick={(slice) => {
              if (slice?.kpi?.drillTo?.length) openL2(slice.kpi.id);
            }}
          />
        </WfCardBody>
      </WfCard>

      {showL2Modal && l1Parent ? (
        <KpiDrillModal
          title={l1Parent.id === "ac-material-flow" ? "Production & stock" : l1Parent.id === "ac-yield-pct" ? "Yield analytics" : "Process breakdown"}
          subtitle={l1Parent.title}
          onBack={closeModals}
          onClose={closeModals}
          wide={l2ModalWide}
        >
          {renderL2View()}

          {!l2ModalWide ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-700/40">
            {l2Kpis.map((kpi) => {
              const hasL3 = kpi.drillTo?.length > 0;
              return (
                <div
                  key={kpi.id}
                  className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-3 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-slate-200 truncate">{kpi.title}</div>
                    <div className="text-lg font-semibold text-slate-50 tabular-nums">
                      {formatKpiValue(kpi)}
                      <span className="text-xs font-normal text-slate-400 ml-1">{kpi.unit}</span>
                    </div>
                  </div>
                  {hasL3 ? (
                    <button
                      type="button"
                      className="text-xs text-cyan-300 hover:text-cyan-100 whitespace-nowrap shrink-0"
                      onClick={() => setL2DrillId(kpi.id)}
                    >
                      Drill down →
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          ) : null}
        </KpiDrillModal>
      ) : null}

      {showL3Modal && l2Parent && l1Parent ? (
        <KpiDrillModal
          title="Operational detail"
          subtitle={`${l1Parent.title} → ${l2Parent.title}`}
          onBack={() => setL2DrillId(null)}
          onClose={closeModals}
        >
          <AcKpiDetailMetrics
            kpis={l3Kpis}
            parentLabel={l2Parent.title}
            parentValue={`${formatKpiValue(l2Parent)} ${l2Parent.unit}`}
            formatKpiValue={formatKpiValue}
          />
        </KpiDrillModal>
      ) : null}
    </>
  );
}

function KpiDrillModal({ title, subtitle, onBack, onClose, wide = false, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`wf-card wf-card-glow w-full max-h-[92vh] overflow-y-auto ${wide ? "max-w-6xl" : "max-w-2xl"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ac-kpi-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-700/50 bg-slate-900/95 px-5 py-3 backdrop-blur">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-cyan-300/80">{title}</div>
            <h3 id="ac-kpi-modal-title" className="text-base font-semibold text-slate-100 truncate">
              {subtitle}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" className="wf-btn wf-btn-ghost text-xs" onClick={onBack}>
              ← Go back
            </button>
            <button
              type="button"
              className="wf-btn wf-btn-ghost text-xs px-2"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function IconGauge() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4" />
      <path d="m4.93 4.93 2.83 2.83" />
      <path d="M2 12h4" />
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2 2" />
    </svg>
  );
}

export default AcIsa95KpiPanel;
