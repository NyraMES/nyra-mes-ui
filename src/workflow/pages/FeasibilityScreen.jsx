import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../services/api";
import { isFeasibilityReady } from "../../utils/workflowValidation";
import { useWorkflow } from "../WorkflowContext";
import {
  WfCard,
  WfCardHeader,
  WfCardBody,
  SectionHeader,
  StatusPill,
  ContextBanner,
  OntologyEdge,
  EmptyState
} from "../ui";


const STATUS_META = {
  ok:      { kind: "ok",   tone: "emerald", label: "Available" },
  ready:   { kind: "ok",   tone: "emerald", label: "Ready" },
  yes:     { kind: "ok",   tone: "emerald", label: "Yes" },
  green:   { kind: "ok",   tone: "emerald", label: "OK" },
  partial: { kind: "warn", tone: "amber",   label: "Partial" },
  amber:   { kind: "warn", tone: "amber",   label: "Partial" },
  warn:    { kind: "warn", tone: "amber",   label: "Warning" },
  short:   { kind: "warn", tone: "amber",   label: "Short" },
  missing: { kind: "bad",  tone: "rose",    label: "Missing" },
  blocked: { kind: "bad",  tone: "rose",    label: "Blocked" },
  red:     { kind: "bad",  tone: "rose",    label: "Blocked" },
  no:      { kind: "bad",  tone: "rose",    label: "Unavailable" }
};


function statusOf(v) {
  if (!v) return { kind: "neutral", tone: "slate", label: "Unknown" };
  const key = String(v).toLowerCase().trim();
  if (STATUS_META[key]) return STATUS_META[key];
  // common patterns
  if (key.includes("ready") || key.includes("ok") || key.includes("avail")) return STATUS_META.ok;
  if (key.includes("part") || key.includes("warn")) return STATUS_META.partial;
  if (key.includes("block") || key.includes("miss") || key.includes("fail")) return STATUS_META.blocked;
  return { kind: "info", tone: "blue", label: v };
}


