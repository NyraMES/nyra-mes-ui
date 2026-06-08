import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import DataCaptureTemplateBuilder, {
  emptyFieldRow
} from "../../components/DataCaptureTemplateBuilder";
import api from "../../services/api";
import { formatApiError } from "../../services/api";
import {
  createMesCoreRoutingWithOperations,
  fetchMesCoreProducts,
  fetchMesCoreRoutings,
} from "../../services/mesCoreApi";
import {
  fetchProcesses,
  fetchProcessTemplate,
  isProcessActive,
  processKey
} from "../../utils/mesApi";
import {
  CASTING_ROUTE_PRESETS,
  captureSummary,
  findProcessByCode
} from "../../utils/routeStepPresets";
import { emptyTemplateMeta } from "../../utils/templateHelpers";
import { useWorkflow } from "../WorkflowContext";
import {
  WfCard,
  WfCardHeader,
  WfCardBody,
  SectionHeader,
  StatusPill,
  ContextBanner,
  OntologyEdge,
  EmptyState
} from "../ui";


function emptyOp(seq = 1, fields = []) {
  return {
    seq,
    name: "",
    code: "",
    cycle: "",
    inspect: false,
    process_id: "",
    processMode: "existing",
    newProcess: {
      process_code: "",
      process_name: "",
      process_type: "",
      description: "",
      is_active: true
    },
    templateMeta: emptyTemplateMeta(),
    templateFields: fields.length ? fields : [emptyFieldRow()],
    existingTemplate: null,
    loadingTemplate: false,
    showCaptureBuilder: false
  };
}

const RESOURCE_TYPES = [
  { value: "material",  label: "Material",   endpoint: "/materials",        idKey: "material_id", nameKey: "material_name" },
  { value: "machine",   label: "Machine",    endpoint: "/machines",         idKey: "machine_id",  nameKey: "machine_name"  },
  { value: "tool",      label: "Tool",       endpoint: "/tools",            idKey: "tool_id",     nameKey: "tool_name"     },
  { value: "workforce", label: "Workforce",  endpoint: "/workforce-roles",  idKey: "role_id",     nameKey: "role_name"     }
];

function findPart(parts, ref) {
  if (!ref) return null;
  return (
    parts.find(
      (p) =>
        p.part_code === ref ||
        p.part_id === ref ||
        p.product_id === ref
    ) || null
  );
}

function partOptionValue(part) {
  return part.part_code || part.part_id;
}


