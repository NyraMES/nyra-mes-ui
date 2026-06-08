/**
 * Horizontal flow diagram with arrow connectors.
 * Each `step` shape:
 *   { id, title, code, status, seq?, count?, meta?, icon? }
 */
export default function FlowDiagram({ steps = [], compact = false }) {
  if (!steps.length) {
    return (
      <div className="wf-flow-diagram-empty">
        No flow defined yet.
      </div>
    );
  }

  return (
    <div className="wf-flow-diagram flex items-stretch gap-2 overflow-x-auto pb-2">
      {steps.map((step, idx) => (
        <div className="flex items-stretch gap-2" key={step.id || idx}>
          <FlowNode step={step} compact={compact} />
          {idx < steps.length - 1 && (
            <FlowConnector active={step.status === "done" || step.status === "active"} />
          )}
        </div>
      ))}
    </div>
  );
}

function formatFlowCount(step) {
  if (step.count === undefined || step.count === null) {
    return "—";
  }
  return step.count;
}

function FlowNode({ step, compact }) {
  const status = step.status || "pending";
  const statusClass = {
    done:    "wf-flow-node-done",
    active:  "wf-flow-node-active",
    blocked: "wf-flow-node-blocked",
    pending: ""
  }[status];

  const badge = {
    done:    { text: "Done",    cls: "wf-pill wf-pill-ok" },
    active:  { text: "Active",  cls: "wf-pill wf-pill-info" },
    blocked: { text: "Blocked", cls: "wf-pill wf-pill-bad" },
    pending: { text: "Pending", cls: "wf-pill wf-pill-neutral" }
  }[status];

  return (
    <div
      className={`wf-flow-node ${statusClass} ${compact ? "wf-flow-node--compact min-w-[148px]" : "min-w-[196px]"} flex-shrink-0`}
    >
      <div className="wf-flow-node-top">
        {step.seq !== undefined && (
          <div className="wf-flow-node-seq" aria-hidden="true">
            {step.seq}
          </div>
        )}
        <span className={badge.cls}>{badge.text}</span>
      </div>

      <div
        className={`wf-flow-node-count${step.count === undefined || step.count === null ? " wf-flow-node-count--placeholder" : ""}`}
        aria-label={`${step.title} count`}
      >
        {formatFlowCount(step)}
      </div>

      <div className="wf-flow-node-title">
        {step.title}
      </div>
      {step.code && (
        <div className="wf-flow-node-code">
          {step.code}
        </div>
      )}
      {step.meta && (
        <div className="wf-flow-node-meta">
          {step.meta}
        </div>
      )}
    </div>
  );
}

function FlowConnector({ active }) {
  return (
    <div className={`wf-connector ${active ? "wf-connector-active" : ""}`}>
      <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
        <path
          d="M2 11 H22 M16 5 L22 11 L16 17"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className={active ? "wf-edge-animate" : ""}
        />
      </svg>
    </div>
  );
}
