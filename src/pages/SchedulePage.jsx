import { useEffect, useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function SchedulePage() {
  const [scheduleId, setScheduleId] = useState("");
  const [lotId, setLotId] = useState("");
  const [routingOperationId, setRoutingOperationId] = useState("");
  const [workCenterId, setWorkCenterId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [scheduleStatus, setScheduleStatus] = useState("Planned");

  const [schedules, setSchedules] = useState([]);

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      const response = await api.get("/schedules");
      setSchedules(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const clearForm = () => {
    setScheduleId("");
    setLotId("");
    setRoutingOperationId("");
    setWorkCenterId("");
    setMachineId("");
    setScheduleStatus("Planned");
  };

  const createSchedule = async () => {
    try {
      await api.post("/schedule", {
        schedule_id: scheduleId,
        lot_id: lotId,
        routing_operation_id: routingOperationId,
        assigned_work_center_id: workCenterId,
        assigned_machine_id: machineId,
        schedule_status: scheduleStatus
      });

      alert("Schedule created successfully");
      clearForm();
      loadSchedules();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error creating schedule"
      );
    }
  };

  return (
    <div>
      <h1 className="page-title">Schedules</h1>
      <p className="page-subtitle">
        Plan and assign lots to work centers and machines
      </p>

      <FormCard title="Add Schedule">
        <div className="form-grid">
          <FormField label="Schedule ID">
            <input
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
            />
          </FormField>

          <FormField label="Lot ID">
            <input
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
            />
          </FormField>

          <FormField label="Routing Operation ID">
            <input
              value={routingOperationId}
              onChange={(e) => setRoutingOperationId(e.target.value)}
            />
          </FormField>

          <FormField label="Work Center ID">
            <input
              value={workCenterId}
              onChange={(e) => setWorkCenterId(e.target.value)}
            />
          </FormField>

          <FormField label="Machine ID">
            <input
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
            />
          </FormField>

          <FormField label="Status">
            <select
              value={scheduleStatus}
              onChange={(e) => setScheduleStatus(e.target.value)}
            >
              <option value="Planned">Planned</option>
              <option value="Released">Released</option>
              <option value="Completed">Completed</option>
            </select>
          </FormField>
        </div>

        <div className="button-group">
          <button
            className="primary-button"
            onClick={createSchedule}
          >
            Save Schedule
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
        <FormCard title="Schedule List">
          <table className="data-table">
            <thead>
              <tr>
                <th>Schedule ID</th>
                <th>Lot ID</th>
                <th>Routing Operation</th>
                <th>Work Center</th>
                <th>Machine</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {schedules.map((s) => (
                <tr key={s.schedule_id}>
                  <td>{s.schedule_id}</td>
                  <td>{s.lot_id}</td>
                  <td>{s.routing_operation_id}</td>
                  <td>{s.assigned_work_center_id}</td>
                  <td>{s.assigned_machine_id}</td>
                  <td>{s.schedule_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FormCard>
      </div>
    </div>
  );
}

export default SchedulePage;