function FeasibilityScreen() {
  const { context, markStage } = useWorkflow();
  const [lots, setLots] = useState([]);
  const [lotId, setLotId] = useState(context.lotId || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/production-lots").then((r) => setLots(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (context.lotId && !lotId) setLotId(context.lotId);
  }, [context.lotId]);

  const check = async () => {
    if (!lotId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.get(`/feasibility/${lotId}`);
      setResult(r.data);
      if (isFeasibilityReady(r.data?.overall_status)) {
        markStage("feasibility");
      }
    } catch (e) {
      setError(e.response?.data?.detail || "Feasibility check failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lotId) check();
  }, [lotId]);

  const dims = [
    { key: "material",  label: "Material",  hint: "Raw material, alloys & consumables ready", icon: <IconBox /> },
    { key: "machine",   label: "Machine",   hint: "Required machines available & uptime",     icon: <IconMachine /> },
    { key: "tool",      label: "Tool",      hint: "Tooling, dies, fixtures present",          icon: <IconTool /> },
    { key: "workforce", label: "Workforce", hint: "Skilled operators scheduled in shift",     icon: <IconUsers /> }
  ];

  const overall = statusOf(result?.overall_status);
  const isReady = result && isFeasibilityReady(result.overall_status);
  const gateReason = result?.blocked_reason;

  const blockers = result
    ? dims
        .map((d) => ({ ...d, s: statusOf(result[`${d.key}_status`]) }))
        .filter((d) => d.s.kind !== "ok")
    : [];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Stage 05 · Feasibility Validation"
        title="Can this lot run right now?"
        subtitle="Reasoning across four dimensions. If any are blocked, the system surfaces the root cause and prevents scheduling."
      />

      <ContextBanner
        items={[
          { label: "Customer", value: context.customerName },
          { label: "Order", value: context.orderId },
          { label: "Lot", value: lotId || "—" },
          { label: "Status", value: result?.overall_status || "—" }
        ]}
        action={
          isReady && (
            <Link to="/workflow/scheduling" className="wf-btn wf-btn-primary">
              Proceed to Schedule →
            </Link>
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <WfCard className="md:col-span-2" glow>
          <WfCardHeader
            title="Feasibility Reasoning"
            subtitle={result ? `Overall: ${result.overall_status}` : "Pick a lot to run the check"}
            icon={<IconBolt />}
            right={result && <StatusPill kind={overall.kind}>{overall.label}</StatusPill>}
          />
          <WfCardBody className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="wf-label">Lot</label>
                <select
                  className="wf-select"
                  value={lotId}
                  onChange={(e) => setLotId(e.target.value)}
                >
                  <option value="">-- Pick a lot --</option>
                  {lots.map((l) => (
                    <option key={l.lot_id} value={l.lot_id}>
                      {l.lot_id} · qty {l.lot_quantity} · {l.status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="wf-btn wf-btn-primary w-full justify-center"
                  onClick={check}
                  disabled={!lotId || loading}
                >
                  {loading ? "Checking…" : "Re-run Check"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dims.map((d) => {
                const s = result ? statusOf(result[`${d.key}_status`]) : { kind: "neutral", label: "Pending" };
                return (
                  <DimensionTile
                    key={d.key}
                    icon={d.icon}
                    label={d.label}
                    hint={d.hint}
                    status={s}
                    value={result?.[`${d.key}_status`]}
                  />
                );
              })}
            </div>

            {error && (
              <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            {result && gateReason && !isReady && (
              <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                <div className="text-[10px] uppercase tracking-widest text-rose-300 font-semibold mb-1">
                  Feasibility gate — blocked
                </div>
                {gateReason}
              </div>
            )}

            {result && isReady && (
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                Feasibility gate passed — scheduling is allowed for this lot.
              </div>
            )}

            {!result && !error && !loading && (
              <EmptyState
                title="No feasibility data yet"
                hint="Pick a lot to inspect material, machine, tool and workforce status."
                icon={<IconBolt />}
              />
            )}
          </WfCardBody>
        </WfCard>

        <div className="space-y-5">
          <WfCard>
            <WfCardHeader
              title="Root-Cause Analysis"
              subtitle="What's blocking the lot?"
              icon={<IconAlert />}
            />
            <WfCardBody>
              {!result ? (
                <EmptyState title="Run a check" hint="Select a lot to compute root cause." icon={<IconAlert />} />
              ) : blockers.length === 0 ? (
                <div className="text-center py-6">
                  <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 mb-2">
                    <IconCheck />
                  </div>
                  <div className="text-sm text-emerald-200 font-medium">No blockers detected</div>
                  <div className="text-xs text-slate-500 mt-1">Lot is ready to schedule.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {blockers.map((b) => (
                    <div key={b.key} className="rounded-lg bg-rose-500/8 border border-rose-400/30 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-rose-200 font-semibold flex items-center gap-2">
                          {b.icon}
                          {b.label}
                        </div>
                        <StatusPill kind={b.s.kind}>{b.s.label}</StatusPill>
                      </div>
                      <div className="text-xs text-slate-300 mt-1 leading-relaxed">
                        {b.hint}.
                      </div>
                      <div className="text-[11px] text-cyan-300 mt-2">
                        Ask Nyra → <span className="text-slate-300">Why is {b.label.toLowerCase()} blocked?</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader
              title="Feasibility Gate"
              subtitle="Scheduling requires overall OK"
              icon={<IconShield />}
            />
            <WfCardBody className="space-y-2.5 text-xs">
              <GateRule ok={Boolean(lotId)} label="Lot selected" />
              <GateRule ok={Boolean(result)} label="Feasibility check run" />
              <GateRule ok={isReady} label="overall_status = OK / READY" />
              <GateRule
                ok={!result || blockers.length === 0}
                label="No resource dimension blocked"
              />
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader title="Ontology" subtitle="Feasibility reasoning graph" icon={<IconAtom />} />
            <WfCardBody className="space-y-2.5">
              <OntologyEdge from="Operation" to="Material" label="requires" />
              <OntologyEdge from="Operation" to="Machine" label="requires" />
              <OntologyEdge from="Operation" to="Tool" label="requires" />
              <OntologyEdge from="Operation" to="Workforce" label="needs" />
              <OntologyEdge from="Lot" to="Feasibility" label="passes" />
            </WfCardBody>
          </WfCard>
        </div>
      </div>
    </div>
  );
}

function GateRule({ ok, label }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/></svg>
      )}
      <span className={ok ? "text-emerald-200" : "text-slate-400"}>{label}</span>
    </div>
  );
}

function DimensionTile({ icon, label, hint, status, value }) {
  const toneRing = {
    ok:      "ring-emerald-400/40 from-emerald-500/15",
    warn:    "ring-amber-400/40   from-amber-500/15",
    bad:     "ring-rose-400/40    from-rose-500/15",
    info:    "ring-blue-400/40    from-blue-500/15",
    neutral: "ring-slate-700/50   from-slate-500/10"
  }[status.kind] || "";
  const toneIcon = {
    ok:      "text-emerald-300 bg-emerald-500/15 border-emerald-400/30",
    warn:    "text-amber-300   bg-amber-500/15   border-amber-400/30",
    bad:     "text-rose-300    bg-rose-500/15    border-rose-400/30",
    info:    "text-blue-300    bg-blue-500/15    border-blue-400/30",
    neutral: "text-slate-400   bg-slate-800/40   border-slate-700/40"
  }[status.kind] || "";

  return (
    <div className={`relative rounded-2xl bg-gradient-to-br to-slate-900/40 ${toneRing} ring-1 p-4`}>
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg border ${toneIcon}`}>{icon}</div>
        <StatusPill kind={status.kind}>{status.label}</StatusPill>
      </div>
      <div className="mt-3 text-base font-semibold text-slate-100">{label}</div>
      <div className="text-xs text-slate-400 mt-1 leading-snug">{hint}</div>
      {value && (
        <div className="text-[10px] mt-2 font-mono uppercase tracking-widest text-slate-500">
          Raw: {String(value)}
        </div>
      )}
    </div>
  );
}

function IconShield()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.5 8.5 8 9 4.5-.5 8-4.5 8-9V6z"/></svg>; }
function IconBox()     { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7 12 3l9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10"/></svg>; }
function IconMachine() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M8 8V4h8v4M9 14h6"/></svg>; }
function IconTool()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z"/></svg>; }
function IconUsers()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M14 19c0-2.5 2.5-4 4-4s4 1.5 4 4"/></svg>; }
function IconBolt()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>; }
function IconAtom()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconAlert()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18A2 2 0 0 0 3.54 21h16.92a2 2 0 0 0 1.72-3L13.7 3.86a2 2 0 0 0-3.4 0z"/></svg>; }
function IconCheck()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>; }

export default FeasibilityScreen;
