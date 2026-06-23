/**
 * Horizontal flow diagram with arrow connectors.
 * Each `step` shape:
 *   { id, title, code, status, seq?, count?, meta?, icon? }
 */
export default function FlowDiagram({ steps = [], compact = false, dense = false, layout = "horizontal" }) {
  if (!steps.length) {
    return (
      <div className="wf-flow-diagram-empty">
        No flow defined yet.
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className="wf-flow-grid grid grid-cols-3 gap-1.5 w-full max-w-[252px]">
        {steps.map((step, idx) => (
          <FlowTile key={step.id || idx} step={step} />
        ))}
      </div>
    );
  }

  return (
    <div className={`wf-flow-diagram flex items-stretch overflow-x-auto pb-2 ${dense ? "gap-1 wf-flow-diagram--dense" : "gap-2"}`}>
      {steps.map((step, idx) => (
        <div className={`flex items-stretch ${dense ? "gap-1" : "gap-2"}`} key={step.id || idx}>
          <FlowNode step={step} compact={compact} dense={dense} />
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

function FlowNode({ step, compact, dense }) {
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
      className={`wf-flow-node ${statusClass} ${
        dense
          ? "wf-flow-node--dense min-w-[84px] max-w-[96px]"
          : compact
            ? "wf-flow-node--compact min-w-[148px]"
            : "min-w-[196px]"
      } flex-shrink-0`}
    >
      <div className={`wf-flow-node-top${dense ? " wf-flow-node-top--dense" : ""}`}>
        {step.seq !== undefined && (
          <div className="wf-flow-node-seq" aria-hidden="true">
            {step.seq}
          </div>
        )}
        {!dense ? <span className={badge.cls}>{badge.text}</span> : null}
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

function FlowTile({ step }) {
  const status = step.status || "pending";
  const statusClass = {
    done: "wf-flow-node-done",
    active: "wf-flow-node-active",
    blocked: "wf-flow-node-blocked",
    pending: ""
  }[status];

  return (
    <div
      className={`wf-flow-node wf-flow-node--tile aspect-square ${statusClass} flex flex-col items-center justify-center text-center p-1 min-w-0`}
      title={step.title}
    >
      {step.seq !== undefined ? (
        <div className="wf-flow-node-seq mb-0.5" aria-hidden="true">
          {step.seq}
        </div>
      ) : null}
      <div className="wf-flow-node-count text-base leading-none">
        {formatFlowCount(step)}
      </div>
      <div className="wf-flow-node-title text-[9px] leading-tight mt-1 line-clamp-2 px-0.5">
        {step.title}
      </div>
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
