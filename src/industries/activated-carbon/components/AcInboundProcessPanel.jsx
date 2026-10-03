import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  fetchAcInboundExecution,
  fetchAcRawMaterialType,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import { displayInboundStepLabel } from "../constants/processSteps";
import AcInboundStepCapture from "./AcInboundStepCapture";
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

function stepPill(step, isActive) {
  if (String(step.status || "").toUpperCase() === "COMPLETED") {
    return { kind: "ok", label: "Done" };
  }
  if (isActive) return { kind: "info", label: "Now" };
  return { kind: "neutral", label: "Waiting" };
}

function AcInboundProcessPanel({
  focusOrderId = null,
  refreshToken = 0,
  alwaysVisible = false,
  onStepCompleted = null
}) {
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
    const ids = rows.map((r) => String(r.customer_order_id));
    if (focusOrderId && ids.includes(String(focusOrderId))) {
      setOrderId(String(focusOrderId));
      return;
    }
    if (!orderId || !ids.includes(String(orderId))) {
      setOrderId(ids[0]);
    }
  }, [rows, orderId, focusOrderId]);

  const selected = useMemo(
    () => rows.find((r) => String(r.customer_order_id) === String(orderId)),
    [rows, orderId]
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
    setSuccess(
      `Step recorded for ${saved.order_code} — ${displayInboundStepLabel(
        nextStepMeta?.operation_name || nextStep
      )}`
    );
    await reload();
    onStepCompleted?.(saved);
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
          title="Inbound prep (4 steps)"
          subtitle="Lab → RMS bags → crusher → RM outward"
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4">
            <p className="text-sm text-slate-600">
              No inward orders yet. Record <strong>Gate receipt</strong> on tab{" "}
              <strong>1 · Gate receipt</strong> first — you will then complete the four prep steps
              here.
            </p>
          </div>
        </WfCardBody>
      </WfCard>
    );
  }

  return (
    <WfCard className="mb-6">
      <WfCardHeader
        title="Inbound prep (4 steps after gate)"
        subtitle="Lab → RMS bags → crusher performance → RM outward, then Release."
      />
      <WfCardBody>
        {error ? <AcAlert variant="error">{error}</AcAlert> : null}
        {success ? <AcAlert variant="success">{success}</AcAlert> : null}

        <div className="wf-light-panel rounded-xl p-4 mb-4 max-w-2xl">
          <AcFormSelect
            label="Inward order"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          >
            {rows.map((r) => (
              <option key={r.customer_order_id} value={String(r.customer_order_id)}>
                {r.order_code} — {r.product_code || "RAW"}
                {r.inbound_prep_complete ? " · prep complete" : ""}
              </option>
            ))}
          </AcFormSelect>
        </div>

        {selected ? (
          <div className="wf-light-panel rounded-xl p-4 mb-4 max-w-2xl ac-inbound-process-panel">
            <ol className="ac-inbound-process-steps space-y-2 mb-0">
              <li className="ac-inbound-process-step ac-inbound-process-step--done">
                <StatusPill kind="ok">Done</StatusPill>
                <div>
                  <div className="font-medium text-slate-900">Received at gate</div>
                  <div className="text-xs text-slate-600">
                    Supplier receipt recorded ·{" "}
                    {formatReceivedQty(selected.quantity, selected.uom || "KG")}
                  </div>
                </div>
              </li>

              {inboundSteps.map((step, index) => {
                const isActive = stepIsActive(step, nextStepMeta);
                const pill = stepPill(step, isActive);
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
                  <div className="font-medium text-slate-900">Release to Production</div>
                  <div className="text-xs text-slate-600">
                    {selected.inbound_prep_complete ? (
                      <Link
                        to="/activated-carbon/raw-material?tab=release"
                        className="text-blue-700 underline font-medium"
                      >
                        Open Release →
                      </Link>
                    ) : (
                      "Complete Lab, RMS bags, crusher, and RM outward first."
                    )}
                  </div>
                </div>
              </li>
            </ol>
          </div>
        ) : null}

        {selected && nextStep && nextStepMeta ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">
              {nextStepIndex ? `Step ${nextStepIndex} of ${prepCount}` : "Record now"} ·{" "}
              {displayInboundStepLabel(nextStepMeta.operation_name)}
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
          <p className="text-sm text-emerald-800 mt-3 wf-light-panel rounded-lg px-4 py-2 max-w-2xl">
            Inbound prep complete for {selected.order_code}. Continue on{" "}
            <Link to="/activated-carbon/raw-material?tab=release" className="underline font-medium">
              Release to Production
            </Link>
            .
          </p>
        ) : null}
      </WfCardBody>
    </WfCard>
  );
}

export default AcInboundProcessPanel;
