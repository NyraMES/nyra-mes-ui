import { useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function ProductionLotPage() {
  const [lotId, setLotId] = useState("");
  const [productionOrderId, setProductionOrderId] = useState("");
  const [lotQuantity, setLotQuantity] = useState("");
  const [status, setStatus] = useState("Created");

  const [lookupLotId, setLookupLotId] = useState("");
  const [lotDetails, setLotDetails] = useState(null);

  const clearForm = () => {
    setLotId("");
    setProductionOrderId("");
    setLotQuantity("");
    setStatus("Created");
  };

  const clearLookup = () => {
    setLookupLotId("");
    setLotDetails(null);
  };

  const createProductionLot = async () => {
    try {
      await api.post("/production-lot", {
        lot_id: lotId,
        production_order_id: productionOrderId,
        lot_quantity: Number(lotQuantity),
        status: status
      });

      alert("Production lot created successfully");
      clearForm();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error creating production lot"
      );
    }
  };

  const loadLotDetails = async () => {
    try {
      const response = await api.get(`/production-lot/${lookupLotId}`);
      setLotDetails(response.data);
    } catch (error) {
      console.error(error);
      setLotDetails(null);
      alert(
        error.response?.data?.detail ||
        "Error loading production lot"
      );
    }
  };

  return (
    <div>
      <h1 className="page-title">Production Lots</h1>
      <p className="page-subtitle">
        Create production lots and look up lot details
      </p>

      <FormCard title="Add Production Lot">
        <div className="form-grid">
          <FormField label="Lot ID">
            <input
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
            />
          </FormField>

          <FormField label="Production Order ID">
            <input
              value={productionOrderId}
              onChange={(e) => setProductionOrderId(e.target.value)}
            />
          </FormField>

          <FormField label="Lot Quantity">
            <input
              type="number"
              value={lotQuantity}
              onChange={(e) => setLotQuantity(e.target.value)}
            />
          </FormField>

          <FormField label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="Created">Created</option>
              <option value="In-Progress">In-Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </FormField>
        </div>

        <div className="button-group">
          <button
            className="primary-button"
            onClick={createProductionLot}
          >
            Save Production Lot
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
        <FormCard title="Lookup Production Lot">
          <div className="form-grid">
            <FormField label="Lot ID">
              <input
                value={lookupLotId}
                onChange={(e) => setLookupLotId(e.target.value)}
              />
            </FormField>
          </div>

          <div className="button-group">
            <button
              className="primary-button"
              onClick={loadLotDetails}
            >
              Load Lot
            </button>

            <button
              className="secondary-button"
              onClick={clearLookup}
            >
              Clear
            </button>
          </div>

          {lotDetails && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lot ID</th>
                  <th>Production Order ID</th>
                  <th>Lot Quantity</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>{lotDetails.lot_id}</td>
                  <td>{lotDetails.production_order_id}</td>
                  <td>{lotDetails.lot_quantity}</td>
                  <td>{lotDetails.status}</td>
                </tr>
              </tbody>
            </table>
          )}
        </FormCard>
      </div>
    </div>
  );
}

export default ProductionLotPage;
