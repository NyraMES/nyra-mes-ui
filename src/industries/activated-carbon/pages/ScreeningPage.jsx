import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  createAcScreening,
  fetchAcLotsAwaitingScreening,
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
  const [awaitingLots, setAwaitingLots] = useState([]);
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
    fetchAcLotsAwaitingScreening()
      .then((list) => {
        setAwaitingLots(list || []);
        if (list?.[0]) {
          setLotId((prev) => prev || list[0].production_lot_id);
        }
      })
      .catch(() => setAwaitingLots([]));
  }, [ready, location.key]);

  const lotOptions = awaitingLots.length ? awaitingLots : masters.production_lots;

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
      setSuccess(
        `Screening saved · ${row.execution_code}. Complete Quality Testing to move this lot to in-stock.`
      );
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
        subtitle="Classify output by mesh size and record overs / fines recovery. Saves stage Material:ProductionLot → screenedAt → Screening Cell triples."
      />

      {(mastersError || error) && <AcAlert variant="error">{mastersError || error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      <p className="text-sm text-slate-300 mb-4">
        Ontology-linked save — preview staged triples on{" "}
        <Link to="/workflow/kg" className="text-cyan-300 underline">
          KG Triples
        </Link>{" "}
        or configure fields in{" "}
        <Link to="/activated-carbon/masters?tab=ontology-ui" className="text-cyan-300 underline">
          Masters → Ontology & UI
        </Link>
        .
      </p>

      <WfCard className="mb-6">
        <WfCardHeader title="Record screening" />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            {lotOptions.length === 0 && !mastersLoading ? (
              <p className="text-sm text-amber-800 md:col-span-2">
                No lots awaiting screening. Finish all steps on{" "}
                <Link to="/activated-carbon/execution" className="text-blue-700 underline">
                  Execution
                </Link>{" "}
                first.
              </p>
            ) : null}
            <AcFormSelect
              label="Lot"
              className="md:col-span-2"
              value={lotId}
              loading={mastersLoading}
              onChange={(e) => setLotId(e.target.value)}
            >
              {lotOptions.map((lot) => (
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
