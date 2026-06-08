import { Link } from "react-router-dom";

export function WfCard({ children, className = "", glow = false }) {
  return (
    <div
      className={`wf-card ${glow ? "wf-card-glow" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function WfCardHeader({ title, subtitle, icon, right }) {
  return (
    <div className="wf-card-header flex items-start justify-between gap-4 px-5 pt-5">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="wf-card-header-icon">
            {icon}
          </div>
        )}
        <div>
          <h3 className="wf-card-header-title">
            {title}
          </h3>
          {subtitle && (
            <p className="wf-card-header-subtitle">{subtitle}</p>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

export function WfCardBody({ children, className = "" }) {
  return <div className={`relative z-[1] p-5 ${className}`}>{children}</div>;
}

export function StatusPill({ kind = "neutral", children }) {
  return <span className={`wf-pill wf-pill-${kind}`}>{children}</span>;
}

export function KpiTile({ label, value, sub, accent = "blue", icon, trend }) {
  const accents = {
    blue:    { from: "from-blue-500/15",    border: "border-blue-400/30",    icon: "text-blue-300",    text: "text-blue-300" },
    cyan:    { from: "from-cyan-500/15",    border: "border-cyan-400/30",    icon: "text-cyan-300",    text: "text-cyan-300" },
    indigo:  { from: "from-indigo-500/15",  border: "border-indigo-400/30",  icon: "text-indigo-300",  text: "text-indigo-300" },
    violet:  { from: "from-violet-500/15",  border: "border-violet-400/30",  icon: "text-violet-300",  text: "text-violet-300" },
    emerald: { from: "from-emerald-500/15", border: "border-emerald-400/30", icon: "text-emerald-300", text: "text-emerald-300" },
    amber:   { from: "from-amber-500/15",   border: "border-amber-400/30",   icon: "text-amber-300",   text: "text-amber-300" },
    rose:    { from: "from-rose-500/15",    border: "border-rose-400/30",    icon: "text-rose-300",    text: "text-rose-300" }
  };
  const a = accents[accent] || accents.blue;
  return (
    <div className="wf-kpi-tile wf-card relative overflow-hidden p-4 min-w-0">
      <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-radial ${a.from} blur-3xl`} />
      <div className="relative min-w-0">
        <div className="wf-kpi-tile__label pr-1" title={label}>
          {label}
        </div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="wf-kpi-tile__value-row">
              <span className="wf-kpi-tile__value">{value}</span>
              {sub && (
                <span className="wf-kpi-tile__sub" title={sub}>
                  {sub}
                </span>
              )}
            </div>
            {trend && (
              <div className={`text-xs mt-2 ${a.text} flex items-center gap-1`}>
                {trend}
              </div>
            )}
          </div>
          {icon && (
            <div className={`shrink-0 p-2 rounded-xl bg-slate-900/60 border ${a.border} ${a.icon}`}>
              {icon}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SectionHeader({ eyebrow, title, subtitle, right }) {
  return (
    <div className="wf-section-header flex items-end justify-between gap-4 mb-5">
      <div>
        {eyebrow && (
          <div className="wf-section-header-eyebrow">
            {eyebrow}
          </div>
        )}
        <h2 className="wf-section-header-title mt-1">
          {title}
        </h2>
        {subtitle && (
          <p className="wf-section-header-subtitle mt-1 max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

export function ContextBanner({ label = "Workflow Context", items, action }) {
  return (
    <div className="wf-card p-4 mb-5 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300 uppercase tracking-widest">
          <Spark /> {label}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {items.map((it, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-700/60 text-xs text-slate-300">
                <span className="text-slate-500 mr-1.5 uppercase tracking-wider text-[10px]">
                  {it.label}
                </span>
                <span className="text-slate-900 font-medium">
                  {it.value || "—"}
                </span>
              </span>
              {i < items.length - 1 && (
                <span className="text-slate-600">→</span>
              )}
            </span>
          ))}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, hint }) {
  return (
    <div className="text-center py-10">
      {icon && (
        <div className="inline-flex p-3 rounded-2xl bg-slate-900/60 border border-slate-700/40 text-slate-500 mb-3">
          {icon}
        </div>
      )}
      <div className="text-sm text-slate-300 font-medium">{title}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export function StageLink({ to, children, completed = false, active = false }) {
  return (
    <Link
      to={to}
      className={`wf-stage ${active ? "wf-stage-active" : ""} ${completed ? "wf-stage-done" : ""}`}
    >
      {children}
    </Link>
  );
}

export function OntologyEdge({ from, to, label }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="px-2 py-1 rounded-md bg-slate-900/70 border border-slate-700/50 text-slate-200 font-mono">
        {from}
      </span>
      <span className="flex items-center gap-1 text-cyan-300/80">
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
        <span className="text-cyan-300">→</span>
      </span>
      <span className="px-2 py-1 rounded-md bg-slate-900/70 border border-slate-700/50 text-slate-200 font-mono">
        {to}
      </span>
    </div>
  );
}

export function Spark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6M12 16v6M2 12h6M16 12h6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
    </svg>
  );
}

export function Caret() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/** Modal shown after save so the user can copy the system-generated business IDs. */
export function GeneratedIdsDialog({
  open,
  title = "Created successfully",
  subtitle,
  items = [],
  continueLabel = "Continue",
  onContinue,
  onClose
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generated-ids-title"
    >
      <div className="wf-card wf-card-glow w-full max-w-md shadow-2xl border border-cyan-500/20">
        <WfCardHeader
          title={title}
          subtitle={subtitle || "Save these IDs for traceability on the shop floor."}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" />
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          }
        />
        <WfCardBody className="space-y-4 pt-0">
          <ul className="space-y-2.5">
            {items.map(({ label, value }) => (
              <li
                key={label}
                className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/60 border border-slate-700/50 px-3 py-2.5"
              >
                <span className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold shrink-0">
                  {label}
                </span>
                <span className="font-mono text-sm text-cyan-200 text-right break-all">{value}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            {onClose && (
              <button type="button" className="wf-btn wf-btn-ghost" onClick={onClose}>
                Close
              </button>
            )}
            <button type="button" className="wf-btn wf-btn-primary" onClick={onContinue}>
              {continueLabel}
            </button>
          </div>
        </WfCardBody>
      </div>
    </div>
  );
}
