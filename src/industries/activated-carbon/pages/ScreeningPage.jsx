import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  createAcScreening,
  fetchAcScreening,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import AcAlert from "../components/AcAlert";
import AcFormSelect from "../components/AcFormSelect";
import AcSaveBar from "../components/AcSaveBar";
import useAcMasters from "../hooks/useAcMasters";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function ScreeningPage() {
  const location = useLocation();
  const { masters, loading: mastersLoading, error: mastersError, reload: reloadMasters, ready } =
    useAcMasters();
  const [rows, setRows] = useState([]);
  const [lotId, setLotId] = useState("");
  const [meshSize, setMeshSize] = useState("8x30");
  const [goodKg, setGoodKg] = useState("");
  const [oversKg, setOversKg] = useState("");
  const [finesKg, setFinesKg] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!lotId && masters.production_lots[0]) {
      setLotId(masters.production_lots[0].production_lot_id);
    }
  }, [ready, masters, lotId]);

  const reloadRows = async () => {
    setRows(await fetchAcScreening());
  };

  useEffect(() => {
    reloadRows().catch(() => setRows([]));
  }, [location.key]);

  const handleSave = async () => {
    if (!lotId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const row = await createAcScreening({
        production_lot_id: lotId,
        mesh_size: meshSize,
        good_kg: goodKg ? Number(goodKg) : undefined,
        overs_kg: oversKg ? Number(oversKg) : undefined,
        fines_kg: finesKg ? Number(finesKg) : undefined
      });
      setSuccess(`Screening saved · ${row.execution_code}`);
      setGoodKg("");
      setOversKg("");
      setFinesKg("");
      await reloadRows();
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
        eyebrow="Post-activation"
        title="Screening"
        subtitle="Classify output by mesh size and record overs / fines recovery."
      />

      {(mastersError || error) && <AcAlert variant="error">{mastersError || error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      <WfCard className="mb-6">
        <WfCardHeader title="Record screening" />
        <WfCardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <AcFormSelect
              label="Lot"
              className="md:col-span-2"
              value={lotId}
              loading={mastersLoading}
              onChange={(e) => setLotId(e.target.value)}
            >
              {masters.production_lots.map((lot) => (
                <option key={lot.production_lot_id} value={lot.production_lot_id}>
                  {lot.lot_code}
                </option>
              ))}
            </AcFormSelect>
            <label className="text-sm">
              <span className="block mb-1 font-medium text-slate-700">Mesh size</span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={meshSize}
                onChange={(e) => setMeshSize(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium text-slate-700">Good fraction (KG)</span>
              <input
                type="number"
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={goodKg}
                onChange={(e) => setGoodKg(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium text-slate-700">Overs (KG)</span>
              <input
                type="number"
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={oversKg}
                onChange={(e) => setOversKg(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium text-slate-700">Fines (KG)</span>
              <input
                type="number"
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={finesKg}
                onChange={(e) => setFinesKg(e.target.value)}
              />
            </label>
          </div>
          <AcSaveBar onSave={handleSave} saving={saving} saveLabel="Save screening" disabled={!lotId} />
        </WfCardBody>
      </WfCard>

      <WfCard>
        <WfCardHeader title="Screening history" />
        <WfCardBody>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-600">No screening executions found.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {rows.map((ex) => (
                <li key={ex.execution_id} className="font-mono">
                  {ex.execution_code} · {ex.status}
                </li>
              ))}
            </ul>
          )}
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default ScreeningPage;
