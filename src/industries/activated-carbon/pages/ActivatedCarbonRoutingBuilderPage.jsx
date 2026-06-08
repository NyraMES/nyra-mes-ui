import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppContext } from "../../../context/AppContext";
import useAcPageRefresh from "../hooks/useAcPageRefresh";
import {
  copyRoutingFromTemplate,
  createOperationDraft,
  createParameterDraft,
  deleteRoutingOperation,
  fetchActiveWorkspaceRouting,
  formatApiError,
  persistRoutingChange,
  setOperationResourceRequirements
} from "../services/acRoutingBuilderApi";
import { fetchAcMasters } from "../../../services/activatedCarbonApi";
import ResourceRequirementsDialog from "../components/routing-builder/ResourceRequirementsDialog";
import {
  createTemplateRoutingReference,
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
    operationId: null,
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

  const isEditable = Boolean(routing?.is_editable && !routing?.is_template);

  const persist = async (nextRouting) => {
    setSaving(true);
    setNotice("");
    try {
      const saved = await persistRoutingChange(nextRouting, workspaceCode);
      setRouting(saved);
      setNotice("Workspace route saved.");
    } catch (e) {
      setError(formatApiError(e, "Failed to save routing changes"));
    } finally {
      setSaving(false);
    }
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

    let nextOps;
    if (opDialog.mode === "edit" && opDialog.initial?.operation_id) {
      nextOps = operations.map((op) =>
        op.operation_id === opDialog.initial.operation_id
          ? {
              ...op,
              operation_code: values.operation_code,
              operation_name: values.operation_name,
              operation_seq: values.operation_seq,
              requires_machine: Boolean(values.requires_machine),
              requires_labor: Boolean(values.requires_labor),
              requires_tools: Boolean(values.requires_tools),
              is_custom: op.is_custom || opDialog.initial.is_custom,
              gate_type: op.is_custom ? op.gate_type || "custom" : op.gate_type
            }
          : op
      );
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
      nextOps = [...operations, draft];
    }

    const nextRouting = { ...routing, operations: sortOperations(nextOps) };
    setOpDialog({ open: false, mode: "add", initial: null, afterSeq: null });
    await persist(nextRouting);
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
      const opId = operation.routing_operation_id || operation.operation_id;
      await deleteRoutingOperation(opId);
      const nextOps = operations.filter(
        (op) => op.operation_id !== operation.operation_id
      );
      const nextRouting = { ...routing, operations: sortOperations(nextOps) };
      const saved = await persistRoutingChange(nextRouting, workspaceCode);
      setRouting(saved);
      setNotice(`Removed ${operation.operation_code} from workspace route.`);
    } catch (e) {
      setError(formatApiError(e, "Failed to remove operation"));
    } finally {
      setSaving(false);
    }
  };

  const openAddParameter = (operationId) => {
    setParamDialog({
      open: true,
      operationId,
      initial: createParameterDraft()
    });
  };

  const handleSaveParameter = async (parameter) => {
    if (!routing || !paramDialog.operationId) return;

    const nextOps = operations.map((op) => {
      if (op.operation_id !== paramDialog.operationId) return op;
      const existing = (op.parameters || []).some(
        (p) => p.parameter_id === parameter.parameter_id
      );
      const parameters = existing
        ? op.parameters.map((p) => (p.parameter_id === parameter.parameter_id ? parameter : p))
        : [...(op.parameters || []), parameter];
      return { ...op, parameters };
    });

    setParamDialog({ open: false, operationId: null, initial: null });
    await persist({ ...routing, operations: nextOps });
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
        op.routing_operation_id || op.operation_id,
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
                    {operations.map((operation) => (
                      <tr key={operation.operation_id}>
                        <td className="ac-rb-seq">{operation.operation_seq}</td>
                        <td>
                          <div className="ac-rb-op-name">{operation.operation_name}</div>
                          <div className="ac-rb-op-code">{operation.operation_code}</div>
                          <OperationGateBadges operation={operation} />
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
                                onClick={() => openAddParameter(operation.operation_id)}
                              >
                                Add parameter
                              </button>
                              <button
                                type="button"
                                className="ac-rb-btn ac-rb-btn--ghost ac-rb-btn--small text-red-700"
                                disabled={saving}
                                onClick={() => handleDeleteOperation(operation)}
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
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
        title="Add operation parameter"
        initial={paramDialog.initial}
        onClose={() => setParamDialog({ open: false, operationId: null, initial: null })}
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
