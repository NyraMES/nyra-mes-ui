import { useEffect, useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function WorkOrderPage() {
  const [workOrderId, setWorkOrderId] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [lotId, setLotId] = useState("");
  const [routingOperationId, setRoutingOperationId] = useState("");

  const [startWorkOrderId, setStartWorkOrderId] = useState("");

  const [completeWorkOrderId, setCompleteWorkOrderId] = useState("");
  const [actualOutput, setActualOutput] = useState("");
  const [scrapQty, setScrapQty] = useState("0");
  const [reworkQty, setReworkQty] = useState("0");

  const [workOrders, setWorkOrders] = useState([]);

  useEffect(() => {
    loadWorkOrders();
  }, []);

  const loadWorkOrders = async () => {
    try {
      const response = await api.get("/work-orders");
      setWorkOrders(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const clearCreateForm = () => {
    setWorkOrderId("");
    setScheduleId("");
    setLotId("");
    setRoutingOperationId("");
  };

  const clearStartForm = () => {
    setStartWorkOrderId("");
  };

  const clearCompleteForm = () => {
    setCompleteWorkOrderId("");
    setActualOutput("");
    setScrapQty("0");
    setReworkQty("0");
  };

  const createWorkOrder = async () => {
    try {
      await api.post("/work-order", {
        work_order_id: workOrderId,
        schedule_id: scheduleId,
        lot_id: lotId,
        routing_operation_id: routingOperationId,
        work_order_status: "Released"
      });

      alert("Work order created successfully");
      clearCreateForm();
      loadWorkOrders();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error creating work order"
      );
    }
  };

  const startWorkOrder = async () => {
    try {
      await api.put(`/work-order/${startWorkOrderId}/start`);

      alert("Work order started");
      clearStartForm();
      loadWorkOrders();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error starting work order"
      );
    }
  };

  const completeWorkOrder = async () => {
    try {
      await api.put(`/work-order/${completeWorkOrderId}/complete`, {
        actual_output_quantity: Number(actualOutput),
        scrap_quantity: Number(scrapQty),
        rework_quantity: Number(reworkQty)
      });

      alert("Work order completed");
      clearCompleteForm();
      loadWorkOrders();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error completing work order"
      );
    }
  };

  return (
    <div>
      <h1 className="page-title">Work Orders</h1>
      <p className="page-subtitle">
        Create, start and complete work orders on the shop floor
      </p>

      <FormCard title="Add Work Order">
        <div className="form-grid">
          <FormField label="Work Order ID">
            <input
              value={workOrderId}
              onChange={(e) => setWorkOrderId(e.target.value)}
            />
          </FormField>

          <FormField label="Schedule ID">
            <input
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
            />
          </FormField>

          <FormField label="Lot ID">
            <input
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
            />
          </FormField>

          <FormField label="Routing Operation ID">
            <input
              value={routingOperationId}
              onChange={(e) => setRoutingOperationId(e.target.value)}
            />
          </FormField>
        </div>

        <div className="button-group">
          <button
            className="primary-button"
            onClick={createWorkOrder}
          >
            Save Work Order
          </button>

          <button
            className="secondary-button"
            onClick={clearCreateForm}
          >
            Clear
          </button>
        </div>
      </FormCard>

      <div className="list-section">
        <FormCard title="Start Work Order">
          <div className="form-grid">
            <FormField label="Work Order ID">
              <input
                value={startWorkOrderId}
                onChange={(e) => setStartWorkOrderId(e.target.value)}
              />
            </FormField>
          </div>

          <div className="button-group">
            <button
              className="primary-button"
              onClick={startWorkOrder}
            >
              Start Work Order
            </button>

            <button
              className="secondary-button"
              onClick={clearStartForm}
            >
              Clear
            </button>
          </div>
        </FormCard>
      </div>

      <div className="list-section">
        <FormCard title="Complete Work Order">
          <div className="form-grid">
            <FormField label="Work Order ID">
              <input
                value={completeWorkOrderId}
                onChange={(e) => setCompleteWorkOrderId(e.target.value)}
              />
            </FormField>

            <FormField label="Actual Output Quantity">
              <input
                type="number"
                value={actualOutput}
                onChange={(e) => setActualOutput(e.target.value)}
              />
            </FormField>

            <FormField label="Scrap Quantity">
              <input
                type="number"
                value={scrapQty}
                onChange={(e) => setScrapQty(e.target.value)}
              />
            </FormField>

            <FormField label="Rework Quantity">
              <input
                type="number"
                value={reworkQty}
                onChange={(e) => setReworkQty(e.target.value)}
              />
            </FormField>
          </div>

          <div className="button-group">
            <button
              className="primary-button"
              onClick={completeWorkOrder}
            >
              Complete Work Order
            </button>

            <button
              className="secondary-button"
              onClick={clearCompleteForm}
            >
              Clear
            </button>
          </div>
        </FormCard>
      </div>

      <div className="list-section">
        <FormCard title="Work Order List">
          <table className="data-table">
            <thead>
              <tr>
                <th>Work Order ID</th>
                <th>Schedule ID</th>
                <th>Lot ID</th>
                <th>Routing Operation</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {workOrders.map((wo) => (
                <tr key={wo.work_order_id}>
                  <td>{wo.work_order_id}</td>
                  <td>{wo.schedule_id}</td>
                  <td>{wo.lot_id}</td>
                  <td>{wo.routing_operation_id}</td>
                  <td>{wo.work_order_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FormCard>
      </div>
    </div>
  );
}

export default WorkOrderPage;
