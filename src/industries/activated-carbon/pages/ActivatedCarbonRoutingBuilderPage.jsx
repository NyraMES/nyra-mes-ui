import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppContext } from "../../../context/AppContext";
import useAcPageRefresh from "../hooks/useAcPageRefresh";
import {
  addOperationParameter,
  copyRoutingFromTemplate,
  createOperationDraft,
  createParameterDraft,
  createRoutingOperation,
  deleteOperationParameter,
  deleteRoutingOperation,
  fetchActiveWorkspaceRouting,
  formatApiError,
  isUuid,
  patchOperationSequence,
  saveWorkspaceRoutingLocal,
  setOperationResourceRequirements,
  updateOperationParameter,
  updateRoutingOperation
} from "../services/acRoutingBuilderApi";
import { fetchAcMasters } from "../../../services/activatedCarbonApi";
import ResourceRequirementsDialog from "../components/routing-builder/ResourceRequirementsDialog";
import {
  buildRoutingTableRows,
  createTemplateRoutingReference,
  isKilnCoreOperation,
  sortOperations,
  suggestInsertSequence
} from "../constants/defaultActivatedCarbonRoute";
import OperationGateBadges from "../components/routing-builder/OperationGateBadges";
import OperationEditorDialog from "../components/routing-builder/OperationEditorDialog";
import ParameterEditorDialog from "../components/routing-builder/ParameterEditorDialog";
import AcRoutingBuilderGuide from "../components/AcRoutingBuilderGuide";
import AcAlert from "../components/AcAlert";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

import "../styles/routingBuilder.css";

function formatParamValue(value) {
  if (value == null || value === "") return "—";
  return String(value);
}

function operationApiId(operation) {
  return operation.routing_operation_id || operation.operation_id;
}

