import { useEffect, useState } from "react";

import {
  AC_DEMO_LOT_COMPLETE,
  fetchAcTraceability
} from "../../../services/activatedCarbonApi";
import BatchTraceabilityView from "../components/BatchTraceabilityView";
import { SectionHeader, WfCard, WfCardBody } from "../../../workflow/ui";

function traceToSteps(data) {
  if (!data?.nodes?.length) return undefined;
  return data.nodes.map((n) => ({
    stage: n.node_type,
    ref: n.node_id,
    detail: n.label || n.node_type
  }));
}

function TraceabilityPage() {
  const [lotCode, setLotCode] = useState(AC_DEMO_LOT_COMPLETE);
  const [trace, setTrace] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!lotCode) return;
    (async () => {
      try {
        setError("");
        setTrace(await fetchAcTraceability(lotCode));
      } catch (e) {
        setError(e?.message || "Traceability load failed");
        setTrace(null);
      }
    })();
  }, [lotCode]);

  return (
    <div className="max-w-5xl">
      <SectionHeader
        eyebrow="Genealogy"
        title="Batch Traceability"
        subtitle="Follow raw material lots through activation, screening, and dispatch."
      />
      <div className="mb-4 flex items-center gap-2 text-sm">
        <label htmlFor="lot-code" className="text-slate-600">Lot:</label>
        <input
          id="lot-code"
          className="border rounded px-2 py-1 font-mono"
          value={lotCode}
          onChange={(e) => setLotCode(e.target.value)}
        />
      </div>
      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
      <WfCard>
        <WfCardBody>
          <BatchTraceabilityView trace={traceToSteps(trace)} />
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default TraceabilityPage;
