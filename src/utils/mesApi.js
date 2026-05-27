import api from "../services/api";

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function fetchProcesses(params = {}) {
  const res = await api.get("/processes", { params });
  return normalizeList(res.data);
}

export async function fetchParts() {
  try {
    const res = await api.get("/parts");
    return normalizeList(res.data);
  } catch {
    const res = await api.get("/part");
    return normalizeList(res.data);
  }
}

export async function createPart(payload) {
  try {
    return await api.post("/parts", payload);
  } catch (e) {
    const status = e?.response?.status;
    if (status === 404) {
      return api.post("/part", payload);
    }
    throw e;
  }
}

export function processKey(process) {
  return process?.process_id || process?.process_code;
}

export function isProcessActive(process) {
  return process?.is_active !== false && process?.active !== false;
}

export function uniqueProcessTypes(processes) {
  return [
    ...new Set(
      processes
        .map((p) => p.process_type)
        .filter(Boolean)
        .map(String)
    )
  ].sort();
}

export function uniquePartTypes(parts) {
  return [
    ...new Set(
      parts
        .map((p) => p.part_type)
        .filter(Boolean)
        .map(String)
    )
  ].sort();
}

export async function fetchPartRoutings(partId) {
  if (!partId) return [];
  try {
    const res = await api.get(`/parts/${partId}/routings`);
    return normalizeList(res.data);
  } catch {
    try {
      const res = await api.get(`/part/${partId}/routings`);
      return normalizeList(res.data);
    } catch {
      return [];
    }
  }
}

export async function fetchProcessTemplate(processId) {
  if (!processId) {
    return { templateId: "", templateName: "", templateMeta: null, fields: [], templates: [] };
  }
  try {
    const res = await api.get(`/processes/${processId}/data-capture-template`);
    return normalizeTemplateResponse(res.data);
  } catch {
    try {
      const res = await api.get(`/processes/${processId}/data-capture-templates`);
      const templates = normalizeList(res.data);
      const withFields = await Promise.all(
        templates.map(async (template) => {
          try {
            const fieldsRes = await api.get(
              `/data-capture/templates/${template.template_id}/fields`
            );
            return { ...template, fields: normalizeList(fieldsRes.data) };
          } catch {
            return { ...template, fields: [] };
          }
        })
      );
      return normalizeTemplateResponse({ templates: withFields });
    } catch {
      return { templateId: "", templateName: "", templateMeta: null, fields: [], templates: [] };
    }
  }
}

export function normalizeTemplateResponse(data) {
  if (!data) {
    return { templateId: "", templateName: "", templateMeta: null, fields: [], templates: [] };
  }

  if (Array.isArray(data.templates) && data.templates.length) {
    const primary = data.templates[0];
    const fields = data.templates.flatMap((template) => template.fields || []);
    const sortedFields = [...fields].sort(
      (a, b) => (Number(a.field_sequence) || 0) - (Number(b.field_sequence) || 0)
    );
    return {
      templateId: primary.template_id || "",
      templateName: primary.template_name || "",
      templates: data.templates,
      templateMeta: {
        template_name: primary.template_name || "",
        template_sequence: primary.template_sequence ?? 10,
        capture_stage: primary.capture_stage || "execution",
        description: primary.description || ""
      },
      fields: sortedFields
    };
  }

  const template = data.template || data;
  const fields = data.fields || template?.fields || [];
  return {
    templateId: template.template_id || data.template_id || "",
    templateName: template.template_name || data.template_name || "",
    templates: [],
    templateMeta: {
      template_name: template.template_name || data.template_name || "",
      template_sequence: template.template_sequence ?? data.template_sequence ?? 10,
      capture_stage: template.capture_stage || data.capture_stage || "execution",
      description: template.description || data.description || ""
    },
    fields: Array.isArray(fields) ? fields : []
  };
}
