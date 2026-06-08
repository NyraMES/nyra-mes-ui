import { useEffect, useState } from "react";

import {
  createAcKilnParameters,
  fetchAcKilnParameters,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import AcFormSelect from "../components/AcFormSelect";
import AcSaveBar from "../components/AcSaveBar";
import AcAlert from "../components/AcAlert";
import useAcMasters from "../hooks/useAcMasters";
import ParameterReadingGrid from "../components/ParameterReadingGrid";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function KilnParametersPage() {
  const { masters, loading: mastersLoading, error: mastersError, reload: reloadMasters, ready } =
    useAcMasters();
  const [executions, setExecutions] = useState([]);
  const [lotId, setLotId] = useState("");
  const [readings, setReadings] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!lotId && masters.production_lots[0]) {
      setLotId(masters.production_lots[0].production_lot_id);
    }
  }, [ready, masters, lotId]);

  useEffect(() => {
    fetchAcKilnParameters().then(setExecutions).catch(() => setExecutions([]));
  }, []);

  const handleSave = async () => {
    if (!lotId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const num = (key) => {
        const v = readings[key];
        return v !== undefined && v !== "" ? Number(v) : undefined;
      };
      const row = await createAcKilnParameters({
        production_lot_id: lotId,
        zone1_temp_c: num("zone1_temp_c"),
        zone2_temp_c: num("zone2_temp_c"),
        steam_flow_kg_h: num("steam_flow_kg_h"),
        residence_time_min: num("residence_time_min"),
        o2_pct: num("o2_pct"),
        kiln_temp_c: num("kiln_temp_c"),
        pressure_bar: num("pressure_bar")
      });
      setSuccess(`Parameters saved · ${row.execution_code}`);
      setReadings({});
      setExecutions(await fetchAcKilnParameters());
      await reloadMasters();
    } catch (e) {
      setError(formatAcApiError(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <SectionHeader
        eyebrow="Operations"
        title="Hourly Kiln Parameters"
        subtitle="Record temperature, steam, and residence time readings per shift."
      />

      {(mastersError || error) && <AcAlert variant="error">{mastersError || error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      <WfCard className="mb-4">
        <WfCardHeader title="Record readings" subtitle="Execution ID from sequence (EXEC-AC-#)." />
        <WfCardBody>
          <AcFormSelect
            label="Production lot"
            value={lotId}
            loading={mastersLoading}
            onChange={(e) => setLotId(e.target.value)}
            className="mb-4 max-w-md"
          >
            {masters.production_lots.map((lot) => (
              <option key={lot.production_lot_id} value={lot.production_lot_id}>
                {lot.lot_code} · {lot.lot_quantity} KG
              </option>
            ))}
          </AcFormSelect>
          <ParameterReadingGrid
            definitions={masters.kiln_parameter_definitions}
            values={readings}
            onChange={(key, v) => setReadings((prev) => ({ ...prev, [key]: v }))}
          />
          <AcSaveBar onSave={handleSave} saving={saving} saveLabel="Save readings" disabled={!lotId} />
        </WfCardBody>
      </WfCard>

      <WfCard>
        <WfCardHeader title="Recent records" />
        <WfCardBody>
          {executions.length === 0 ? (
            <p className="text-sm text-slate-600">No execution records.</p>
          ) : (
            <ul className="text-sm space-y-1 font-mono">
              {executions.slice(0, 10).map((ex) => (
                <li key={ex.execution_id}>{ex.execution_code} · {ex.status}</li>
              ))}
            </ul>
          )}
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default KilnParametersPage;