function ActivatedCarbonRoutingBuilderPage() {
  const { context } = useAppContext();
  const { locationKey, focusTick } = useAcPageRefresh();
  const workspaceCode = context.workspace_code;

  const templateRef = useMemo(() => createTemplateRoutingReference(), []);

  const [routing, setRouting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [opDialog, setOpDialog] = useState({ open: false, mode: "add", initial: null, afterSeq: null });
  const [paramDialog, setParamDialog] = useState({
    open: false,
    mode: "add",
    operationId: null,
    operationApiId: null,
    initial: null
  });
  const [resourceDialog, setResourceDialog] = useState({
    open: false,
    operation: null
  });
  const [plantResources, setPlantResources] = useState({
    machines: [],
    tools: [],
    labor_pools: []
  });

  const loadRouting = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const active = await fetchActiveWorkspaceRouting(workspaceCode);
      setRouting(active);
    } catch (e) {
      setError(formatApiError(e, "Failed to load workspace routing"));
      setRouting(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceCode]);

  useEffect(() => {
    loadRouting();
  }, [loadRouting, locationKey, focusTick]);

  useEffect(() => {
    fetchAcMasters()
      .then((masters) => {
        setPlantResources({
          machines: masters.machines || masters.kilns || [],
          tools: masters.tools || [],
          labor_pools: masters.labor_pools || []
        });
      })
      .catch(() => {});
  }, []);

  const operations = useMemo(
    () => sortOperations(routing?.operations || []),
    [routing]
  );

  const tableRows = useMemo(() => buildRoutingTableRows(operations), [operations]);

  const isEditable = Boolean(routing?.is_editable && !routing?.is_template);

  const saveLocalFallback = async (nextRouting, message) => {
    const saved = await saveWorkspaceRoutingLocal(nextRouting, workspaceCode);
    setRouting(saved);
    setNotice(message || "Saved locally (API unavailable).");
  };

  const handleCopyTemplate = async () => {
    setCopying(true);
    setError("");
    setNotice("");
    try {
      const copied = await copyRoutingFromTemplate(workspaceCode);
      setRouting(copied);
      setNotice("Template route copied to workspace. You can now customize operations.");
    } catch (e) {
      setError(formatApiError(e, "Failed to copy template route"));
    } finally {
      setCopying(false);
    }
  };

  const openAddOperation = () => {
    const lastSeq = operations.length ? operations[operations.length - 1].operation_seq : 0;
    setOpDialog({
      open: true,
      mode: "add",
      afterSeq: null,
      initial: createOperationDraft({ operation_seq: lastSeq + 10, operation_name: "New Operation" })
    });
  };

  const openInsertAfter = (operation) => {
    const idx = operations.findIndex((op) => op.operation_id === operation.operation_id);
    const next = operations[idx + 1];
    const seq = suggestInsertSequence(operation.operation_seq, next?.operation_seq);
    setOpDialog({
      open: true,
      mode: "insert",
      afterSeq: operation.operation_seq,
      initial: createOperationDraft({
        operation_seq: seq,
        operation_name: "",
        operation_code: ""
      })
    });
  };

  const openEditOperation = (operation) => {
    setOpDialog({
      open: true,
      mode: "edit",
      afterSeq: null,
      initial: { ...operation }
    });
  };

  const handleSaveOperation = async (values) => {
    if (!routing) return;
    setSaving(true);
    setError("");
    setNotice("");

    const gateType = opDialog.initial?.gate_type;
    const isQualityGate = gateType === "quality_gate" || values.is_quality_gate;
    const isFeasibilityGate = gateType === "feasibility_gate" || values.is_feasibility_gate;

    try {
      if (opDialog.mode === "edit" && opDialog.initial?.operation_id) {
        const opId = operationApiId(opDialog.initial);
        if (isUuid(opId)) {
          if (Number(values.operation_seq) !== Number(opDialog.initial.operation_seq)) {
            await patchOperationSequence(opId, Number(values.operation_seq));
          }
          await updateRoutingOperation(opId, {
            operation_name: values.operation_name,
            is_quality_gate: isQualityGate,
            is_feasibility_gate: isFeasibilityGate
          });
          await loadRouting();
          setNotice(`Updated ${values.operation_code || opDialog.initial.operation_code}.`);
        } else {
          const nextOps = operations.map((op) =>
            op.operation_id === opDialog.initial.operation_id
              ? {
                  ...op,
                  operation_code: values.operation_code,
                  operation_name: values.operation_name,
                  operation_seq: values.operation_seq,
                  requires_machine: Boolean(values.requires_machine),
                  requires_labor: Boolean(values.requires_labor),
                  requires_tools: Boolean(values.requires_tools)
                }
              : op
          );
          await saveLocalFallback(
            { ...routing, operations: sortOperations(nextOps) },
            "Operation updated locally."
          );
        }
      } else {
        if (routing.routing_id && isUuid(routing.routing_id)) {
          await createRoutingOperation({
            operation_code: values.operation_code,
            operation_name: values.operation_name,
            operation_seq: Number(values.operation_seq),
            is_quality_gate: isQualityGate,
            is_feasibility_gate: isFeasibilityGate
          });
          await loadRouting();
          setNotice(`Added ${values.operation_name}.`);
        } else {
          const draft = createOperationDraft({
            operation_seq: values.operation_seq,
            operation_name: values.operation_name,
            operation_code: values.operation_code,
            requires_machine: values.requires_machine,
            requires_labor: values.requires_labor,
            requires_tools: values.requires_tools,
            is_custom: true
          });
          await saveLocalFallback(
            { ...routing, operations: sortOperations([...operations, draft]) },
            "Operation added locally."
          );
        }
      }
      setOpDialog({ open: false, mode: "add", initial: null, afterSeq: null });
    } catch (e) {
      setError(formatApiError(e, "Failed to save operation"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOperation = async (operation) => {
    if (!routing) return;
    if (
      !window.confirm(
        `Remove "${operation.operation_name}" from the workspace route?`
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const opId = operationApiId(operation);
      if (isUuid(opId)) {
        await deleteRoutingOperation(opId);
        await loadRouting();
        setNotice(`Removed ${operation.operation_code} from workspace route.`);
      } else {
        const nextOps = operations.filter(
          (op) => op.operation_id !== operation.operation_id
        );
        await saveLocalFallback(
          { ...routing, operations: sortOperations(nextOps) },
          `Removed ${operation.operation_code} locally.`
        );
      }
    } catch (e) {
      setError(formatApiError(e, "Failed to remove operation"));
    } finally {
      setSaving(false);
    }
  };

  const handleMoveOperation = async (operation, direction) => {
    const idx = operations.findIndex((op) => op.operation_id === operation.operation_id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= operations.length) return;

    const neighbor = operations[swapIdx];
    const opId = operationApiId(operation);
    const targetSeq = neighbor.operation_seq;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (isUuid(opId)) {
        await patchOperationSequence(opId, targetSeq);
        await loadRouting();
        setNotice(`Moved ${operation.operation_code} ${direction}.`);
      } else {
        const nextOps = operations.map((op) => {
          if (op.operation_id === operation.operation_id) {
            return { ...op, operation_seq: neighbor.operation_seq };
          }
          if (op.operation_id === neighbor.operation_id) {
            return { ...op, operation_seq: operation.operation_seq };
          }
          return op;
        });
        await saveLocalFallback(
          { ...routing, operations: sortOperations(nextOps) },
          "Sequence updated locally."
        );
      }
    } catch (e) {
      setError(formatApiError(e, "Failed to reorder operation"));
    } finally {
      setSaving(false);
    }
  };

  const openAddParameter = (operation) => {
    setParamDialog({
      open: true,
      mode: "add",
      operationId: operation.operation_id,
      operationApiId: operationApiId(operation),
      initial: createParameterDraft()
    });
  };

  const openEditParameter = (operation, parameter) => {
    setParamDialog({
      open: true,
      mode: "edit",
      operationId: operation.operation_id,
      operationApiId: operationApiId(operation),
      initial: { ...parameter }
    });
  };

  const handleSaveParameter = async (parameter) => {
    if (!routing || !paramDialog.operationId) return;
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const opApiId = paramDialog.operationApiId;
      if (isUuid(opApiId)) {
        if (paramDialog.mode === "edit" && isUuid(parameter.parameter_id)) {
          await updateOperationParameter(opApiId, parameter.parameter_id, parameter);
          setNotice(`Updated parameter ${parameter.parameter_code}.`);
        } else {
          await addOperationParameter(opApiId, parameter);
          setNotice(`Added parameter ${parameter.parameter_code}.`);
        }
        await loadRouting();
      } else {
        const nextOps = operations.map((op) => {
          if (op.operation_id !== paramDialog.operationId) return op;
          const existing = (op.parameters || []).some(
            (p) => p.parameter_id === parameter.parameter_id
          );
          const parameters = existing
            ? op.parameters.map((p) =>
                p.parameter_id === parameter.parameter_id ? parameter : p
              )
            : [...(op.parameters || []), parameter];
          return { ...op, parameters };
        });
        await saveLocalFallback(
          { ...routing, operations: nextOps },
          "Parameter saved locally."
        );
      }
      setParamDialog({
        open: false,
        mode: "add",
        operationId: null,
        operationApiId: null,
        initial: null
      });
    } catch (e) {
      setError(formatApiError(e, "Failed to save parameter"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteParameter = async (operation, parameter) => {
    if (
      !window.confirm(
        `Remove parameter "${parameter.parameter_name || parameter.parameter_code}"?`
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const opApiId = operationApiId(operation);
      if (isUuid(opApiId) && isUuid(parameter.parameter_id)) {
        await deleteOperationParameter(opApiId, parameter.parameter_id);
        await loadRouting();
        setNotice(`Removed parameter ${parameter.parameter_code}.`);
      } else {
        const nextOps = operations.map((op) => {
          if (op.operation_id !== operation.operation_id) return op;
          return {
            ...op,
            parameters: (op.parameters || []).filter(
              (p) => p.parameter_id !== parameter.parameter_id
            )
          };
        });
        await saveLocalFallback(
          { ...routing, operations: nextOps },
          "Parameter removed locally."
        );
      }
    } catch (e) {
      setError(formatApiError(e, "Failed to remove parameter"));
    } finally {
      setSaving(false);
    }
  };

  const openResourceRequirements = (operation) => {
    setResourceDialog({ open: true, operation });
  };

  const handleSaveResourceRequirements = async (requirements) => {
    const op = resourceDialog.operation;
    if (!op) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await setOperationResourceRequirements(
        operationApiId(op),
        requirements
      );
      const nextOps = operations.map((row) =>
        row.operation_id === op.operation_id
          ? { ...row, resource_requirements: saved }
          : row
      );
      setRouting((prev) => (prev ? { ...prev, operations: nextOps } : prev));
      setResourceDialog({ open: false, operation: null });
      setNotice(`Resource requirements saved for ${op.operation_code}.`);
    } catch (e) {
      setError(formatApiError(e, "Failed to save resource requirements"));
    } finally {
      setSaving(false);
    }
  };

  const formatResourceSummary = (operation) => {
    const reqs = operation.resource_requirements || [];
    if (!reqs.length) return "Not assigned";
    return reqs
      .map((r) => {
        const prefix =
          r.requirement_type === "PRIMARY"
            ? "M"
            : r.requirement_type === "LABOR"
              ? "L"
              : "T";
        return `${prefix}:${r.resource_code}`;
      })
      .join(", ");
  };

  const renderOperationRow = (operation, idx) => (
    <tr key={operation.operation_id}>
      <td className="ac-rb-seq">
        <div className="ac-rb-seq-cell">
          <span>{operation.operation_seq}</span>
          {isEditable && (
            <div className="ac-rb-seq-controls">
              <button
                type="button"
                className="ac-rb-btn ac-rb-btn--ghost ac-rb-btn--tiny"
                disabled={saving || idx === 0}
                title="Move up"
                onClick={() => handleMoveOperation(operation, "up")}
              >
                ↑
              </button>
              <button
                type="button"
                className="ac-rb-btn ac-rb-btn--ghost ac-rb-btn--tiny"
                disabled={saving || idx === operations.length - 1}
                title="Move down"
                onClick={() => handleMoveOperation(operation, "down")}
              >
                ↓
              </button>
            </div>
          )}
        </div>
      </td>
      <td>
        <div className="ac-rb-op-name">{operation.operation_name}</div>
        <div className="ac-rb-op-code">{operation.operation_code}</div>
        <OperationGateBadges operation={operation} />
        {isKilnCoreOperation(operation) && (
          <span className="ac-rb-badge ac-rb-badge--kiln">Kiln subprocess</span>
        )}
      </td>
      <td>
        <div className="text-xs text-slate-600 font-mono">
          {formatResourceSummary(operation)}
        </div>
        {isEditable && (
          <button
            type="button"
            className="ac-rb-btn ac-rb-btn--ghost ac-rb-btn--small mt-1"
            disabled={saving}
            onClick={() => openResourceRequirements(operation)}
          >
            Assign resources
          </button>
        )}
      </td>
      <td>
        {(operation.parameters || []).length === 0 ? (
          <span className="text-slate-400 text-xs">No parameters</span>
        ) : (
          <div className="ac-rb-params">
            <table className="ac-rb-params-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Unit</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Mandatory</th>
                  {isEditable && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {operation.parameters.map((param) => (
                  <tr key={param.parameter_id || param.parameter_code}>
                    <td>{param.parameter_code}</td>
                    <td>{param.parameter_name}</td>
                    <td>{param.data_type}</td>
                    <td>{param.unit || "—"}</td>
                    <td>{formatParamValue(param.min_value)}</td>
                    <td>{formatParamValue(param.max_value)}</td>
                    <td>{param.mandatory ? "Yes" : "No"}</td>
                    {isEditable && (
                      <td>
                        <div className="ac-rb-param-actions">
                          <button
                            type="button"
                            className="ac-rb-btn ac-rb-btn--ghost ac-rb-btn--small"
                            disabled={saving}
                            onClick={() => openEditParameter(operation, param)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="ac-rb-btn ac-rb-btn--ghost ac-rb-btn--small text-red-700"
                            disabled={saving}
                            onClick={() => handleDeleteParameter(operation, param)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </td>
      {isEditable && (
        <td>
          <div className="ac-rb-actions">
            <button
              type="button"
              className="ac-rb-btn ac-rb-btn--ghost ac-rb-btn--small"
              disabled={saving}
              onClick={() => openInsertAfter(operation)}
            >
              Insert after
            </button>
            <button
              type="button"
              className="ac-rb-btn ac-rb-btn--ghost ac-rb-btn--small"
              disabled={saving}
              onClick={() => openEditOperation(operation)}
            >
              Edit
            </button>
            <button
              type="button"
              className="ac-rb-btn ac-rb-btn--ghost ac-rb-btn--small"
              disabled={saving}
              onClick={() => openAddParameter(operation)}
            >
              Add parameter
            </button>
            <button
              type="button"
              className="ac-rb-btn ac-rb-btn--ghost ac-rb-btn--small text-red-700"
              disabled={saving}
              onClick={() => handleDeleteOperation(operation)}
            >
              Delete
            </button>
          </div>
        </td>
      )}
    </tr>
  );

  return (
    <div className="ac-rb-page space-y-6">
      <SectionHeader
        title="Routing Builder"
        subtitle="Define and customize the workspace manufacturing route (process steps). Customers and live lot data are managed on other pages — see the guide below."
      />

      <AcRoutingBuilderGuide />

      {error && <AcAlert variant="error">{error}</AcAlert>}

      {notice && <AcAlert variant="info">{notice}</AcAlert>}

      <WfCard>
        <WfCardHeader
          title="Workspace route"
          subtitle={
            routing
              ? `${routing.routing_name || routing.routing_code} · ${operations.length} operations`
              : "No workspace route loaded"
          }
        />
        <WfCardBody>
          {loading ? (
            <p className="text-sm text-slate-500">Loading active routing…</p>
          ) : !routing ? (
            <div className="ac-rb-empty">
              <p className="text-sm text-slate-600 mb-4">
                No workspace routing exists yet. Copy the Activated Carbon industry template to
                create an editable workspace route.
              </p>
              <button
                type="button"
                className="ac-rb-btn ac-rb-btn--primary"
                disabled={copying}
                onClick={handleCopyTemplate}
              >
                {copying ? "Copying…" : "Copy Activated Carbon Template Route"}
              </button>
            </div>
          ) : (
            <>
              {!isEditable && (
                <div className="ac-rb-banner ac-rb-banner--warn">
                  This route is marked as template/read-only. Copy it to your workspace to enable
                  editing.
                </div>
              )}

              {isEditable && (
                <div className="ac-rb-toolbar">
                  <button
                    type="button"
                    className="ac-rb-btn ac-rb-btn--primary"
                    disabled={saving}
                    onClick={openAddOperation}
                  >
                    Add Operation
                  </button>
                  {saving && <span className="ac-rb-saving">Saving…</span>}
                </div>
              )}

              <div className="ac-rb-table-wrap">
                <table className="ac-rb-table">
                  <thead>
                    <tr>
                      <th>Seq</th>
                      <th>Operation</th>
                      <th>Resources</th>
                      <th>Parameters</th>
                      {isEditable && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => {
                      if (row.type === "group") {
                        return (
                          <tr key={row.id} className="ac-rb-group-row">
                            <td colSpan={isEditable ? 5 : 4}>
                              <div className="ac-rb-group-label">{row.label}</div>
                              <div className="ac-rb-group-hint">{row.hint}</div>
                            </td>
                          </tr>
                        );
                      }
                      const idx = operations.findIndex(
                        (op) => op.operation_id === row.operation.operation_id
                      );
                      return renderOperationRow(row.operation, idx);
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </WfCardBody>
      </WfCard>

      <WfCard className="ac-rb-template-ref">
        <WfCardHeader
          title="Industry template reference (read-only)"
          subtitle="Default Activated Carbon route — not editable. Use Copy Template to create a workspace version."
        />
        <WfCardBody>
          <ul className="ac-rb-template-list">
            {templateRef.operations.map((op) => (
              <li key={op.operation_id}>
                <span>{op.operation_seq}</span>
                {op.operation_name}
              </li>
            ))}
          </ul>
        </WfCardBody>
      </WfCard>

      <OperationEditorDialog
        open={opDialog.open}
        title={
          opDialog.mode === "edit"
            ? "Edit operation"
            : opDialog.mode === "insert"
              ? `Insert operation after seq ${opDialog.afterSeq}`
              : "Add operation"
        }
        initial={opDialog.initial}
        onClose={() =>
          setOpDialog({ open: false, mode: "add", initial: null, afterSeq: null })
        }
        onSave={handleSaveOperation}
      />

      <ParameterEditorDialog
        open={paramDialog.open}
        title={paramDialog.mode === "edit" ? "Edit operation parameter" : "Add operation parameter"}
        initial={paramDialog.initial}
        onClose={() =>
          setParamDialog({
            open: false,
            mode: "add",
            operationId: null,
            operationApiId: null,
            initial: null
          })
        }
        onSave={handleSaveParameter}
      />

      <ResourceRequirementsDialog
        open={resourceDialog.open}
        operation={resourceDialog.operation}
        plantResources={plantResources}
        saving={saving}
        onClose={() => setResourceDialog({ open: false, operation: null })}
        onSave={handleSaveResourceRequirements}
      />
    </div>
  );
}

export default ActivatedCarbonRoutingBuilderPage;
