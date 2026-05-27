import { useEffect, useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function TraceabilityClosurePage() {
  const [traceabilityId, setTraceabilityId] = useState("");
  const [lotId, setLotId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [productionOrderId, setProductionOrderId] = useState("");
  const [dispatchId, setDispatchId] = useState("");
  const [finalQualityStatus, setFinalQualityStatus] = useState("Accepted");
  const [remarks, setRemarks] = useState("");

  const [traceabilityClosures, setTraceabilityClosures] = useState([]);

  useEffect(() => {
    loadTraceabilityClosures();
  }, []);

  const loadTraceabilityClosures = async () => {
    try {
      const response = await api.get("/traceability-closures");
      setTraceabilityClosures(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const clearForm = () => {
    setTraceabilityId("");
    setLotId("");
    setOrderId("");
    setProductionOrderId("");
    setDispatchId("");
    setFinalQualityStatus("Accepted");
    setRemarks("");
  };

  const createTraceabilityClosure = async () => {
    try {
      await api.post("/traceability-closure", {
        traceability_id: traceabilityId,
        lot_id: lotId,
        order_id: orderId,
        production_order_id: productionOrderId,
        final_quality_status: finalQualityStatus,
        dispatch_id: dispatchId,
        closure_status: "Closed",
        remarks: remarks
      });

      alert("Traceability closure created successfully");
      clearForm();
      loadTraceabilityClosures();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error creating traceability closure"
      );
    }
  };

  return (
    <div>
      <h1 className="page-title">Traceability Closures</h1>
      <p className="page-subtitle">
        Close end-to-end traceability from lot to dispatch
      </p>

      <FormCard title="Add Traceability Closure">
        <div className="form-grid">
          <FormField label="Traceability ID">
            <input
              value={traceabilityId}
              onChange={(e) => setTraceabilityId(e.target.value)}
            />
          </FormField>

          <FormField label="Lot ID">
            <input
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
            />
          </FormField>

          <FormField label="Order ID">
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            />
          </FormField>

          <FormField label="Production Order ID">
            <input
              value={productionOrderId}
              onChange={(e) => setProductionOrderId(e.target.value)}
            />
          </FormField>

          <FormField label="Dispatch ID">
            <input
              value={dispatchId}
              onChange={(e) => setDispatchId(e.target.value)}
            />
          </FormField>

          <FormField label="Final Quality Status">
            <select
              value={finalQualityStatus}
              onChange={(e) => setFinalQualityStatus(e.target.value)}
            >
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
            </select>
          </FormField>

          <FormField label="Remarks">
            <input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </FormField>
        </div>

        <div className="button-group">
          <button
            className="primary-button"
            onClick={createTraceabilityClosure}
          >
            Save Traceability Closure
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
        <FormCard title="Traceability Closure List">
          <table className="data-table">
            <thead>
              <tr>
                <th>Traceability ID</th>
                <th>Lot ID</th>
                <th>Order ID</th>
                <th>Production Order</th>
                <th>Dispatch ID</th>
                <th>Final Status</th>
                <th>Closure Status</th>
              </tr>
            </thead>

            <tbody>
              {traceabilityClosures.map((tc) => (
                <tr key={tc.traceability_id}>
                  <td>{tc.traceability_id}</td>
                  <td>{tc.lot_id}</td>
                  <td>{tc.order_id}</td>
                  <td>{tc.production_order_id}</td>
                  <td>{tc.dispatch_id}</td>
                  <td>{tc.final_quality_status}</td>
                  <td>{tc.closure_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FormCard>
      </div>
    </div>
  );
}

export default TraceabilityClosurePage;
