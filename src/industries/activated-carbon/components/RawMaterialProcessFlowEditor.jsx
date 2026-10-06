import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchAcRawMaterialType, formatAcApiError } from "../../../services/activatedCarbonApi";
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
  AC_INBOUND_FIXED_END,
  AC_INBOUND_FIXED_START,
  AC_TERMINAL_INSTOCK,
  buildStandardShopFloorOperations,
  splitTerminalFinishedGoodsQc
} from "../constants/acRawMaterialProcessCatalog";
import { displayOperationLabel } from "../constants/processSteps";
import { isGrCoconutShellType, keepGrCoconutShellTypes } from "../utils/acGrCoconutShell";

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
    inbound_operations: [],
    process_parameters: [],
    status: "ACTIVE",
    is_obsolete: false,
    usage: null
  };
}

function draftFromType(type) {
  if (!type) return emptyDraft();
  const inboundOps = attachParametersToOperations(
    type.inbound_operations || [],
    type.process_parameters || []
  );
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
    inbound_operations: inboundOps,
    operations,
    process_parameters: (type.process_parameters || []).map((p) => ({ ...p })),
    status: type.status || (type.is_obsolete ? "OBSOLETE" : "ACTIVE"),
    is_obsolete: Boolean(type.is_obsolete || String(type.status || "").toUpperCase() === "OBSOLETE"),
    usage: type.usage || null
  };
}

