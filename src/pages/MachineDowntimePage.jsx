import { useEffect, useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function MachineDowntimePage() {
  const [downtimeId, setDowntimeId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [workOrderId, setWorkOrderId] = useState("");
  const [downtimeReason, setDowntimeReason] = useState("");
  const [downtimeMinutes, setDowntimeMinutes] = useState("0");

  const [machineDowntimes, setMachineDowntimes] = useState([]);

  useEffect(() => {
    loadMachineDowntimes();
  }, []);

  const loadMachineDowntimes = async () => {
    try {
      const response = await api.get("/machine-downtimes");
      setMachineDowntimes(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const clearForm = () => {
    setDowntimeId("");
    setMachineId("");
    setWorkOrderId("");
    setDowntimeReason("");
    setDowntimeMinutes("0");
  };

  const createMachineDowntime = async () => {
    try {
      await api.post("/machine-downtime", {
        downtime_id: downtimeId,
        machine_id: machineId,
        work_order_id: workOrderId,
        downtime_reason: downtimeReason,
        downtime_minutes: Number(downtimeMinutes)
      });

      alert("Machine downtime created successfully");
      clearForm();
      loadMachineDowntimes();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error creating downtime"
      );
    }
  };

  return (
    <div>
      <h1 className="page-title">Machine Downtimes</h1>
      <p className="page-subtitle">
        Track unplanned downtime against machines and work orders
      </p>

      <FormCard title="Add Machine Downtime">
        <div className="form-grid">
          <FormField label="Downtime ID">
            <input
              value={downtimeId}
              onChange={(e) => setDowntimeId(e.target.value)}
            />
          </FormField>

          <FormField label="Machine ID">
            <input
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
            />
          </FormField>

          <FormField label="Work Order ID">
            <input
              value={workOrderId}
              onChange={(e) => setWorkOrderId(e.target.value)}
            />
          </FormField>

          <FormField label="Downtime Reason">
            <input
              value={downtimeReason}
              onChange={(e) => setDowntimeReason(e.target.value)}
            />
          </FormField>

          <FormField label="Downtime Minutes">
            <input
              type="number"
              value={downtimeMinutes}
              onChange={(e) => setDowntimeMinutes(e.target.value)}
            />
          </FormField>
        </div>

        <div className="button-group">
          <button
            className="primary-button"
            onClick={createMachineDowntime}
          >
            Save Downtime
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
        <FormCard title="Machine Downtime List">
          <table className="data-table">
            <thead>
              <tr>
                <th>Downtime ID</th>
                <th>Machine ID</th>
                <th>Work Order ID</th>
                <th>Reason</th>
                <th>Minutes</th>
              </tr>
            </thead>

            <tbody>
              {machineDowntimes.map((dt) => (
                <tr key={dt.downtime_id}>
                  <td>{dt.downtime_id}</td>
                  <td>{dt.machine_id}</td>
                  <td>{dt.work_order_id}</td>
                  <td>{dt.downtime_reason}</td>
                  <td>{dt.downtime_minutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FormCard>
      </div>
    </div>
  );
}

export default MachineDowntimePage;
