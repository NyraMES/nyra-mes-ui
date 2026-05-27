import { useEffect, useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function DispatchMasterPage() {
  const [dispatchId, setDispatchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [dispatchStatus, setDispatchStatus] = useState("Ready");

  const [dispatches, setDispatches] = useState([]);

  useEffect(() => {
    loadDispatches();
  }, []);

  const loadDispatches = async () => {
    try {
      const response = await api.get("/dispatches");
      setDispatches(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const clearForm = () => {
    setDispatchId("");
    setCustomerId("");
    setOrderId("");
    setVehicleNumber("");
    setTransporterName("");
    setDispatchStatus("Ready");
  };

  const createDispatch = async () => {
    try {
      await api.post("/dispatch", {
        dispatch_id: dispatchId,
        customer_id: customerId,
        order_id: orderId,
        vehicle_number: vehicleNumber,
        transporter_name: transporterName,
        dispatch_status: dispatchStatus
      });

      alert("Dispatch created successfully");
      clearForm();
      loadDispatches();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error creating dispatch"
      );
    }
  };

  return (
    <div>
      <h1 className="page-title">Dispatches</h1>
      <p className="page-subtitle">
        Plan dispatches against customer orders
      </p>

      <FormCard title="Add Dispatch">
        <div className="form-grid">
          <FormField label="Dispatch ID">
            <input
              value={dispatchId}
              onChange={(e) => setDispatchId(e.target.value)}
            />
          </FormField>

          <FormField label="Customer ID">
            <input
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            />
          </FormField>

          <FormField label="Order ID">
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            />
          </FormField>

          <FormField label="Vehicle Number">
            <input
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
            />
          </FormField>

          <FormField label="Transporter Name">
            <input
              value={transporterName}
              onChange={(e) => setTransporterName(e.target.value)}
            />
          </FormField>

          <FormField label="Status">
            <select
              value={dispatchStatus}
              onChange={(e) => setDispatchStatus(e.target.value)}
            >
              <option value="Ready">Ready</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Delivered">Delivered</option>
            </select>
          </FormField>
        </div>

        <div className="button-group">
          <button
            className="primary-button"
            onClick={createDispatch}
          >
            Save Dispatch
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
        <FormCard title="Dispatch List">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dispatch ID</th>
                <th>Customer ID</th>
                <th>Order ID</th>
                <th>Vehicle</th>
                <th>Transporter</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {dispatches.map((d) => (
                <tr key={d.dispatch_id}>
                  <td>{d.dispatch_id}</td>
                  <td>{d.customer_id}</td>
                  <td>{d.order_id}</td>
                  <td>{d.vehicle_number}</td>
                  <td>{d.transporter_name}</td>
                  <td>{d.dispatch_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FormCard>
      </div>
    </div>
  );
}

export default DispatchMasterPage;
