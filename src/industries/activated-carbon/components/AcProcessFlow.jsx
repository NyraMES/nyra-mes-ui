import { Link } from "react-router-dom";

const BASE = "/activated-carbon";

function statusLabel(status) {
  if (status === "complete") return "Done";
  if (status === "active") return "In progress";
  return "Pending";
}

function AcProcessFlow({ steps = [] }) {
  if (!steps.length) {
    return <p className="text-sm text-slate-600">No process steps configured.</p>;
  }

  return (
    <div className="wf-ac-process-flow">
      {steps.map((step, index) => (
        <div key={step.path} className="flex items-center gap-2 flex-1 min-w-0">
          <Link
            to={`${BASE}/${step.path}`}
            className={`wf-ac-process-step wf-ac-process-step--${step.status}`}
          >
            <div className="wf-ac-process-step-num">
              Step {step.step_order} · {statusLabel(step.status)}
            </div>
            <div className="wf-ac-process-step-label">{step.label}</div>
            <div className="wf-ac-process-step-meta">
              {step.record_count} record{step.record_count === 1 ? "" : "s"}
            </div>
          </Link>
          {index < steps.length - 1 && (
            <span className="wf-ac-process-connector" aria-hidden="true">
              →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default AcProcessFlow;
