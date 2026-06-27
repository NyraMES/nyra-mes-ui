import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchAcRawMaterialType } from "../../../services/activatedCarbonApi";
import AcProcessEntryScreen from "./AcProcessEntryScreen";
import AcSaveBar from "./AcSaveBar";
import AcPermissionNotice from "./AcPermissionNotice";
import {
  attachParametersToOperations,
  flattenOperationParameters,
  reorderOperations,
  resequenceOperations
} from "../utils/routingParameterUtils";
import {
  AC_MANDATORY_PRE_PROCESSES,
  AC_TERMINAL_INSTOCK,
  buildStandardShopFloorOperations
} from "../constants/acRawMaterialProcessCatalog";

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
  saving = false,
  canEdit = true
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
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

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
        if (!canEdit) return;
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
    if (!canEdit) return;
    setProcessEntry({ mode: "add", index: null });
    setScreen("process");
  };

  const openEditProcess = (index) => {
    if (!canEdit) return;
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
        process_step: (op.process_step || "").trim().toUpperCase(),
        is_mandatory: op.is_mandatory !== false
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

  const applyStandardTemplate = () => {
    if (!canEdit) return;
    patchDraft((prev) => ({
      ...prev,
      operations: resequenceOperations(buildStandardShopFloorOperations())
    }));
  };

  if (screen === "process" && canEdit) {
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
      {!canEdit ? (
        <AcPermissionNotice
          title="View only — process setup is restricted"
          message="Adding raw materials and changing process steps requires a Super Administrator. You can still look up existing materials and their production steps below."
        />
      ) : null}

      <div className="ac-rm-flow-selector-bar">
        <label className="ac-rm-flow-selector ac-rm-flow-selector--raw">
          <span className="ac-rm-flow-selector-label">Choose raw material</span>
          <select
            className="ac-rm-flow-select"
            value={selectedKey}
            onChange={(e) => selectTypeByKey(e.target.value)}
            disabled={loadingType}
          >
            <option value={PLACEHOLDER_KEY}>— Pick from list —</option>
            {sortedTypes.map((t) => (
              <option
                key={t.product_id || t.product_code}
                value={String(t.product_id || t.product_code)}
                title={t.product_code}
              >
                {t.product_name || t.product_code}
                {!t.routing_code ? " (setup incomplete)" : ""}
              </option>
            ))}
            {canEdit ? <option value={NEW_KEY}>+ Add new raw material…</option> : null}
          </select>
        </label>

        <div className="ac-rm-flow-selector-arrow" aria-hidden="true">
          then becomes
        </div>

        <div className="ac-rm-flow-selector ac-rm-flow-selector--finished">
          <span className="ac-rm-flow-selector-label">Finished product</span>
          {showNewMaterialFields && canEdit ? (
            <input
              className="ac-rm-flow-select ac-rm-flow-finished-input"
              value={draft.finished_product_name}
              onChange={(e) => patchDraft({ finished_product_name: e.target.value })}
              placeholder="Output product name"
            />
          ) : showNewMaterialFields ? (
            <div className="ac-rm-flow-finished-display">
              <span className="ac-rm-flow-finished-name">{draft.finished_product_name || "—"}</span>
            </div>
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
        <p className="ac-rm-flow-data-summary--compact text-sm text-slate-600 mb-3">
          Every raw material requires <strong>Inward</strong> and <strong>Incoming QC</strong> on
          the Raw Material page. Below, configure which shop-floor processes apply to{" "}
          <strong>{draft.product_name || "this material"}</strong> after release — kiln feed,
          screening, destoning, finished-goods QC (→ in stock), and their tracking fields.
        </p>
      ) : null}

      {hasSelection || selectedKey === NEW_KEY ? (
        <p className="ac-rm-flow-data-summary--compact">
          <strong>{draft.product_name || "New material"}</strong>
          {" → "}
          {operations.length} shop-floor step{operations.length === 1 ? "" : "s"}
          {" → "}
          <strong>{draft.finished_product_name || draft.product_name || "Finished product"}</strong>
          {" → in stock"}
        </p>
      ) : null}

      {showTechnicalDetails && (hasSelection || selectedKey === NEW_KEY) ? (
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

      {(hasSelection || selectedKey === NEW_KEY) && canEdit ? (
        <button
          type="button"
          className="text-xs text-slate-500 underline mb-2"
          onClick={() => setShowTechnicalDetails((v) => !v)}
        >
          {showTechnicalDetails ? "Hide reference codes" : "Show reference codes"}
        </button>
      ) : null}

      {showNewMaterialFields && canEdit ? (
        <label className="text-sm block max-w-md mb-4">
          <span className="block mb-1 font-medium text-slate-700">Name of new raw material</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
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
          {AC_MANDATORY_PRE_PROCESSES.map((pre) => (
            <div key={pre.id} className="ac-rm-flow-diagram-segment">
              <div className="ac-rm-flow-node ac-rm-flow-node--fixed">
                <div className="ac-rm-flow-node-kicker">Required</div>
                <div className="ac-rm-flow-node-title">{pre.operation_name}</div>
                <div className="ac-rm-flow-node-step">{pre.description}</div>
              </div>
              <div className="ac-rm-flow-link" aria-hidden="true" />
            </div>
          ))}

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
                role={canEdit ? "button" : undefined}
                tabIndex={canEdit ? 0 : undefined}
                draggable={canEdit}
                className={`ac-rm-flow-node ac-rm-flow-node--process${
                  canEdit ? " ac-rm-flow-node--draggable" : ""
                }${
                  dragIndex === index ? " ac-rm-flow-node--dragging" : ""
                }${dropIndex === index && dragIndex !== index ? " ac-rm-flow-node--drop-target" : ""}`}
                onDragStart={canEdit ? () => handleDragStart(index) : undefined}
                onDragOver={canEdit ? (e) => handleDragOver(e, index) : undefined}
                onDrop={canEdit ? () => handleDrop(index) : undefined}
                onDragEnd={canEdit ? handleDragEnd : undefined}
                onClick={canEdit ? () => openEditProcess(index) : undefined}
                onKeyDown={
                  canEdit
                    ? (e) => {
                        if (e.key === "Enter") openEditProcess(index);
                      }
                    : undefined
                }
                title={canEdit ? "Drag to reorder, click to edit" : op.operation_name}
              >
                <div className="ac-rm-flow-node-kicker">
                  P{index + 1}
                  {canEdit ? <span className="ac-rm-flow-drag-hint"> ⋮⋮</span> : null}
                </div>
                <div className="ac-rm-flow-node-title">{op.operation_name}</div>
                <div className="ac-rm-flow-node-step">{op.process_step || "Step"}</div>
                <div className="ac-rm-flow-node-meta">
                  {op.is_mandatory === false ? (
                    <span className="text-amber-700">Optional</span>
                  ) : (
                    <span className="text-emerald-700">Mandatory</span>
                  )}
                  {(op.parameters || []).length > 0 ? (
                    <span>
                      {" · "}
                      {(op.parameters || []).length} field
                      {(op.parameters || []).length === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="ac-rm-flow-node-meta--warn"> · No fields set yet</span>
                  )}
                </div>
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
            <div className="ac-rm-flow-link" aria-hidden="true" />
            <div className="ac-rm-flow-node ac-rm-flow-node--instock">
              <div className="ac-rm-flow-node-kicker">Terminal</div>
              <div className="ac-rm-flow-node-title">{AC_TERMINAL_INSTOCK.operation_name}</div>
              <div className="ac-rm-flow-node-step">{AC_TERMINAL_INSTOCK.description}</div>
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

      {canEdit ? (
        <div className="ac-rm-flow-actions">
          <button
            type="button"
            className="ac-rm-flow-add-process-btn"
            onClick={openAddProcess}
            disabled={!hasSelection && selectedKey !== NEW_KEY}
          >
            + Add process step
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={applyStandardTemplate}
            disabled={!hasSelection && selectedKey !== NEW_KEY}
          >
            Apply standard template
          </button>
          <p className="text-xs text-slate-500">
            Standard template: kiln feed → activation → screening → destoning (optional) → QC.
            Tap a step to edit fields and mandatory/optional. Drag to reorder.
          </p>
        </div>
      ) : null}

      {operations.length > 0 ? (
        <details className="ac-rm-flow-triplets-panel mb-4">
          <summary className="text-sm font-semibold text-slate-800 cursor-pointer py-2">
            Fields recorded at each step ({operations.length} steps)
          </summary>
          {operations.map((op, index) => (
            <div key={op.operation_code || index} className="ac-rm-flow-step-triplets mt-3">
              <div className="ac-rm-flow-step-triplets-head">
                <strong>
                  Step {index + 1}: {op.operation_name}
                </strong>
                {canEdit ? (
                  <button
                    type="button"
                    className="text-xs text-blue-700 hover:underline ml-auto"
                    onClick={() => openEditProcess(index)}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
              {(op.parameters || []).length ? (
                <ul className="text-sm text-slate-700 mt-2 space-y-1 list-disc pl-5">
                  {(op.parameters || []).map((param) => (
                    <li key={param.key}>
                      {param.label || param.key}
                      {param.unit ? ` (${param.unit})` : ""}
                      {param.mandatory !== false ? "" : " — optional"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mt-2">
                  No fields defined for this step yet.
                </p>
              )}
            </div>
          ))}
        </details>
      ) : null}

      {operations.length > 0 && canEdit ? (
        <div className="ac-rm-flow-process-table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 w-12">#</th>
                <th className="py-2">Step name</th>
                <th className="py-2 w-48">Actions</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((op, index) => (
                <tr key={op.operation_code || index} className="border-b border-slate-100">
                  <td className="py-2 font-semibold text-slate-700">{index + 1}</td>
                  <td className="py-2">{op.operation_name}</td>
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

      {canEdit ? (
        <AcSaveBar
          onSave={handleSave}
          saving={saving}
          saveLabel={draft.isNew ? "Create raw material & routing" : "Save routing"}
          disabled={(!dirty && !draft.isNew) || (!hasSelection && selectedKey !== NEW_KEY)}
        />
      ) : null}
    </div>
  );
}

export default RawMaterialProcessFlowEditor;
