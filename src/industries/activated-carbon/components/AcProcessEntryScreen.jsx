import { useEffect, useState } from "react";

import {
  AC_INBOUND_PROCESS_STEP_OPTIONS,
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
  process_step: "KILN_FEED",
  is_mandatory: true,
  parameters: []
};

function lockedInboundChoice(stepOptions, stepChoice, operationCode) {
  const byChoice = stepOptions.find((opt) => opt.value === stepChoice && opt.operationCode);
  if (byChoice) return byChoice;
  const code = String(operationCode || "").toUpperCase();
  return stepOptions.find((opt) => opt.operationCode && opt.operationCode === code) || null;
}

function AcProcessEntryScreen({
  mode = "add",
  phase = "shop",
  initial = null,
  stepNumber = 1,
  chainLength = 0,
  rawMaterialName = "",
  onSave,
  onCancel
}) {
  const isInbound = phase === "inbound";
  const stepOptions = isInbound ? AC_INBOUND_PROCESS_STEP_OPTIONS : AC_PROCESS_STEP_OPTIONS;
  const defaultStep = isInbound ? "CRUSHING" : "KILN_FEED";
  const usedAt = isInbound ? "inbound" : "execution";
  const codePrefix = isInbound ? "IN-" : "OP-";
  const [form, setForm] = useState({ ...EMPTY_PROCESS, parameters: [] });
  const [insertAt, setInsertAt] = useState(chainLength + 1);
  const [error, setError] = useState("");
  const [seededDefaults, setSeededDefaults] = useState(false);

  useEffect(() => {
    if (mode === "edit" && initial) {
      const execParams = (initial.parameters || []).filter(
        (p) => (p.used_at || usedAt) !== "feasibility"
      );
      const locked = lockedInboundChoice(stepOptions, "", initial.operation_code);
      setForm({
        operation_name: initial.operation_name || "",
        operation_code: locked?.operationCode || initial.operation_code || "",
        process_step: locked?.processStep || initial.process_step || defaultStep,
        step_choice: locked?.value || initial.process_step || defaultStep,
        is_mandatory: initial.is_mandatory !== false,
        parameters: execParams.length
          ? execParams.map((p) =>
              normalizeTripletParameter({
                ...p,
                process_step: initial.process_step,
                used_at: usedAt
              })
            )
          : defaultExecutionParametersForStep(locked?.value || initial.process_step).map((p) => ({
              ...p,
              used_at: usedAt,
              process_step: locked?.processStep || initial.process_step
            }))
      });
      setInsertAt(stepNumber);
      setSeededDefaults(false);
    } else {
      const step = defaultStep;
      setForm({
        ...EMPTY_PROCESS,
        process_step: step,
        step_choice: step,
        parameters: defaultExecutionParametersForStep(step).map((p) => ({
          ...p,
          used_at: usedAt
        }))
      });
      setInsertAt(chainLength + 1);
      setSeededDefaults(true);
    }
    setError("");
  }, [mode, initial, stepNumber, chainLength, defaultStep, usedAt]);

  const updateField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "process_step") {
        const step = String(value || "").toUpperCase();
        const opt = stepOptions.find((o) => o.value === step);
        next.step_choice = step;
        if (opt && !prev.operation_name.trim()) {
          next.operation_name = opt.label;
        }
        if (opt?.operationCode) {
          next.operation_code = opt.operationCode;
          next.process_step = opt.processStep || step;
        } else {
          next.process_step = step;
          if (
            !prev.operation_code.trim() ||
            prev.operation_code.startsWith("OP-") ||
            prev.operation_code.startsWith("IN-")
          ) {
            next.operation_code = `${codePrefix}${step.replace(/[^A-Z0-9]+/g, "-")}`;
          }
        }
        if (mode === "add" && (seededDefaults || !prev.parameters?.length || opt?.operationCode)) {
          next.parameters = defaultExecutionParametersForStep(step).map((p) => ({
            ...p,
            used_at: usedAt,
            process_step: opt?.processStep || step
          }));
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

    const locked = lockedInboundChoice(stepOptions, form.step_choice, form.operation_code);
    const processStep = (locked?.processStep || form.process_step || "").trim().toUpperCase();
    const operationCode = (
      locked?.operationCode ||
      form.operation_code ||
      suggestOperationCode(processStep, insertAt)
    ).trim();
    const executionParams = (form.parameters || []).filter((p) => p.key?.trim() && p.label?.trim());

    if (!executionParams.length) {
      setError("Add at least one field — what should operators record when this step is done?");
      return;
    }

    for (const p of executionParams) {
      if (!p.ontology_predicate && !p.predicate_uri?.startsWith("urn:")) {
        setError(`Field "${p.label || p.key}" needs a predicate — open Technical settings or pick a process type with defaults.`);
        return;
      }
    }

    const parameters = executionParams.map((p) =>
      normalizeTripletParameter({ ...p, process_step: processStep, used_at: usedAt })
    );

    onSave?.({
      operation_name: form.operation_name.trim(),
      operation_code: operationCode,
      process_step: processStep,
      is_mandatory: form.is_mandatory !== false,
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
          ← Back
        </button>
        <h3 className="text-lg font-semibold text-slate-900">
          {mode === "edit" ? `Edit step ${stepNumber}` : `Add step ${chainLength + 1}`}
        </h3>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
          {isInbound ? (
            <>
              For raw material <strong>{rawMaterialName}</strong>. This step runs on{" "}
              <strong>Inbound Execution</strong> after receipt and before raw material QC.
            </>
          ) : rawMaterialName ? (
            <>
              For raw material <strong>{rawMaterialName}</strong>. Choose what happens at this
              stage and which values operators must enter.
            </>
          ) : (
            "Describe this production stage and what shop-floor staff should record."
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
          <label className="text-sm block sm:col-span-2">
            <span className="block mb-1 font-medium text-slate-700">Step name</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.operation_name}
              onChange={(e) => updateField("operation_name", e.target.value)}
              placeholder="e.g. Steam Activation"
              autoFocus
            />
          </label>

          <label className="text-sm block">
            <span className="block mb-1 font-medium text-slate-700">Type of work</span>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.step_choice || form.process_step}
              onChange={(e) => updateField("process_step", e.target.value)}
            >
              {stepOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {mode === "add" ? (
            <label className="text-sm block">
              <span className="block mb-1 font-medium text-slate-700">Where in the line?</span>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
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

          <details className="sm:col-span-2 ac-triplet-technical-details">
            <summary>Advanced codes (optional)</summary>
            <label className="text-sm block mt-3 max-w-md">
              <span className="block mb-1 font-medium text-slate-700">Operation code</span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
                value={form.operation_code}
                onChange={(e) => updateField("operation_code", e.target.value)}
                placeholder="Auto-generated if blank"
              />
            </label>
          </details>
        </div>

        <label className="text-sm block ac-process-mandatory-toggle mb-4">
          <span className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.is_mandatory !== false}
              onChange={(e) => updateField("is_mandatory", e.target.checked)}
            />
            <span>
              <span className="block font-medium text-slate-700">Mandatory process</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                When unchecked, operators may skip this step on{" "}
                {isInbound ? "Inbound Execution" : "Execution"} if it does not apply to this batch.
              </span>
            </span>
          </span>
        </label>

        <AcTripletParameterEditor
          friendlyMode
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
            className="rounded-lg bg-[#08264a] text-white px-5 py-2.5 text-sm font-medium hover:bg-[#0c3d6e]"
          >
            {mode === "edit" ? "Save step" : "Add step to line"}
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
