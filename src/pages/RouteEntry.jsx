import { useEffect, useMemo, useState } from "react";

import DataCaptureTemplateBuilder, {
  emptyFieldRow
} from "../components/DataCaptureTemplateBuilder";
import MesCard from "../components/mes/MesCard";
import MesPageHeader from "../components/mes/MesPageHeader";
import api, { formatApiError } from "../services/api";
import { saveProcessTemplateFields } from "../utils/dataCaptureHelpers";
import {
  CASTING_ROUTE_PRESETS,
  captureSummary,
  findProcessByCode
} from "../utils/routeStepPresets";
import {
  fetchPartRoutings,
  fetchParts,
  fetchProcesses,
  fetchProcessTemplate,
  isProcessActive,
  processKey,
  uniqueProcessTypes
} from "../utils/mesApi";
import { emptyTemplateMeta } from "../utils/templateHelpers";
import {
  findDuplicateSequences,
  nextSequence,
  newLocalId,
  sortBySequence
} from "../utils/sequenceHelpers";

function emptyStep(existingSteps = []) {
  return {
    localId: newLocalId(),
    operation_sequence: nextSequence(existingSteps, "operation_sequence"),
    process_id: "",
    mode: "existing",
    newProcess: {
      process_code: "",
      process_name: "",
      process_type: "",
      description: "",
      is_active: true
    },
    operation_code: "",
    operation_name: "",
    standard_cycle_time_minutes: "",
    inspection_required: false,
    existingTemplate: null,
    templateMeta: emptyTemplateMeta(),
    templateFields: [emptyFieldRow()],
    showTemplateBuilder: false,
    loadingTemplate: false
  };
}

