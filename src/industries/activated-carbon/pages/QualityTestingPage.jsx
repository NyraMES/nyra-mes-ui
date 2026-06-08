import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  createAcQualityTest,
  fetchAcQualityTesting,
  fetchAcCompletedLots,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import AcSaveBar from "../components/AcSaveBar";
import AcAlert from "../components/AcAlert";
import QualityResultForm from "../components/QualityResultForm";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function lotOptionValue(lot) {
  return String(lot.production_lot_id || lot.lot_id || lot.lot_code || "");
}

function QualityTestingPage() {
  const location = useLocation();
  const [lots, setLots] = useState([]);
  const [lotsLoading, setLotsLoading] = useState(true);
  const [checks, setChecks] = useState([]);
  const [lotId, setLotId] = useState("");
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLotsLoading(true);
    fetchAcCompletedLots()
      .then((rows) => {
        const list = rows || [];
        setLots(list);
        if (!lotId && list[0]) {
          setLotId(lotOptionValue(list[0]));
        }
      })
      .catch(() => setLots([]))
      .finally(() => setLotsLoading(false));
  }, [location.key]);

  const reloadChecks = async () => {
    setChecks(await fetchAcQualityTesting());
  };

  useEffect(() => {
    reloadChecks().catch(() => setChecks([]));
  }, [location.key]);

  const handleSave = async () => {
    if (!lotId) return;
    const lot = lots.find((l) => lotOptionValue(l) === String(lotId));
    const production_lot_id = lot?.production_lot_id || lotId;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const check = await createAcQualityTest({
        production_lot_id,
        iodine_mg_g: values.iodine_mg_g || undefined,
        ash_pct: values.ash_pct || undefined,
        moisture_pct: values.moisture_pct || undefined,
        bulk_density: values.bulk_density || undefined,
        remarks: values.remarks || undefined,
        status: values.qc_status || "PASSED"
      });
      const passed = (values.qc_status || "PASSED").toUpperCase() === "PASSED";
      setSuccess(
        passed
          ? `Quality check ${check.check_code} passed — lot added to finished-goods stock.`
          : `Quality check ${check.check_code} saved.`
      );
      setValues({});
      await reloadChecks();
    } catch (e) {
      setError(formatAcApiError(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <SectionHeader
        eyebrow="Quality"
        title="Finished product quality testing"
        subtitle="Final lot QC (iodine, ash, moisture, bulk density) — separate from the OP-QC step on Execution."
      />

      <p className="text-sm text-slate-300 mb-4 max-w-3xl">
        Routing step <strong className="text-slate-100">OP-QC / Quality Testing</strong> on{" "}
        <Link to="/activated-carbon/execution" className="text-cyan-300 underline">
          Execution
        </Link>{" "}
        records in-process inspection. This page stores the formal finished-goods quality check
        for dispatch and traceability.
      </p>

      {error && <AcAlert variant="error">{error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      <WfCard className="mb-4">
        <WfCardHeader title="Existing checks" />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4">
            {checks.length === 0 ? (
              <p className="text-sm text-slate-600">No quality checks yet.</p>
            ) : (
              <ul className="text-sm space-y-1 text-slate-800">
                {checks.map((c) => (
                  <li key={c.quality_check_id || c.check_code} className="font-mono">
                    {c.check_code} · {c.status}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </WfCardBody>
      </WfCard>

      <WfCard>
        <WfCardHeader title="New test result" subtitle="Check ID auto-generated (QC-AC-*)." />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4">
            {lots.length === 0 && !lotsLoading ? (
              <p className="text-sm text-amber-800 mb-4">
                No lots with completed shop-floor routing yet. Finish all steps on{" "}
                <Link to="/activated-carbon/execution" className="text-blue-700 underline">
                  Execution
                </Link>{" "}
                first, then return here. Or create a{" "}
                <Link to="/activated-carbon/kiln-feed" className="text-blue-700 underline">
                  kiln feed
                </Link>{" "}
                first.
              </p>
            ) : null}
            <QualityResultForm
              lotId={lotId}
              lots={lots}
              lotsLoading={lotsLoading}
              onLotChange={setLotId}
              values={values}
              onChange={(field, val) => setValues((prev) => ({ ...prev, [field]: val }))}
            />
            <AcSaveBar
              onSave={handleSave}
              saving={saving}
              saveLabel="Save test result"
              disabled={!lotId || lots.length === 0}
            />
          </div>
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default QualityTestingPage;
