import { useEffect, useState } from "react";

import { fetchAcYieldAnalysis } from "../../../services/activatedCarbonApi";
import { SectionHeader, WfCard, WfCardBody, KpiTile } from "../../../workflow/ui";

function YieldAnalysisPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setData(await fetchAcYieldAnalysis());
      } catch (e) {
        setError(e?.message || "Failed to load yield analysis");
      }
    })();
  }, []);

  return (
    <div className="max-w-5xl">
      <SectionHeader
        eyebrow="Analytics"
        title="Yield Analysis"
        subtitle="Compare input mass, activated output, and recovery by kiln and period."
      />
      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KpiTile label="Planned Mass" value={data?.total_planned_quantity ?? "—"} />
        <KpiTile label="Lot Mass" value={data?.total_lot_quantity ?? "—"} />
        <KpiTile label="Yield %" value={data?.average_yield_pct != null ? `${data.average_yield_pct}%` : "—"} />
      </div>
      <WfCard>
        <WfCardBody>
          <p className="text-sm text-slate-600">
            {data
              ? `${data.lot_count} lots tracked for ${data.industry_template_code}.`
              : "Loading yield from /api/activated-carbon/yield-analysis…"}
          </p>
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default YieldAnalysisPage;
