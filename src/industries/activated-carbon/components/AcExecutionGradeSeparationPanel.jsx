import { forwardRef, useImperativeHandle, useState } from "react";

/**
 * Grade separation capture embedded in the GRADE_SEPARATION execution step.
 */
const AcExecutionGradeSeparationPanel = forwardRef(function AcExecutionGradeSeparationPanel(
  { readOnly = false },
  ref
) {
  const [gradeCode, setGradeCode] = useState("8x30");
  const [separatedKg, setSeparatedKg] = useState("");
  const [gradeYieldPct, setGradeYieldPct] = useState("");
  const [oversKg, setOversKg] = useState("");
  const [finesKg, setFinesKg] = useState("");

  useImperativeHandle(
    ref,
    () => ({
      validate() {
        if (readOnly) return true;
        return (
          gradeCode.trim() !== "" &&
          separatedKg !== "" &&
          !Number.isNaN(Number(separatedKg)) &&
          Number(separatedKg) >= 0
        );
      },
      getPayload() {
        return {
          grade_code: gradeCode.trim(),
          separated_kg: separatedKg !== "" ? Number(separatedKg) : undefined,
          grade_yield_pct: gradeYieldPct !== "" ? Number(gradeYieldPct) : undefined,
          overs_grade_kg: oversKg !== "" ? Number(oversKg) : undefined,
          fines_grade_kg: finesKg !== "" ? Number(finesKg) : undefined
        };
      }
    }),
    [readOnly, gradeCode, separatedKg, gradeYieldPct, oversKg, finesKg]
  );

  return (
    <div className="rounded-xl border border-violet-400/20 bg-slate-900/50 p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold text-slate-100">Grade separation</div>
        <div className="text-xs text-slate-400 mt-0.5">
          Split screened output into product grades (mesh bands) for stock and dispatch.
        </div>
      </div>
      {readOnly ? (
        <p className="text-xs text-amber-200/90 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2">
          This step is complete — values are read-only.
        </p>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm md:col-span-2">
          <span className="wf-label">Product grade</span>
          <input
            className="wf-input"
            value={gradeCode}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setGradeCode(e.target.value)}
            placeholder="e.g. 8x30, 12x40"
          />
        </label>
        <label className="text-sm">
          <span className="wf-label">Grade mass separated (KG)</span>
          <input
            type="number"
            min="0"
            className="wf-input"
            value={separatedKg}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setSeparatedKg(e.target.value)}
            placeholder="Required"
          />
        </label>
        <label className="text-sm">
          <span className="wf-label">Grade yield (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            className="wf-input"
            value={gradeYieldPct}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setGradeYieldPct(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="wf-label">Overs — recycle (KG)</span>
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
          <span className="wf-label">Fines — sub-grade (KG)</span>
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

export default AcExecutionGradeSeparationPanel;
