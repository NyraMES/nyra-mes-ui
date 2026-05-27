import { useEffect, useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function DispatchLinePage() {
  const [dispatchLineId, setDispatchLineId] = useState("");
  const [dispatchId, setDispatchId] = useState("");
  const [lotId, setLotId] = useState("");
  const [partId, setPartId] = useState("");
  const [dispatchQty, setDispatchQty] = useState("");
  const [acceptedQty, setAcceptedQty] = useState("");
  const [rejectedQty, setRejectedQty] = useState("0");

  const [dispatchLines, setDispatchLines] = useState([]);

  useEffect(() => {
    loadDispatchLines();
  }, []);

  const loadDispatchLines = async () => {
    try {
      // The backend now scopes lines under a dispatch; fan-out across all
      // dispatches and concatenate to keep this page's UX unchanged.
      const dispatches = (await api.get("/dispatches")).data || [];
      const allLines = await Promise.all(
        dispatches.map((d) =>
          api
            .get(`/dispatch/${d.dispatch_id}/lines`)
            .then((r) => r.data || [])
            .catch(() => [])
        )
      );
      setDispatchLines(allLines.flat());
    } catch (error) {
      console.error(error);
    }
  };

  const clearForm = () => {
    setDispatchLineId("");
    setDispatchId("");
    setLotId("");
    setPartId("");
    setDispatchQty("");
    setAcceptedQty("");
    setRejectedQty("0");
  };

  const createDispatchLine = async () => {
    try {
      await api.post(`/dispatch/${dispatchId}/line`, {
        dispatch_line_id: dispatchLineId,
        lot_id: lotId,
        part_id: partId,
        dispatch_quantity: Number(dispatchQty),
        accepted_quantity: Number(acceptedQty),
        rejected_quantity: Number(rejectedQty)
      });

      alert("Dispatch line created successfully");
      clearForm();
      loadDispatchLines();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error creating dispatch line"
      );
    }
  };

  return (
    <div>
      <h1 className="page-title">Dispatch Lines</h1>
      <p className="page-subtitle">
        Add lot-wise dispatch line items against a dispatch
      </p>

      <FormCard title="Add Dispatch Line">
        <div className="form-grid">
          <FormField label="Dispatch Line ID">
            <input
              value={dispatchLineId}
              onChange={(e) => setDispatchLineId(e.target.value)}
            />
          </FormField>

          <FormField label="Dispatch ID">
            <input
              value={dispatchId}
              onChange={(e) => setDispatchId(e.target.value)}
            />
          </FormField>

          <FormField label="Lot ID">
            <input
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
            />
          </FormField>

          <FormField label="Part ID">
            <input
              value={partId}
              onChange={(e) => setPartId(e.target.value)}
            />
          </FormField>

          <FormField label="Dispatch Quantity">
            <input
              type="number"
              value={dispatchQty}
              onChange={(e) => setDispatchQty(e.target.value)}
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
        </div>

        <div className="button-group">
          <button
            className="primary-button"
            onClick={createDispatchLine}
          >
            Save Dispatch Line
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
        <FormCard title="Dispatch Line List">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dispatch Line ID</th>
                <th>Dispatch ID</th>
                <th>Lot ID</th>
                <th>Part ID</th>
                <th>Dispatch Qty</th>
                <th>Accepted</th>
                <th>Rejected</th>
              </tr>
            </thead>

            <tbody>
              {dispatchLines.map((dl) => (
                <tr key={dl.dispatch_line_id}>
                  <td>{dl.dispatch_line_id}</td>
                  <td>{dl.dispatch_id}</td>
                  <td>{dl.lot_id}</td>
                  <td>{dl.part_id}</td>
                  <td>{dl.dispatch_quantity}</td>
                  <td>{dl.accepted_quantity}</td>
                  <td>{dl.rejected_quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FormCard>
      </div>
    </div>
  );
}

export default DispatchLinePage;