function RouteEntry() {
  const [parts, setParts] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [routings, setRoutings] = useState([]);
  const [partId, setPartId] = useState("");
  const [routingId, setRoutingId] = useState("");
  const [routingVersion, setRoutingVersion] = useState("v1");
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState([emptyStep()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const processTypes = useMemo(
    () => uniqueProcessTypes(processes),
    [processes]
  );

  const activeProcesses = useMemo(
    () => processes.filter(isProcessActive),
    [processes]
  );

  useEffect(() => {
    Promise.all([fetchParts(), fetchProcesses()])
      .then(([p, proc]) => {
        setParts(p);
        setProcesses(proc);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!partId) {
      setRoutings([]);
      return;
    }
    fetchPartRoutings(partId).then(setRoutings).catch(() => setRoutings([]));
  }, [partId, success]);

  const sortedSteps = useMemo(
    () => sortBySequence(steps, "operation_sequence"),
    [steps]
  );

  const duplicateSequences = useMemo(
    () => findDuplicateSequences(steps, "operation_sequence"),
    [steps]
  );

  const updateStep = (localId, patch) => {
    setSteps((prev) =>
      prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s))
    );
    setError("");
    setSuccess("");
  };

  const addStep = () => {
    setSteps((prev) => [...prev, emptyStep(prev)]);
  };

  const removeStep = (localId) => {
    setSteps((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.localId !== localId);
    });
  };

  const handleProcessSelect = async (localId, processId) => {
    updateStep(localId, {
      process_id: processId,
      mode: "existing",
      loadingTemplate: true,
      existingTemplate: null,
      showTemplateBuilder: false
    });

    if (!processId) {
      updateStep(localId, { loadingTemplate: false });
      return;
    }

    const proc = processes.find(
      (p) => String(processKey(p)) === String(processId)
    );
    const template = await fetchProcessTemplate(processId);
    updateStep(localId, {
      loadingTemplate: false,
      existingTemplate: template,
      templateMeta: template.templateMeta || emptyTemplateMeta(),
      operation_name: proc?.process_name || "",
      operation_code: proc?.process_code || processKey(proc) || ""
    });
  };

  const enableNewProcess = (localId) => {
    updateStep(localId, {
      mode: "new",
      process_id: "",
      existingTemplate: null,
      showTemplateBuilder: false,
      templateFields: [emptyFieldRow()],
      templateMeta: emptyTemplateMeta(),
      newProcess: {
        process_code: "",
        process_name: "",
        process_type: "",
        description: "",
        is_active: true
      }
    });
  };

  const reloadStepTemplate = async (localId, processId) => {
    const template = await fetchProcessTemplate(processId);
    updateStep(localId, {
      existingTemplate: template,
      templateMeta: template.templateMeta || emptyTemplateMeta(),
      showTemplateBuilder: false
    });
  };

  const loadStandardCastingRoute = async () => {
    const newSteps = [];
    for (const preset of CASTING_ROUTE_PRESETS) {
      const proc = findProcessByCode(processes, preset.process_code);
      const processId = proc ? processKey(proc) : "";
      let existingTemplate = null;
      if (processId) {
        existingTemplate = await fetchProcessTemplate(processId);
      }
      newSteps.push({
        ...emptyStep(newSteps),
        process_id: processId,
        mode: processId ? "existing" : "new",
        operation_code: preset.process_code,
        operation_name: preset.process_name,
        existingTemplate,
        templateMeta: existingTemplate?.templateMeta || {
          ...emptyTemplateMeta(),
          template_name: `${preset.process_name} — data to capture`
        },
        newProcess: {
          process_code: preset.process_code,
          process_name: preset.process_name,
          process_type: "casting",
          description: "",
          is_active: true
        }
      });
    }
    setSteps(newSteps);
    setSuccess("Standard casting route loaded — review each step and save.");
    setError("");
  };

  const validateBeforeSave = () => {
    if (!partId) return "Select a part.";
    if (!routingId.trim()) return "Enter or select a routing ID.";
    if (duplicateSequences.length) {
      return `Duplicate operation_sequence: ${duplicateSequences.join(", ")}`;
    }
    for (const step of sortedSteps) {
      if (!Number(step.operation_sequence) || Number(step.operation_sequence) <= 0) {
        return "Each route step needs a valid operation_sequence.";
      }
      if (!step.operation_code?.trim() || !step.operation_name?.trim()) {
        return "Each step needs operation_code and operation_name.";
      }
      if (step.mode === "existing" && !step.process_id) {
        return "Select a process or create a new one for each step.";
      }
      if (step.mode === "new") {
        if (!step.newProcess.process_code.trim() || !step.newProcess.process_name.trim()) {
          return "New process steps need process code and name.";
        }
        if (!step.newProcess.process_type.trim()) {
          return "New process steps need process_type.";
        }
        const fieldDups = findDuplicateSequences(
          step.templateFields || [],
          "field_sequence"
        );
        if (fieldDups.length) {
          return `Duplicate field_sequence in step ${step.operation_sequence}: ${fieldDups.join(", ")}`;
        }
      }
      if (shouldSavePendingTemplate(step)) {
        if (!step.templateMeta?.template_name?.trim()) {
          return `Step ${step.operation_sequence} needs a capture template name.`;
        }
        const fieldDups = findDuplicateSequences(
          step.templateFields || [],
          "field_sequence"
        );
        if (fieldDups.length) {
          return `Duplicate field_sequence in step ${step.operation_sequence}: ${fieldDups.join(", ")}`;
        }
      }
    }
    return "";
  };

  const shouldSavePendingTemplate = (step) => {
    const hasPendingFields = (step.templateFields || []).some(
      (f) => f.field_name?.trim() && f.field_label?.trim()
    );
    const hasName = step.templateMeta?.template_name?.trim();
    const noExistingFields = !(step.existingTemplate?.fields?.length > 0);
    return (
      step.mode === "existing" &&
      step.process_id &&
      hasPendingFields &&
      hasName &&
      (step.showTemplateBuilder || noExistingFields)
    );
  };

  const createProcessAndTemplate = async (step) => {
    const procRes = await api.post("/processes", {
      process_code: step.newProcess.process_code.trim(),
      process_name: step.newProcess.process_name.trim(),
      process_type: step.newProcess.process_type.trim(),
      description: step.newProcess.description.trim() || null,
      is_active: step.newProcess.is_active !== false
    });
    const created = procRes.data;
    const processId = processKey(created);

    await saveProcessTemplateFields(processId, step.templateMeta, step.templateFields);

    return processId;
  };

  const saveRoute = async () => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const resolvedSteps = [];
      for (const step of sortedSteps) {
        let processId = step.process_id;
        if (step.mode === "new") {
          processId = await createProcessAndTemplate(step);
        } else if (shouldSavePendingTemplate(step)) {
          await saveProcessTemplateFields(
            step.process_id,
            step.templateMeta,
            step.templateFields
          );
        }
        resolvedSteps.push({
          process_id: processId,
          operation_id: step.operation_code.trim(),
          operation_sequence: Number(step.operation_sequence),
          operation_name: step.operation_name.trim(),
          standard_cycle_time_minutes:
            step.standard_cycle_time_minutes === ""
              ? null
              : Number(step.standard_cycle_time_minutes),
          inspection_required: !!step.inspection_required
        });
      }

      await api.post("/routing-with-operations", {
        routing_id: routingId.trim(),
        part_id: partId,
        routing_version: routingVersion.trim() || "v1",
        is_active: isActive,
        operations: resolvedSteps
      });

      setSuccess(`Routing ${routingId} saved with ${resolvedSteps.length} operation(s).`);
      const refreshed = await fetchProcesses();
      setProcesses(refreshed);
    } catch (e) {
      setError(formatApiError(e, "Failed to save routing"));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="max-w-6xl">
      <MesPageHeader
        eyebrow="Ontology · Part Routing"
        title="Route Entry"
        subtitle="A route is an ordered list of processes (Moulding → Melting → …). For each process, define the data operators must capture when that step runs."
      />

      <div className="mb-6 rounded-lg border border-[#08264a]/20 bg-blue-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold text-[#08264a]">Process → Data to capture</p>
        <p className="mt-1">
          Each route step is one <strong>process</strong>. The capture fields for that step are
          what the operator fills in during execution (e.g. Moulding: sand type, mould ID,
          moisture %, mould hardness).
        </p>
      </div>

      <MesCard title="Routing Header" subtitle="Part and routing identity" className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Part
            </label>
            <select className={inputClass} value={partId} onChange={(e) => setPartId(e.target.value)}>
              <option value="">— Select part —</option>
              {parts.map((p) => (
                <option key={p.part_id} value={p.part_id}>
                  {p.part_id} · {p.part_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Routing ID
            </label>
            {routings.length > 0 && (
              <select
                className={`${inputClass} mb-2`}
                value=""
                onChange={(e) => {
                  if (e.target.value) setRoutingId(e.target.value);
                }}
              >
                <option value="">— Select existing routing —</option>
                {routings.map((r) => (
                  <option key={r.routing_id} value={r.routing_id}>
                    {r.routing_id} · {r.routing_version || "v1"}
                  </option>
                ))}
              </select>
            )}
            <input
              className={`${inputClass} font-mono`}
              value={routingId}
              onChange={(e) => setRoutingId(e.target.value)}
              placeholder="RTG-CAST-001"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Version
            </label>
            <input
              className={inputClass}
              value={routingVersion}
              onChange={(e) => setRoutingVersion(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active routing
            </label>
          </div>
        </div>
      </MesCard>

      {duplicateSequences.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Duplicate operation_sequence: {duplicateSequences.join(", ")} — adjust before saving.
        </div>
      )}

      <div className="space-y-4">
        {sortedSteps.map((step, index) => (
          <MesCard
            key={step.localId}
            title={`Route Operation ${index + 1}`}
            subtitle={`operation_sequence ${step.operation_sequence}`}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Operation Sequence
                  </label>
                  <input
                    type="number"
                    className={`${inputClass} font-mono text-[#08264a]`}
                    value={step.operation_sequence}
                    onChange={(e) =>
                      updateStep(step.localId, { operation_sequence: e.target.value })
                    }
                  />
                  <p className="mt-1 text-xs text-slate-500">Auto-suggest: max + 10</p>
                </div>

                <div className="lg:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Route step (process)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className={`min-w-[220px] flex-1 ${inputClass}`}
                      value={step.mode === "existing" ? step.process_id : ""}
                      disabled={step.mode === "new"}
                      onChange={(e) => handleProcessSelect(step.localId, e.target.value)}
                    >
                      <option value="">— Select process —</option>
                      {activeProcesses.map((p) => {
                        const id = processKey(p);
                        return (
                          <option key={id} value={id}>
                            {p.process_code || id} · {p.process_name}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      className="rounded-lg border border-[#08264a] px-3 py-2 text-sm font-medium text-[#08264a] hover:bg-blue-50"
                      onClick={() => enableNewProcess(step.localId)}
                    >
                      + New Process
                    </button>
                  </div>
                </div>

                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:underline"
                    onClick={() => removeStep(step.localId)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {step.mode === "new" && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 space-y-4">
                  <p className="text-sm font-semibold text-slate-800">New Process</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      className={inputClass}
                      placeholder="Process code"
                      value={step.newProcess.process_code}
                      onChange={(e) =>
                        updateStep(step.localId, {
                          newProcess: { ...step.newProcess, process_code: e.target.value },
                          operation_code: e.target.value
                        })
                      }
                    />
                    <input
                      className={inputClass}
                      placeholder="Process name"
                      value={step.newProcess.process_name}
                      onChange={(e) =>
                        updateStep(step.localId, {
                          newProcess: { ...step.newProcess, process_name: e.target.value },
                          operation_name: e.target.value
                        })
                      }
                    />
                    <input
                      className={inputClass}
                      list={`process-types-${step.localId}`}
                      placeholder="Process type"
                      value={step.newProcess.process_type}
                      onChange={(e) =>
                        updateStep(step.localId, {
                          newProcess: { ...step.newProcess, process_type: e.target.value }
                        })
                      }
                    />
                    <datalist id={`process-types-${step.localId}`}>
                      {processTypes.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                    <input
                      className={`${inputClass} md:col-span-2`}
                      placeholder="Description"
                      value={step.newProcess.description}
                      onChange={(e) =>
                        updateStep(step.localId, {
                          newProcess: { ...step.newProcess, description: e.target.value }
                        })
                      }
                    />
                  </div>

                  <DataCaptureTemplateBuilder
                    embedded
                    editOnly
                    templateMeta={step.templateMeta}
                    onTemplateMetaChange={(meta) =>
                      updateStep(step.localId, { templateMeta: meta })
                    }
                    fields={step.templateFields}
                    onFieldsChange={(fields) =>
                      updateStep(step.localId, { templateFields: fields })
                    }
                  />
                  <p className="text-xs text-slate-500">
                    Process and capture parameters are persisted when you save the route.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Operation Code
                  </label>
                  <input
                    className={`${inputClass} font-mono`}
                    value={step.operation_code}
                    onChange={(e) =>
                      updateStep(step.localId, { operation_code: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Operation Name
                  </label>
                  <input
                    className={inputClass}
                    value={step.operation_name}
                    onChange={(e) =>
                      updateStep(step.localId, { operation_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Std Cycle (min)
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    value={step.standard_cycle_time_minutes}
                    onChange={(e) =>
                      updateStep(step.localId, {
                        standard_cycle_time_minutes: e.target.value
                      })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={step.inspection_required}
                      onChange={(e) =>
                        updateStep(step.localId, {
                          inspection_required: e.target.checked
                        })
                      }
                    />
                    Inspection required
                  </label>
                </div>
              </div>

              {step.mode === "existing" && step.process_id && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-800">Data to capture during this step</p>
                  {step.loadingTemplate && (
                    <p className="text-sm text-slate-500">Loading…</p>
                  )}
                  {!step.loadingTemplate &&
                    step.existingTemplate?.fields?.length > 0 &&
                    !step.showTemplateBuilder && (
                      <>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                          {captureSummary(step.existingTemplate.fields)}
                        </div>
                        <DataCaptureTemplateBuilder
                          embedded
                          readOnly
                          templateId={step.existingTemplate.templateId}
                          templateMeta={step.existingTemplate.templateMeta}
                          initialFields={step.existingTemplate.fields}
                        />
                      </>
                    )}
                  {!step.loadingTemplate &&
                    (!step.existingTemplate?.fields?.length ||
                      step.existingTemplate.fields.length === 0) &&
                    !step.showTemplateBuilder && (
                      <>
                        <p className="text-sm text-slate-500">
                          No capture parameters defined for this process yet.
                        </p>
                        <button
                          type="button"
                          className="rounded-lg bg-[#08264a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#103a6b]"
                          onClick={() =>
                            updateStep(step.localId, {
                              showTemplateBuilder: true,
                              templateMeta: emptyTemplateMeta(),
                              templateFields: [emptyFieldRow()]
                            })
                          }
                        >
                          + Define Capture Parameters
                        </button>
                      </>
                    )}
                  {step.showTemplateBuilder && (
                    <>
                      <DataCaptureTemplateBuilder
                        embedded
                        editOnly
                        templateMeta={step.templateMeta}
                        onTemplateMetaChange={(meta) =>
                          updateStep(step.localId, { templateMeta: meta })
                        }
                        fields={step.templateFields}
                        onFieldsChange={(fields) =>
                          updateStep(step.localId, { templateFields: fields })
                        }
                      />
                      <p className="text-xs text-slate-500">
                        Parameters are saved when you save the route.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </MesCard>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-lg border border-[#08264a] px-4 py-2 text-sm font-medium text-[#08264a] hover:bg-blue-50"
          onClick={loadStandardCastingRoute}
        >
          Load standard casting route
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={addStep}
        >
          + Add Route Operation
        </button>
        <button
          type="button"
          className="rounded-lg bg-[#08264a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#103a6b] disabled:opacity-50"
          disabled={saving}
          onClick={saveRoute}
        >
          {saving ? "Saving Route…" : "Save Route"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-line">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}
    </div>
  );
}

export default RouteEntry;
