import { useEffect, useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function InspectionResultPage() {
  const [inspectionResultId, setInspectionResultId] = useState("");
  const [workOrderId, setWorkOrderId] = useState("");
  const [lotId, setLotId] = useState("");
  const [inspectionPlanId, setInspectionPlanId] = useState("");
  const [inspectedQty, setInspectedQty] = useState("");
  const [acceptedQty, setAcceptedQty] = useState("");
  const [rejectedQty, setRejectedQty] = useState("");
  const [inspectionStatus, setInspectionStatus] = useState("Passed");

  const [inspectionResults, setInspectionResults] = useState([]);

  useEffect(() => {
    loadInspectionResults();
  }, []);

  const loadInspectionResults = async () => {
    try {
      const response = await api.get("/inspection-results");
      setInspectionResults(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const clearForm = () => {
    setInspectionResultId("");
    setWorkOrderId("");
    setLotId("");
    setInspectionPlanId("");
    setInspectedQty("");
    setAcceptedQty("");
    setRejectedQty("");
    setInspectionStatus("Passed");
  };

  const createInspectionResult = async () => {
    try {
      await api.post("/inspection-result", {
        inspection_result_id: inspectionResultId,
        work_order_id: workOrderId,
        lot_id: lotId,
        inspection_plan_id: inspectionPlanId,
        inspected_quantity: Number(inspectedQty),
        accepted_quantity: Number(acceptedQty),
        rejected_quantity: Number(rejectedQty),
        inspection_status: inspectionStatus
      });

      alert("Inspection result created successfully");
      clearForm();
      loadInspectionResults();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error creating inspection result"
      );
    }
  };

  return (
    <div>
      <h1 className="page-title">Inspection Results</h1>
      <p className="page-subtitle">
        Record inspection outcomes for produced lots
      </p>

      <FormCard title="Add Inspection Result">
        <div className="form-grid">
          <FormField label="Inspection Result ID">
            <input
              value={inspectionResultId}
              onChange={(e) => setInspectionResultId(e.target.value)}
            />
          </FormField>

          <FormField label="Work Order ID">
            <input
              value={workOrderId}
              onChange={(e) => setWorkOrderId(e.target.value)}
            />
          </FormField>

          <FormField label="Lot ID">
            <input
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
            />
          </FormField>

          <FormField label="Inspection Plan ID">
            <input
              value={inspectionPlanId}
              onChange={(e) => setInspectionPlanId(e.target.value)}
            />
          </FormField>

          <FormField label="Inspected Quantity">
            <input
              type="number"
              value={inspectedQty}
              onChange={(e) => setInspectedQty(e.target.value)}
            />
          </FormField>

          <FormField label="Accepted Quantity">
            <input
              type="number"
              value={acceptedQty}
              onChange={(e) => setAcceptedQty(e.target.value)}
            />
          </FormField>

          <FormField label="Rejected Quantity">
            <input
              type="number"
              value={rejectedQty}
              onChange={(e) => setRejectedQty(e.target.value)}
            />
          </FormField>

          <FormField label="Inspection Status">
            <select
              value={inspectionStatus}
              onChange={(e) => setInspectionStatus(e.target.value)}
            >
              <option value="Passed">Passed</option>
              <option value="Failed">Failed</option>
            </select>
          </FormField>
        </div>

        <div className="button-group">
          <button
            className="primary-button"
            onClick={createInspectionResult}
          >
            Save Inspection Result
          </button>

          <button
            className="secondary-button"
            onClick={clearForm}
          >
            Clear
          </button>
        </div>
      </FormCard>

      <div className="list-section">
        <FormCard title="Inspection Result List">
          <table className="data-table">
            <thead>
              <tr>
                <th>Inspection Result ID</th>
                <th>Work Order ID</th>
                <th>Lot ID</th>
                <th>Inspected</th>
                <th>Accepted</th>
                <th>Rejected</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {inspectionResults.map((ir) => (
                <tr key={ir.inspection_result_id}>
                  <td>{ir.inspection_result_id}</td>
                  <td>{ir.work_order_id}</td>
                  <td>{ir.lot_id}</td>
                  <td>{ir.inspected_quantity}</td>
                  <td>{ir.accepted_quantity}</td>
                  <td>{ir.rejected_quantity}</td>
                  <td>{ir.inspection_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FormCard>
      </div>
    </div>
  );
}

export default InspectionResultPage;
