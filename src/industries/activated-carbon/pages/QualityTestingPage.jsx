import { useEffect, useMemo, useState } from "react";
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
import { buildQcPayload, emptyQcForm } from "../components/AcQcDynamicFields";
import useAcOntologyConfig from "../hooks/useAcOntologyConfig";
import { getEnabledQualityParameters } from "../utils/acOntologyConfigStore";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function lotOptionValue(lot) {
  return String(lot.production_lot_id || lot.lot_id || lot.lot_code || "");
}

function QualityTestingPage() {
  const location = useLocation();
  const { config: ontologyConfig, loading: configLoading } = useAcOntologyConfig();
  const qualityFields = useMemo(
    () => getEnabledQualityParameters(ontologyConfig),
    [ontologyConfig]
  );
  const [lots, setLots] = useState([]);
  const [lotsLoading, setLotsLoading] = useState(true);
  const [checks, setChecks] = useState([]);
  const [lotId, setLotId] = useState("");
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues((prev) => ({ ...emptyQcForm(qualityFields), qc_status: prev.qc_status || "PASSED", ...prev }));
  }, [qualityFields]);

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
        status: values.qc_status || "PASSED",
        ...buildQcPayload(values, qualityFields)
      });
      const disposition = (values.qc_status || "PASSED").toUpperCase();
      const released = disposition === "PASSED";
      const scrapped = disposition === "SCRAPPED" || disposition === "SCRAP";
      setSuccess(
        scrapped
          ? `Quality check ${check.check_code} saved — lot marked scrapped.`
          : released
            ? `Quality check ${check.check_code} — released to finished-goods stock (visible on Dispatch).`
            : `Quality check ${check.check_code} saved — lot held, not stocked.`
      );
      setValues({ ...emptyQcForm(qualityFields), qc_status: "PASSED" });
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
        subtitle="Fields configured in Masters → Ontology & UI — stages testedBy / captures triples on save."
      />

      <p className="text-sm text-slate-300 mb-4 max-w-3xl">
        Routing step <strong className="text-slate-100">OP-QC / Quality Testing</strong> on{" "}
        <Link to="/activated-carbon/execution" className="text-cyan-300 underline">
          Execution
        </Link>{" "}
        records in-process inspection. This page stores the formal finished-goods quality check
        for dispatch and traceability. Configure parameters in{" "}
        <Link to="/activated-carbon/masters?tab=ontology-ui" className="text-cyan-300 underline">
          Ontology & UI
        </Link>{" "}
        · preview triples on{" "}
        <Link to="/workflow/kg" className="text-cyan-300 underline">
          KG Triples
        </Link>
        .
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
            {configLoading ? (
              <p className="text-sm text-slate-600 mb-4">Loading ontology configuration…</p>
            ) : null}
            {lots.length === 0 && !lotsLoading ? (
              <p className="text-sm text-amber-800 mb-4">
                No screened lots awaiting final QC. Finish{" "}
                <Link to="/activated-carbon/execution" className="text-blue-700 underline">
                  Execution
                </Link>
                , record{" "}
                <Link to="/activated-carbon/screening" className="text-blue-700 underline">
                  Screening
                </Link>
                , then pass quality testing here to move the lot to in-stock for dispatch.
              </p>
            ) : null}
            <QualityResultForm
              lotId={lotId}
              lots={lots}
              lotsLoading={lotsLoading}
              onLotChange={setLotId}
              values={values}
              fields={qualityFields}
              onChange={(field, val) => setValues((prev) => ({ ...prev, [field]: val }))}
            />
            <AcSaveBar
              onSave={handleSave}
              saving={saving}
              saveLabel="Save test result"
              disabled={!lotId || lots.length === 0 || configLoading}
            />
          </div>
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default QualityTestingPage;
