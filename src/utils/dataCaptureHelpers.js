import api from "../services/api";
import { sortBySequence } from "./sequenceHelpers";

/** Stages shown on the shop-floor execution screen. */
const SHOP_FLOOR_STAGES = new Set([
  "execution",
  "during",
  "setup",
  "run",
  "operate",
  "production"
]);

export function matchesCaptureStage(blockStage, requestedStage) {
  if (!requestedStage) return true;
  const stage = (blockStage || "execution").toLowerCase().trim();
  const requested = requestedStage.toLowerCase().trim();

  if (requested === "execution") {
    if (stage === "inspection" || stage === "closeout") return false;
    if (SHOP_FLOOR_STAGES.has(stage)) return true;
    // Unknown stage labels still show on execution unless explicitly post-op.
    return stage !== "inspection" && stage !== "closeout";
  }

  return stage === requested;
}

export function normalizeCaptureTemplatePayload(data, { captureStage } = {}) {
  if (!data) return [];

  let blocks = [];
  if (Array.isArray(data)) {
    blocks = data;
  } else {
    const templates = data.templates || (data.fields ? [data] : []);
    blocks = Array.isArray(templates) ? templates : [templates];
  }

  const mapped = blocks
    .map((block) => ({
      template_id: block.template_id || data?.template_id,
      template_name: block.template_name || block.operation_name || "Data Capture",
      capture_stage: block.capture_stage,
      operation_name: block.operation_name,
      process_id: block.process_id || data?.process_id,
      process_name: block.process_name || data?.process_name,
      fields: sortBySequence(block.fields || data?.fields || [], "field_sequence")
    }))
    .filter((block) => block.fields?.length > 0);

  if (!captureStage) return mapped;

  const filtered = mapped.filter((block) =>
    matchesCaptureStage(block.capture_stage, captureStage)
  );

  // If stage labels in DB don't match UI (e.g. "during"), still show available fields.
  return filtered.length > 0 ? filtered : mapped;
}

export function captureFieldKey(templateId, field) {
  return `${templateId || "tpl"}::${field.field_id || field.field_name}`;
}

export function buildInitialCaptureValues(templates) {
  const initial = {};
  templates.forEach((tpl) => {
    tpl.fields.forEach((f) => {
      const key = captureFieldKey(tpl.template_id, f);
      initial[key] = f.field_type === "boolean" ? false : "";
    });
  });
  return initial;
}

export function validateCaptureValues(templates, values) {
  const errors = {};

  for (const tpl of templates) {
    for (const field of tpl.fields || []) {
      const key = captureFieldKey(tpl.template_id, field);
      const raw = values[key];
      const label = field.field_label || field.field_name;

      if (field.is_mandatory) {
        if (field.field_type === "boolean") {
          if (raw !== true && raw !== false) {
            errors[key] = `${label} is required.`;
          }
        } else if (raw === "" || raw === null || raw === undefined) {
          errors[key] = `${label} is required.`;
        }
      }

      if (field.field_type === "number" && raw !== "" && raw !== null && raw !== undefined) {
        const num = Number(raw);
        if (Number.isNaN(num)) {
          errors[key] = `${label} must be a number.`;
        } else {
          if (field.min_value != null && num < Number(field.min_value)) {
            errors[key] = `${label} must be ≥ ${field.min_value}.`;
          }
          if (field.max_value != null && num > Number(field.max_value)) {
            errors[key] = `${label} must be ≤ ${field.max_value}.`;
          }
        }
      }
    }
  }

  return errors;
}

function stringifyCaptureValue(field, raw) {
  if (field.field_type === "boolean") {
    return raw ? "true" : "false";
  }
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

/** Submit one POST per template (API contract). */
export async function submitWorkOrderCaptures(workOrderId, templates, values, capturedBy) {
  const trimmedId = workOrderId.trim();
  const results = [];

  for (const tpl of templates) {
    const payload = {
      template_id: tpl.template_id,
      captured_by: capturedBy?.trim() || undefined,
      values: (tpl.fields || []).map((field) => ({
        field_id: field.field_id,
        field_value: stringifyCaptureValue(field, values[captureFieldKey(tpl.template_id, field)])
      }))
    };
    const res = await api.post(`/work-orders/${trimmedId}/data-capture`, payload);
    results.push(res.data);
  }

  return results;
}

/** Persist a data capture template + fields for a process (route entry). */
export async function saveProcessTemplateFields(processId, templateMeta, templateFields) {
  const hasFields = (templateFields || []).some(
    (f) => f.field_name?.trim() && f.field_label?.trim()
  );
  if (!hasFields || !templateMeta?.template_name?.trim()) {
    return null;
  }

  const tplRes = await api.post(`/processes/${processId}/data-capture-templates`, {
    template_name: templateMeta.template_name.trim(),
    template_sequence: Number(templateMeta.template_sequence) || 10,
    capture_stage: templateMeta.capture_stage || "execution",
    description: templateMeta.description?.trim() || null,
    is_active: true
  });
  const templateId = tplRes.data?.template_id || tplRes.data?.id;
  if (!templateId) return null;

  for (const row of sortBySequence(templateFields, "field_sequence")) {
    if (!row.field_name?.trim() || !row.field_label?.trim()) continue;
    await api.post(`/data-capture-templates/${templateId}/fields`, {
      field_sequence: Number(row.field_sequence),
      field_name: row.field_name.trim(),
      field_label: row.field_label.trim(),
      field_type: row.field_type || "text",
      unit_of_measure: row.unit_of_measure?.trim() || null,
      is_mandatory: !!row.is_mandatory,
      min_value: row.min_value === "" || row.min_value == null ? null : Number(row.min_value),
      max_value: row.max_value === "" || row.max_value == null ? null : Number(row.max_value),
      dropdown_values: row.dropdown_values?.trim() || null,
      ontology_property: row.ontology_property?.trim() || null
    });
  }

  return templateId;
}
