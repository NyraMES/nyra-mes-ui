import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  fetchMesCoreProductionLots,
  runMesCoreFeasibilityCheck,
} from "../../services/mesCoreApi";
import { isFeasibilityReady, feasibilityLabel } from "../../utils/workflowValidation";
import useWorkflowNavPaths from "../../hooks/useWorkflowNavPaths";
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


function groupChecks(checks, types) {
  const wanted = new Set(types.map((t) => t.toLowerCase()));
  return (checks || []).filter((c) =>
    wanted.has(String(c.resource_type || "").toLowerCase())
  );
}

function groupStatus(checks, fallbackStatus) {
  if (checks.some((c) => (c.status || "").toUpperCase() === "BLOCKED")) {
    return statusOf("blocked");
  }
  if (checks.some((c) => (c.status || "").toUpperCase() === "WARNING")) {
    return statusOf("warn");
  }
  if (checks.length) return statusOf("ok");
  return fallbackStatus;
}

function groupHint(checks, fallbackHint, dimKey) {
  const details = checks.map((c) => c.detail).filter(Boolean);
  if (!details.length) return fallbackHint;
  if (dimKey === "schedule_capacity") {
    return simplifyScheduleDetail(details.join("; "));
  }
  if (details.length === 1) return details[0];
  return details[0];
}

/** Collapse legacy multi-operation overlap text to one sentence. */
function simplifyScheduleDetail(detail) {
  const text = String(detail || "").trim();
  if (!text) return text;

  const lotFromOverlap = text.match(/overlaps lot\s+(\S+)/i);
  const lotFromShort = text.match(/^Lot\s+(\S+)\s+is using/i);
  const lot = lotFromOverlap?.[1] || lotFromShort?.[1];
  if (lot) {
    const usesKiln = /KILN|activation kiln/i.test(text);
    const resource = usesKiln ? "the activation kiln" : "this equipment";
    return `Lot ${lot} is using ${resource}. Please wait for that process to complete.`;
  }

  const first = text.split(";")[0].trim();
  return first.length > 160 ? `${first.slice(0, 157)}…` : first;
}

/** Map API checks onto user-facing dimension tiles (one card per group). */
function buildDimensionTiles(result, dimDefs) {
  const checks = result?.checks || [];
  const groups = {
    material: ["material"],
    machine: ["machine", "machine_assignment"],
    tool: ["tool"],
    workforce: ["workforce"],
    routing: ["routing"],
    schedule_capacity: ["schedule_capacity"]
  };

  return dimDefs.map((d) => {
    const matched = groupChecks(checks, groups[d.key] || [d.key]);
    const summaryStatus = result?.[`${d.key}_status`];
    return {
      ...d,
      status: groupStatus(
        matched,
        summaryStatus ? statusOf(summaryStatus) : { kind: "neutral", label: "Pending" }
      ),
      hint: groupHint(matched, d.hint, d.key)
    };
  });
}

function feasibilityDimDefs(machineLabel, machineHint) {
  return [
    { key: "material", label: "Material", hint: "Raw material inward and QC status", icon: <IconBox /> },
    { key: "machine", label: machineLabel, hint: machineHint, icon: <IconMachine /> },
    { key: "tool", label: "Tool", hint: "Tooling requirements satisfied", icon: <IconTool /> },
    { key: "workforce", label: "Workforce", hint: "Labor pools available for routing", icon: <IconUsers /> },
    {
      key: "routing",
      label: "Routing",
      hint: "Active product routing with operations defined",
      icon: <IconRoute />
    },
    {
      key: "schedule_capacity",
      label: "Schedule",
      hint: "Machine/kiln not double-booked with another lot",
      icon: <IconCalendar />
    }
  ];
}

