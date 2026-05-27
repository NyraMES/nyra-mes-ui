import { useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function InspectionParameterResultPage() {
  const [resultParamId, setResultParamId] = useState("");
  const [inspectionResultId, setInspectionResultId] = useState("");
  const [parameterId, setParameterId] = useState("");
  const [observedValue, setObservedValue] = useState("");
  const [resultStatus, setResultStatus] = useState("OK");

  const clearForm = () => {
    setResultParamId("");
    setInspectionResultId("");
    setParameterId("");
    setObservedValue("");
    setResultStatus("OK");
  };

  const createParameterResult = async () => {
    try {
      await api.post("/inspection-parameter-result", {
        result_param_id: resultParamId,
        inspection_result_id: inspectionResultId,
        parameter_id: parameterId,
        observed_value: observedValue,
        result_status: resultStatus
      });

      alert("Inspection parameter result created successfully");
      clearForm();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error creating parameter result"
      );
    }
  };

  return (
    <div>
      <h1 className="page-title">Inspection Parameter Results</h1>
      <p className="page-subtitle">
        Capture observed values for inspection parameters
      </p>

      <FormCard title="Add Inspection Parameter Result">
        <div className="form-grid">
          <FormField label="Result Parameter ID">
            <input
              value={resultParamId}
              onChange={(e) => setResultParamId(e.target.value)}
            />
          </FormField>

          <FormField label="Inspection Result ID">
            <input
              value={inspectionResultId}
              onChange={(e) => setInspectionResultId(e.target.value)}
            />
          </FormField>

          <FormField label="Parameter ID">
            <input
              value={parameterId}
              onChange={(e) => setParameterId(e.target.value)}
            />
          </FormField>

          <FormField label="Observed Value">
            <input
              value={observedValue}
              onChange={(e) => setObservedValue(e.target.value)}
            />
          </FormField>

          <FormField label="Result Status">
            <select
              value={resultStatus}
              onChange={(e) => setResultStatus(e.target.value)}
            >
              <option value="OK">OK</option>
              <option value="NOT_OK">NOT_OK</option>
            </select>
          </FormField>
        </div>

        <div className="button-group">
          <button
            className="primary-button"
            onClick={createParameterResult}
          >
            Save Parameter Result
          </button>

          <button
            className="secondary-button"
            onClick={clearForm}
          >
            Clear
          </button>
        </div>
      </FormCard>
    </div>
  );
}

export default InspectionParameterResultPage;
