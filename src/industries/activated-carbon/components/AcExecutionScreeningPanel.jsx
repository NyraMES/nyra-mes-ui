import { forwardRef, useImperativeHandle, useState } from "react";

/**
 * Screening capture embedded in the SCREENING execution step.
 */
const AcExecutionScreeningPanel = forwardRef(function AcExecutionScreeningPanel(
  { readOnly = false },
  ref
) {
  const [meshSize, setMeshSize] = useState("8x30");
  const [goodKg, setGoodKg] = useState("");
  const [oversKg, setOversKg] = useState("");
  const [finesKg, setFinesKg] = useState("");

  useImperativeHandle(
    ref,
    () => ({
      validate() {
        if (readOnly) return true;
        return goodKg !== "" && !Number.isNaN(Number(goodKg)) && Number(goodKg) >= 0;
      },
      getPayload() {
        return {
          mesh_size: meshSize,
          good_kg: goodKg !== "" ? Number(goodKg) : undefined,
          overs_kg: oversKg !== "" ? Number(oversKg) : undefined,
          fines_kg: finesKg !== "" ? Number(finesKg) : undefined
        };
      }
    }),
    [readOnly, meshSize, goodKg, oversKg, finesKg]
  );

  return (
    <div className="rounded-xl border border-cyan-400/20 bg-slate-900/50 p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold text-slate-100">Screening classification</div>
        <div className="text-xs text-slate-400 mt-0.5">
          Record mesh size and good / overs / fines fractions for this lot.
        </div>
      </div>
      {readOnly ? (
        <p className="text-xs text-amber-200/90 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2">
          This step is complete — values are read-only.
        </p>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm md:col-span-2">
          <span className="wf-label">Mesh size</span>
          <input
            className="wf-input"
            value={meshSize}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setMeshSize(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="wf-label">Good fraction (KG)</span>
          <input
            type="number"
            min="0"
            className="wf-input"
            value={goodKg}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setGoodKg(e.target.value)}
            placeholder="Required"
          />
        </label>
        <label className="text-sm">
          <span className="wf-label">Overs (KG)</span>
          <input
            type="number"
            min="0"
            className="wf-input"
            value={oversKg}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setOversKg(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="wf-label">Fines (KG)</span>
          <input
            type="number"
            min="0"
            className="wf-input"
            value={finesKg}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setFinesKg(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
});

export default AcExecutionScreeningPanel;
