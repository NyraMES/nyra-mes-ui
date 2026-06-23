import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  fetchAcDashboard,
  fetchAcFinishedGoodsStock,
  fetchAcKilnFeedLots,
  fetchAcRawMaterialInward,
  fetchAcRawMaterialQc,
  fetchAcScreening,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import useAcOntologyConfig from "../hooks/useAcOntologyConfig";
import { getImpurityChartConfig } from "../utils/acOntologyConfigStore";
import {
  buildAcStockDetailBundle,
  buildAcYieldDetailBundle
} from "../utils/acStockAnalytics";
import {
  AcCharcoalStockChart,
  AcFlowStageBar,
  AcGcharcoalStockChart,
  AcGradeWiseStockChart,
  AcImpuritiesChart,
  AcKilnYieldChart,
  AcRmsLossChart
} from "../components/AcProductionStockCharts";
import AcAlert from "../components/AcAlert";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

const REPORT_SECTIONS = [
  { id: "stages", label: "WIP stages", testbedRef: "dashboard/stages" },
  { id: "rms-loss", label: "RMS total loss %", testbedRef: "dashboard/rms-loss-last30" },
  { id: "kiln-yield", label: "Kiln yield", testbedRef: "dashboard/kiln_yield_chart" },
  { id: "grade-stock", label: "Grade-wise stock", testbedRef: "dashboard/gradeinstock" },
  { id: "charcoal", label: "Charcoal stock", testbedRef: "dashboard/rawmaterial" },
  { id: "gcharcoal", label: "GCharcoal stock", testbedRef: "dashboard/gcharcoal" },
  { id: "impurities", label: "Impurities", testbedRef: "dashboard impurities chart" }
];

function AcReportsPage() {
  const { config: ontologyConfig } = useAcOntologyConfig();
  const impurityFields = useMemo(
    () => getImpurityChartConfig(ontologyConfig),
    [ontologyConfig]
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stockDetail, setStockDetail] = useState(null);
  const [yieldDetail, setYieldDetail] = useState(null);
  const [activeSection, setActiveSection] = useState("stages");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [dashboard, inward, qc, kilnLots, finishedGoods, screening] = await Promise.all([
          fetchAcDashboard(),
          fetchAcRawMaterialInward().catch(() => []),
          fetchAcRawMaterialQc().catch(() => []),
          fetchAcKilnFeedLots().catch(() => []),
          fetchAcFinishedGoodsStock().catch(() => []),
          fetchAcScreening().catch(() => [])
        ]);
        if (cancelled) return;
        setStockDetail(
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
        setYieldDetail(
          buildAcYieldDetailBundle({
            dashboard,
            qcRows: qc,
            kilnLots,
            inwardOrders: inward
          })
        );
      } catch (e) {
        if (!cancelled) setError(formatAcApiError(e, "Could not load reports"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [impurityFields]);

  return (
    <div className="max-w-6xl space-y-6">
      <SectionHeader
        eyebrow="Analytics"
        title="Production reports"
        subtitle="Testbed-aligned stock and yield reports — RMS loss, kiln yield, grade stock, and WIP stages."
      />

      <p className="text-sm text-slate-300 max-w-3xl">
        Mirrors the SAM Carbons testbed dashboard report panels. Impurity series follow{" "}
        <Link to="/activated-carbon/masters?tab=ontology-ui" className="text-cyan-300 underline">
          Ontology & UI
        </Link>{" "}
        QC configuration.
      </p>

      {error ? <AcAlert variant="error">{error}</AcAlert> : null}

      <div className="flex flex-wrap gap-2">
        {REPORT_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              activeSection === section.id
                ? "bg-white/15 border-cyan-400/50 text-white"
                : "border-white/15 text-slate-300 hover:text-white hover:bg-white/5"
            }`}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-300 py-8">Loading report data…</p>
      ) : (
        <WfCard>
          <WfCardHeader
            title={REPORT_SECTIONS.find((s) => s.id === activeSection)?.label || "Report"}
            subtitle={`Testbed: ${REPORT_SECTIONS.find((s) => s.id === activeSection)?.testbedRef || ""}`}
          />
          <WfCardBody>
            {activeSection === "stages" && <AcFlowStageBar stages={stockDetail?.stages || []} />}
            {activeSection === "rms-loss" && <AcRmsLossChart bundle={yieldDetail?.rmsLoss} />}
            {activeSection === "kiln-yield" && <AcKilnYieldChart bundle={yieldDetail?.kilnYield} />}
            {activeSection === "grade-stock" && (
              <AcGradeWiseStockChart grades={stockDetail?.grades || []} />
            )}
            {activeSection === "charcoal" && (
              <AcCharcoalStockChart chart={stockDetail?.charcoal} narrow={false} />
            )}
            {activeSection === "gcharcoal" && (
              <AcGcharcoalStockChart chart={stockDetail?.gcharcoal} narrow={false} />
            )}
            {activeSection === "impurities" && (
              <AcImpuritiesChart
                rows={stockDetail?.impurities || []}
                colors={stockDetail?.impurityColors || {}}
                seriesKeys={stockDetail?.impuritySeries || ["Stones", "Unburnt", "Minus20"]}
              />
            )}
          </WfCardBody>
        </WfCard>
      )}
    </div>
  );
}

export default AcReportsPage;