function RawMaterialProcessFlowEditor({
  materialTypes = [],
  onCreate,
  onUpdate,
  onMarkObsolete,
  saving = false,
  canEdit = true
}) {
  const NEW_KEY = "__new__";
  const PLACEHOLDER_KEY = "";
  const [selectedKey, setSelectedKey] = useState(PLACEHOLDER_KEY);
  const [draft, setDraft] = useState(emptyDraft);
  const [screen, setScreen] = useState("flow");
  const [processEntry, setProcessEntry] = useState({ mode: "add", index: null, zone: "shop" });
  const [validation, setValidation] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loadingType, setLoadingType] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [markingObsolete, setMarkingObsolete] = useState(false);

  const canEditDraft = canEdit && !draft.is_obsolete;
  const dispatchLocked = Boolean(draft.usage?.dispatch_completed);
  const usageLocked = Boolean(draft.usage?.kiln_process_started || dispatchLocked);
  const routingLocked = dispatchLocked;

  const sortedTypes = useMemo(
    () =>
      keepGrCoconutShellTypes(materialTypes).sort((a, b) =>
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
    const preferred = sortedTypes.find(isGrCoconutShellType) || sortedTypes[0];
    if (preferred) {
      selectTypeByKey(String(preferred.product_id || preferred.product_code));
    }
  }, [sortedTypes, selectedKey, selectTypeByKey]);

  const operations = useMemo(
    () => resequenceOperations(draft.operations || []),
    [draft.operations]
  );

  const { routeOperations, terminalFgQc } = useMemo(
    () => splitTerminalFinishedGoodsQc(operations),
    [operations]
  );

  const inboundOperations = useMemo(
    () => resequenceOperations(draft.inbound_operations || []),
    [draft.inbound_operations]
  );

  const activeZoneOps = processEntry.zone === "inbound" ? inboundOperations : operations;

  const patchDraft = (updater) => {
    setDraft((prev) => (typeof updater === "function" ? updater(prev) : { ...prev, ...updater }));
    setDirty(true);
  };

  const openAddProcess = () => {
    if (!canEditDraft || usageLocked) return;
    setProcessEntry({ mode: "add", index: null, zone: "shop" });
    setScreen("process");
  };

  const openAddInboundProcess = () => {
    if (!canEditDraft || usageLocked) return;
    setProcessEntry({ mode: "add", index: null, zone: "inbound" });
    setScreen("process");
  };

  const openEditProcess = (index, zone = "shop") => {
    if (!canEditDraft || usageLocked) return;
    setProcessEntry({ mode: "edit", index, zone });
    setScreen("process");
  };

  const handleProcessEntrySave = (processData) => {
    const { insertAt, parameters, ...op } = processData;
    const zone = processEntry.zone || "shop";
    const field = zone === "inbound" ? "inbound_operations" : "operations";
    patchDraft((prev) => {
      const ops = [...(prev[field] || [])];
      const withParams = { ...op, parameters: parameters || [] };
      if (processEntry.mode === "edit" && processEntry.index != null) {
        ops[processEntry.index] = { ...ops[processEntry.index], ...withParams };
        return { ...prev, [field]: resequenceOperations(ops) };
      }
      const at = Math.max(1, Math.min(Number(insertAt) || ops.length + 1, ops.length + 1));
      ops.splice(at - 1, 0, withParams);
      return { ...prev, [field]: resequenceOperations(ops) };
    });
    setScreen("flow");
  };

  const removeProcess = (index, zone = "shop") => {
    if (usageLocked) return;
    const field = zone === "inbound" ? "inbound_operations" : "operations";
    patchDraft((prev) => ({
      ...prev,
      [field]: resequenceOperations((prev[field] || []).filter((_, i) => i !== index))
    }));
  };

  const moveProcess = (index, delta, zone = "shop") => {
    if (!canEditDraft || routingLocked) return;
    const field = zone === "inbound" ? "inbound_operations" : "operations";
    const list = zone === "inbound" ? inboundOperations : operations;
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    patchDraft((prev) => ({
      ...prev,
      [field]: reorderOperations(prev[field] || [], index, target)
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
    patchDraft((prev) => {
      const { routeOperations: chain, terminalFgQc } = splitTerminalFinishedGoodsQc(
        prev.operations || []
      );
      const next = reorderOperations(chain, dragIndex, index);
      return {
        ...prev,
        operations: resequenceOperations(terminalFgQc ? [...next, terminalFgQc] : next)
      };
    });
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
    const inboundOps = resequenceOperations(
      (draft.inbound_operations || []).filter((op) => op.operation_name?.trim())
    );
    if (!ops.length) {
      throw new Error("Add at least one shop-floor process step in the routing chain.");
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
      inbound_operations: inboundOps.map((op, i) => ({
        operation_sequence: i + 1,
        operation_name: op.operation_name.trim(),
        operation_code: (op.operation_code || `IN-STEP-${i + 1}`).trim(),
        process_step: (op.process_step || "").trim().toUpperCase(),
        is_mandatory: op.is_mandatory !== false
      })),
      process_parameters: flattenOperationParameters(
        [...inboundOps, ...ops],
        draft.process_parameters
      )
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
      if (row?.product_id) {
        const fresh = await fetchAcRawMaterialType(row.product_id);
        setDraft(draftFromType(fresh));
      } else if (row) {
        setDraft(draftFromType(row));
      }
    } catch (e) {
      setValidation(formatAcApiError(e, "Save failed"));
      throw e;
    }
  };

  const handleMarkObsolete = async () => {
    if (!draft.product_id || draft.isNew || !onMarkObsolete) return;
    const label = draft.product_name || draft.product_code || "this material";
    const confirmed = window.confirm(
      `Mark "${label}" as obsolete?\n\nHistorical inward, production, and dispatch records stay unchanged. New inward receipts for this material will be blocked. You can add a new raw material type for future production.`
    );
    if (!confirmed) return;
    setValidation("");
    setMarkingObsolete(true);
    try {
      const row = await onMarkObsolete(draft.product_id);
      setDirty(false);
      if (row) {
        setDraft(draftFromType(row));
        setSelectedKey(String(row.product_id || row.product_code));
      }
    } catch (e) {
      setValidation(formatAcApiError(e, "Could not mark obsolete"));
      throw e;
    } finally {
      setMarkingObsolete(false);
    }
  };

  const applyStandardTemplate = () => {
    if (!canEditDraft || usageLocked) return;
    patchDraft((prev) => ({
      ...prev,
      operations: resequenceOperations(buildStandardShopFloorOperations())
    }));
  };

  if (screen === "process" && canEditDraft && !usageLocked) {
    return (
      <AcProcessEntryScreen
        phase={processEntry.zone === "inbound" ? "inbound" : "shop"}
        mode={processEntry.mode}
        initial={
          processEntry.mode === "edit" && processEntry.index != null
            ? activeZoneOps[processEntry.index]
            : null
        }
        stepNumber={(processEntry.index ?? 0) + 1}
        chainLength={activeZoneOps.length}
        rawMaterialName={draft.product_name}
        onSave={handleProcessEntrySave}
        onCancel={() => setScreen("flow")}
      />
    );
  }

  const showNewMaterialFields = selectedKey === NEW_KEY || draft.isNew;
  const hasSelection = selectedKey && selectedKey !== PLACEHOLDER_KEY;
  const flowEditable = canEditDraft && !routingLocked;

  return (
    <div className="ac-rm-flow-page wf-light-panel">
      {!canEdit ? (
        <AcPermissionNotice
          title="View only — process setup is restricted"
          message="Adding raw materials and changing process steps requires a Super Administrator. You can still look up existing materials and their production steps below."
        />
      ) : null}

      {canEdit && draft.isNew ? (
        <AcPermissionNotice
          variant="info"
          title="New raw material checklist"
          message='Select "+ Add new raw material…", enter raw and finished product names, click "Apply standard template" (or + Add process step), then "Create raw material & routing".'
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
            {sortedTypes.map((t) => {
              const obsolete =
                t.is_obsolete || String(t.status || "").toUpperCase() === "OBSOLETE";
              return (
              <option
                key={t.product_id || t.product_code}
                value={String(t.product_id || t.product_code)}
                title={t.product_code}
              >
                {t.product_name || t.product_code}
                {t.product_code ? ` · ${t.product_code}` : ""}
                {(t.inbound_operations?.length || t.operations?.length)
                  ? ` — ${t.inbound_operations?.length || 0} inbound / ${t.operations?.length || 0} shop`
                  : ""}
                {obsolete ? " (obsolete)" : ""}
                {!t.routing_code ? " (setup incomplete)" : ""}
              </option>
            );
            })}
          </select>
        </label>

        <div className="ac-rm-flow-selector-arrow" aria-hidden="true">
          then becomes
        </div>

        <div className="ac-rm-flow-selector ac-rm-flow-selector--finished">
          <span className="ac-rm-flow-selector-label">Finished product</span>
          {showNewMaterialFields && canEditDraft ? (
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

      {draft.is_obsolete ? (
        <div className="ac-rm-flow-obsolete-banner" role="status">
          <strong>Obsolete</strong> — kept for reports and traceability. New inward is blocked.
          Use <strong>+ Add new raw material…</strong> for future production.
        </div>
      ) : null}

      {!draft.is_obsolete && usageLocked ? (
        <div className="ac-rm-flow-lock-banner" role="status">
          {dispatchLocked
            ? "Finished product has been dispatched — routing is locked for integrity."
            : "Kiln production has started — existing steps can still be reordered and saved. Adding or removing steps is blocked."}{" "}
          To retire this material, use <strong>Mark obsolete</strong> below.
        </div>
      ) : null}

      {validation ? (
        <p className="ac-rm-flow-validation text-sm text-red-700 mb-3">{validation}</p>
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
          {" · "}
          {inboundOperations.length} inbound prep
          {" · "}
          {operations.length} shop step{operations.length === 1 ? "" : "s"}
          {" · "}
          {(draft.process_parameters || []).length} tracking field
          {(draft.process_parameters || []).length === 1 ? "" : "s"}
          {" → "}
          <strong>{draft.finished_product_name || draft.product_name || "Finished product"}</strong>
          {" → in stock"}
        </p>
      ) : null}

      {hasSelection && !draft.isNew ? (
        <p className="text-xs text-slate-500 mb-3 max-w-3xl">
          Plant story: <strong>Gate receipt</strong> (Raw Material Inward tab) →{" "}
          <strong>inbound prep</strong> (Lab / RMS bags / crusher / RM outward) →{" "}
          <strong>Release to Production</strong> → <strong>Activation</strong> (pre-kiln + kiln shop
          steps) → <strong>Post-activation</strong> → <strong>Finished goods QC</strong> → in stock.
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

      {showNewMaterialFields && canEditDraft ? (
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

      <div className="ac-rm-flow-diagram-wrap">
        <div className="ac-rm-flow-diagram" aria-label="Linear manufacturing routing">
          <div className="ac-rm-flow-diagram-segment">
            <div className="ac-rm-flow-node ac-rm-flow-node--fixed">
              <div className="ac-rm-flow-node-kicker">Required</div>
              <div className="ac-rm-flow-node-title">{AC_INBOUND_FIXED_START.operation_name}</div>
              <div className="ac-rm-flow-node-step">{AC_INBOUND_FIXED_START.description}</div>
            </div>
            <div className="ac-rm-flow-link" aria-hidden="true" />
          </div>

          {inboundOperations.map((op, index) => (
            <div key={op.operation_code || `in${index}`} className="ac-rm-flow-diagram-segment">
              <div className="ac-rm-flow-link" aria-hidden="true" />
              <div className="ac-rm-flow-process-step">
                {flowEditable ? (
                  <div className="ac-rm-flow-move-controls">
                    <button
                      type="button"
                      className="ac-rm-flow-move-btn"
                      disabled={index === 0}
                      onClick={() => moveProcess(index, -1, "inbound")}
                    >
                      ← Earlier
                    </button>
                    <button
                      type="button"
                      className="ac-rm-flow-move-btn"
                      disabled={index === inboundOperations.length - 1}
                      onClick={() => moveProcess(index, 1, "inbound")}
                    >
                      Later →
                    </button>
                  </div>
                ) : null}
              <div
                role={flowEditable ? "button" : undefined}
                tabIndex={flowEditable ? 0 : undefined}
                className="ac-rm-flow-node ac-rm-flow-node--process ac-rm-flow-node--inbound"
                onClick={flowEditable ? () => openEditProcess(index, "inbound") : undefined}
              >
                <div className="ac-rm-flow-node-kicker">Inbound prep · {index + 1}</div>
                <div className="ac-rm-flow-node-title">{op.operation_name}</div>
                <div className="ac-rm-flow-node-step">{op.process_step || "Step"}</div>
                {flowEditable ? (
                  <button
                    type="button"
                    className="text-[10px] text-red-600 mt-1 underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProcess(index, "inbound");
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              </div>
              <div className="ac-rm-flow-link" aria-hidden="true" />
            </div>
          ))}

          {flowEditable ? (
            <div className="ac-rm-flow-diagram-segment">
              <button
                type="button"
                className="ac-rm-flow-add-btn text-xs"
                onClick={openAddInboundProcess}
              >
                + Add inbound prep step
              </button>
              <div className="ac-rm-flow-link" aria-hidden="true" />
            </div>
          ) : null}

          <div className="ac-rm-flow-diagram-segment">
            <div className="ac-rm-flow-node ac-rm-flow-node--fixed">
              <div className="ac-rm-flow-node-kicker">Required</div>
              <div className="ac-rm-flow-node-title">{AC_INBOUND_FIXED_END.operation_name}</div>
              <div className="ac-rm-flow-node-step">{AC_INBOUND_FIXED_END.description}</div>
            </div>
            <div className="ac-rm-flow-link" aria-hidden="true" />
          </div>

          <div className="ac-rm-flow-node ac-rm-flow-node--material">
            <div className="ac-rm-flow-node-kicker">Raw material</div>
            <div className="ac-rm-flow-node-title">
              {draft.product_name.trim() || "Select raw material"}
            </div>
            <div className="ac-rm-flow-node-step">{draft.product_code || "RAW-AC-*"}</div>
          </div>

          {routeOperations.map((op, index) => (
            <div key={op.operation_code || `p${index}`} className="ac-rm-flow-diagram-segment">
              <div className="ac-rm-flow-link" aria-hidden="true" />
              <div className="ac-rm-flow-process-step">
                {flowEditable ? (
                  <div className="ac-rm-flow-move-controls">
                    <button
                      type="button"
                      className="ac-rm-flow-move-btn"
                      disabled={index === 0}
                      title="Move this step earlier in the chain (toward raw material)"
                      aria-label={`Move ${op.operation_name} earlier`}
                      onClick={() => moveProcess(index, -1)}
                    >
                      ← Earlier
                    </button>
                    <button
                      type="button"
                      className="ac-rm-flow-move-btn"
                      disabled={index === routeOperations.length - 1 && !terminalFgQc}
                      title="Move this step later in the chain (toward finished product)"
                      aria-label={`Move ${op.operation_name} later`}
                      onClick={() => moveProcess(index, 1)}
                    >
                      Later →
                    </button>
                  </div>
                ) : null}
                <div
                  role={flowEditable ? "button" : undefined}
                  tabIndex={flowEditable ? 0 : undefined}
                  draggable={flowEditable}
                  className={`ac-rm-flow-node ac-rm-flow-node--process${
                    flowEditable ? " ac-rm-flow-node--draggable" : ""
                  }${
                    dragIndex === index ? " ac-rm-flow-node--dragging" : ""
                  }${dropIndex === index && dragIndex !== index ? " ac-rm-flow-node--drop-target" : ""}`}
                  onDragStart={flowEditable ? () => handleDragStart(index) : undefined}
                  onDragOver={flowEditable ? (e) => handleDragOver(e, index) : undefined}
                  onDrop={flowEditable ? () => handleDrop(index) : undefined}
                  onDragEnd={flowEditable ? handleDragEnd : undefined}
                  onClick={flowEditable ? () => openEditProcess(index) : undefined}
                  onKeyDown={
                    flowEditable
                      ? (e) => {
                          if (e.key === "Enter") openEditProcess(index);
                        }
                      : undefined
                  }
                  title={
                    flowEditable
                      ? "Click to edit · drag or use Earlier/Later to reorder"
                      : op.operation_name
                  }
                >
                  <div className="ac-rm-flow-node-kicker">
                    P{index + 1}
                    {flowEditable ? <span className="ac-rm-flow-drag-hint"> ⋮⋮</span> : null}
                  </div>
                  <div className="ac-rm-flow-node-title">{displayOperationLabel(op)}</div>
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

          {terminalFgQc ? (
            <div className="ac-rm-flow-diagram-segment">
              <div className="ac-rm-flow-link" aria-hidden="true" />
              <div
                role={flowEditable ? "button" : undefined}
                tabIndex={flowEditable ? 0 : undefined}
                className={`ac-rm-flow-node ac-rm-flow-node--process ac-rm-flow-node--terminal-qc${
                  flowEditable ? " ac-rm-flow-node--draggable" : ""
                }`}
                onClick={
                  flowEditable
                    ? () => openEditProcess(operations.length - 1)
                    : undefined
                }
                onKeyDown={
                  flowEditable
                    ? (e) => {
                        if (e.key === "Enter") openEditProcess(operations.length - 1);
                      }
                    : undefined
                }
                title={flowEditable ? "Click to edit final QC step" : terminalFgQc.operation_name}
              >
                <div className="ac-rm-flow-node-kicker">Final QC</div>
                <div className="ac-rm-flow-node-title">{displayOperationLabel(terminalFgQc)}</div>
                <div className="ac-rm-flow-node-step">{terminalFgQc.process_step || "QC"}</div>
              </div>
            </div>
          ) : null}

          <div className="ac-rm-flow-diagram-segment">
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

      {flowEditable ? (
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
            Tap a step to edit. Use <strong>Earlier</strong> / <strong>Later</strong> or drag to
            reorder steps in the chain.
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
                {flowEditable ? (
                  <button
                    type="button"
                    className="text-xs text-blue-700 hover:underline ml-auto"
                    onClick={() => openEditProcess(index)}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
              {(() => {
                const destonStep =
                  /deston/i.test(String(op.operation_code || "")) ||
                  /deston/i.test(String(op.operation_name || ""));
                const extra = destonStep
                  ? (draft.process_parameters || []).filter((p) => {
                      const key = String(p.key || p.parameter_code || "").toLowerCase();
                      const bound = String(p.operation_code || "").toUpperCase();
                      return (
                        bound === "OP-DESTON-QC" ||
                        key.startsWith("deston_qc") ||
                        key === "deston_copy_from_kiln_bag"
                      );
                    })
                  : [];
                const shown = [...(op.parameters || [])];
                for (const param of extra) {
                  const key = param.key || param.parameter_code;
                  if (key && !shown.some((row) => (row.key || row.parameter_code) === key)) {
                    shown.push(param);
                  }
                }
                return shown.length ? (
                <ul className="text-sm text-slate-700 mt-2 space-y-1 list-disc pl-5">
                  {shown.map((param) => (
                    <li key={param.key || param.parameter_code}>
                      {param.label || param.key || param.parameter_code}
                      {param.unit ? ` (${param.unit})` : ""}
                      {param.mandatory !== false ? "" : " — optional"}
                    </li>
                  ))}
                </ul>
                ) : (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mt-2">
                  No fields defined for this step yet.
                </p>
                );
              })()}
            </div>
          ))}
        </details>
      ) : null}

      {operations.length > 0 && flowEditable ? (
        <div className="ac-rm-flow-process-table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 w-12">#</th>
                <th className="py-2">Step name</th>
                <th className="py-2 min-w-[14rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((op, index) => (
                <tr key={op.operation_code || index} className="border-b border-slate-100">
                  <td className="py-2 font-semibold text-slate-700">{index + 1}</td>
                  <td className="py-2">{displayOperationLabel(op)}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2 items-center">
                      <button
                        type="button"
                        className="ac-rm-flow-move-btn ac-rm-flow-move-btn--compact"
                        disabled={index === 0}
                        title="Move earlier in chain"
                        onClick={() => moveProcess(index, -1)}
                      >
                        ← Earlier
                      </button>
                      <button
                        type="button"
                        className="ac-rm-flow-move-btn ac-rm-flow-move-btn--compact"
                        disabled={index === operations.length - 1}
                        title="Move later in chain"
                        onClick={() => moveProcess(index, 1)}
                      >
                        Later →
                      </button>
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

      {canEdit && !draft.isNew && !draft.is_obsolete && onMarkObsolete ? (
        <div className="ac-rm-flow-obsolete-actions mb-3">
          <button
            type="button"
            className="ac-rm-flow-obsolete-btn"
            disabled={markingObsolete || saving}
            onClick={handleMarkObsolete}
          >
            {markingObsolete ? "Marking obsolete…" : "Mark obsolete"}
          </button>
          <p className="text-xs text-slate-500 mt-1">
            Retires this material for new inward while preserving all production and dispatch history.
          </p>
        </div>
      ) : null}

      {flowEditable ? (
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
