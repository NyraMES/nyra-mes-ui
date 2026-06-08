import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar
} from "recharts";

import { formatApiError } from "../../services/api";
import {
  fetchMesCoreMachines,
  fetchMesCoreOeeIntelligence,
  recordMesCoreOeeSummary,
} from "../../services/mesCoreApi";
import { expandSingleDayTrend, normalizeOeeTrendPoints } from "../../utils/oeeTrend";
import {
  WfCard,
  WfCardHeader,
  WfCardBody,
  SectionHeader,
  KpiTile,
  StatusPill,
  EmptyState
} from "../ui";


function OeeDashboard() {
  const [intel, setIntel] = useState(null);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  const [machineId, setMachineId] = useState("");
  const [oeeDate, setOeeDate] = useState(new Date().toISOString().slice(0, 10));
  const [plannedMinutes, setPlannedMinutes] = useState("480");
  const [downtimeMinutes, setDowntimeMinutes] = useState("0");
  const [idealCycleTime, setIdealCycleTime] = useState("2");
  const [totalQty, setTotalQty] = useState("100");
  const [goodQty, setGoodQty] = useState("95");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [intelData, machineList] = await Promise.all([
        fetchMesCoreOeeIntelligence(),
        fetchMesCoreMachines(),
      ]);

      setIntel(intelData);
      setMachines(machineList);
      if (machineList.length) {
        setMachineId((prev) => prev || machineList[0].machine_id);
      }
    } catch (e) {
      setLoadError(formatApiError(e, "Could not load OEE intelligence"));
      setIntel(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const plant = intel?.plant || { availability: 0, performance: 0, quality: 0, oee: 0 };
  const trendChart = useMemo(() => {
    const points = normalizeOeeTrendPoints(intel?.trend, intel?.machine_ranking);
    return expandSingleDayTrend(points);
  }, [intel]);
  const machineLatest = intel?.machine_ranking || [];
  const downtimeByMachine = (intel?.downtime_hotspots || []).map((h) => ({
    machine: h.machine_id,
    minutes: h.minutes
  }));

  const recordOee = async () => {
    if (!machineId || !oeeDate) {
      alert("Select a machine and date.");
      return;
    }
    const planned = Number(plannedMinutes) || 0;
    const downtime = Number(downtimeMinutes) || 0;
    const ideal = Number(idealCycleTime) || 0;
    const total = Number(totalQty) || 0;
    const good = Number(goodQty) || 0;
    const operating = Math.max(0, planned - downtime);
    const availability = planned > 0 ? (operating / planned) * 100 : 0;
    const performance = operating > 0 ? ((ideal * total) / operating) * 100 : 0;
    const quality = total > 0 ? (good / total) * 100 : 0;
    const oee = (availability * performance * quality) / 10000;

    setSaving(true);
    try {
      await recordMesCoreOeeSummary({
        machine_id: machineId,
        oee_date: oeeDate,
        planned_production_minutes: planned,
        downtime_minutes: downtime,
        ideal_cycle_time_minutes: ideal,
        total_quantity: total,
        good_quantity: good,
        availability_percent: availability,
        performance_percent: performance,
        quality_percent: quality,
        oee_percent: oee
      });
      await load();
    } catch (e) {
      alert(formatApiError(e, "Error saving OEE summary"));
    } finally {
      setSaving(false);
    }
  };

  const dataSourceLabel =
    intel?.data_source === "recorded"
      ? `${intel.summaries_count} recorded summaries`
      : intel?.data_source === "shop_floor"
        ? "Calculated from completed work orders & schedules (no manual OEE save needed)"
        : intel?.data_source === "mixed"
          ? `${intel.summaries_count} recorded + shop-floor execution data`
          : intel?.data_source === "estimated"
            ? "Estimated from downtime logs"
            : "Complete operations in Execution to populate trend, or record OEE below";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Process Intelligence"
        title="OEE & Utilization Intelligence"
        subtitle="Availability × Performance × Quality across machines. Record daily OEE or derive availability from downtime logs."
        right={
          <button type="button" className="wf-btn wf-btn-ghost" onClick={load} disabled={loading}>
            Refresh
          </button>
        }
      />

      {loadError && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {loadError}
        </div>
      )}

      {intel?.data_source === "shop_floor" && (
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          Trend and KPIs are derived from <span className="font-semibold">shop-floor execution</span>
          (completed work orders, schedule times, downtime). Save a manual OEE summary to override a day.
        </div>
      )}
      {intel?.data_source === "estimated" && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Showing <span className="font-semibold">estimated</span> availability from machine downtime.
          Record a full OEE summary for performance and quality metrics.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile label="Availability" value={`${plant.availability.toFixed(1)}%`} accent="cyan" icon={<IconAvail />} />
        <KpiTile label="Performance" value={`${plant.performance.toFixed(1)}%`} accent="blue" icon={<IconPerf />} />
        <KpiTile label="Quality" value={`${plant.quality.toFixed(1)}%`} accent="emerald" icon={<IconQual />} />
        <KpiTile label="OEE" value={`${plant.oee.toFixed(1)}%`} accent="violet" icon={<IconChart />} />
      </div>

      <p className="text-xs text-slate-500">{dataSourceLabel}</p>

      <WfCard>
        <WfCardHeader title="Record OEE" subtitle="Per machine, per day" icon={<IconChart />} />
        <WfCardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="wf-label">Machine</label>
              <select className="wf-select" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
                <option value="">-- Machine --</option>
                {machines.map((m) => (
                  <option key={m.machine_id} value={m.machine_id}>{m.machine_id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="wf-label">Date</label>
              <input type="date" className="wf-input" value={oeeDate} onChange={(e) => setOeeDate(e.target.value)} />
            </div>
            <div>
              <label className="wf-label">Planned min</label>
              <input type="number" className="wf-input" value={plannedMinutes} onChange={(e) => setPlannedMinutes(e.target.value)} />
            </div>
            <div>
              <label className="wf-label">Downtime min</label>
              <input type="number" className="wf-input" value={downtimeMinutes} onChange={(e) => setDowntimeMinutes(e.target.value)} />
            </div>
            <div>
              <label className="wf-label">Ideal cycle (min/unit)</label>
              <input type="number" className="wf-input" value={idealCycleTime} onChange={(e) => setIdealCycleTime(e.target.value)} />
            </div>
            <div>
              <label className="wf-label">Total qty</label>
              <input type="number" className="wf-input" value={totalQty} onChange={(e) => setTotalQty(e.target.value)} />
            </div>
            <div>
              <label className="wf-label">Good qty</label>
              <input type="number" className="wf-input" value={goodQty} onChange={(e) => setGoodQty(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" className="wf-btn wf-btn-primary" onClick={recordOee} disabled={saving}>
              {saving ? "Saving…" : "Save OEE summary"}
            </button>
          </div>
        </WfCardBody>
      </WfCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WfCard className="lg:col-span-2" glow>
          <WfCardHeader
            title="OEE Trend"
            subtitle={
              trendChart.dayCount > 1
                ? `Plant average · ${trendChart.dayCount} days`
                : trendChart.dayCount === 1
                  ? `1 day recorded (${trendChart.singleDay}) — add more days for a full trend`
                  : "Plant-wide performance over time"
            }
            icon={<IconChart />}
          />
          <WfCardBody>
            {loading ? (
              <div className="text-center py-12 text-slate-400">Loading…</div>
            ) : trendChart.mode === "empty" ? (
              <EmptyState title="No OEE trend data" hint="Save an OEE summary above to populate this chart." icon={<IconChart />} />
            ) : (
              <div className="space-y-2">
                {trendChart.mode === "single" && (
                  <div className="text-xs text-slate-400">
                    Showing <span className="text-violet-300 font-semibold">{trendChart.singleOee.toFixed(1)}%</span> OEE
                    on {trendChart.singleDay}. Save summaries on additional dates to see a multi-day trend line.
                  </div>
                )}
                <div className="h-64 min-h-[256px] w-full">
                  <ResponsiveContainer width="100%" height={256}>
                    <LineChart data={trendChart.data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 6" stroke="rgba(124,159,255,0.12)" vertical={false}/>
                      <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false}/>
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`}/>
                      <Tooltip
                        formatter={(value) => [`${Number(value).toFixed(1)}%`, "OEE"]}
                        contentStyle={{ background: "#0a1226", border: "1px solid rgba(124,159,255,0.3)", borderRadius: 8, color: "#e2e8f0" }}
                        labelStyle={{ color: "#94a3b8" }}
                      />
                      <Line
                        type="linear"
                        dataKey="oee"
                        stroke="#a78bfa"
                        strokeWidth={2.5}
                        dot={{ r: 6, fill: "#a78bfa", stroke: "#e9d5ff", strokeWidth: 2 }}
                        activeDot={{ r: 8, fill: "#c4b5fd" }}
                        connectNulls
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </WfCardBody>
        </WfCard>

        <WfCard>
          <WfCardHeader title="Plant OEE" subtitle="Composite score" icon={<IconQual />} />
          <WfCardBody>
            <div className="h-44 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="60%" outerRadius="100%" data={[
                  { name: "OEE", value: Math.min(plant.oee, 100), fill: "#a78bfa" }
                ]} startAngle={90} endAngle={-270}>
                  <RadialBar background={{ fill: "rgba(124,159,255,0.1)" }} dataKey="value" cornerRadius={20} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-3xl font-bold text-slate-100">{plant.oee.toFixed(1)}%</div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">Plant OEE</div>
              </div>
            </div>
          </WfCardBody>
        </WfCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WfCard className="lg:col-span-2">
          <WfCardHeader title="Machine OEE Ranking" subtitle={`${machineLatest.length} machines`} icon={<IconMachine />} />
          <WfCardBody>
            {loading ? (
              <div className="text-center py-8 text-slate-400">Loading…</div>
            ) : machineLatest.length === 0 ? (
              <EmptyState title="No machine data" hint="Save an OEE summary or log machine downtime." icon={<IconMachine />} />
            ) : (
              <div className="space-y-3">
                {machineLatest.map((m) => {
                  const oee = Number(m.oee_percent) || 0;
                  const tone = oee >= 80 ? "ok" : oee >= 60 ? "warn" : "bad";
                  return (
                    <div key={m.machine_id} className="grid grid-cols-[140px_1fr_60px] items-center gap-3">
                      <div className="font-mono text-slate-200 text-sm truncate">{m.machine_id}</div>
                      <div className="h-2 rounded-full bg-slate-800/60 overflow-hidden">
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
          <WfCardHeader title="Downtime Hotspots" subtitle="Total downtime minutes" icon={<IconClock />} />
          <WfCardBody>
            {downtimeByMachine.length === 0 ? (
              <EmptyState title="No downtime logs" hint="Log downtime under Maintenance or during execution." icon={<IconClock />} />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={downtimeByMachine} layout="vertical" margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(124,159,255,0.12)" horizontal={false}/>
                    <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false}/>
                    <YAxis type="category" dataKey="machine" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={90}/>
                    <Tooltip
                      contentStyle={{ background: "#0a1226", border: "1px solid rgba(124,159,255,0.3)", borderRadius: 8, color: "#e2e8f0" }}
                    />
                    <Bar dataKey="minutes" fill="#fb7185" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </WfCardBody>
        </WfCard>
      </div>
    </div>
  );
}

function IconAvail()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IconPerf()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>; }
function IconQual()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.5 8.5 8 9 4.5-.5 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>; }
function IconChart()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>; }
function IconMachine(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M8 8V4h8v4M9 14h6"/></svg>; }
function IconClock()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }

export default OeeDashboard;
