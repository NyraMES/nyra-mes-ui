import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchAcRawMaterialType } from "../../../services/activatedCarbonApi";
import AcProcessEntryScreen from "./AcProcessEntryScreen";
import AcSaveBar from "./AcSaveBar";
import {
  attachParametersToOperations,
  buildTripletPreview,
  executionTripletCount,
  flattenOperationParameters,
  reorderOperations,
  resequenceOperations
} from "../utils/routingParameterUtils";

import "../styles/rawMaterialFlow.css";

function emptyDraft() {
  return {
    isNew: true,
    product_id: null,
    product_code: "",
    product_name: "",
    finished_product_name: "",
    finished_product_code: "",
    routing_code: "",
    operations: [],
    process_parameters: []
  };
}

function draftFromType(type) {
  if (!type) return emptyDraft();
  const operations = attachParametersToOperations(
    type.operations || [],
    type.process_parameters || []
  );
  return {
    isNew: false,
    product_id: type.product_id,
    product_code: type.product_code || "",
    product_name: type.product_name || "",
    finished_product_name: type.finished_product_name || type.product_name || "",
    finished_product_code: type.finished_product_code || "",
    routing_code: type.routing_code || "",
    operations,
    process_parameters: (type.process_parameters || []).map((p) => ({ ...p }))
  };
}