function FeasibilityScreen({
  hideHeader = false,
  machineLabel = "Machine",
  machineHint = "Required machines available & uptime",
  runCheck,
  loadLots,
  initialLotId,
  afterPassHint,
  afterPassPath,
  afterPassLabel
}) {
  const { context, markStage, update } = useWorkflow();
  const nav = useWorkflowNavPaths();
  const passPath = afterPassPath || nav.afterFeasibility;
  const passLabel = afterPassLabel || nav.afterFeasibilityLabel;
  const passHint =
    afterPassHint ||
    "Feasibility gate passed — you can proceed to the next step in the manufacturing flow.";
  const [lots, setLots] = useState([]);
  const [lotId, setLotId] = useState(initialLotId || context.lotId || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loader = loadLots || fetchMesCoreProductionLots;
    loader()
      .then((rows) => setLots(rows || []))
      .catch(() => setLots([]));
  }, [loadLots]);

  useEffect(() => {
    if (!lots.length) return;
    const preferred = context.lotId;
    if (!preferred) return;
    const match = lots.find(
      (l) => l.lot_id === preferred || l.production_lot_id === preferred || l.lot_code === preferred
    );
    if (match) {
      const id = match.lot_id || match.lot_code;
      setLotId(id);
    }
  }, [context.lotId, lots]);

  useEffect(() => {
    if (context.lotId && !lotId) setLotId(context.lotId);
  }, [context.lotId, lotId]);

  useEffect(() => {
    if (!initialLotId) return;
    setLotId(initialLotId);
    update({ lotId: initialLotId });
  }, [initialLotId, update]);

  const selectLot = (value) => {
    setLotId(value);
    if (value) update({ lotId: value });
  };

  const check = async () => {
    if (!lotId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const checkFn = runCheck || runMesCoreFeasibilityCheck;
      const data = await checkFn(lotId);
      setResult(data);
      if (isFeasibilityReady(data?.overall_status)) {
        markStage("feasibility");
      }
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Feasibility check failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lotId) check();
  }, [lotId]);

  const dimDefs = feasibilityDimDefs(machineLabel, machineHint);

  const dimensionTiles = result
    ? buildDimensionTiles(result, dimDefs)
    : dimDefs.map((d) => ({
        ...d,
        status: { kind: "neutral", label: "Pending" }
      }));

  const overall = statusOf(result?.overall_status);
  const isReady = result && isFeasibilityReady(result.overall_status);

  const blockers = dimensionTiles
    .filter((d) => d.status?.kind === "bad")
    .map((d) => ({
      key: d.key,
      label: d.label,
      hint: d.hint,
      icon: <IconAlert />,
      s: d.status
    }));

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <SectionHeader
          eyebrow="Stage 05 · Feasibility Validation"
          title="Can this lot run right now?"
          subtitle="Six checks across material, kiln, tools, workforce, routing, and schedule. Blocked items show what to fix before lot routing."
        />
      )}

      <ContextBanner
        items={[
          { label: "Customer", value: context.customerName },
          { label: "Order", value: context.orderId },
          { label: "Lot", value: lotId || "—" },
          { label: "Status", value: result?.overall_status || "—" }
        ]}
        action={
          isReady && (
            <Link to={nav.afterFeasibility} className="wf-btn wf-btn-primary">
              {nav.afterFeasibilityLabel}
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
                  onChange={(e) => selectLot(e.target.value)}
                >
                  <option value="">-- Pick a lot --</option>
                  {lots.map((l) => {
                    const id = l.lot_id || l.lot_code;
                    const inward = l.order_code ? ` · ${l.order_code}` : "";
                    const gateLabel = l.feasibility_status
                      ? feasibilityLabel(l.feasibility_status)
                      : "Not checked";
                    return (
                      <option key={id} value={id}>
                        {id}
                        {inward} · qty {l.lot_quantity ?? "—"} · {gateLabel}
                      </option>
                    );
                  })}
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
              {dimensionTiles.map((d) => (
                <DimensionTile
                  key={d.key}
                  icon={d.icon}
                  label={d.label}
                  hint={d.hint}
                  status={d.status}
                />
              ))}
            </div>

            {error && (
              <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            {result && !isReady && blockers.length > 0 && (
              <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                <div className="text-[10px] uppercase tracking-widest text-rose-300 font-semibold mb-1">
                  Feasibility gate — blocked
                </div>
                {blockers.map((b) => b.hint).join(" ")}
              </div>
            )}

            {result && isReady && (
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {passHint}{" "}
                <Link to={passPath} className="underline font-semibold text-emerald-50">
                  {passLabel}
                </Link>
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
              ) : blockers.length === 0 && isReady ? (
                <div className="text-center py-6">
                  <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 mb-2">
                    <IconCheck />
                  </div>
                  <div className="text-sm text-emerald-200 font-medium">No blockers detected</div>
                  <div className="text-xs text-slate-500 mt-1">Lot is ready to schedule.</div>
                </div>
              ) : blockers.length === 0 && !isReady ? (
                <div className="text-center py-6">
                  <div className="text-sm text-amber-200 font-medium">Checks passed individually</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {result?.blocked_reason ||
                      "Overall gate is not open yet — open Lot Routing and generate work orders, then re-run feasibility."}
                  </div>
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
                ok={!result || (result.checks || []).every((c) => (c.status || "").toUpperCase() !== "BLOCKED")}
                label="Routing, machines & schedule capacity OK"
              />
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

function DimensionTile({ icon, label, hint, status }) {
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
      <div className="text-xs text-slate-400 mt-1 leading-relaxed">{hint}</div>
    </div>
  );
}

function IconShield()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.5 8.5 8 9 4.5-.5 8-4.5 8-9V6z"/></svg>; }
function IconBox()     { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7 12 3l9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10"/></svg>; }
function IconMachine() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M8 8V4h8v4M9 14h6"/></svg>; }
function IconTool()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z"/></svg>; }
function IconUsers()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M14 19c0-2.5 2.5-4 4-4s4 1.5 4 4"/></svg>; }
function IconRoute()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19V8a4 4 0 0 1 4-4h4"/></svg>; }
function IconCalendar(){ return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>; }
function IconBolt()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>; }
function IconAtom()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconAlert()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18A2 2 0 0 0 3.54 21h16.92a2 2 0 0 0 1.72-3L13.7 3.86a2 2 0 0 0-3.4 0z"/></svg>; }
function IconCheck()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>; }

export default FeasibilityScreen;
