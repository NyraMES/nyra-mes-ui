import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  createAcKilnFeedLot,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import AcAlert from "./AcAlert";
import AcFormSelect from "./AcFormSelect";
import useAcMasters from "../hooks/useAcMasters";
import { isValidUuid } from "../utils/acProductUtils";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

/**
 * Kiln charge step — shown inside Execution when activation is next and lot is not yet charged.
 */
export default function AcExecutionKilnFeedPanel({ lot, onCharged }) {
  const { masters, loading: mastersLoading, ready } = useAcMasters();
  const [kilnCode, setKilnCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const kilns = masters.kilns || [];
  const lotId = lot?.production_lot_id || lot?.lot_id;
  const lotCode = lot?.lot_code || lot?.lot_id;

  useEffect(() => {
    if (!kilnCode && kilns[0]) {
      setKilnCode(kilns[0].resource_code);
    }
  }, [kilns, kilnCode]);

  const handleCharge = async () => {
    if (!lotId || !kilnCode) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        kiln_resource_code: kilnCode,
        status: "IN_PROGRESS"
      };
      if (isValidUuid(lotId)) {
        payload.production_lot_id = lotId;
      } else {
        payload.lot_code = lotCode;
      }
      await createAcKilnFeedLot(payload);
      onCharged?.();
    } catch (e) {
      setError(formatAcApiError(e, "Kiln charge failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <WfCard className="border-amber-400/30 bg-amber-500/5">
      <WfCardHeader
        title="Charge activation kiln"
        subtitle="Assign the kiln before starting the activation step."
      />
      <WfCardBody className="space-y-4">
        <p className="text-sm text-slate-300">
          Lot <span className="font-mono text-slate-100">{lotCode}</span> ·{" "}
          {lot?.lot_quantity ?? "—"} KG — feasibility passed; charge the kiln to begin shop-floor
          execution.
        </p>
        {error && <AcAlert variant="error">{error}</AcAlert>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
          <AcFormSelect
            label="Kiln"
            value={kilnCode}
            loading={mastersLoading}
            onChange={(e) => setKilnCode(e.target.value)}
          >
            {kilns.map((k) => (
              <option key={k.resource_id} value={k.resource_code}>
                {k.resource_code} — {k.resource_name}
              </option>
            ))}
          </AcFormSelect>
        </div>
        {ready && kilns.length === 0 && (
          <p className="text-xs text-amber-200">
            No kiln resources found.{" "}
            <Link to="/activated-carbon/masters?tab=plant-resources" className="underline">
              Add one in Masters → Plant resources
            </Link>
            .
          </p>
        )}
        <button
          type="button"
          className="wf-btn wf-btn-primary"
          disabled={saving || !kilnCode || !lotId}
          onClick={handleCharge}
        >
          {saving ? "Charging…" : "Charge kiln →"}
        </button>
      </WfCardBody>
    </WfCard>
  );
}
