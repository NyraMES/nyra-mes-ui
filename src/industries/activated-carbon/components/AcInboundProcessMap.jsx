import { Link } from "react-router-dom";

import { displayInboundStepLabel } from "../constants/processSteps";
import { StatusPill } from "../../../workflow/ui";

const PREVIEW_STEPS = [
  { operation_code: "IN-RMS-BAG", operation_name: "RMS Inward", process_step: "IN-RMS-BAG" },
  { operation_code: "IN-LAB", operation_name: "Lab", process_step: "IN-LAB" },
  { operation_code: "IN-RM-OUT", operation_name: "RMS Outward", process_step: "IN-RM-OUT" }
];

function formatReceivedQty(quantity, uom = "KG") {
  const n = Number(quantity);
  if (!Number.isFinite(n) || n <= 0) return null;
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

function nextStepFromSelected(selected) {
  const inboundSteps = selected?.inbound_steps || [];
  const nextOpCode = selected?.next_inbound_operation_code;
  const nextStep = selected?.next_inbound_step;
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
}

export default function AcInboundProcessMap({
  selected = null,
  gatePending = false,
  previewQuantity = "",
  previewUom = "KG"
}) {
  const inboundSteps = selected?.inbound_steps?.length ? selected.inbound_steps : PREVIEW_STEPS;
  const prepCount = inboundSteps.length;
  const nextStepMeta = selected ? nextStepFromSelected(selected) : null;
  const labDenied = Boolean(selected?.lab_denied);
  const qtyLabel = formatReceivedQty(
    selected?.quantity ?? previewQuantity,
    selected?.uom || previewUom
  );
  const gateDone = Boolean(selected) && !gatePending;

  return (
    <aside className="wf-ac-gate-receipt-flow rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
        Process map
      </p>
      <div className="wf-light-panel rounded-xl p-3 ac-inbound-process-panel">
        <ol className="ac-inbound-process-steps ac-inbound-process-steps--sidebar space-y-2 mb-0">
          <li
            className={`ac-inbound-process-step${
              gateDone ? " ac-inbound-process-step--done" : " ac-inbound-process-step--active"
            }`}
          >
            <StatusPill kind={gateDone ? "ok" : "info"}>{gateDone ? "Done" : "Now"}</StatusPill>
            <div>
              <div className="font-medium text-slate-900">Received at gate</div>
              <div className="text-xs text-slate-600">
                {gateDone
                  ? `Gate receipt recorded${qtyLabel ? ` · ${qtyLabel}` : ""}`
                  : qtyLabel
                    ? `Gate receipt · ${qtyLabel}`
                    : "Enter the gate receipt"}
              </div>
            </div>
          </li>

          {inboundSteps.map((step, index) => {
            const isActive = !gatePending && !labDenied && stepIsActive(step, nextStepMeta);
            const pill = gatePending
              ? { kind: "neutral", label: "Waiting" }
              : stepPill(step, isActive, labDenied);
            return (
              <li
                key={step.operation_code || step.process_step}
                className={`ac-inbound-process-step${
                  !gatePending && step.status === "COMPLETED" ? " ac-inbound-process-step--done" : ""
                }${isActive ? " ac-inbound-process-step--active" : ""}`}
              >
                <StatusPill kind={pill.kind}>{pill.label}</StatusPill>
                <div>
                  <div className="font-medium text-slate-900">
                    {prepCount ? `Step ${index + 1} of ${prepCount} · ` : ""}
                    {displayInboundStepLabel(step.operation_name || step)}
                  </div>
                </div>
              </li>
            );
          })}

          <li
            className={`ac-inbound-process-step${
              selected?.inbound_prep_complete ? " ac-inbound-process-step--ready" : ""
            }`}
          >
            <StatusPill kind={selected?.inbound_prep_complete ? "ok" : "warn"}>
              {selected?.inbound_prep_complete ? "Ready" : "Locked"}
            </StatusPill>
            <div>
              <div className="font-medium text-slate-900">Release to Production</div>
              <div className="text-xs text-slate-600">
                {labDenied
                  ? "Lab denied — this inward cannot be released."
                  : selected?.inbound_prep_complete ? (
                    <Link
                      to="/activated-carbon/raw-material?tab=release"
                      className="wf-btn wf-btn-primary mt-1"
                    >
                      Open Release
                    </Link>
                  ) : (
                    "Complete RMS Inward, Lab, and RMS Outward first."
                  )}
              </div>
            </div>
          </li>
        </ol>
      </div>
    </aside>
  );
}
