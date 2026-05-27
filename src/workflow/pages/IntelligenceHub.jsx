import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar
} from "recharts";

import api from "../../services/api";
import {
  WfCard,
  WfCardHeader,
  WfCardBody,
  KpiTile,
  SectionHeader,
  StatusPill,
  EmptyState
} from "../ui";
import FlowDiagram from "../FlowDiagram";


const safeFetch = async (url, fallback) => {
  try {
    const r = await api.get(url);
    return r.data ?? fallback;
  } catch (e) {
    return fallback;
  }
};


function IntelligenceHub() {
  const [kpis, setKpis] = useState({
    production_orders: 0,
    work_orders: 0,
    ncr_count: 0,
    dispatch_count: 0,
    average_oee: 0
  });
  const [orders, setOrders] = useState([]);
  const [lots, setLots] = useState([]);
  const [oeeTrend, setOeeTrend] = useState([]);
  const [oeeSummaries, setOeeSummaries] = useState([]);
  const [openWorkOrders, setOpenWorkOrders] = useState([]);
  const [openNcrs, setOpenNcrs] = useState([]);
  const [dispatches, setDispatches] = useState([]);

  useEffect(() => {
    (async () => {
      const [k, o, l, t, oee, wos, ncrs, dis] = await Promise.all([
        safeFetch("/dashboard/kpis", {}),
        safeFetch("/orders", []),
        safeFetch("/production-lots", []),
        safeFetch("/dashboard/oee-trend", []),
        safeFetch("/oee-daily-summary", []),
        safeFetch("/dashboard/open-work-orders", []),
        safeFetch("/dashboard/open-ncrs", []),
        safeFetch("/dashboard/recent-dispatches", [])
      ]);
      setKpis(k || {});
      setOrders(Array.isArray(o) ? o : []);
      setLots(Array.isArray(l) ? l : []);
      setOeeTrend(Array.isArray(t) ? t : []);
      setOeeSummaries(Array.isArray(oee) ? oee : []);
      setOpenWorkOrders(Array.isArray(wos) ? wos : []);
      setOpenNcrs(Array.isArray(ncrs) ? ncrs : []);
      setDispatches(Array.isArray(dis) ? dis : []);
    })();
  }, []);

  const oeeValue = Number(kpis.average_oee || 0);

  const machineStatus = useMemo(() => {
    const latest = {};
    oeeSummaries.forEach((r) => {
      const id = r.machine_id;
      if (!id) return;
      const existing = latest[id];
      if (!existing || (r.oee_date || "") > (existing.oee_date || "")) {
        latest[id] = r;
      }
    });
    return Object.values(latest).slice(0, 6);
  }, [oeeSummaries]);

  const lotStageCounts = useMemo(() => {
    const map = { created: 0, inprogress: 0, completed: 0 };
    lots.forEach((l) => {
      const s = (l.status || "").toLowerCase();
      if (s.includes("complete")) map.completed += 1;
      else if (s.includes("progress")) map.inprogress += 1;
      else map.created += 1;
    });
    return map;
  }, [lots]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Manufacturing Workflow Intelligence"
        title="Operational Intelligence Hub"
        subtitle="A single, connected view across orders, lots, machines, quality and dispatch — driven by the ontology graph."
        right={
          <Link to="/workflow/customer-order" className="wf-btn wf-btn-primary">
            Start New Workflow
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiTile label="Orders" value={orders.length} sub="Customer orders" accent="blue" icon={<IconOrder />} />
        <KpiTile label="Production Lots" value={lots.length} sub="In system" accent="indigo" icon={<IconLot />} />
        <KpiTile label="Open Work Orders" value={openWorkOrders.length} sub="Shop floor" accent="cyan" icon={<IconWO />} />
        <KpiTile label="Open NCRs" value={openNcrs.length} sub="Quality" accent="rose" icon={<IconNcr />} />
        <KpiTile label="Dispatches" value={dispatches.length} sub="Recent" accent="violet" icon={<IconTruck />} />
        <KpiTile label="Avg OEE" value={`${oeeValue.toFixed(1)}%`} sub="Plant-wide" accent="emerald" icon={<IconChart />} />
      </div>

      {/* Live workflow pipeline */}
      <WfCard glow>
        <WfCardHeader
          title="Live Workflow Pipeline"
          subtitle="Real-time view of every manufacturing stage from order intake to dispatch"
          icon={<IconFlow />}
          right={<StatusPill kind="info">Streaming</StatusPill>}
        />
        <WfCardBody>
          <FlowDiagram
            steps={[
              { id: "co", title: "Customer Order", code: "CO", status: "done", seq: 1, meta: `${orders.length} orders` },
              { id: "po", title: "Production Order", code: "PO", status: "done", seq: 2, meta: `${kpis.production_orders ?? 0} active` },
              { id: "ls", title: "Lot Split", code: "LS", status: "done", seq: 3, meta: `${lots.length} lots` },
              { id: "rt", title: "Routing", code: "RT", status: "active", seq: 4, meta: "Operations sequenced" },
              { id: "fe", title: "Feasibility", code: "FE", status: "active", seq: 5, meta: "Materials · Machines · Tools" },
              { id: "sc", title: "Scheduling", code: "SC", status: "active", seq: 6, meta: "Work centers · Shifts" },
              { id: "ex", title: "Execution", code: "EX", status: "active", seq: 7, meta: `${openWorkOrders.length} WO open` },
              { id: "qc", title: "Inspection", code: "QC", status: openNcrs.length ? "blocked" : "active", seq: 8, meta: `${openNcrs.length} NCR` },
              { id: "dp", title: "Dispatch", code: "DP", status: "pending", seq: 9, meta: `${dispatches.length} dispatched` },
              { id: "tr", title: "Traceability", code: "TR", status: "pending", seq: 10, meta: "Genealogy closed" }
            ]}
          />
        </WfCardBody>
      </WfCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <WfCard className="lg:col-span-2">
          <WfCardHeader
            title="OEE Trend"
            subtitle="Plant-wide overall equipment effectiveness — last period"
            icon={<IconChart />}
          />
          <WfCardBody>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={oeeTrend} margin={{ top: 6, right: 10, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="oeeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.5}/>
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" stroke="rgba(124,159,255,0.12)" vertical={false}/>
                  <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false}/>
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]}/>
                  <Tooltip
                    contentStyle={{ background: "#0a1226", border: "1px solid rgba(124,159,255,0.3)", borderRadius: 8, color: "#e2e8f0" }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Area type="monotone" dataKey="oee" stroke="#60a5fa" strokeWidth={2.5} fill="url(#oeeGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </WfCardBody>
        </WfCard>

        <WfCard>
          <WfCardHeader title="Quality Gate" subtitle="Inspections · NCRs · Pass rate" icon={<IconShield />} />
          <WfCardBody>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="60%" outerRadius="100%" data={[
                  { name: "OEE", value: oeeValue, fill: "#60a5fa" }
                ]} startAngle={90} endAngle={-270}>
                  <RadialBar background={{ fill: "rgba(124,159,255,0.1)" }} dataKey="value" cornerRadius={20} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="text-center -mt-32 pointer-events-none">
                <div className="text-3xl font-bold text-slate-100">
                  {oeeValue.toFixed(1)}%
                </div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400">Plant OEE</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-12 text-center">
              <StatBlock label="Avail" value="—" tone="emerald" />
              <StatBlock label="Perf"  value="—" tone="blue" />
              <StatBlock label="Qual"  value="—" tone="violet" />
            </div>
          </WfCardBody>
        </WfCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <WfCard>
          <WfCardHeader
            title="Machine Status"
            subtitle="Latest OEE per machine"
            icon={<IconMachine />}
          />
          <WfCardBody>
            {machineStatus.length === 0 ? (
              <EmptyState title="No machine data" hint="Record an OEE summary to see live status." icon={<IconMachine />}/>
            ) : (
              <div className="space-y-3">
                {machineStatus.map((m) => {
                  const oee = Number(m.oee_percent) || 0;
                  const tone = oee >= 80 ? "ok" : oee >= 60 ? "warn" : "bad";
                  return (
                    <div key={m.machine_id} className="flex items-center gap-3">
                      <div className="text-xs font-mono text-slate-300 w-28 truncate">
                        {m.machine_id}
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-slate-800/60 overflow-hidden">
                        <div
                          className={`h-full ${tone === "ok" ? "bg-emerald-400" : tone === "warn" ? "bg-amber-400" : "bg-rose-400"}`}
                          style={{ width: `${Math.min(oee, 100)}%` }}
                        />
                      </div>
                      <StatusPill kind={tone}>{oee.toFixed(1)}%</StatusPill>
                    </div>
                  );
                })}
              </div>
            )}
          </WfCardBody>
        </WfCard>

        <WfCard>
          <WfCardHeader title="Lot Stages" subtitle="Where lots are right now" icon={<IconLot />} />
          <WfCardBody>
            <div className="grid grid-cols-3 gap-2">
              <StageStat label="Created" value={lotStageCounts.created} tone="info" />
              <StageStat label="In Progress" value={lotStageCounts.inprogress} tone="warn" />
              <StageStat label="Completed" value={lotStageCounts.completed} tone="ok" />
            </div>

            <div className="mt-5">
              <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
                Recent Lots
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {lots.slice(0, 8).map((l) => (
                  <div key={l.lot_id} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-slate-900/40 border border-slate-700/30 text-xs">
                    <span className="font-mono text-slate-300">{l.lot_id}</span>
                    <span className="text-slate-400">qty {l.lot_quantity}</span>
                    <StatusPill kind={(l.status || "").toLowerCase().includes("complete") ? "ok" : "info"}>
                      {l.status || "—"}
                    </StatusPill>
                  </div>
                ))}
                {lots.length === 0 && (
                  <div className="text-xs text-slate-500 text-center py-3">No lots yet</div>
                )}
              </div>
            </div>
          </WfCardBody>
        </WfCard>

        <WfCard>
          <WfCardHeader title="Operational Signals" subtitle="Anomalies & alerts" icon={<IconBolt />} />
          <WfCardBody>
            <div className="space-y-2.5">
              <SignalRow tone="bad" label="Open NCRs blocking dispatch" value={openNcrs.length} hint="Quality must close before dispatch gate." />
              <SignalRow tone="warn" label="Open work orders" value={openWorkOrders.length} hint="Awaiting completion on shop floor." />
              <SignalRow tone="info" label="Dispatches today" value={dispatches.length} hint="Ready or shipped." />
              <SignalRow tone="ok"  label="OEE health" value={`${oeeValue.toFixed(1)}%`} hint="Above 75% target maintains throughput." />
            </div>
          </WfCardBody>
        </WfCard>
      </div>
    </div>
  );
}

function StageStat({ label, value, tone }) {
  const cls = {
    ok:   "bg-emerald-500/10 border-emerald-400/30 text-emerald-200",
    info: "bg-blue-500/10 border-blue-400/30 text-blue-200",
    warn: "bg-amber-500/10 border-amber-400/30 text-amber-200",
    bad:  "bg-rose-500/10 border-rose-400/30 text-rose-200"
  }[tone] || "bg-slate-500/10 border-slate-400/30";
  return (
    <div className={`rounded-xl border ${cls} p-3 text-center`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-widest mt-0.5 opacity-80">{label}</div>
    </div>
  );
}

function SignalRow({ tone, label, value, hint }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-700/30">
      <StatusPill kind={tone}>{value}</StatusPill>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-200">{label}</div>
        <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{hint}</div>
      </div>
    </div>
  );
}

function StatBlock({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-900/40 border border-slate-700/30 py-2">
      <div className="text-[10px] uppercase tracking-widest text-slate-400">{label}</div>
      <div className="text-base font-semibold text-slate-100 mt-0.5">{value}</div>
    </div>
  );
}

function IconOrder()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/></svg>; }
function IconLot()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7 12 3l9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10"/></svg>; }
function IconWO()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h7M7 17h4"/></svg>; }
function IconNcr()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18A2 2 0 0 0 3.54 21h16.92a2 2 0 0 0 1.72-3L13.7 3.86a2 2 0 0 0-3.4 0z"/></svg>; }
function IconTruck()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h11v10H2zM13 10h5l3 3v4h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>; }
function IconChart()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>; }
function IconFlow()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="6" height="6" rx="1"/><rect x="15" y="4" width="6" height="6" rx="1"/><rect x="9" y="14" width="6" height="6" rx="1"/><path d="M9 7h6M6 10v4h6M18 10v4h-6"/></svg>; }
function IconShield()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.5 8.5 8 9 4.5-.5 8-4.5 8-9V6z"/></svg>; }
function IconMachine() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M8 8V4h8v4M9 14h6"/></svg>; }
function IconBolt()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>; }

export default IntelligenceHub;
