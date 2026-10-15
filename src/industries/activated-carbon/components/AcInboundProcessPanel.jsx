import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../../auth/AuthContext";
import {
  fetchAcInboundExecution,
  fetchAcRawMaterialType,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import {
  userCanAccessAcRms,
  userCanEnterAcInboundBags,
  userCanRaiseAcDebitNote,
  userCanRecordAcLab,
  userCanRecordAcRmsOutward
} from "../utils/acPrivileges";
import { displayInboundStepLabel } from "../constants/processSteps";
import AcInboundStepCapture from "./AcInboundStepCapture";
import AcInboundDebitNotePanel from "./AcInboundDebitNotePanel";
import AcAlert from "./AcAlert";
import AcFormSelect from "./AcFormSelect";
import { WfCard, WfCardBody, WfCardHeader, StatusPill } from "../../../workflow/ui";

function formatReceivedQty(quantity, uom = "KG") {
  const n = Number(quantity);
  if (!Number.isFinite(n)) return `${quantity ?? "—"} ${uom}`;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${uom}`;
}

function stepIsActive(step, nextStepMeta) {
  if (!nextStepMeta || !step) return false;
  if (nextStepMeta.operation_code && step.operation_code) {
    return step.operation_code === nextStepMeta.operation_code;
  }
  return (
    step.status !== "COMPLETED" &&
    String(step.process_step).toUpperCase() ===
      String(nextStepMeta.process_step).toUpperCase()
  );
}

function stepPill(step, isActive, labDenied) {
  const status = String(step.status || "").toUpperCase();
  if (status === "DENIED") {
    return { kind: "warn", label: "Denied" };
  }
  if (labDenied && status !== "COMPLETED" && status !== "DENIED") {
    return { kind: "neutral", label: "Stopped" };
  }
  if (status === "COMPLETED") {
    return { kind: "ok", label: "Done" };
  }
  if (isActive) return { kind: "info", label: "Now" };
  return { kind: "neutral", label: "Waiting" };
}

function inboundOperationCode(step) {
  return String(step?.operation_code || "").toUpperCase();
}

function canCaptureInboundStep(step, access) {
  const code = inboundOperationCode(step);
  if (code === "IN-RMS-BAG") return access.canEnterBags;
  if (code === "IN-LAB") return access.canRecordLab;
  if (code === "IN-RM-OUT") return access.canRecordOutward;
  return access.canRecordRmsStep;
}

function inboundStepWaitingCopy(orderCode, step) {
  const code = inboundOperationCode(step);
  if (code === "IN-LAB") {
    return `${orderCode} is waiting on Lab. Quality records that check. After Lab, the RMS engineer records RMS outward here.`;
  }
  if (code === "IN-RM-OUT") {
    return `${orderCode} is waiting on RMS outward. The RMS engineer records the rotary bags.`;
  }
  if (code === "IN-RMS-BAG") {
    return `${orderCode} is waiting on bag generation. The RMS engineer enters the bags on this screen.`;
  }
  return `${orderCode} is waiting on ${displayInboundStepLabel(step)}. The RMS engineer records that step.`;
}

function AcInboundProcessPanel({
  focusOrderId = null,
  refreshToken = 0,
  alwaysVisible = false,
  onStepCompleted = null,
  onReadyForRelease = null
}) {
  const { user } = useAuth();
  const canEnterBags = userCanEnterAcInboundBags(user?.roles || [], user);
  const canRecordLab = userCanRecordAcLab(user?.roles || [], user);
  const canRaiseDebitNote = userCanRaiseAcDebitNote(user?.roles || [], user);
  const canRecordRmsStep = userCanAccessAcRms(user?.roles || [], user);
  const canRecordOutward = userCanRecordAcRmsOutward(user?.roles || [], user);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderId, setOrderId] = useState("");
  const [materialType, setMaterialType] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAcInboundExecution();
      setRows(data);
      return data;
    } catch (e) {
      setError(formatAcApiError(e, "Could not load inbound process status"));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshToken]);

  useEffect(() => {
    if (!rows.length) {
      setOrderId("");
      return;
    }
    const visible = rows.filter((r) => !r.inbound_prep_complete && !r.lab_denied);
    const ids = visible.map((r) => String(r.customer_order_id));
    if (focusOrderId && ids.includes(String(focusOrderId))) {
      setOrderId(String(focusOrderId));
      return;
    }
    if (!orderId || !ids.includes(String(orderId))) {
      setOrderId(ids[0] || "");
    }
  }, [rows, orderId, focusOrderId]);

  const visibleRows = useMemo(
    () => rows.filter((r) => !r.inbound_prep_complete && !r.lab_denied),
    [rows]
  );

  const selected = useMemo(
    () => visibleRows.find((r) => String(r.customer_order_id) === String(orderId)),
    [visibleRows, orderId]
  );

  useEffect(() => {
    let cancelled = false;
    setMaterialType(null);
    if (!selected?.raw_material_type_id) return undefined;
    (async () => {
      try {
        const type = await fetchAcRawMaterialType(selected.raw_material_type_id);
        if (!cancelled) setMaterialType(type);
      } catch {
        if (!cancelled) setMaterialType(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.raw_material_type_id, selected?.order_code]);

  const nextOpCode = selected?.next_inbound_operation_code;
  const nextStep = selected?.next_inbound_step;
  const inboundSteps = selected?.inbound_steps || [];
  const prepCount = inboundSteps.length;

  const nextStepMeta = useMemo(() => {
    if (nextOpCode) {
      return inboundSteps.find(
        (s) => String(s.operation_code || "").toUpperCase() === String(nextOpCode).toUpperCase()
      );
    }
    return inboundSteps.find(
      (s) =>
        s.status !== "COMPLETED" &&
        String(s.process_step).toUpperCase() === String(nextStep || "").toUpperCase()
    );
  }, [inboundSteps, nextStep, nextOpCode]);

  const nextStepIndex = useMemo(() => {
    if (!nextStepMeta) return 0;
    const idx = inboundSteps.findIndex(
      (s) =>
        (nextStepMeta.operation_code && s.operation_code === nextStepMeta.operation_code) ||
        String(s.process_step).toUpperCase() === String(nextStepMeta.process_step).toUpperCase()
    );
    return idx >= 0 ? idx + 1 : 0;
  }, [inboundSteps, nextStepMeta]);

  const handleStepCompleted = async (saved) => {
    if (saved?.lab_denied) {
      setSuccess(
        `Lab denied ${saved.order_code} — this inward is stopped and will not go to RMS or later steps.`
      );
    } else {
      const justSaved = String(nextStepMeta?.operation_code || "").toUpperCase();
      setSuccess(
        justSaved === "IN-LAB"
          ? `Lab saved for ${saved.order_code}. RMS outward is with the RMS engineer.`
          : `Step recorded for ${saved.order_code} — ${displayInboundStepLabel(
              nextStepMeta?.operation_name || nextStep
            )}`
      );
    }
    await reload();
    onStepCompleted?.(saved);
    if (saved?.inbound_prep_complete && !saved?.lab_denied) {
      onReadyForRelease?.(saved);
    }
  };

  if (loading && rows.length === 0) {
    return (
      <WfCard className="mb-6">
        <WfCardBody>
          <p className="text-sm text-slate-600">Loading inbound process…</p>
        </WfCardBody>
      </WfCard>
    );
  }

  if (rows.length === 0) {
    if (!alwaysVisible) return null;
    return (
      <WfCard className="mb-6">
        <WfCardHeader
          title="Inbound prep (3 steps)"
          subtitle="Bag generation (RMS engineer) → Lab → RMS outward"
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4">
            <p className="text-sm text-slate-600">
              No inward orders yet. Gate receipt is recorded first. Bag generation is entered here by the RMS engineer.
            </p>
          </div>
        </WfCardBody>
      </WfCard>
    );
  }

  return (
    <WfCard className="mb-6">
      <WfCardHeader
        title="Inbound prep (3 steps after gate)"
        subtitle="Bag generation is entered here by the RMS engineer, then Lab and RMS outward."
      />
      <WfCardBody>
        {error ? <AcAlert variant="error">{error}</AcAlert> : null}
        {success ? <AcAlert variant="success">{success}</AcAlert> : null}

        <div className="wf-ac-gate-receipt-grid wf-ac-gate-receipt-grid--wide">
          <div>
            <div className="wf-light-panel rounded-xl p-4 mb-4">
              <AcFormSelect
                label="Inward order"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                emptyMessage="No inward waiting on inbound prep"
              >
                <option value="">Select inward…</option>
                {visibleRows.map((r) => (
                  <option key={r.customer_order_id} value={String(r.customer_order_id)}>
                    {r.order_code} — {r.product_code || "RAW"}
                    {r.next_inbound_operation_code
                      ? ` · ${displayInboundStepLabel(r.next_inbound_operation_code)}`
                      : ""}
                  </option>
                ))}
              </AcFormSelect>
            </div>

            {selected?.lab_denied ? (
              <div className="wf-light-panel rounded-lg px-4 py-3 mb-4 border border-amber-300 bg-amber-50">
                <p className="text-sm font-semibold text-amber-900">
                  Lab denied {selected.order_code} — this inward is stopped.
                </p>
                {selected.lab_remarks ? (
                  <p className="text-sm text-slate-700 mt-1">Remarks: {selected.lab_remarks}</p>
                ) : null}
                <p className="text-xs text-slate-600 mt-1">
                  RMS Outward and Release stay locked for this record only.
                </p>
              </div>
            ) : null}

            {selected &&
            (selected.moisture_pct != null ||
              selected.dust_pct != null ||
              selected.volatility != null) ? (
              <div className="wf-light-panel rounded-lg px-4 py-3 mb-4">
                <p className="text-sm font-semibold text-slate-800 m-0">Lab values · {selected.order_code}</p>
                <p className="text-sm text-slate-700 mt-1 mb-0">
                  Moisture {selected.moisture_pct ?? "—"}% · Dust {selected.dust_pct ?? "—"}% ·
                  Volatility {selected.volatility ?? "—"}%
                  {selected.lab_remarks ? ` · ${selected.lab_remarks}` : ""}
                </p>
              </div>
            ) : null}

            {canRaiseDebitNote && selected && (selected.debit_note?.eligible || selected.debit_note?.raised) ? (
              <AcInboundDebitNotePanel
                selected={selected}
                onSaved={async () => {
                  await reload();
                }}
              />
            ) : null}

            {!canRaiseDebitNote && selected?.debit_note?.eligible && !selected?.debit_note?.raised ? (
              <div className="wf-light-panel rounded-lg px-4 py-3 mb-4">
                <p className="text-sm text-slate-800 m-0">
                  {selected.order_code} can have a debit note. The supervisor raises it.
                </p>
              </div>
            ) : null}

            {selected && !selected.lab_denied && nextStepMeta && !canCaptureInboundStep(nextStepMeta, { canEnterBags, canRecordLab, canRecordOutward, canRecordRmsStep }) ? (
              <div className="wf-light-panel rounded-lg px-4 py-3 mb-4">
                <p className="text-sm text-slate-800 m-0">
                  {inboundStepWaitingCopy(selected.order_code, nextStepMeta)}
                </p>
              </div>
            ) : null}

            {selected && !selected.lab_denied && nextStep && nextStepMeta && canCaptureInboundStep(nextStepMeta, { canEnterBags, canRecordLab, canRecordOutward, canRecordRmsStep }) ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">
                  {nextStepIndex ? `Step ${nextStepIndex} of ${prepCount}` : "Record now"} ·{" "}
                  {displayInboundStepLabel(nextStepMeta)}
                </p>
                <AcInboundStepCapture
                  selected={selected}
                  nextStepMeta={nextStepMeta}
                  materialType={materialType}
                  onCompleted={handleStepCompleted}
                />
              </div>
            ) : null}

            {selected?.inbound_prep_complete ? (
              <div className="wf-light-panel rounded-lg px-4 py-3 space-y-2">
                <p className="text-sm text-emerald-800 m-0">
                  RMS outward complete for {selected.order_code}.
                </p>
                <Link
                  to="/activated-carbon/raw-material?tab=release"
                  className="wf-btn wf-btn-primary"
                >
                  Open Release to production
                </Link>
              </div>
            ) : null}
          </div>

          {selected ? (
            <aside className="wf-ac-gate-receipt-flow rounded-lg border border-blue-200 bg-blue-50/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Process map
              </p>
              <p className="text-sm font-semibold text-slate-900 mb-2">
                Inward {selected.order_code}
              </p>
              <div className="wf-light-panel rounded-xl p-3 ac-inbound-process-panel">
                <ol className="ac-inbound-process-steps ac-inbound-process-steps--sidebar space-y-2 mb-0">
                  <li className="ac-inbound-process-step ac-inbound-process-step--done">
                    <StatusPill kind="ok">Done</StatusPill>
                    <div>
                      <div className="font-medium text-slate-900">Received at gate</div>
                      <div className="text-xs text-slate-600">
                        Gate receipt recorded ·{" "}
                        {formatReceivedQty(selected.quantity, selected.uom || "KG")}
                      </div>
                    </div>
                  </li>

                  {inboundSteps.map((step, index) => {
                    const isActive = !selected.lab_denied && stepIsActive(step, nextStepMeta);
                    const pill = stepPill(step, isActive, selected.lab_denied);
                    return (
                      <li
                        key={step.operation_code || step.process_step}
                        className={`ac-inbound-process-step${
                          step.status === "COMPLETED" ? " ac-inbound-process-step--done" : ""
                        }${isActive ? " ac-inbound-process-step--active" : ""}`}
                      >
                        <StatusPill kind={pill.kind}>{pill.label}</StatusPill>
                        <div>
                          <div className="font-medium text-slate-900">
                            {prepCount ? `Step ${index + 1} of ${prepCount} · ` : ""}
                            {displayInboundStepLabel(step.operation_name)}
                          </div>
                          {String(step.operation_code || "").toUpperCase() === "IN-LAB" &&
                          (selected.moisture_pct != null ||
                            selected.dust_pct != null ||
                            selected.volatility != null) ? (
                            <div className="text-xs text-slate-600">
                              Moisture {selected.moisture_pct ?? "—"}% · Dust{" "}
                              {selected.dust_pct ?? "—"}% · Volatility {selected.volatility ?? "—"}%
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}

                  <li
                    className={`ac-inbound-process-step${
                      selected.inbound_prep_complete ? " ac-inbound-process-step--ready" : ""
                    }`}
                  >
                    <StatusPill kind={selected.inbound_prep_complete ? "ok" : "warn"}>
                      {selected.inbound_prep_complete ? "Ready" : "Locked"}
                    </StatusPill>
                    <div>
                      <div className="font-medium text-slate-900">
                        {selected.inbound_prep_complete
                          ? "RMS outward complete"
                          : "RMS outward complete"}
                      </div>
                      <div className="text-xs text-slate-600">
                        {selected.lab_denied
                          ? "Lab denied — this inward cannot be released."
                          : selected.inbound_prep_complete ? (
                          <Link
                            to="/activated-carbon/raw-material?tab=release"
                            className="wf-btn wf-btn-primary mt-1"
                          >
                            Open Release to production
                          </Link>
                        ) : (
                          "Finish RMS Outward, then move to the Release to production tab."
                        )}
                      </div>
                    </div>
                  </li>
                </ol>
              </div>
            </aside>
          ) : null}
        </div>
      </WfCardBody>
    </WfCard>
  );
}

export default AcInboundProcessPanel;
