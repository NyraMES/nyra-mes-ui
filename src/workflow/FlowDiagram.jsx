/**
 * Horizontal flow diagram with arrow connectors.
 * Each `step` shape:
 *   { id, title, code, status: 'done' | 'active' | 'pending' | 'blocked', meta?, icon? }
 */
export default function FlowDiagram({ steps = [], compact = false }) {
  if (!steps.length) {
    return (
      <div className="text-sm text-slate-500 py-6 text-center">
        No flow defined yet.
      </div>
    );
  }

  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
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
      className={`wf-flow-node ${statusClass} ${compact ? "min-w-[150px]" : "min-w-[180px]"} flex-shrink-0`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {step.seq !== undefined && (
            <div className="w-6 h-6 rounded-md bg-slate-900/80 border border-slate-700/60 flex items-center justify-center text-[11px] font-bold text-slate-200">
              {step.seq}
            </div>
          )}
          {step.icon && (
            <div className="text-blue-300">{step.icon}</div>
          )}
        </div>
        <span className={badge.cls}>{badge.text}</span>
      </div>
      <div className="text-sm font-semibold text-slate-100 leading-tight">
        {step.title}
      </div>
      {step.code && (
        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
          {step.code}
        </div>
      )}
      {step.meta && (
        <div className="text-[11px] text-slate-400 mt-2 leading-snug">
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
