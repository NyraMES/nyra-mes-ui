import { useEffect, useState } from "react";

import api from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function MaintenanceEventPage() {
  const [maintenanceEventId, setMaintenanceEventId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [eventType, setEventType] = useState("Breakdown");
  const [reportedBy, setReportedBy] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [downtimeMinutes, setDowntimeMinutes] = useState("0");

  const [maintenanceEvents, setMaintenanceEvents] = useState([]);

  useEffect(() => {
    loadMaintenanceEvents();
  }, []);

  const loadMaintenanceEvents = async () => {
    try {
      const response = await api.get("/maintenance-events");
      setMaintenanceEvents(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const clearForm = () => {
    setMaintenanceEventId("");
    setMachineId("");
    setEventType("Breakdown");
    setReportedBy("");
    setIssueDescription("");
    setActionTaken("");
    setDowntimeMinutes("0");
  };

  const createMaintenanceEvent = async () => {
    try {
      await api.post("/maintenance-event", {
        maintenance_event_id: maintenanceEventId,
        machine_id: machineId,
        event_type: eventType,
        event_status: "Open",
        reported_by: reportedBy,
        issue_description: issueDescription,
        action_taken: actionTaken,
        downtime_minutes: Number(downtimeMinutes)
      });

      alert("Maintenance event created successfully");
      clearForm();
      loadMaintenanceEvents();
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.detail ||
        "Error creating maintenance event"
      );
    }
  };

  return (
    <div>
      <h1 className="page-title">Maintenance Events</h1>
      <p className="page-subtitle">
        Log breakdown, preventive and corrective maintenance events
      </p>

      <FormCard title="Add Maintenance Event">
        <div className="form-grid">
          <FormField label="Maintenance Event ID">
            <input
              value={maintenanceEventId}
              onChange={(e) => setMaintenanceEventId(e.target.value)}
            />
          </FormField>

          <FormField label="Machine ID">
            <input
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
            />
          </FormField>

          <FormField label="Event Type">
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              <option value="Breakdown">Breakdown</option>
              <option value="Preventive">Preventive</option>
              <option value="Corrective">Corrective</option>
            </select>
          </FormField>

          <FormField label="Reported By">
            <input
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
            />
          </FormField>

          <FormField label="Issue Description">
            <input
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
            />
          </FormField>

          <FormField label="Action Taken">
            <input
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
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
            onClick={createMaintenanceEvent}
          >
            Save Maintenance Event
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
        <FormCard title="Maintenance Event List">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Machine ID</th>
                <th>Type</th>
                <th>Status</th>
                <th>Reported By</th>
                <th>Downtime (min)</th>
              </tr>
            </thead>

            <tbody>
              {maintenanceEvents.map((ev) => (
                <tr key={ev.maintenance_event_id}>
                  <td>{ev.maintenance_event_id}</td>
                  <td>{ev.machine_id}</td>
                  <td>{ev.event_type}</td>
                  <td>{ev.event_status}</td>
                  <td>{ev.reported_by}</td>
                  <td>{ev.downtime_minutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FormCard>
      </div>
    </div>
  );
}

export default MaintenanceEventPage;
