import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState
} from "react";

import api, { formatApiError } from "../services/api";
import { isActivatedCarbonShell } from "../config/legacyApiGuard";
import {
  buildInitialCaptureValues,
  captureFieldKey,
  normalizeCaptureTemplatePayload,
  submitWorkOrderCaptures,
  validateCaptureValues
} from "../utils/dataCaptureHelpers";
import { sortBySequence } from "../utils/sequenceHelpers";

const WorkOrderCaptureForm = forwardRef(function WorkOrderCaptureForm(
  {
    workOrderId,
    capturedBy = "",
    captureStage = "execution",
    theme = "mes",
    title = "Operation data capture",
    subtitle = "Enter actual values for each parameter defined on this operation.",
    showSubmitButton = true,
    readOnly = false,
    onSaved
  },
  ref
) {
  const [templates, setTemplates] = useState([]);
  const [values, setValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState("");

  const isWorkflow = theme === "workflow";
  const labelClass = isWorkflow
    ? "mb-1 block text-xs font-semibold uppercase tracking-wide text-white"
    : "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";
  const hintClass = isWorkflow ? "mt-1 text-xs text-slate-300" : "mt-1 text-xs opacity-60";
  const booleanLabelClass = isWorkflow
    ? "flex items-center gap-2 text-sm text-white"
    : "flex items-center gap-2 text-sm text-slate-700";
  const inputClass = isWorkflow
    ? "wf-input text-slate-900 bg-white"
    : "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const errInputClass = isWorkflow
    ? "wf-input border-red-400/60 bg-red-500/10 text-slate-900"
    : "w-full rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm";

  const loadTemplate = async (id = workOrderId) => {
    if (!id?.trim()) {
      setTemplates([]);
      setValues({});
      return;
    }

    if (isActivatedCarbonShell()) {
      setTemplates([]);
      setValues({});
      setLoadError("");
      return;
    }

    setLoading(true);
    setLoadError("");
    setSubmitError("");
    setSuccess("");
    setFieldErrors({});

    try {
      const res = await api.get(`/work-orders/${id.trim()}/data-capture-template`);
      const blocks = normalizeCaptureTemplatePayload(res.data, { captureStage });
      setTemplates(blocks);
      setValues(buildInitialCaptureValues(blocks));
    } catch (e) {
      setTemplates([]);
      setValues({});
      setLoadError(formatApiError(e, "Could not load capture parameters"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workOrderId?.trim()) {
      void loadTemplate(workOrderId);
    } else {
      setTemplates([]);
      setValues({});
      setLoadError("");
    }
  }, [workOrderId, captureStage]);

  const setValue = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const runValidation = () => {
    const errors = validateCaptureValues(templates, values);
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitCapture = async () => {
    if (isActivatedCarbonShell()) {
      return true;
    }
    if (!workOrderId?.trim()) {
      setSubmitError("Work order ID is required.");
      return false;
    }
    if (!templates.length) {
      return true;
    }
    if (!runValidation()) {
      setSubmitError("Fix validation errors before saving.");
      return false;
    }

    setSubmitting(true);
    setSubmitError("");
    setSuccess("");

    try {
      await submitWorkOrderCaptures(workOrderId, templates, values, capturedBy);
      setSuccess("Capture values saved.");
      onSaved?.();
      return true;
    } catch (e) {
      setSubmitError(formatApiError(e, "Failed to save capture values"));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  useImperativeHandle(ref, () => ({
    hasTemplates: templates.length > 0,
    loading,
    validate: runValidation,
    submit: submitCapture,
    reload: () => loadTemplate(workOrderId)
  }));

  const renderFieldInput = (tpl, field) => {
    const key = captureFieldKey(tpl.template_id, field);
    const err = fieldErrors[key];
    const commonClass = err ? errInputClass : inputClass;
    const disabled = readOnly;

    switch (field.field_type) {
      case "number":
        return (
          <input
            type="number"
            className={commonClass}
            value={values[key] ?? ""}
            disabled={disabled}
            onChange={(e) => setValue(key, e.target.value)}
          />
        );
      case "date":
        return (
          <input
            type="date"
            className={commonClass}
            value={values[key] ?? ""}
            disabled={disabled}
            onChange={(e) => setValue(key, e.target.value)}
          />
        );
      case "boolean":
        return (
          <label className={booleanLabelClass}>
            <input
              type="checkbox"
              checked={!!values[key]}
              disabled={disabled}
              onChange={(e) => setValue(key, e.target.checked)}
            />
            {field.field_label || field.field_name}
          </label>
        );
      case "dropdown": {
        const options = String(field.dropdown_values || "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        return (
          <select
            className={commonClass}
            value={values[key] ?? ""}
            disabled={disabled}
            onChange={(e) => setValue(key, e.target.value)}
          >
            <option value="">— Select —</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      }
      default:
        return (
          <input
            type="text"
            className={commonClass}
            value={values[key] ?? ""}
            disabled={disabled}
            onChange={(e) => setValue(key, e.target.value)}
          />
        );
    }
  };

  const fieldCount = useMemo(
    () => templates.reduce((n, tpl) => n + (tpl.fields?.length || 0), 0),
    [templates]
  );

  if (!workOrderId?.trim()) return null;

  if (loading) {
    return (
      <div className={isWorkflow ? "text-xs text-slate-400 py-2" : "text-sm text-slate-500 py-2"}>
        Loading capture parameters…
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className={
          isWorkflow
            ? "rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        }
      >
        {loadError}
      </div>
    );
  }

  if (!templates.length) {
    return (
      <div className={isWorkflow ? "text-xs text-slate-200 py-1" : "text-sm text-slate-500 py-1"}>
        No capture parameters defined for this operation.
        <span className={`block mt-1 ${isWorkflow ? "text-slate-300" : "opacity-80"}`}>
          Define them in Route Entry for the linked process, then re-save the routing.
        </span>
      </div>
    );
  }

  return (
    <div className={isWorkflow ? "space-y-4" : "space-y-4"}>
      {readOnly && (
        <div
          className={
            isWorkflow
              ? "rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
              : "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          }
        >
          Start this operation to enter values. Parameters below will be required on complete.
        </div>
      )}
      {!isWorkflow && (
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      )}
      {isWorkflow && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white font-semibold">
            {title}
          </div>
          <div className="text-xs text-slate-200 mt-1">{subtitle}</div>
        </div>
      )}

      {templates.map((tpl) => (
        <div
          key={tpl.template_id || tpl.template_name}
          className={
            isWorkflow
              ? "rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 space-y-3"
              : "rounded-lg border border-slate-200 bg-white p-4 space-y-3"
          }
        >
          <div className={isWorkflow ? "text-sm font-semibold text-white" : "text-sm font-semibold text-slate-800"}>
            {tpl.template_name}
          </div>
          {sortBySequence(tpl.fields || [], "field_sequence").map((field) => {
            const key = captureFieldKey(tpl.template_id, field);
            const err = fieldErrors[key];
            if (field.field_type === "boolean") {
              return (
                <div key={key}>
                  {renderFieldInput(tpl, field)}
                  {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
                </div>
              );
            }
            return (
              <div key={key}>
                <label className={`${labelClass} flex items-center gap-2`}>
                  <span className={isWorkflow ? "font-mono text-cyan-200" : "font-mono text-[#08264a]"}>
                    {field.field_sequence}
                  </span>
                  <span className={isWorkflow ? "text-white normal-case" : ""}>
                    {field.field_label || field.field_name}
                  </span>
                  {field.is_mandatory && <span className="text-red-300">*</span>}
                  {field.unit_of_measure && (
                    <span className={`normal-case ${isWorkflow ? "text-slate-300" : "opacity-70"}`}>
                      ({field.unit_of_measure})
                    </span>
                  )}
                </label>
                {renderFieldInput(tpl, field)}
                {field.field_type === "number" &&
                  (field.min_value != null || field.max_value != null) && (
                    <p className={hintClass}>
                      Range: {field.min_value ?? "—"} to {field.max_value ?? "—"}
                    </p>
                  )}
                {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
              </div>
            );
          })}
        </div>
      ))}

      {showSubmitButton && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={
              isWorkflow
                ? "wf-btn wf-btn-primary"
                : "rounded-lg bg-[#08264a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#103a6b] disabled:opacity-50"
            }
            disabled={submitting}
            onClick={() => void submitCapture()}
          >
            {submitting ? "Saving…" : "Save Capture Values"}
          </button>
          <span className={isWorkflow ? "text-xs text-slate-300" : "text-xs text-slate-500"}>
            {fieldCount} parameter(s)
          </span>
        </div>
      )}

      {submitError && (
        <div
          className={
            isWorkflow
              ? "rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 whitespace-pre-line"
              : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line"
          }
        >
          {submitError}
        </div>
      )}
      {success && showSubmitButton && (
        <div
          className={
            isWorkflow
              ? "rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200"
              : "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          }
        >
          {success}
        </div>
      )}
    </div>
  );
});

export default WorkOrderCaptureForm;
