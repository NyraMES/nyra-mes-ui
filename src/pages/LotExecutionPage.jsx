import { useEffect, useMemo, useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


const EMPTY_COMPLETION = {
  outputQty: "",
  scrapQty: "",
  remarks: "",
  paramName: "",
  paramValue: "",
  parameters: {}
};


function LotExecutionPage() {
  const [productionOrders, setProductionOrders] = useState([]);
  const [productionLots, setProductionLots] = useState([]);

  const [productionOrderId, setProductionOrderId] = useState("");
  const [lotId, setLotId] = useState("");
  const [operatorName, setOperatorName] = useState("");

  const [summary, setSummary] = useState(null);
  const [operations, setOperations] = useState([]);

  const [completion, setCompletion] = useState(EMPTY_COMPLETION);

  useEffect(() => {
    loadProductionOrders();
    loadProductionLots();
  }, []);

  useEffect(() => {
    setLotId("");
    setSummary(null);
    setOperations([]);
    setCompletion(EMPTY_COMPLETION);
  }, [productionOrderId]);

  useEffect(() => {
    if (lotId) {
      loadSummary(lotId, true);
    } else {
      setSummary(null);
      setOperations([]);
      setCompletion(EMPTY_COMPLETION);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotId]);

  const loadProductionOrders = async () => {
    try {
      const response = await api.get("/production-orders");
      const all = Array.isArray(response.data) ? response.data : [];
      const open = all.filter(
        (po) => (po.status || "").toLowerCase() !== "completed"
      );
      setProductionOrders(open);
    } catch (error) {
      console.error("Error loading production orders", error);
      setProductionOrders([]);
    }
  };

  const loadProductionLots = async () => {
    try {
      const response = await api.get("/production-lots");
      const all = Array.isArray(response.data) ? response.data : [];
      const open = all.filter(
        (l) => (l.status || "").toLowerCase() !== "completed"
      );
      setProductionLots(open);
    } catch (error) {
      console.error("Error loading production lots", error);
      setProductionLots([]);
    }
  };

  const filteredLots = useMemo(() => {
    if (!productionOrderId) return [];
    return productionLots.filter(
      (l) => l.production_order_id === productionOrderId
    );
  }, [productionLots, productionOrderId]);

  const clearForm = () => {
    setProductionOrderId("");
    setLotId("");
    setOperatorName("");
    setSummary(null);
    setOperations([]);
    setCompletion(EMPTY_COMPLETION);
  };

  const loadSummary = async (idOverride, silent = false) => {
    const id = idOverride || lotId;
    if (!id) {
      if (!silent) alert("Please select a Lot");
      return;
    }

    try {
      const response = await api.get(`/lot/${id}/execution-summary`, {
        params: { sync: !silent }
      });
      const data = response.data || {};

      setSummary({
        lot_id: data.lot_id,
        production_order_id: data.production_order_id,
        part_id: data.part_id,
        part_name: data.part_name,
        lot_status: data.lot_status
      });

      setOperations(
        Array.isArray(data.operations) ? data.operations : []
      );
    } catch (error) {
      console.error(error);

      if (error.response?.status === 404) {
        setSummary(null);
        setOperations([]);
        return;
      }

      if (!silent) {
        alert(
          error.response?.data?.detail ||
          "Error loading execution summary"
        );
      }
    }
  };

  const routeAlreadyGenerated = operations.length > 0;

  const generateRoute = async () => {
    if (!lotId) {
      alert("Please select a Lot");
      return;
    }

    if (routeAlreadyGenerated) {
      alert("Route is already generated for this lot");
      return;
    }

    try {
      await api.post(`/lot/${lotId}/generate-route`);
      alert("Route generated successfully");
      await loadSummary(lotId);
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error generating route"
      );
    }
  };

  const loadFlow = () => {
    loadSummary();
  };

  const startOperation = async (lotOperationId) => {
    if (!operatorName) {
      alert("Please enter an Operator Name");
      return;
    }

    try {
      await api.put(
        `/lot-operation/${lotOperationId}/start`,
        { operator_name: operatorName }
      );

      setCompletion(EMPTY_COMPLETION);
      await loadSummary(lotId);
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error starting operation"
      );
    }
  };

  const setParam = (name, value) => {
    setCompletion((prev) => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [name]: value
      }
    }));
  };

  const addParameter = () => {
    const name = completion.paramName.trim();
    if (!name) {
      alert("Please enter a parameter name");
      return;
    }

    setCompletion((prev) => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [name]: prev.paramValue
      },
      paramName: "",
      paramValue: ""
    }));
  };

  const completeOperation = async (lotOperationId) => {
    try {
      await api.put(
        `/lot-operation/${lotOperationId}/complete`,
        {
          input_parameters: completion.parameters,
          output_quantity: Number(completion.outputQty) || 0,
          scrap_quantity: Number(completion.scrapQty) || 0,
          remarks: completion.remarks
        }
      );

      setCompletion(EMPTY_COMPLETION);
      await loadSummary(lotId);
      loadProductionLots();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error completing operation"
      );
    }
  };

  const formatTime = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  };

  const activeOperation = useMemo(() => {
    const inProgress = operations.find(
      (op) => op.status === "In Progress"
    );
    if (inProgress) return inProgress;

    const ready = operations.find((op) => op.status === "Ready");
    return ready || null;
  }, [operations]);

  const statusBadgeClass = (status) => {
    const slug = (status || "")
      .toLowerCase()
      .replace(/\s+/g, "-");
    return `status-badge status-badge-${slug}`;
  };

  const stepClass = (op) => {
    const isActive =
      activeOperation &&
      op.lot_operation_id === activeOperation.lot_operation_id;
    const status = (op.status || "").toLowerCase();

    let cls = "process-step";
    if (isActive) cls += " process-step-active";
    if (status === "completed") cls += " process-step-completed";
    if (status === "in progress") cls += " process-step-in-progress";
    return cls;
  };

  const renderTemplateField = (template) => {
    const name = template.parameter_name;
    const label = template.parameter_label || name;
    const dataType = (template.data_type || "text").toLowerCase();
    const currentValue = completion.parameters[name];

    let inputElement;

    if (dataType === "number") {
      inputElement = (
        <input
          type="number"
          value={currentValue ?? ""}
          onChange={(e) => setParam(name, e.target.value)}
        />
      );
    } else if (dataType === "date") {
      inputElement = (
        <input
          type="date"
          value={currentValue ?? ""}
          onChange={(e) => setParam(name, e.target.value)}
        />
      );
    } else if (dataType === "boolean") {
      inputElement = (
        <input
          type="checkbox"
          className="form-checkbox"
          checked={Boolean(currentValue)}
          onChange={(e) => setParam(name, e.target.checked)}
        />
      );
    } else {
      inputElement = (
        <input
          type="text"
          value={currentValue ?? ""}
          onChange={(e) => setParam(name, e.target.value)}
        />
      );
    }

    return (
      <FormField label={label} key={name}>
        {inputElement}
      </FormField>
    );
  };

  const renderCompletionForm = (op) => {
    const templates = Array.isArray(op?.parameter_templates)
      ? op.parameter_templates
      : [];
    const hasTemplates = templates.length > 0;
    const parameterEntries = Object.entries(completion.parameters);

    return (
      <>
        <div className="form-grid">
          <FormField label="Output Quantity">
            <input
              type="number"
              value={completion.outputQty}
              onChange={(e) =>
                setCompletion((prev) => ({
                  ...prev,
                  outputQty: e.target.value
                }))
              }
            />
          </FormField>

          <FormField label="Scrap Quantity">
            <input
              type="number"
              value={completion.scrapQty}
              onChange={(e) =>
                setCompletion((prev) => ({
                  ...prev,
                  scrapQty: e.target.value
                }))
              }
            />
          </FormField>

          <FormField label="Remarks">
            <input
              value={completion.remarks}
              onChange={(e) =>
                setCompletion((prev) => ({
                  ...prev,
                  remarks: e.target.value
                }))
              }
            />
          </FormField>

          {hasTemplates &&
            templates.map((t) => renderTemplateField(t))}

          {!hasTemplates && (
            <>
              <FormField label="Parameter Name">
                <input
                  value={completion.paramName}
                  onChange={(e) =>
                    setCompletion((prev) => ({
                      ...prev,
                      paramName: e.target.value
                    }))
                  }
                />
              </FormField>

              <FormField label="Parameter Value">
                <input
                  value={completion.paramValue}
                  onChange={(e) =>
                    setCompletion((prev) => ({
                      ...prev,
                      paramValue: e.target.value
                    }))
                  }
                />
              </FormField>
            </>
          )}
        </div>

        {!hasTemplates && parameterEntries.length > 0 && (
          <div className="parameter-list">
            <div className="parameter-list-title">
              Captured Parameters
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {parameterEntries.map(([name, value]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="button-group button-group-left">
          {!hasTemplates && (
            <button
              className="secondary-button"
              onClick={addParameter}
            >
              Add Parameter
            </button>
          )}

          <button
            className="primary-button"
            onClick={() => completeOperation(op.lot_operation_id)}
          >
            Complete
          </button>
        </div>
      </>
    );
  };

  const renderActiveCard = () => {
    if (operations.length === 0) return null;

    if (!activeOperation) {
      const allDone = operations.every(
        (op) => op.status === "Completed"
      );

      return (
        <FormCard title="Active Operation">
          <div className="active-op-empty">
            {allDone
              ? "All operations completed for this lot."
              : "No active operation. Generate or check the route."}
          </div>
        </FormCard>
      );
    }

    return (
      <FormCard title="Active Operation">
        <div className="active-op-header">
          <div className="active-op-heading">
            <div className="active-op-title">
              {activeOperation.operation_name}
            </div>
            <div className="active-op-code">
              Code: {activeOperation.operation_code} ·
              {" "}Seq {activeOperation.seq}
            </div>
          </div>

          <span className={statusBadgeClass(activeOperation.status)}>
            {activeOperation.status}
          </span>
        </div>

        <div className="active-op-meta">
          <div className="active-op-meta-item">
            <div className="active-op-meta-label">Started At</div>
            <div className="active-op-meta-value">
              {formatTime(activeOperation.started_at)}
            </div>
          </div>

          <div className="active-op-meta-item">
            <div className="active-op-meta-label">Completed At</div>
            <div className="active-op-meta-value">
              {formatTime(activeOperation.completed_at)}
            </div>
          </div>
        </div>

        {activeOperation.status === "Ready" && (
          <div className="button-group button-group-left">
            <button
              className="primary-button"
              onClick={() =>
                startOperation(activeOperation.lot_operation_id)
              }
            >
              Start Operation
            </button>
          </div>
        )}

        {activeOperation.status === "In Progress" &&
          renderCompletionForm(activeOperation)}
      </FormCard>
    );
  };

  return (
    <div>
      <h1 className="page-title">Lot Execution</h1>
      <p className="page-subtitle">
        Execute lot operations based on routing sequence
      </p>

      <FormCard title="Generate / Load Lot Route">
        <div className="form-grid">
          <FormField label="Production Order">
            <select
              value={productionOrderId}
              onChange={(e) => setProductionOrderId(e.target.value)}
            >
              <option value="">-- Select a Production Order --</option>
              {productionOrders.map((po) => {
                const labelParts = [po.production_order_id];
                if (po.order_line_id) {
                  labelParts.push(`Line: ${po.order_line_id}`);
                }
                if (po.status) {
                  labelParts.push(po.status);
                }
                return (
                  <option
                    key={po.production_order_id}
                    value={po.production_order_id}
                  >
                    {labelParts.join(" · ")}
                  </option>
                );
              })}
            </select>
          </FormField>

          <FormField label="Lot">
            <select
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
              disabled={!productionOrderId}
            >
              <option value="">
                {productionOrderId
                  ? "-- Select a Lot --"
                  : "-- Select a Production Order first --"}
              </option>
              {filteredLots.map((l) => {
                const labelParts = [l.lot_id];
                if (l.lot_quantity !== undefined && l.lot_quantity !== null) {
                  labelParts.push(`Qty: ${l.lot_quantity}`);
                }
                if (l.status) {
                  labelParts.push(l.status);
                }
                return (
                  <option key={l.lot_id} value={l.lot_id}>
                    {labelParts.join(" · ")}
                  </option>
                );
              })}
            </select>
          </FormField>

          <FormField label="Operator Name">
            <input
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
            />
          </FormField>
        </div>

        {lotId && routeAlreadyGenerated && (
          <div className="form-hint">
            Route is already generated for this lot — work is in progress.
          </div>
        )}

        {lotId && filteredLots.length === 0 && (
          <div className="form-hint">
            No open lots found for the selected production order.
          </div>
        )}

        <div className="button-group">
          <button
            className="primary-button"
            onClick={generateRoute}
            disabled={!lotId || routeAlreadyGenerated}
          >
            Generate Route
          </button>

          <button
            className="primary-button"
            onClick={loadFlow}
            disabled={!lotId}
          >
            Refresh
          </button>

          <button
            className="secondary-button"
            onClick={clearForm}
          >
            Clear
          </button>
        </div>
      </FormCard>

      {summary && (
        <div className="list-section">
          <FormCard title="Lot Summary">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lot ID</th>
                  <th>Production Order ID</th>
                  <th>Part ID</th>
                  <th>Part Name</th>
                  <th>Lot Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{summary.lot_id || "-"}</td>
                  <td>{summary.production_order_id || "-"}</td>
                  <td>{summary.part_id || "-"}</td>
                  <td>{summary.part_name || "-"}</td>
                  <td>{summary.lot_status || "-"}</td>
                </tr>
              </tbody>
            </table>
          </FormCard>
        </div>
      )}

      {operations.length > 0 && (
        <div className="lot-exec-row">
          <div className="lot-exec-active">
            {renderActiveCard()}
          </div>

          <aside className="lot-exec-frame">
            <FormCard title="Process Steps">
              <div className="process-list">
                {operations.map((op) => (
                  <div
                    key={op.lot_operation_id}
                    className={stepClass(op)}
                  >
                    <div className="process-step-number">
                      {op.seq}
                    </div>
                    <div className="process-step-body">
                      <div className="process-step-name">
                        {op.operation_name}
                      </div>
                      <div className="process-step-code">
                        {op.operation_code}
                      </div>
                      <div className="process-step-status">
                        {op.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </FormCard>
          </aside>
        </div>
      )}
    </div>
  );
}

export default LotExecutionPage;