function RoutingMaster() {
  const navigate = useNavigate();
  const { update } = useWorkflow();
  const [searchParams] = useSearchParams();

  // ----- masters & existing data
  const [parts, setParts] = useState([]);
  const [partsLoading, setPartsLoading] = useState(true);
  const [processes, setProcesses] = useState([]);
  const [existingRoutings, setExistingRoutings] = useState([]);
  const [loadingRoutings, setLoadingRoutings] = useState(false);

  // ----- routing form
  const [partId, setPartId] = useState(searchParams.get("part") || "");
  const [version, setVersion] = useState("v1");
  const [processType, setProcessType] = useState("");
  const [isActive, setIsActive] = useState(true);

  // ----- operations being authored
  const [operations, setOperations] = useState([emptyOp(1)]);

  // ----- last saved routing - drives the "Add resources" panel
  const [savedRouting, setSavedRouting] = useState(null);
  const [savedOperations, setSavedOperations] = useState([]);
  const [requirementsByOp, setRequirementsByOp] = useState({});

  // ----- resource attachment form (per saved operation)
  const [reqOpId, setReqOpId] = useState("");
  const [reqResourceType, setReqResourceType] = useState("material");
  const [reqResources, setReqResources] = useState([]);
  const [reqResourceId, setReqResourceId] = useState("");
  const [reqQuantity, setReqQuantity] = useState("1");
  const [reqMandatory, setReqMandatory] = useState(true);

  const [saving, setSaving] = useState(false);


  // load masters / existing routings

  useEffect(() => {
    setPartsLoading(true);
    fetchMesCoreProducts()
      .then((rows) => setParts(rows || []))
      .catch(() => setParts([]))
      .finally(() => setPartsLoading(false));
    fetchProcesses().then(setProcesses).catch(() => setProcesses([]));
  }, []);

  useEffect(() => {
    if (!parts.length || !partId) return;
    const match = findPart(parts, partId);
    if (match) {
      const code = partOptionValue(match);
      if (code !== partId) setPartId(code);
    }
  }, [parts, partId]);

  const activeProcesses = useMemo(
    () => processes.filter(isProcessActive),
    [processes]
  );

  useEffect(() => {
    if (!partId) {
      setExistingRoutings([]);
      return;
    }
    const selected = findPart(parts, partId);
    if (!selected?.product_id) {
      setExistingRoutings([]);
      return;
    }
    setLoadingRoutings(true);
    fetchMesCoreRoutings()
      .then((rows) =>
        (rows || []).filter((r) => r.product_id === selected.product_id)
      )
      .then(setExistingRoutings)
      .catch(() => setExistingRoutings([]))
      .finally(() => setLoadingRoutings(false));
  }, [partId, savedRouting, parts]);

  // pull the right resource list when the picker type switches
  useEffect(() => {
    const meta = RESOURCE_TYPES.find((t) => t.value === reqResourceType);
    if (!meta) return;
    api.get(meta.endpoint)
      .then((r) => setReqResources(r.data || []))
      .catch(() => setReqResources([]));
    setReqResourceId("");
  }, [reqResourceType]);


  // derived state
  const part = useMemo(() => findPart(parts, partId), [parts, partId]);
  const selectedProductId = part?.product_id || null;

  const operationsValid = operations.every((op) => {
    if (!op.name.trim() || Number(op.seq) <= 0) return false;
    if (op.processMode === "new") {
      if (!op.newProcess.process_code.trim() || !op.newProcess.process_name.trim()) {
        return false;
      }
      if (!op.newProcess.process_type.trim()) return false;
    }
    return true;
  });

  const buildResolvedOperations = () =>
    operations.map((op) => {
      if (op.processMode === "new") {
        const code = op.newProcess.process_code.trim();
        return {
          operation_id: op.code.trim() || null,
          operation_sequence: Number(op.seq),
          operation_name: op.name.trim(),
          process_id: code,
          process_code: code,
          process_name: op.newProcess.process_name.trim(),
          process_type: op.newProcess.process_type.trim(),
          standard_cycle_time_minutes:
            op.cycle === "" || op.cycle === null ? null : Number(op.cycle),
          inspection_required: !!op.inspect,
        };
      }
      return {
        operation_id: op.code.trim() || null,
        operation_sequence: Number(op.seq),
        operation_name: op.name.trim(),
        process_id: op.process_id ? String(op.process_id) : null,
        process_code: op.code.trim() || null,
        process_name: op.name.trim(),
        standard_cycle_time_minutes:
          op.cycle === "" || op.cycle === null ? null : Number(op.cycle),
        inspection_required: !!op.inspect,
      };
    });

  const canSave =
    selectedProductId &&
    version.trim() &&
    operations.length > 0 &&
    operationsValid &&
    !saving;


  // operation row editors

  const updateOp = (idx, patch) => {
    setOperations((prev) =>
      prev.map((op, i) => (i === idx ? { ...op, ...patch } : op))
    );
  };

  const addOpRow = () => {
    setOperations((prev) => [
      ...prev,
      emptyOp((prev[prev.length - 1]?.seq || prev.length) + 1)
    ]);
  };

  const handleProcessSelect = async (idx, processId) => {
    if (!processId) {
      updateOp(idx, {
        process_id: "",
        processMode: "existing",
        loadingTemplate: false,
        existingTemplate: null,
        showCaptureBuilder: false
      });
      return;
    }

    updateOp(idx, {
      process_id: processId,
      processMode: "existing",
      loadingTemplate: true,
      existingTemplate: null,
      showCaptureBuilder: false
    });

    const proc = activeProcesses.find((p) => String(processKey(p)) === String(processId));
    const template = await fetchProcessTemplate(processId);
    updateOp(idx, {
      loadingTemplate: false,
      existingTemplate: template,
      templateMeta: template.templateMeta || emptyTemplateMeta(),
      name: proc?.process_name || "",
      code: proc?.process_code || processKey(proc) || ""
    });
  };

  const enableNewProcess = (idx) => {
    updateOp(idx, {
      processMode: "new",
      process_id: "",
      existingTemplate: null,
      showCaptureBuilder: false,
      templateFields: [emptyFieldRow()],
      templateMeta: emptyTemplateMeta(),
      newProcess: {
        process_code: "",
        process_name: "",
        process_type: processType || "",
        description: "",
        is_active: true
      }
    });
  };

  const loadStandardCastingRoute = async () => {
    const rows = [];
    for (const preset of CASTING_ROUTE_PRESETS) {
      const proc = findProcessByCode(processes, preset.process_code);
      const processId = proc ? processKey(proc) : "";
      let existingTemplate = null;
      if (processId) {
        existingTemplate = await fetchProcessTemplate(processId);
      }
      rows.push({
        ...emptyOp(rows.length + 1),
        process_id: processId,
        processMode: processId ? "existing" : "new",
        name: preset.process_name,
        code: preset.process_code,
        existingTemplate,
        templateMeta: existingTemplate?.templateMeta || {
          ...emptyTemplateMeta(),
          template_name: `${preset.process_name} — data to capture`
        },
        newProcess: {
          process_code: preset.process_code,
          process_name: preset.process_name,
          process_type: processType || "casting",
          description: "",
          is_active: true
        }
      });
    }
    setOperations(rows);
  };

  const removeOpRow = (idx) => {
    setOperations((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveOpRow = (idx, dir) => {
    setOperations((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((op, i) => ({ ...op, seq: i + 1 }));
    });
  };


  // save routing-with-operations (atomic)

  const saveRouting = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const resolvedOps = buildResolvedOperations();
      const body = {
        product_id: selectedProductId,
        routing_version: version.trim(),
        process_type: processType.trim() || null,
        is_active: isActive,
        operations: resolvedOps,
      };
      const r = await createMesCoreRoutingWithOperations(body);
      const routing = r.routing || null;
      const ops = r.operations || [];
      setSavedRouting(routing);
      setSavedOperations(ops);
      setRequirementsByOp({});
      if (ops.length) setReqOpId(ops[0].operation_id);
      update({ partId: partOptionValue(part) || partId });
    } catch (e) {
      alert(formatApiError(e, "Error saving routing"));
    } finally {
      setSaving(false);
    }
  };


  // resource requirements (per operation)

  const loadRequirements = async (operationId) => {
    if (!operationId) return;
    try {
      const r = await api.get(`/operation/${operationId}/requirements`);
      setRequirementsByOp((prev) => ({ ...prev, [operationId]: r.data || [] }));
    } catch {
      setRequirementsByOp((prev) => ({ ...prev, [operationId]: [] }));
    }
  };

  useEffect(() => {
    if (reqOpId) loadRequirements(reqOpId);
  }, [reqOpId]);

  const addRequirement = async () => {
    if (!reqOpId || !reqResourceId) return;
    try {
      await api.post("/operation-resource-requirement", {
        operation_id: reqOpId,
        required_resource_type: reqResourceType,
        required_resource_id: Number(reqResourceId),
        required_quantity: Number(reqQuantity || 1),
        is_mandatory: !!reqMandatory
      });
      await loadRequirements(reqOpId);
      setReqResourceId("");
      setReqQuantity("1");
    } catch (e) {
      alert(e.response?.data?.detail || "Error adding requirement");
    }
  };


  const goToOrder = () => {
    update({ partId });
    navigate("/workflow/customer-order");
  };

  const resetForm = () => {
    setSavedRouting(null);
    setSavedOperations([]);
    setRequirementsByOp({});
    setOperations([emptyOp(1)]);
    setVersion("v1");
    setProcessType("");
    setIsActive(true);
  };


  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Master Data · Routing"
        title="Define the routing for a part"
        subtitle="Each operation is a process (Moulding, Melting, …). Link a process and define the data to capture when that step runs."
      />

      <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-slate-200">
        <span className="font-semibold text-white">Process → Data to capture</span>
        {" — "}
        Pick an existing process per operation, or click <strong className="text-white">+ New process</strong> to
        create one with capture fields. Also available on{" "}
        <Link to="/route-entry" className="text-cyan-200 underline">
          Route Entry
        </Link>
        .
      </div>

      <ContextBanner
        items={[
          { label: "Part",      value: part?.part_code || part?.part_id || "—" },
          { label: "Name",      value: part?.part_name || "—" },
          { label: "Routings",  value: existingRoutings.length || "—" },
          { label: "Status",    value: savedRouting ? "Saved" : "Draft" }
        ]}
        action={
          savedRouting ? (
            <button type="button" className="wf-btn wf-btn-primary" onClick={goToOrder}>
              Continue → Customer Order
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ---- main editor ---- */}
        <WfCard className="lg:col-span-2" glow>
          <WfCardHeader
            title={savedRouting ? `Routing saved: ${savedRouting.routing_id}` : "Build routing"}
            subtitle={
              savedRouting
                ? "Now attach materials, machines, tools or workforce to each operation."
                : "Pick a part, add operations in order, then save."
            }
            icon={<IconFlow />}
            right={
              savedRouting
                ? <StatusPill kind="ok">Saved</StatusPill>
                : <StatusPill kind="warn">Draft</StatusPill>
            }
          />
          <WfCardBody className="space-y-5">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="wf-label">Part</label>
                <select
                  className="wf-select wf-part-select"
                  value={partId}
                  onChange={(e) => setPartId(e.target.value)}
                  disabled={!!savedRouting}
                >
                  <option value="">
                    {partsLoading ? "Loading parts…" : "-- Pick a part --"}
                  </option>
                  {parts.map((p) => (
                    <option key={p.product_id} value={partOptionValue(p)}>
                      {p.part_code || p.part_id} · {p.part_name} ({p.part_type || "—"})
                    </option>
                  ))}
                </select>
                {!partsLoading && parts.length === 0 && (
                  <div className="text-[11px] text-amber-200 mt-1">
                    No parts found — create one in Part Master first.
                  </div>
                )}
              </div>
              <div>
                <label className="wf-label">Version</label>
                <input
                  className="wf-input"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="v1"
                  disabled={!!savedRouting}
                />
              </div>
              <div className="md:col-span-2">
                <label className="wf-label">Process Type</label>
                <input
                  className="wf-input"
                  value={processType}
                  onChange={(e) => setProcessType(e.target.value)}
                  placeholder="e.g. casting / machining / fabrication"
                  disabled={!!savedRouting}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={!!savedRouting}
                  />
                  Active routing
                </label>
              </div>
            </div>

            <div className="rounded-xl bg-slate-900/40 border border-slate-700/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">
                  Operations · in execution order
                </div>
                {!savedRouting && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="wf-btn wf-btn-ghost text-xs"
                      onClick={loadStandardCastingRoute}
                    >
                      Load casting route
                    </button>
                    <button
                      type="button"
                      className="wf-btn wf-btn-ghost text-xs"
                      onClick={addOpRow}
                    >
                      + Add operation
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                      <th className="text-left py-2 px-2 font-semibold w-14">Seq</th>
                      <th className="text-left py-2 px-2 font-semibold">Process (route step)</th>
                      <th className="text-left py-2 px-2 font-semibold">Operation Name</th>
                      <th className="text-left py-2 px-2 font-semibold w-32">Code (optional)</th>
                      <th className="text-left py-2 px-2 font-semibold w-24">Cycle (min)</th>
                      <th className="text-left py-2 px-2 font-semibold w-20">QC?</th>
                      {!savedRouting && (
                        <th className="text-right py-2 px-2 font-semibold w-28">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {savedRouting
                      ? savedOperations.map((op) => (
                          <tr key={op.operation_id} className="border-b border-white/5">
                            <td className="py-2 px-2 font-mono text-slate-300">{op.operation_sequence}</td>
                            <td className="py-2 px-2 text-slate-300 text-xs">{op.process_id || "—"}</td>
                            <td className="py-2 px-2 text-slate-100 font-medium">{op.operation_name}</td>
                            <td className="py-2 px-2 font-mono text-slate-300">{op.operation_id}</td>
                            <td className="py-2 px-2 text-slate-300">
                              {op.standard_cycle_time_minutes ?? "—"}
                            </td>
                            <td className="py-2 px-2">
                              {op.inspection_required
                                ? <StatusPill kind="info">QC</StatusPill>
                                : <StatusPill kind="neutral">—</StatusPill>}
                            </td>
                          </tr>
                        ))
                      : operations.map((op, idx) => (
                          <Fragment key={`row-${idx}`}>
                            <tr className="border-b border-white/5 align-top">
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  min={1}
                                  className="wf-input py-1"
                                  value={op.seq}
                                  onChange={(e) => updateOp(idx, { seq: e.target.value })}
                                />
                              </td>
                              <td className="py-2 px-2 min-w-[180px]">
                                {op.processMode === "new" ? (
                                  <div className="space-y-1">
                                    <span className="text-[10px] uppercase text-cyan-200 font-semibold">
                                      New process
                                    </span>
                                    <button
                                      type="button"
                                      className="block text-[10px] text-slate-400 underline"
                                      onClick={() => handleProcessSelect(idx, "")}
                                    >
                                      Pick existing instead
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <select
                                      className="wf-select py-1 text-xs"
                                      value={op.process_id}
                                      onChange={(e) => handleProcessSelect(idx, e.target.value)}
                                    >
                                      <option value="">— Process —</option>
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
                                      className="text-[10px] text-cyan-200 underline"
                                      onClick={() => enableNewProcess(idx)}
                                    >
                                      + New process
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  className="wf-input py-1"
                                  placeholder="e.g. Melting"
                                  value={op.name}
                                  onChange={(e) => updateOp(idx, { name: e.target.value })}
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  className="wf-input py-1 font-mono"
                                  placeholder="auto"
                                  value={op.code}
                                  onChange={(e) => updateOp(idx, { code: e.target.value })}
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  min={0}
                                  className="wf-input py-1"
                                  placeholder="—"
                                  value={op.cycle}
                                  onChange={(e) => updateOp(idx, { cycle: e.target.value })}
                                />
                              </td>
                              <td className="py-2 px-2">
                                <label className="flex items-center gap-1 text-xs text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={op.inspect}
                                    onChange={(e) => updateOp(idx, { inspect: e.target.checked })}
                                  />
                                  QC
                                </label>
                              </td>
                              <td className="py-2 px-2 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  title="Move up"
                                  className="text-slate-400 hover:text-slate-100 px-1 disabled:opacity-30"
                                  onClick={() => moveOpRow(idx, -1)}
                                  disabled={idx === 0}
                                >↑</button>
                                <button
                                  type="button"
                                  title="Move down"
                                  className="text-slate-400 hover:text-slate-100 px-1 disabled:opacity-30"
                                  onClick={() => moveOpRow(idx, +1)}
                                  disabled={idx === operations.length - 1}
                                >↓</button>
                                <button
                                  type="button"
                                  title="Remove"
                                  className="text-rose-300 hover:text-rose-200 px-1 disabled:opacity-30"
                                  onClick={() => removeOpRow(idx)}
                                  disabled={operations.length === 1}
                                >×</button>
                              </td>
                            </tr>
                            {(op.process_id || op.processMode === "new") && (
                              <tr key={`cap-${idx}`} className="border-b border-white/5">
                                <td colSpan={7} className="py-3 px-2">
                                  <div className="wf-light-panel rounded-lg p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[#08264a] mb-2">
                                      Data to capture during this step
                                    </p>
                                    {op.processMode === "new" && (
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                        <div>
                                          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                                            Process code
                                          </label>
                                          <input
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                                            placeholder="e.g. MOULD"
                                            value={op.newProcess?.process_code || ""}
                                            onChange={(e) =>
                                              updateOp(idx, {
                                                newProcess: {
                                                  ...(op.newProcess || {}),
                                                  process_code: e.target.value
                                                },
                                                code: e.target.value,
                                                name: op.name || op.newProcess?.process_name
                                              })
                                            }
                                          />
                                        </div>
                                        <div>
                                          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                                            Process name
                                          </label>
                                          <input
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                                            placeholder="e.g. Moulding"
                                            value={op.newProcess?.process_name || ""}
                                            onChange={(e) =>
                                              updateOp(idx, {
                                                newProcess: {
                                                  ...(op.newProcess || {}),
                                                  process_name: e.target.value
                                                },
                                                name: e.target.value
                                              })
                                            }
                                          />
                                        </div>
                                        <div>
                                          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                                            Process type
                                          </label>
                                          <input
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                                            placeholder="e.g. casting"
                                            value={op.newProcess?.process_type || ""}
                                            onChange={(e) =>
                                              updateOp(idx, {
                                                newProcess: {
                                                  ...(op.newProcess || {}),
                                                  process_type: e.target.value
                                                }
                                              })
                                            }
                                          />
                                        </div>
                                      </div>
                                    )}
                                    {op.loadingTemplate && (
                                      <p className="text-xs text-slate-500">Loading capture fields…</p>
                                    )}
                                    {!op.loadingTemplate &&
                                      op.processMode === "existing" &&
                                      op.existingTemplate?.fields?.length > 0 &&
                                      !op.showCaptureBuilder && (
                                        <>
                                          <p className="text-sm text-emerald-800 bg-emerald-50 rounded px-2 py-1 mb-2">
                                            {captureSummary(op.existingTemplate.fields)}
                                          </p>
                                          <button
                                            type="button"
                                            className="text-xs text-[#08264a] underline mb-2"
                                            onClick={() => updateOp(idx, { showCaptureBuilder: true })}
                                          >
                                            + Add more capture fields
                                          </button>
                                        </>
                                      )}
                                    {!op.loadingTemplate &&
                                      op.processMode === "existing" &&
                                      !op.existingTemplate?.fields?.length &&
                                      !op.showCaptureBuilder && (
                                        <button
                                          type="button"
                                          className="wf-btn wf-btn-ghost text-xs mb-2"
                                          onClick={() =>
                                            updateOp(idx, {
                                              showCaptureBuilder: true,
                                              templateMeta: emptyTemplateMeta(),
                                              templateFields: [emptyFieldRow()]
                                            })
                                          }
                                        >
                                          + Define capture parameters
                                        </button>
                                      )}
                                    {(op.processMode === "new" ||
                                      op.showCaptureBuilder) && (
                                      <>
                                        <DataCaptureTemplateBuilder
                                          embedded
                                          editOnly
                                          templateMeta={op.templateMeta}
                                          onTemplateMetaChange={(meta) =>
                                            updateOp(idx, { templateMeta: meta })
                                          }
                                          fields={op.templateFields}
                                          onFieldsChange={(fields) =>
                                            updateOp(idx, { templateFields: fields })
                                          }
                                        />
                                        <p className="text-xs text-slate-500 mt-2">
                                          Saved when you click Save Routing.
                                        </p>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>

            {!savedRouting ? (
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
                <div className="text-xs text-slate-400">
                  Saving creates the <span className="text-cyan-300 font-medium">routing</span> and all operations atomically.
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="wf-btn wf-btn-ghost"
                    onClick={() => setOperations([emptyOp(1)])}
                  >
                    Clear ops
                  </button>
                  <button
                    type="button"
                    className="wf-btn wf-btn-primary"
                    disabled={!canSave}
                    onClick={saveRouting}
                  >
                    {saving ? "Saving…" : "Save Routing"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
                <div className="text-xs text-slate-400">
                  Routing <span className="text-cyan-300 font-mono">{savedRouting.routing_id}</span> active and ready to be consumed by the lot Routing Flow.
                </div>
                <button
                  type="button"
                  className="wf-btn wf-btn-ghost"
                  onClick={resetForm}
                >
                  + New routing
                </button>
              </div>
            )}
          </WfCardBody>
        </WfCard>

        {/* ---- side rail ---- */}
        <div className="space-y-5">
          <WfCard>
            <WfCardHeader title="Ontology" subtitle="Routing relationships" icon={<IconAtom />} />
            <WfCardBody className="space-y-2.5">
              <OntologyEdge from="Part" to="Routing" label="follows" />
              <OntologyEdge from="Routing" to="Operation" label="hasOperation" />
              <OntologyEdge from="Operation" to="Machine" label="requires" />
              <OntologyEdge from="Operation" to="Material" label="consumes" />
              <OntologyEdge from="Operation" to="Tool" label="uses" />
              <OntologyEdge from="Operation" to="Workforce" label="needs" />
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader
              title="Existing routings"
              subtitle={part ? `For ${part.part_code || part.part_id}` : "Pick a part first"}
              icon={<IconList />}
            />
            <WfCardBody>
              {!partId ? (
                <EmptyState
                  title="Select a part"
                  hint="Existing routings will appear here once you pick a part."
                  icon={<IconList />}
                />
              ) : loadingRoutings ? (
                <div className="text-sm text-slate-400">Loading…</div>
              ) : existingRoutings.length === 0 ? (
                <EmptyState
                  title="No routings yet"
                  hint="Save below to create the first routing for this part."
                  icon={<IconList />}
                />
              ) : (
                <ul className="space-y-2 text-sm">
                  {existingRoutings.map((r) => (
                    <li
                      key={r.routing_id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-slate-900/40 border border-slate-700/30"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-slate-200 truncate">{r.routing_id}</div>
                        <div className="text-[11px] text-slate-500">
                          {r.routing_version || "—"} · {r.process_type || "—"}
                        </div>
                      </div>
                      {r.is_active
                        ? <StatusPill kind="ok">Active</StatusPill>
                        : <StatusPill kind="neutral">Inactive</StatusPill>}
                    </li>
                  ))}
                </ul>
              )}
            </WfCardBody>
          </WfCard>
        </div>
      </div>

      {/* ---- resource requirements (only after save) ---- */}
      {savedRouting && savedOperations.length > 0 && (
        <WfCard>
          <WfCardHeader
            title="Resource Requirements"
            subtitle="Attach the materials, machines, tools and workforce each operation needs - this feeds the feasibility check."
            icon={<IconAtom />}
          />
          <WfCardBody className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <label className="wf-label">Operation</label>
                <select
                  className="wf-select"
                  value={reqOpId}
                  onChange={(e) => setReqOpId(e.target.value)}
                >
                  {savedOperations.map((op) => (
                    <option key={op.operation_id} value={op.operation_id}>
                      Seq {op.operation_sequence} · {op.operation_name} ({op.operation_id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="wf-label">Resource Type</label>
                <select
                  className="wf-select"
                  value={reqResourceType}
                  onChange={(e) => setReqResourceType(e.target.value)}
                >
                  {RESOURCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="wf-label">Resource</label>
                <select
                  className="wf-select"
                  value={reqResourceId}
                  onChange={(e) => setReqResourceId(e.target.value)}
                >
                  <option value="">-- Pick a resource --</option>
                  {reqResources.map((r) => {
                    const meta = RESOURCE_TYPES.find((t) => t.value === reqResourceType);
                    return (
                      <option key={r.id} value={r.id}>
                        {r[meta.idKey]} · {r[meta.nameKey]}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="wf-label">Quantity</label>
                <input
                  className="wf-input"
                  type="number"
                  step="0.0001"
                  min={0}
                  value={reqQuantity}
                  onChange={(e) => setReqQuantity(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reqMandatory}
                    onChange={(e) => setReqMandatory(e.target.checked)}
                  />
                  Mandatory
                </label>
              </div>
              <div className="md:col-span-5 flex justify-end">
                <button
                  type="button"
                  className="wf-btn wf-btn-primary"
                  onClick={addRequirement}
                  disabled={!reqOpId || !reqResourceId}
                >
                  Attach requirement
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-slate-900/40 border border-slate-700/30 p-4">
              <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-3">
                Attached to {reqOpId || "—"}
              </div>
              {(requirementsByOp[reqOpId] || []).length === 0 ? (
                <EmptyState
                  title="No resources attached yet"
                  hint="Use the picker above to add at least one resource."
                  icon={<IconAtom />}
                />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                      <th className="text-left py-2 px-3 font-semibold">Type</th>
                      <th className="text-left py-2 px-3 font-semibold">Resource Ref</th>
                      <th className="text-left py-2 px-3 font-semibold">Quantity</th>
                      <th className="text-left py-2 px-3 font-semibold">Mandatory</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(requirementsByOp[reqOpId] || []).map((r) => (
                      <tr key={r.id} className="border-b border-white/5">
                        <td className="py-2 px-3 text-slate-200 capitalize">{r.required_resource_type}</td>
                        <td className="py-2 px-3 font-mono text-slate-300">#{r.required_resource_id}</td>
                        <td className="py-2 px-3 text-slate-300">{r.required_quantity}</td>
                        <td className="py-2 px-3">
                          {r.is_mandatory
                            ? <StatusPill kind="ok">Yes</StatusPill>
                            : <StatusPill kind="neutral">Optional</StatusPill>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
              <Link to="/workflow/routing" className="wf-btn wf-btn-ghost">
                Go to lot Routing Flow →
              </Link>
              <Link to="/workflow/customer-order" className="wf-btn wf-btn-primary">
                Start a Customer Order →
              </Link>
            </div>
          </WfCardBody>
        </WfCard>
      )}
    </div>
  );
}


function IconFlow() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="6" height="6" rx="1"/><rect x="15" y="4" width="6" height="6" rx="1"/><rect x="9" y="14" width="6" height="6" rx="1"/><path d="M9 7h6M6 10v4h6M18 10v4h-6"/></svg>; }
function IconAtom() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconList() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>; }


export default RoutingMaster;
