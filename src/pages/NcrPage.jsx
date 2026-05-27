import { useEffect, useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function NcrPage() {
  const [ncrId, setNcrId] = useState("");
  const [inspectionResultId, setInspectionResultId] = useState("");
  const [defectId, setDefectId] = useState("");
  const [rejectedQty, setRejectedQty] = useState("");
  const [disposition, setDisposition] = useState("scrap");
  const [rootCause, setRootCause] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");

  const [ncrs, setNcrs] = useState([]);

  useEffect(() => {
    loadNcrs();
  }, []);

  const loadNcrs = async () => {
    try {
      const response = await api.get("/ncrs");
      setNcrs(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const clearForm = () => {
    setNcrId("");
    setInspectionResultId("");
    setDefectId("");
    setRejectedQty("");
    setDisposition("scrap");
    setRootCause("");
    setCorrectiveAction("");
  };

  const createNcr = async () => {
    try {
      await api.post("/ncr", {
        ncr_id: ncrId,
        inspection_result_id: inspectionResultId,
        defect_id: defectId,
        rejected_quantity: Number(rejectedQty),
        disposition: disposition,
        root_cause: rootCause,
        corrective_action: correctiveAction,
        status: "Open"
      });

      alert("NCR created successfully");
      clearForm();
      loadNcrs();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error creating NCR"
      );
    }
  };

  return (
    <div>
      <h1 className="page-title">Non-Conformance Reports</h1>
      <p className="page-subtitle">
        Raise and track NCRs against rejected inspection results
      </p>

      <FormCard title="Add NCR">
        <div className="form-grid">
          <FormField label="NCR ID">
            <input
              value={ncrId}
              onChange={(e) => setNcrId(e.target.value)}
            />
          </FormField>

          <FormField label="Inspection Result ID">
            <input
              value={inspectionResultId}
              onChange={(e) => setInspectionResultId(e.target.value)}
            />
          </FormField>

          <FormField label="Defect ID">
            <input
              value={defectId}
              onChange={(e) => setDefectId(e.target.value)}
            />
          </FormField>

          <FormField label="Rejected Quantity">
            <input
              type="number"
              value={rejectedQty}
              onChange={(e) => setRejectedQty(e.target.value)}
            />
          </FormField>

          <FormField label="Disposition">
            <select
              value={disposition}
              onChange={(e) => setDisposition(e.target.value)}
            >
              <option value="scrap">Scrap</option>
              <option value="rework">Rework</option>
              <option value="accept_with_deviation">
                Accept with Deviation
              </option>
            </select>
          </FormField>

          <FormField label="Root Cause">
            <input
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
            />
          </FormField>

          <FormField label="Corrective Action">
            <input
              value={correctiveAction}
              onChange={(e) => setCorrectiveAction(e.target.value)}
            />
          </FormField>
        </div>

        <div className="button-group">
          <button
            className="primary-button"
            onClick={createNcr}
          >
            Create NCR
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
        <FormCard title="NCR List">
          <table className="data-table">
            <thead>
              <tr>
                <th>NCR ID</th>
                <th>Inspection Result ID</th>
                <th>Defect ID</th>
                <th>Rejected Qty</th>
                <th>Disposition</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {ncrs.map((ncr) => (
                <tr key={ncr.ncr_id}>
                  <td>{ncr.ncr_id}</td>
                  <td>{ncr.inspection_result_id}</td>
                  <td>{ncr.defect_id}</td>
                  <td>{ncr.rejected_quantity}</td>
                  <td>{ncr.disposition}</td>
                  <td>{ncr.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FormCard>
      </div>
    </div>
  );
}

export default NcrPage;
