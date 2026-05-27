import { useEffect, useState } from "react";

import api, { formatApiError } from "../services/api";

import FormCard from "../components/FormCard";
import FormField from "../components/FormField";

import "../styles/Form.css";


function OeeDailySummaryPage() {
  const [oeeId, setOeeId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [oeeDate, setOeeDate] = useState("");
  const [plannedMinutes, setPlannedMinutes] = useState("");
  const [downtimeMinutes, setDowntimeMinutes] = useState("0");
  const [idealCycleTime, setIdealCycleTime] = useState("");
  const [totalQty, setTotalQty] = useState("");
  const [goodQty, setGoodQty] = useState("");

  const [oeeSummaries, setOeeSummaries] = useState([]);

  useEffect(() => {
    loadOeeSummaries();
  }, []);

  const loadOeeSummaries = async () => {
    try {
      const response = await api.get("/oee-daily-summary");
      setOeeSummaries(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const clearForm = () => {
    setOeeId("");
    setMachineId("");
    setOeeDate("");
    setPlannedMinutes("");
    setDowntimeMinutes("0");
    setIdealCycleTime("");
    setTotalQty("");
    setGoodQty("");
  };

  const createOee = async () => {
    const planned = Number(plannedMinutes);
    const downtime = Number(downtimeMinutes);
    const ideal = Number(idealCycleTime);
    const total = Number(totalQty);
    const good = Number(goodQty);

    const operating = planned - downtime;

    const availability = planned > 0 ? (operating / planned) * 100 : 0;
    const performance =
      operating > 0 ? ((ideal * total) / operating) * 100 : 0;
    const quality = total > 0 ? (good / total) * 100 : 0;
    const oee = (availability * performance * quality) / 10000;

    try {
      await api.post("/oee-daily-summary", {
        machine_id: machineId,
        oee_date: oeeDate,
        planned_production_minutes: planned,
        downtime_minutes: downtime,
        ideal_cycle_time_minutes: ideal,
        total_quantity: total,
        good_quantity: good,
        availability_percent: availability,
        performance_percent: performance,
        quality_percent: quality,
        oee_percent: oee
      });

      alert("OEE summary created successfully");
      clearForm();
      loadOeeSummaries();
    } catch (error) {
      console.error(error);
      alert(formatApiError(error, "Error creating OEE"));
    }
  };

  return (
    <div>
      <h1 className="page-title">OEE Daily Summary</h1>
      <p className="page-subtitle">
        Compute and store availability, performance and quality per machine per day
      </p>

      <FormCard title="Add OEE Daily Summary">
        <div className="form-grid">
          <FormField label="OEE ID">
            <input
              value={oeeId}
              onChange={(e) => setOeeId(e.target.value)}
            />
          </FormField>

          <FormField label="Machine ID">
            <input
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
            />
          </FormField>

          <FormField label="OEE Date">
            <input
              type="date"
              value={oeeDate}
              onChange={(e) => setOeeDate(e.target.value)}
            />
          </FormField>

          <FormField label="Planned Production Minutes">
            <input
              type="number"
              value={plannedMinutes}
              onChange={(e) => setPlannedMinutes(e.target.value)}
            />
          </FormField>

          <FormField label="Downtime Minutes">
            <input
              type="number"
              value={downtimeMinutes}
              onChange={(e) => setDowntimeMinutes(e.target.value)}
            />
          </FormField>

          <FormField label="Ideal Cycle Time (min)">
            <input
              type="number"
              value={idealCycleTime}
              onChange={(e) => setIdealCycleTime(e.target.value)}
            />
          </FormField>

          <FormField label="Total Quantity">
            <input
              type="number"
              value={totalQty}
              onChange={(e) => setTotalQty(e.target.value)}
            />
          </FormField>

          <FormField label="Good Quantity">
            <input
              type="number"
              value={goodQty}
              onChange={(e) => setGoodQty(e.target.value)}
            />
          </FormField>
        </div>

        <div className="button-group">
          <button
            className="primary-button"
            onClick={createOee}
          >
            Save OEE
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
        <FormCard title="OEE Daily Summary List">
          <table className="data-table">
            <thead>
              <tr>
                <th>OEE ID</th>
                <th>Machine ID</th>
                <th>Date</th>
                <th>Availability %</th>
                <th>Performance %</th>
                <th>Quality %</th>
                <th>OEE %</th>
              </tr>
            </thead>

            <tbody>
              {oeeSummaries.map((s) => (
                <tr key={s.oee_id}>
                  <td>{s.oee_id}</td>
                  <td>{s.machine_id}</td>
                  <td>{s.oee_date}</td>
                  <td>{Number(s.availability_percent).toFixed(2)}</td>
                  <td>{Number(s.performance_percent).toFixed(2)}</td>
                  <td>{Number(s.quality_percent).toFixed(2)}</td>
                  <td>{Number(s.oee_percent).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FormCard>
      </div>
    </div>
  );
}

export default OeeDailySummaryPage;
