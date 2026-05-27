import { useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function FeasibilityPage() {
  const [lotId, setLotId] = useState("");
  const [result, setResult] = useState(null);

  const clearForm = () => {
    setLotId("");
    setResult(null);
  };

  const checkFeasibility = async () => {
    try {
      const response = await api.get(`/feasibility/${lotId}`);
      setResult(response.data);
    } catch (error) {
      console.error(error);
      setResult(null);
      alert(
        error.response?.data?.detail ||
        "Error checking feasibility"
      );
    }
  };

  return (
    <div>
      <h1 className="page-title">Feasibility Check</h1>
      <p className="page-subtitle">
        Check material, machine, tool and workforce readiness for a lot
      </p>

      <FormCard title="Run Feasibility Check">
        <div className="form-grid">
          <FormField label="Lot ID">
            <input
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
            />
          </FormField>
        </div>

        <div className="button-group">
          <button
            className="primary-button"
            onClick={checkFeasibility}
          >
            Check Feasibility
          </button>

          <button
            className="secondary-button"
            onClick={clearForm}
          >
            Clear
          </button>
        </div>
      </FormCard>

      {result && (
        <div className="list-section">
          <FormCard title="Feasibility Result">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lot ID</th>
                  <th>Material</th>
                  <th>Machine</th>
                  <th>Tool</th>
                  <th>Workforce</th>
                  <th>Overall Status</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>{result.lot_id}</td>
                  <td>{result.material_status}</td>
                  <td>{result.machine_status}</td>
                  <td>{result.tool_status}</td>
                  <td>{result.workforce_status}</td>
                  <td
                    style={{
                      color:
                        result.overall_status === "READY"
                          ? "green"
                          : "red",
                      fontWeight: 600
                    }}
                  >
                    {result.overall_status}
                  </td>
                </tr>
              </tbody>
            </table>
          </FormCard>
        </div>
      )}
    </div>
  );
}

export default FeasibilityPage;
