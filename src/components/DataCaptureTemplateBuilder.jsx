import { useMemo, useState } from "react";

import api, { formatApiError } from "../services/api";
import { emptyTemplateMeta } from "../utils/templateHelpers";
import {
  findDuplicateSequences,
  nextSequence,
  sortBySequence,
  newLocalId
} from "../utils/sequenceHelpers";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "boolean", label: "Boolean" }
];

const CAPTURE_STAGES = ["execution", "during", "setup", "inspection", "closeout"];

export const emptyFieldRow = (fields = []) => ({
  localId: newLocalId(),
  field_sequence: nextSequence(fields, "field_sequence"),
  field_name: "",
  field_label: "",
  field_type: "text",
  unit_of_measure: "",
  is_mandatory: false,
  min_value: "",
  max_value: "",
  dropdown_values: "",
  ontology_property: ""
});

function DataCaptureTemplateBuilder({
  processId,
  templateId: templateIdProp,
  templateMeta: controlledMeta,
  onTemplateMetaChange,
  initialFields = [],
  fields: controlledFields,
  onFieldsChange,
  editOnly = false,
  readOnly = false,
  embedded = false,
  title = "Data Capture Template Builder",
  subtitle = "Define template metadata and ordered capture fields.",
  onSaved
}) {
  const [savedTemplateId, setSavedTemplateId] = useState(templateIdProp || "");
  const templateId = templateIdProp || savedTemplateId;

  const [internalMeta, setInternalMeta] = useState(() =>
    controlledMeta || emptyTemplateMeta()
  );
  const templateMeta = controlledMeta ?? internalMeta;

  const setTemplateMeta = (updater) => {
    const next =
      typeof updater === "function" ? updater(templateMeta) : updater;
    if (onTemplateMetaChange) onTemplateMetaChange(next);
    else setInternalMeta(next);
  };

  const [internalFields, setInternalFields] = useState(() =>
    (controlledFields || initialFields).length
      ? (controlledFields || initialFields).map((f) => ({
          ...f,
          localId: f.localId || newLocalId()
        }))
      : [emptyFieldRow()]
  );
  const fields = controlledFields ?? internalFields;

  const setFields = (updater) => {
    const next = typeof updater === "function" ? updater(fields) : updater;
    if (onFieldsChange) onFieldsChange(next);
    else setInternalFields(next);
  };

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sortedFields = useMemo(
    () => sortBySequence(fields, "field_sequence"),
    [fields]
  );

  const duplicateSequences = useMemo(
    () => findDuplicateSequences(fields, "field_sequence"),
    [fields]
  );

  const updateField = (localId, patch) => {
    setFields((prev) =>
      prev.map((row) => (row.localId === localId ? { ...row, ...patch } : row))
    );
    setError("");
    setSuccess("");
  };

  const addFieldRow = () => {
    setFields((prev) => [...prev, emptyFieldRow(prev)]);
  };

  const removeFieldRow = (localId) => {
    setFields((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.localId !== localId);
    });
  };

  const validateBeforeSubmit = () => {
    if (!processId && !templateId) {
      return "A process must be selected before saving a template.";
    }
    if (!templateMeta.template_name?.trim()) {
      return "Template name is required.";
    }
    if (duplicateSequences.length) {
      return `Duplicate field_sequence values: ${duplicateSequences.join(", ")}`;
    }
    for (const row of sortedFields) {
      if (!row.field_name?.trim()) return "Each field needs a field_name.";
      if (!row.field_label?.trim()) return "Each field needs a field_label.";
      if (Number(row.field_sequence) <= 0) {
        return "field_sequence must be greater than zero.";
      }
    }
    return "";
  };

  const ensureTemplateId = async () => {
    if (templateId) return templateId;
    const res = await api.post(`/processes/${processId}/data-capture-templates`, {
      template_name: templateMeta.template_name.trim(),
      template_sequence: Number(templateMeta.template_sequence) || 10,
      capture_stage: templateMeta.capture_stage || "execution",
      description: templateMeta.description?.trim() || null,
      is_active: true
    });
    const id = res.data?.template_id || res.data?.id;
    if (!id) throw new Error("Template created but no template_id returned.");
    setSavedTemplateId(id);
    return id;
  };

  const submitTemplate = async () => {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const id = await ensureTemplateId();
      for (const row of sortedFields) {
        await api.post(`/data-capture-templates/${id}/fields`, {
          field_sequence: Number(row.field_sequence),
          field_name: row.field_name.trim(),
          field_label: row.field_label.trim(),
          field_type: row.field_type,
          unit_of_measure: row.unit_of_measure?.trim() || null,
          is_mandatory: !!row.is_mandatory,
          min_value: row.min_value === "" ? null : Number(row.min_value),
          max_value: row.max_value === "" ? null : Number(row.max_value),
          dropdown_values: row.dropdown_values?.trim() || null,
          ontology_property: row.ontology_property?.trim() || null
        });
      }
      setSuccess(`Template ${id} saved with ${sortedFields.length} field(s).`);
      onSaved?.({ templateId: id, fields: sortedFields, templateMeta });
    } catch (e) {
      setError(formatApiError(e, "Failed to save template"));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100";
  const cellInputClass =
    "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900";

  const wrapperClass = embedded
    ? "space-y-4"
    : "rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4";

  return (
    <div className={wrapperClass}>
      {!embedded && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          {templateId && (
            <p className="text-xs text-[#08264a] font-mono mt-1">Template: {templateId}</p>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Template Name
            </label>
            <input
              className={inputClass}
              value={templateMeta.template_name}
              disabled={readOnly}
              onChange={(e) =>
                setTemplateMeta((m) => ({ ...m, template_name: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Template Sequence
            </label>
            <input
              type="number"
              className={inputClass}
              value={templateMeta.template_sequence}
              disabled={readOnly}
              onChange={(e) =>
                setTemplateMeta((m) => ({ ...m, template_sequence: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Capture Stage
            </label>
            <select
              className={inputClass}
              value={templateMeta.capture_stage}
              disabled={readOnly}
              onChange={(e) =>
                setTemplateMeta((m) => ({ ...m, capture_stage: e.target.value }))
              }
            >
              {CAPTURE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 lg:col-span-4">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Description
            </label>
            <input
              className={inputClass}
              value={templateMeta.description}
              disabled={readOnly}
              onChange={(e) =>
                setTemplateMeta((m) => ({ ...m, description: e.target.value }))
              }
            />
          </div>
        </div>
      )}

      {readOnly && templateMeta?.template_name && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <div className="font-medium">{templateMeta.template_name}</div>
          <div className="text-xs text-slate-500 mt-1">
            Seq {templateMeta.template_sequence} · Stage {templateMeta.capture_stage}
            {templateMeta.description ? ` · ${templateMeta.description}` : ""}
          </div>
        </div>
      )}

      {duplicateSequences.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Duplicate field_sequence: {duplicateSequences.join(", ")} — adjust before saving.
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Seq</th>
              <th className="px-3 py-2">Field Name</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">UOM</th>
              <th className="px-3 py-2">Req</th>
              <th className="px-3 py-2">Min</th>
              <th className="px-3 py-2">Max</th>
              <th className="px-3 py-2">Dropdown Values</th>
              <th className="px-3 py-2">Ontology</th>
              {!readOnly && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {sortedFields.map((row) => (
              <tr key={row.localId} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2 w-20">
                  {readOnly ? (
                    <span className="font-mono font-semibold text-[#08264a]">
                      {row.field_sequence}
                    </span>
                  ) : (
                    <input
                      type="number"
                      className={`${cellInputClass} w-20`}
                      value={row.field_sequence}
                      onChange={(e) =>
                        updateField(row.localId, { field_sequence: e.target.value })
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    row.field_name
                  ) : (
                    <input
                      className={`${cellInputClass} min-w-[120px]`}
                      value={row.field_name}
                      onChange={(e) =>
                        updateField(row.localId, { field_name: e.target.value })
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    row.field_label
                  ) : (
                    <input
                      className={`${cellInputClass} min-w-[120px]`}
                      value={row.field_label}
                      onChange={(e) =>
                        updateField(row.localId, { field_label: e.target.value })
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    row.field_type
                  ) : (
                    <select
                      className={cellInputClass}
                      value={row.field_type}
                      onChange={(e) =>
                        updateField(row.localId, { field_type: e.target.value })
                      }
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    row.unit_of_measure || "—"
                  ) : (
                    <input
                      className={`${cellInputClass} w-20`}
                      value={row.unit_of_measure}
                      onChange={(e) =>
                        updateField(row.localId, { unit_of_measure: e.target.value })
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {readOnly ? (
                    row.is_mandatory ? "Yes" : "No"
                  ) : (
                    <input
                      type="checkbox"
                      checked={!!row.is_mandatory}
                      onChange={(e) =>
                        updateField(row.localId, { is_mandatory: e.target.checked })
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    row.min_value ?? "—"
                  ) : (
                    <input
                      type="number"
                      className={`${cellInputClass} w-20`}
                      value={row.min_value}
                      onChange={(e) =>
                        updateField(row.localId, { min_value: e.target.value })
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    row.max_value ?? "—"
                  ) : (
                    <input
                      type="number"
                      className={`${cellInputClass} w-20`}
                      value={row.max_value}
                      onChange={(e) =>
                        updateField(row.localId, { max_value: e.target.value })
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    row.dropdown_values || "—"
                  ) : (
                    <input
                      className={`${cellInputClass} min-w-[140px]`}
                      value={row.dropdown_values}
                      onChange={(e) =>
                        updateField(row.localId, { dropdown_values: e.target.value })
                      }
                      placeholder="OK,NG,Rework"
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    row.ontology_property || "—"
                  ) : (
                    <input
                      className={`${cellInputClass} min-w-[120px]`}
                      value={row.ontology_property}
                      onChange={(e) =>
                        updateField(row.localId, { ontology_property: e.target.value })
                      }
                    />
                  )}
                </td>
                {!readOnly && (
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => removeFieldRow(row.localId)}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={addFieldRow}
          >
            + Add Field
          </button>
          {!editOnly && (
            <button
              type="button"
              className="rounded-lg bg-[#08264a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#103a6b] disabled:opacity-50"
              disabled={submitting || (!processId && !templateId)}
              onClick={submitTemplate}
            >
              {submitting ? "Saving…" : "Save Template & Fields"}
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </div>
      )}
    </div>
  );
}

export default DataCaptureTemplateBuilder;
