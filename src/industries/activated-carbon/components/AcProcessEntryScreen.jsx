import { useEffect, useState } from "react";

import {
  AC_PROCESS_STEP_OPTIONS,
  suggestOperationCode
} from "../constants/processSteps";
import {
  defaultExecutionParametersForStep,
  normalizeTripletParameter
} from "../constants/processTripletTemplates";
import AcTripletParameterEditor from "./AcTripletParameterEditor";

import "../styles/rawMaterialFlow.css";

const EMPTY_PROCESS = {
  operation_name: "",
  operation_code: "",
  process_step: "ACTIVATION",
  parameters: []
};

function AcProcessEntryScreen({
  mode = "add",
  initial = null,
  stepNumber = 1,
  chainLength = 0,
  rawMaterialName = "",
  onSave,
  onCancel
}) {
  const [form, setForm] = useState({ ...EMPTY_PROCESS, parameters: [] });
  const [insertAt, setInsertAt] = useState(chainLength + 1);
  const [error, setError] = useState("");
  const [seededDefaults, setSeededDefaults] = useState(false);

  useEffect(() => {
    if (mode === "edit" && initial) {
      const execParams = (initial.parameters || []).filter(
        (p) => (p.used_at || "execution") !== "feasibility"
      );
      setForm({
        operation_name: initial.operation_name || "",
        operation_code: initial.operation_code || "",
        process_step: initial.process_step || "ACTIVATION",
        parameters: execParams.length
          ? execParams.map((p) => normalizeTripletParameter({ ...p, process_step: initial.process_step }))
          : defaultExecutionParametersForStep(initial.process_step)
      });
      setInsertAt(stepNumber);
      setSeededDefaults(false);
    } else {
      const step = "ACTIVATION";
      setForm({
        ...EMPTY_PROCESS,
        process_step: step,
        parameters: defaultExecutionParametersForStep(step)
      });
      setInsertAt(chainLength + 1);
      setSeededDefaults(true);
    }
    setError("");
  }, [mode, initial, stepNumber, chainLength]);

  const updateField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "process_step") {
        const step = String(value || "").toUpperCase();
        const opt = AC_PROCESS_STEP_OPTIONS.find((o) => o.value === step);
        if (opt && !prev.operation_name.trim()) {
          next.operation_name = opt.label;
        }
        if (!prev.operation_code.trim() || prev.operation_code.startsWith("OP-")) {
          next.operation_code = suggestOperationCode(step, insertAt);
        }
        if (mode === "add" && (seededDefaults || !prev.parameters?.length)) {
          next.parameters = defaultExecutionParametersForStep(step);
          setSeededDefaults(true);
        }
      }
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!form.operation_name.trim()) {
      setError("Process name is required.");
      return;
    }

    const processStep = (form.process_step || "").trim().toUpperCase();
    const executionParams = (form.parameters || []).filter((p) => p.key?.trim() && p.label?.trim());

    if (!executionParams.length) {
      setError(
        "Add at least one execution triplet parameter — fields required when this process runs on the shop floor."
      );
      return;
    }

    for (const p of executionParams) {
      if (!p.ontology_predicate && !p.predicate_uri?.startsWith("urn:")) {
        setError(`Parameter "${p.label || p.key}" needs a triplet predicate.`);
        return;
      }
    }

    const parameters = executionParams.map((p) =>
      normalizeTripletParameter({ ...p, process_step: processStep, used_at: "execution" })
    );

    onSave?.({
      operation_name: form.operation_name.trim(),
      operation_code: (form.operation_code || suggestOperationCode(processStep, insertAt)).trim(),
      process_step: processStep,
      insertAt: Number(insertAt) || 1,
      parameters
    });
  };

  const positionOptions =
    mode === "edit"
      ? [{ value: stepNumber, label: `Step ${stepNumber} (current)` }]
      : Array.from({ length: chainLength + 1 }, (_, i) => ({
          value: i + 1,
          label: i === chainLength ? `After step ${chainLength} (end)` : `Before step ${i + 1}`
        }));

  return (
    <div className="ac-process-entry-screen ac-process-entry-screen--wide wf-light-panel">
      <div className="ac-process-entry-screen-header">
        <button type="button" className="ac-process-entry-back" onClick={onCancel}>
          ← Back to routing flow
        </button>
        <h3 className="text-base font-semibold text-slate-900">
          {mode === "edit" ? `Edit process P${stepNumber}` : `Add process P${chainLength + 1}`}
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {rawMaterialName ? (
            <>
              Raw material: <strong>{rawMaterialName}</strong> — define shop-floor execution
              triplets for this step.
            </>
          ) : (
            "Define shop-floor execution triplets (Subject → Predicate → Object) for this process step."
          )}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="ac-process-entry-form">
        <div className="ac-process-entry-grid">
          <label className="text-sm block">
            <span className="block mb-1 font-medium text-slate-700">Process name</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={form.operation_name}
              onChange={(e) => updateField("operation_name", e.target.value)}
              placeholder="e.g. Steam Activation"
              autoFocus
            />
          </label>

          <label className="text-sm block">
            <span className="block mb-1 font-medium text-slate-700">Process type</span>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={form.process_step}
              onChange={(e) => updateField("process_step", e.target.value)}
            >
              {AC_PROCESS_STEP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm block">
            <span className="block mb-1 font-medium text-slate-700">Operation code</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
              value={form.operation_code}
              onChange={(e) => updateField("operation_code", e.target.value)}
              placeholder="e.g. OP-ACTIVATION"
            />
          </label>

          {mode === "add" ? (
            <label className="text-sm block">
              <span className="block mb-1 font-medium text-slate-700">Position in chain</span>
              <select
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={insertAt}
                onChange={(e) => setInsertAt(Number(e.target.value))}
              >
                {positionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <AcTripletParameterEditor
          parameters={form.parameters || []}
          processStep={form.process_step}
          onChange={(parameters) => {
            setSeededDefaults(false);
            setForm((prev) => ({ ...prev, parameters }));
          }}
        />

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-[#08264a] text-white px-4 py-2 text-sm font-medium hover:bg-[#0c3d6e]"
          >
            {mode === "edit" ? "Update process & triplets" : "Add process to routing"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default AcProcessEntryScreen;
