import { useEffect, useMemo, useState } from "react";
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

function formatElapsed(chargedAt) {
  if (!chargedAt) return null;
  const start = new Date(chargedAt);
  if (Number.isNaN(start.getTime())) return null;
  const diffMs = Date.now() - start.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} min in kiln`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m in kiln`;
}

function lotKilnMeta(lot) {
  const meta = lot?.metadata || lot?.metadata_ || {};
  return {
    chargedAt: meta.charged_at,
    kilnCode: meta.kiln_resource_code,
    liveStatus: meta.kiln_live_status
  };
}

/**
 * Kiln charge step — shown inside Execution when activation is next and lot is not yet charged.
 * After charge, shows live lot-in-kiln tracking until the step completes.
 */
export default function AcExecutionKilnFeedPanel({ lot, liveOnly = false, onCharged }) {
  const { masters, loading: mastersLoading, ready } = useAcMasters();
  const [kilnCode, setKilnCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(() => Date.now());

  const kilns = masters.kilns || [];
  const lotId = lot?.production_lot_id || lot?.lot_id;
  const lotCode = lot?.lot_code || lot?.lot_id;
  const lotQty = lot?.lot_quantity ?? "—";
  const { chargedAt, kilnCode: chargedKiln, liveStatus } = lotKilnMeta(lot);
  const isLive = liveOnly || liveStatus === "IN_KILN" || Boolean(chargedAt);

  useEffect(() => {
    if (!isLive) return undefined;
    const timer = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [isLive]);

  const elapsed = useMemo(() => formatElapsed(chargedAt), [chargedAt, tick]);

  useEffect(() => {
    if (chargedKiln) {
      setKilnCode(chargedKiln);
      return;
    }
    if (!kilnCode && kilns[0]) {
      setKilnCode(kilns[0].resource_code);
    }
  }, [kilns, kilnCode, chargedKiln]);

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

  if (isLive && liveOnly) {
    return (
      <WfCard className="border-emerald-400/30 bg-emerald-500/5">
        <WfCardHeader
          title="Kiln live — lot in process"
          subtitle="Track the charged lot until this step completes."
        />
        <WfCardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-emerald-300 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
            <span className="font-mono text-slate-100">{lotCode}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-200">{lotQty} KG</span>
            {chargedKiln && (
              <>
                <span className="text-slate-400">·</span>
                <span className="font-mono text-cyan-200">{chargedKiln}</span>
              </>
            )}
          </div>
          {elapsed && (
            <p className="text-sm text-slate-300">
              {elapsed}
              {chargedAt && (
                <span className="text-slate-500 ml-2">
                  (charged {new Date(chargedAt).toLocaleString()})
                </span>
              )}
            </p>
          )}
          <Link
            to="/activated-carbon/kiln-telemetry"
            className="text-xs text-cyan-300 hover:text-cyan-100 underline inline-block"
          >
            Open kiln telemetry →
          </Link>
        </WfCardBody>
      </WfCard>
    );
  }

  return (
    <WfCard className="border-amber-400/30 bg-amber-500/5">
      <WfCardHeader
        title="Charge activation kiln"
        subtitle="Assign the kiln before starting the activation step."
      />
      <WfCardBody className="space-y-4">
        <p className="text-sm text-slate-300">
          Lot <span className="font-mono text-slate-100">{lotCode}</span> · {lotQty} KG —
          feasibility passed; charge the kiln to begin shop-floor execution.
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