function RawMaterialProcessFlowEditor({
  materialTypes = [],
  onCreate,
  onUpdate,
  saving = false
}) {
  const NEW_KEY = "__new__";
  const PLACEHOLDER_KEY = "";
  const [selectedKey, setSelectedKey] = useState(PLACEHOLDER_KEY);
  const [draft, setDraft] = useState(emptyDraft);
  const [screen, setScreen] = useState("flow");
  const [processEntry, setProcessEntry] = useState({ mode: "add", index: null });
  const [validation, setValidation] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loadingType, setLoadingType] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  const sortedTypes = useMemo(
    () =>
      [...materialTypes].sort((a, b) =>
        (a.product_name || a.product_code || "").localeCompare(
          b.product_name || b.product_code || ""
        )
      ),
    [materialTypes]
  );

  const loadTypeDraft = useCallback(async (type) => {
    if (!type?.product_id) {
      setDraft(draftFromType(type));
      return;
    }
    setLoadingType(true);
    try {
      const fresh = await fetchAcRawMaterialType(type.product_id);
      setDraft(draftFromType(fresh));
    } catch {
      setDraft(draftFromType(type));
    } finally {
      setLoadingType(false);
    }
  }, []);

  const selectTypeByKey = useCallback(
    async (key) => {
      setScreen("flow");
      setProcessEntry({ mode: "add", index: null });
      setValidation("");
      setDirty(false);
      setDragIndex(null);
      setDropIndex(null);

      if (key === NEW_KEY) {
        setSelectedKey(NEW_KEY);
        setDraft(emptyDraft());
        return;
      }
      if (!key) {
        setSelectedKey(PLACEHOLDER_KEY);
        setDraft(emptyDraft());
        return;
      }

      const type = sortedTypes.find(
        (t) => String(t.product_id) === String(key) || String(t.product_code) === String(key)
      );
      if (!type) return;

      setSelectedKey(String(type.product_id || type.product_code));
      await loadTypeDraft(type);
    },
    [sortedTypes, loadTypeDraft]
  );

  useEffect(() => {
    if (selectedKey && selectedKey !== PLACEHOLDER_KEY && selectedKey !== NEW_KEY) return;
    if (sortedTypes.length === 1) {
      selectTypeByKey(String(sortedTypes[0].product_id || sortedTypes[0].product_code));
    }
  }, [sortedTypes, selectedKey, selectTypeByKey]);

  const operations = useMemo(
    () => resequenceOperations(draft.operations || []),
    [draft.operations]
  );

  const patchDraft = (updater) => {
    setDraft((prev) => (typeof updater === "function" ? updater(prev) : { ...prev, ...updater }));
    setDirty(true);
  };

  const openAddProcess = () => {
    setProcessEntry({ mode: "add", index: null });
    setScreen("process");
  };

  const openEditProcess = (index) => {
    setProcessEntry({ mode: "edit", index });
    setScreen("process");
  };

  const handleProcessEntrySave = (processData) => {
    const { insertAt, parameters, ...op } = processData;
    patchDraft((prev) => {
      let ops = resequenceOperations(prev.operations || []);
      const withParams = { ...op, parameters: parameters || [] };
      if (processEntry.mode === "edit" && processEntry.index != null) {
        ops[processEntry.index] = { ...ops[processEntry.index], ...withParams };
        return { ...prev, operations: resequenceOperations(ops) };
      }
      const at = Math.max(1, Math.min(Number(insertAt) || ops.length + 1, ops.length + 1));
      ops.splice(at - 1, 0, withParams);
      return { ...prev, operations: resequenceOperations(ops) };
    });
    setScreen("flow");
  };

  const removeProcess = (index) => {
    patchDraft((prev) => ({
      ...prev,
      operations: resequenceOperations((prev.operations || []).filter((_, i) => i !== index))
    }));
  };

  const handleDragStart = (index) => {
    setDragIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDropIndex(index);
  };

  const handleDrop = (index) => {
    if (dragIndex == null || dragIndex === index) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    patchDraft((prev) => ({
      ...prev,
      operations: reorderOperations(prev.operations || [], dragIndex, index)
    }));
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  const buildPayload = () => {
    const ops = resequenceOperations(
      (draft.operations || []).filter((op) => op.operation_name?.trim())
    );
    if (!ops.length) {
      throw new Error("Add at least one process step (P1, P2, …) in the routing chain.");
    }
    if (!draft.product_name.trim()) {
      throw new Error("Raw material name is required.");
    }
    return {
      product_name: draft.product_name.trim(),
      finished_product_name:
        draft.finished_product_name.trim() || draft.product_name.trim(),
      operations: ops.map((op, i) => ({
        operation_sequence: i + 1,
        operation_name: op.operation_name.trim(),
        operation_code: (op.operation_code || `OP-STEP-${i + 1}`).trim(),
        process_step: (op.process_step || "").trim().toUpperCase()
      })),
      process_parameters: flattenOperationParameters(ops, draft.process_parameters)
    };
  };

  const handleSave = async () => {
    setValidation("");
    try {
      const payload = buildPayload();
      if (draft.isNew) {
        const row = await onCreate?.(payload);
        setDirty(false);
        if (row?.product_id) {
          setSelectedKey(String(row.product_id));
          setDraft(draftFromType(row));
        }
        return;
      }
      const row = await onUpdate?.(draft.product_id, payload);
      setDirty(false);
      if (row) setDraft(draftFromType(row));
    } catch (e) {
      setValidation(e?.message || "Save failed");
      throw e;
    }
  };

  if (screen === "process") {
    return (
      <AcProcessEntryScreen
        mode={processEntry.mode}
        initial={
          processEntry.mode === "edit" && processEntry.index != null
            ? operations[processEntry.index]
            : null
        }
        stepNumber={(processEntry.index ?? 0) + 1}
        chainLength={operations.length}
        rawMaterialName={draft.product_name}
        onSave={handleProcessEntrySave}
        onCancel={() => setScreen("flow")}
      />
    );
  }

  const showNewMaterialFields = selectedKey === NEW_KEY || draft.isNew;
  const hasSelection = selectedKey && selectedKey !== PLACEHOLDER_KEY;

  return (
    <div className="ac-rm-flow-page wf-light-panel">
      <div className="ac-rm-flow-selector-bar">
        <label className="ac-rm-flow-selector ac-rm-flow-selector--raw">
          <span className="ac-rm-flow-selector-label">Raw material</span>
          <select
            className="ac-rm-flow-select"
            value={selectedKey}
            onChange={(e) => selectTypeByKey(e.target.value)}
            disabled={loadingType}
          >
            <option value={PLACEHOLDER_KEY}>— Select raw material —</option>
            {sortedTypes.map((t) => (
              <option key={t.product_id || t.product_code} value={String(t.product_id || t.product_code)}>
                {t.product_code} — {t.product_name}
                {!t.routing_code ? " (no routing yet)" : ""}
              </option>
            ))}
            <option value={NEW_KEY}>+ New raw material…</option>
          </select>
        </label>

        <div className="ac-rm-flow-selector-arrow" aria-hidden="true">
          →
        </div>

        <div className="ac-rm-flow-selector ac-rm-flow-selector--finished">
          <span className="ac-rm-flow-selector-label">Finished product</span>
          {showNewMaterialFields ? (
            <input
              className="ac-rm-flow-select ac-rm-flow-finished-input"
              value={draft.finished_product_name}
              onChange={(e) => patchDraft({ finished_product_name: e.target.value })}
              placeholder="Output product name"
            />
          ) : (
            <div className="ac-rm-flow-finished-display">
              <span className="ac-rm-flow-finished-name">
                {hasSelection
                  ? draft.finished_product_name || draft.product_name || "—"
                  : "Select raw material"}
              </span>
              <span className="ac-rm-flow-finished-code">
                {draft.finished_product_code || (hasSelection ? "FG-AC-*" : "")}
                {draft.routing_code ? ` · ${draft.routing_code}` : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {loadingType ? (
        <p className="text-sm text-slate-500">Loading routing for selected raw material…</p>
      ) : null}

      {hasSelection || selectedKey === NEW_KEY ? (
        <div className="ac-rm-flow-data-summary">
          <dl className="ac-rm-flow-data-grid">
            <div>
              <dt>Raw material</dt>
              <dd>
                <span className="font-mono text-slate-700">{draft.product_code || "RAW-AC-*"}</span>
                <span className="text-slate-900"> · {draft.product_name || "—"}</span>
              </dd>
            </div>
            <div>
              <dt>Finished product</dt>
              <dd>
                <span className="font-mono text-slate-700">
                  {draft.finished_product_code || "FG-AC-*"}
                </span>
                <span className="text-slate-900">
                  {" "}
                  · {draft.finished_product_name || draft.product_name || "—"}
                </span>
              </dd>
            </div>
            <div>
              <dt>Routing</dt>
              <dd className="font-mono text-slate-700">{draft.routing_code || "Assigned on save"}</dd>
            </div>
            <div>
              <dt>Process steps</dt>
              <dd>{operations.length} step{operations.length === 1 ? "" : "s"}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {showNewMaterialFields ? (
        <label className="text-sm block max-w-md mb-4">
          <span className="block mb-1 font-medium text-slate-700">New raw material name</span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={draft.product_name}
            onChange={(e) => patchDraft({ product_name: e.target.value })}
            placeholder="e.g. Coconut Shell"
          />
        </label>
      ) : null}

      {validation ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
          {validation}
        </p>
      ) : null}

      <div className="ac-rm-flow-diagram-wrap">
        <div className="ac-rm-flow-diagram" aria-label="Linear manufacturing routing">
          <div className="ac-rm-flow-node ac-rm-flow-node--material">
            <div className="ac-rm-flow-node-kicker">Raw material</div>
            <div className="ac-rm-flow-node-title">
              {draft.product_name.trim() || "Select raw material"}
            </div>
            <div className="ac-rm-flow-node-step">{draft.product_code || "RAW-AC-*"}</div>
          </div>

          {operations.map((op, index) => (
            <div key={op.operation_code || `p${index}`} className="ac-rm-flow-diagram-segment">
              <div className="ac-rm-flow-link" aria-hidden="true" />
              <div
                role="button"
                tabIndex={0}
                draggable
                className={`ac-rm-flow-node ac-rm-flow-node--process ac-rm-flow-node--draggable${
                  dragIndex === index ? " ac-rm-flow-node--dragging" : ""
                }${dropIndex === index && dragIndex !== index ? " ac-rm-flow-node--drop-target" : ""}`}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                onClick={() => openEditProcess(index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openEditProcess(index);
                }}
                title="Drag to reorder, click to edit"
              >
                <div className="ac-rm-flow-node-kicker">
                  P{index + 1}
                  <span className="ac-rm-flow-drag-hint"> ⋮⋮</span>
                </div>
                <div className="ac-rm-flow-node-title">{op.operation_name}</div>
                <div className="ac-rm-flow-node-step">{op.process_step || op.operation_code}</div>
                {executionTripletCount(op) > 0 ? (
                  <div className="ac-rm-flow-node-meta">
                    {executionTripletCount(op)} execution triplet
                    {executionTripletCount(op) === 1 ? "" : "s"}
                  </div>
                ) : (
                  <div className="ac-rm-flow-node-meta ac-rm-flow-node-meta--warn">
                    No execution triplets
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="ac-rm-flow-diagram-segment">
            <div className="ac-rm-flow-link" aria-hidden="true" />
            <div className="ac-rm-flow-node ac-rm-flow-node--output">
              <div className="ac-rm-flow-node-kicker">Finished product</div>
              <div className="ac-rm-flow-node-title">
                {draft.finished_product_name.trim() || draft.product_name.trim() || "Output"}
              </div>
              <div className="ac-rm-flow-node-step">
                {draft.finished_product_code || "FG-AC-*"}
              </div>
            </div>
          </div>
        </div>

        {!operations.length && hasSelection ? (
          <div className="ac-rm-flow-empty">
            No process steps for this raw material yet. Use <strong>Add process</strong> to define
            P1 and build Raw → P1 → … → Finished goods.
          </div>
        ) : null}
        {!hasSelection && selectedKey !== NEW_KEY ? (
          <div className="ac-rm-flow-empty">
            Choose an existing raw material from the dropdown to load its routing chain.
          </div>
        ) : null}
      </div>

      <div className="ac-rm-flow-actions">
        <button
          type="button"
          className="ac-rm-flow-add-process-btn"
          onClick={openAddProcess}
          disabled={!hasSelection && selectedKey !== NEW_KEY}
        >
          + Add process
        </button>
        <p className="text-xs text-slate-500">
          Drag process nodes to reorder. Each step needs execution triplets (Subject → Predicate →
          Object) — click a node to edit.
        </p>
      </div>

      {operations.length > 0 ? (
        <div className="ac-rm-flow-triplets-panel">
          <h4 className="text-sm font-semibold text-slate-800 mb-2">
            Execution triplets by process step
          </h4>
          <p className="text-xs text-slate-500 mb-3">
            Values captured on the shop floor when each operation completes. Each row is staged as
            a knowledge-graph triplet on save.
          </p>
          {operations.map((op, index) => (
            <div key={op.operation_code || index} className="ac-rm-flow-step-triplets">
              <div className="ac-rm-flow-step-triplets-head">
                <strong>
                  P{index + 1}: {op.operation_name}
                </strong>
                <span className="font-mono text-xs text-slate-500">{op.operation_code}</span>
                <button
                  type="button"
                  className="text-xs text-blue-700 hover:underline ml-auto"
                  onClick={() => openEditProcess(index)}
                >
                  Edit triplets
                </button>
              </div>
              {(op.parameters || []).length ? (
                <table className="ac-triplet-table w-full text-xs">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Subject</th>
                      <th>Predicate</th>
                      <th>Object (at execution)</th>
                      <th>Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(op.parameters || []).map((param) => {
                      const preview = buildTripletPreview(param);
                      return (
                        <tr key={param.key}>
                          <td>
                            <span className="font-medium text-slate-800">{param.label}</span>
                            <code className="block text-[10px] text-slate-500">{param.key}</code>
                          </td>
                          <td>
                            <code className="ac-triplet-uri">{preview.subject_uri}</code>
                          </td>
                          <td>
                            <code className="ac-triplet-uri">{preview.predicate_uri}</code>
                          </td>
                          <td>
                            {preview.object_hint}
                            {param.unit ? ` (${param.unit})` : ""}
                          </td>
                          <td>{param.mandatory !== false ? "Yes" : "No"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                  No execution triplets — click Edit to add required capture fields.
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {operations.length > 0 ? (
        <div className="ac-rm-flow-process-table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 w-12">#</th>
                <th className="py-2">Process</th>
                <th className="py-2">Type</th>
                <th className="py-2">Execution triplets</th>
                <th className="py-2 w-48">Actions</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((op, index) => (
                <tr key={op.operation_code || index} className="border-b border-slate-100">
                  <td className="py-2 font-semibold text-slate-700">P{index + 1}</td>
                  <td className="py-2">{op.operation_name}</td>
                  <td className="py-2 font-mono text-xs">{op.process_step}</td>
                  <td className="py-2 text-xs text-slate-600">
                    {executionTripletCount(op)
                      ? (op.parameters || [])
                          .map((p) => p.label || p.key)
                          .join(", ")
                      : "— none defined —"}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-xs text-blue-700 hover:underline"
                        onClick={() => openEditProcess(index)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => removeProcess(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <AcSaveBar
        onSave={handleSave}
        saving={saving}
        saveLabel={draft.isNew ? "Create raw material & routing" : "Save routing"}
        disabled={(!dirty && !draft.isNew) || (!hasSelection && selectedKey !== NEW_KEY)}
      />
    </div>
  );
}

export default RawMaterialProcessFlowEditor;
