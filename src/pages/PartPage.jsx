import { useEffect, useState } from "react";
import api from "../services/api";
import FormCard from "../components/FormCard";
import FormField from "../components/FormField";
import "../styles/Form.css";

function PartPage() {
  const [partId, setPartId] = useState("");
  const [partName, setPartName] = useState("");
  const [partType, setPartType] = useState("casting");
  const [uom, setUom] = useState("NOS");
  const [parts, setParts] = useState([]);

  useEffect(() => {
    loadParts();
  }, []);

  const loadParts = async () => {
    try {
      const response = await api.get("/part");
      setParts(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const clearForm = () => {
    setPartId("");
    setPartName("");
    setPartType("casting");
    setUom("NOS");
  };

  const createPart = async () => {
    try {
      await api.post("/part", {
        part_id: partId,
        part_name: partName,
        part_type: partType,
        unit_of_measure: uom
      });

      alert("Part created successfully");
      clearForm();
      loadParts();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.detail || "Error creating part");
    }
  };

  return (
    <div>
      <h1 className="page-title">Part Master</h1>
      <p className="page-subtitle">Create and manage OEM part master data</p>

      <FormCard title="Add Part">
        <div className="form-grid">
          <FormField label="Part ID">
            <input value={partId} onChange={(e) => setPartId(e.target.value)} />
          </FormField>

          <FormField label="Part Name">
            <input value={partName} onChange={(e) => setPartName(e.target.value)} />
          </FormField>

          <FormField label="Part Type">
            <select value={partType} onChange={(e) => setPartType(e.target.value)}>
              <option value="casting">Casting</option>
              <option value="machined">Machined</option>
              <option value="fabrication">Fabrication</option>
              <option value="assembly">Assembly</option>
            </select>
          </FormField>

          <FormField label="Unit of Measure">
            <input value={uom} onChange={(e) => setUom(e.target.value)} />
          </FormField>
        </div>

        <div className="button-group">
          <button className="primary-button" onClick={createPart}>
            Save Part
          </button>

          <button className="secondary-button" onClick={clearForm}>
            Clear
          </button>
        </div>
      </FormCard>

      <div className="list-section">
        <FormCard title="Part List">
          <table className="data-table">
            <thead>
              <tr>
                <th>Part ID</th>
                <th>Part Name</th>
                <th>Part Type</th>
                <th>UOM</th>
              </tr>
            </thead>

            <tbody>
              {parts.map((part) => (
                <tr key={part.part_id}>
                  <td>{part.part_id}</td>
                  <td>{part.part_name}</td>
                  <td>{part.part_type}</td>
                  <td>{part.unit_of_measure}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FormCard>
      </div>
    </div>
  );
}

export default PartPage;