import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  createMesCoreSchedule,
  fetchMesCoreLotFeasibility,
  fetchMesCoreMachines,
  fetchMesCoreProductionLots,
  fetchMesCoreSchedulePlan,
  fetchMesCoreSchedules,
  fetchMesCoreWorkCenters,
  runMesCoreFeasibilityCheck,
} from "../../services/mesCoreApi";
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


const SHIFTS = [
  { id: "shift-a", label: "Shift A · 06:00–14:00", startHour: 6  },
  { id: "shift-b", label: "Shift B · 14:00–22:00", startHour: 14 },
  { id: "shift-c", label: "Shift C · 22:00–06:00", startHour: 22 }
];


function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextShiftStart(referenceDate, shiftHour) {
  const d = new Date(referenceDate);
  d.setMinutes(0, 0, 0);
  if (d.getHours() >= shiftHour) {
    d.setDate(d.getDate() + 1);
  }
  d.setHours(shiftHour);
  return d;
}


function SchedulingBoard() {
  const { context, markStage } = useWorkflow();

  const [lots, setLots] = useState([]);
  const [machines, setMachines] = useState([]);
  const [workCenters, setWorkCenters] = useState([]);
  const [schedules, setSchedules] = useState([]);

  const [lotId, setLotId] = useState(context.lotId || "");
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");

  // per-operation editable schedule rows (keyed by operation_id)
  const [rows, setRows] = useState({});
  const [shift, setShift] = useState("shift-a");
  const [startAt, setStartAt] = useState(
    toLocalInputValue(nextShiftStart(new Date(), 6))
  );

  const [savingAll, setSavingAll] = useState(false);
  const [savingOpId, setSavingOpId] = useState(null);
  const [feasibilityGate, setFeasibilityGate] = useState(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [runningFeasibility, setRunningFeasibility] = useState(false);


  // ===================================================================
  // load pickers + existing schedules
  // ===================================================================

  useEffect(() => {
    loadStatic();
  }, []);

  useEffect(() => {
    if (context.lotId && !lotId) setLotId(context.lotId);
  }, [context.lotId]);

  useEffect(() => {
    if (lotId) loadPlan(lotId);
    else { setPlan(null); setRows({}); setFeasibilityGate(null); }
  }, [lotId]);

  useEffect(() => {
    if (!lotId) {
      setFeasibilityGate(null);
      return;
    }
    let cancelled = false;
    setGateLoading(true);
    fetchMesCoreLotFeasibility(lotId)
      .then(async (data) => {
        if (cancelled) return;
        const needsRun =
          data?.overall_status === "BLOCKED" &&
          String(data?.blocked_reason || "").toLowerCase().includes("no feasibility check");
        if (needsRun) {
          try {
            const run = await runMesCoreFeasibilityCheck(lotId);
            if (!cancelled) setFeasibilityGate(run || data);
            return;
          } catch {
            /* fall through to stored gate */
          }
        }
        setFeasibilityGate(data || null);
      })
      .catch(() => {
        if (!cancelled) setFeasibilityGate(null);
      })
      .finally(() => {
        if (!cancelled) setGateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lotId]);

  const runFeasibility = async () => {
    if (!lotId) return;
    setRunningFeasibility(true);
    try {
      const run = await runMesCoreFeasibilityCheck(lotId);
      setFeasibilityGate(run);
    } catch (e) {
      alert(e.response?.data?.detail || "Feasibility check failed");
    } finally {
      setRunningFeasibility(false);
    }
  };

  // when shift changes, snap the planned start to that shift's slot
  useEffect(() => {
    const s = SHIFTS.find((x) => x.id === shift);
    if (s) setStartAt(toLocalInputValue(nextShiftStart(new Date(), s.startHour)));
  }, [shift]);

  // recompute time chain whenever the start, shift or plan changes
  useEffect(() => {
    if (!plan) return;
    setRows((prev) => {
      const defaultMachine = machines[0]?.machine_id || "";
      const defaultWc =
        machines[0]?.work_center_id || workCenters[0]?.work_center_id || "";
      let cursor = new Date(startAt || Date.now());
      const next = {};
      plan.operations.forEach((op) => {
        const dur = Number(op.estimated_duration_minutes ?? op.standard_cycle_time_minutes ?? 60);
        const start = new Date(cursor);
        const end = new Date(cursor.getTime() + dur * 60_000);
        const existing = prev[op.operation_id] || {};
        next[op.operation_id] = {
          machine:
            existing.machine ||
            op.suggested_machine_id ||
            defaultMachine,
          workCenter:
            existing.workCenter ||
            op.suggested_work_center_id ||
            defaultWc,
          start: existing.startEdited ? existing.start : toLocalInputValue(start),
          end: existing.endEdited ? existing.end : toLocalInputValue(end),
          startEdited: !!existing.startEdited,
          endEdited: !!existing.endEdited
        };
        cursor = end;
      });
      return next;
    });
  }, [plan, startAt, shift, machines, workCenters]);


  const loadStatic = async () => {
    try {
      const [ls, ms, wc, sc] = await Promise.all([
        fetchMesCoreProductionLots(),
        fetchMesCoreMachines(),
        fetchMesCoreWorkCenters(),
        fetchMesCoreSchedules(),
      ]);
      setLots(ls || []);
      setMachines(ms || []);
      setWorkCenters(wc || []);
      setSchedules(sc || []);
    } catch (e) {
      console.error(e);
    }
  };

  const refreshSchedules = async () => {
    try {
      const sc = await fetchMesCoreSchedules();
      setSchedules(sc || []);
    } catch { /* ignore */ }
  };

  const loadPlan = async (id) => {
    setPlanLoading(true);
    setPlanError("");
    try {
      const data = await fetchMesCoreSchedulePlan(id);
      setPlan(data);
    } catch (e) {
      const detail =
        e.response?.data?.detail ||
        (typeof e.response?.data === "object"
          ? JSON.stringify(e.response.data)
          : null) ||
        e.message;
      setPlanError(detail || "Could not load plan");
      setPlan(null);
    } finally {
      setPlanLoading(false);
    }
  };


  // ===================================================================
  // derived
  // ===================================================================

  const updateRow = (opId, patch) => {
    setRows((prev) => ({
      ...prev,
      [opId]: { ...prev[opId], ...patch }
    }));
  };

  const machineByCode = useMemo(() => {
    const m = {};
    machines.forEach((x) => { m[x.machine_id] = x; });
    return m;
  }, [machines]);

  // when a machine is picked, snap work center to that machine's wc (if any)
  const setMachineForOp = (opId, machineCode) => {
    const m = machineByCode[machineCode];
    updateRow(opId, {
      machine: machineCode,
      workCenter: m?.work_center_id || rows[opId]?.workCenter || ""
    });
  };


  // ===================================================================
  // save
  // ===================================================================

  const scheduleOne = async (op) => {
    if (!isFeasibilityReady(feasibilityGate?.overall_status)) {
      alert("Feasibility gate is not OK. Run the feasibility check before scheduling.");
      return;
    }
    const r = rows[op.operation_id];
    if (!r?.machine) {
      alert(`Pick a machine for ${op.operation_name}`);
      return;
    }
    setSavingOpId(op.operation_id);
    try {
      await createMesCoreSchedule({
        lot_id: lotId,
        operation_id: op.operation_id,
        assigned_machine_id: r.machine,
        assigned_work_center_id: r.workCenter || null,
        planned_start_time: r.start ? new Date(r.start).toISOString() : null,
        planned_end_time: r.end ? new Date(r.end).toISOString() : null,
        schedule_status: "Scheduled",
      });
      await Promise.all([refreshSchedules(), loadPlan(lotId)]);
      markStage("scheduling");
    } catch (e) {
      alert(e.response?.data?.detail || "Error creating schedule");
    } finally {
      setSavingOpId(null);
    }
  };

  const scheduleAll = async () => {
    if (!plan) return;
    if (!isFeasibilityReady(feasibilityGate?.overall_status)) {
      alert("Feasibility gate is not OK. Run the feasibility check before scheduling.");
      return;
    }
    const pending = plan.operations.filter((op) => !op.already_scheduled);
    if (pending.length === 0) return;
    setSavingAll(true);
    try {
      for (const op of pending) {
        const r = rows[op.operation_id];
        if (!r?.machine) continue; // skip operations without a machine pick
        await createMesCoreSchedule({
          lot_id: lotId,
          operation_id: op.operation_id,
          assigned_machine_id: r.machine,
          assigned_work_center_id: r.workCenter || null,
          planned_start_time: r.start ? new Date(r.start).toISOString() : null,
          planned_end_time: r.end ? new Date(r.end).toISOString() : null,
          schedule_status: "Scheduled",
        });
      }
      await Promise.all([refreshSchedules(), loadPlan(lotId)]);
      markStage("scheduling");
    } catch (e) {
      alert(e.response?.data?.detail || "Error during bulk scheduling");
    } finally {
      setSavingAll(false);
    }
  };


  // ===================================================================
  // groupings for the swimlane card
  // ===================================================================

  const groupedByMachine = useMemo(() => {
    const map = {};
    schedules.forEach((s) => {
      const k = s.assigned_machine_id || "Unassigned";
      if (!map[k]) map[k] = [];
      map[k].push(s);
    });
    return map;
  }, [schedules]);


  // ===================================================================
  // render
  // ===================================================================

  const pendingOps = plan ? plan.operations.filter((o) => !o.already_scheduled) : [];
  const allPicked = pendingOps.length > 0 && pendingOps.every((op) => rows[op.operation_id]?.machine);
  const gateOpen = isFeasibilityReady(feasibilityGate?.overall_status);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Stage 06 · Scheduling Board"
        title="Assign route operations to machines and slots"
        subtitle="Pick a lot - the routing operations, suggested machines, work centers and durations are loaded from the lot's active routing. Confirm or override, then schedule."
        right={
          <Link to="/workflow/execution" className="wf-btn wf-btn-ghost">
            Go to Execution →
          </Link>
        }
      />

      <ContextBanner
        items={[
          { label: "Customer", value: context.customerName },
          { label: "Order", value: context.orderId },
          { label: "Lot", value: lotId || "—" },
          { label: "Part", value: plan?.part_id || context.partId || "—" },
          { label: "Routing", value: plan?.routing_id || "—" },
          { label: "Feasibility", value: gateLoading ? "Checking…" : (feasibilityGate?.overall_status || "—") }
        ]}
      />

      {!gateLoading && lotId && feasibilityGate && !gateOpen && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="font-semibold">Feasibility gate closed.</span>{" "}
            {feasibilityGate.blocked_reason || "Resolve blockers before scheduling this lot."}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              className="wf-btn wf-btn-primary"
              disabled={runningFeasibility}
              onClick={runFeasibility}
            >
              {runningFeasibility ? "Checking…" : "Re-run feasibility"}
            </button>
            <Link to="/workflow/feasibility" className="wf-btn wf-btn-ghost">
              Open Feasibility →
            </Link>
          </div>
        </div>
      )}

      {/* ---- header card: pick lot + global start ---- */}
      <WfCard glow>
        <WfCardHeader
          title="Lot allocation & shift"
          subtitle={plan
            ? `Routing ${plan.routing_id} · ${plan.operations.length} operation(s) · qty ${plan.lot_quantity}`
            : "Pick a lot to load its routing"
          }
          icon={<IconCalendar />}
          right={plan
            ? <StatusPill kind="ok">Plan loaded</StatusPill>
            : <StatusPill kind="warn">Awaiting lot</StatusPill>}
        />
        <WfCardBody className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="wf-label">Lot</label>
              <select
                className="wf-select"
                value={lotId}
                onChange={(e) => setLotId(e.target.value)}
              >
                <option value="">-- Select lot --</option>
                {lots.map((l) => (
                  <option key={l.lot_id} value={l.lot_id}>
                    {l.lot_id} · qty {l.lot_quantity} · {l.status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="wf-label">Shift</label>
              <div className="grid grid-cols-3 gap-2">
                {SHIFTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setShift(s.id)}
                    className={[
                      "rounded-lg px-2 py-2 text-[11px] font-medium border transition-colors",
                      shift === s.id
                        ? "bg-blue-500/20 border-blue-400/50 text-blue-100"
                        : "bg-slate-900/40 border-slate-700/40 text-slate-400 hover:text-slate-200"
                    ].join(" ")}
                  >
                    {s.label.split(" · ")[0]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="wf-label">Planned start (first operation)</label>
              <input
                type="datetime-local"
                className="wf-input"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
              <div className="text-[11px] text-slate-500 mt-1">
                Subsequent operations auto-chain from each operation's cycle time × lot qty.
              </div>
            </div>
          </div>

          {planError && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-400/30 px-4 py-3 text-xs text-rose-200">
              {planError}
            </div>
          )}

          {plan && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-white/5">
              <div className="text-xs text-slate-400 space-y-1">
                <div>
                  {pendingOps.length} operation(s) to schedule.
                  {plan.operations.length - pendingOps.length > 0 &&
                    ` ${plan.operations.length - pendingOps.length} already scheduled.`}
                </div>
                {pendingOps.length === 0 && (
                  <div className="text-cyan-200/90">
                    “Schedule all” stays off when nothing is left — open <span className="font-medium">Execution</span> to start the work orders for this lot.
                  </div>
                )}
                {pendingOps.length > 0 && !allPicked && (
                  <div className="text-amber-200/90">
                    Choose a machine on each row still pending, then bulk-schedule or save row-by-row.
                    {machines.length === 0 && " No machines loaded — add equipment in master data."}
                  </div>
                )}
                {pendingOps.length > 0 && allPicked && !gateOpen && (
                  <div className="text-amber-200/90">
                    Feasibility must be OK before scheduling. Use “Re-run feasibility” above if needed.
                  </div>
                )}
              </div>
              <button
                type="button"
                className="wf-btn wf-btn-primary shrink-0"
                disabled={!plan || pendingOps.length === 0 || savingAll || !allPicked || !gateOpen}
                onClick={scheduleAll}
                title={
                  !gateOpen
                    ? "Feasibility gate must be OK before scheduling"
                    : pendingOps.length === 0
                    ? "Every operation already has a production schedule"
                    : !allPicked
                      ? "Pick a machine for every pending operation first"
                      : undefined
                }
              >
                {savingAll
                  ? "Scheduling…"
                  : pendingOps.length === 0
                    ? "All scheduled ✓"
                    : `Schedule all ${pendingOps.length} operations`}
              </button>
            </div>
          )}
        </WfCardBody>
      </WfCard>

      {/* ---- main editor grid + side rail ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WfCard className="lg:col-span-2">
          <WfCardHeader
            title="Routing operations"
            subtitle={plan
              ? `Auto-filled from active routing ${plan.routing_id}`
              : "Operations appear once a lot is picked"
            }
            icon={<IconFlow />}
          />
          <WfCardBody>
            {planLoading && (
              <div className="text-sm text-slate-400 py-6 text-center">Loading plan…</div>
            )}
            {!planLoading && !plan && (
              <EmptyState
                icon={<IconCalendar />}
                title="No lot selected"
                hint="Pick a lot above. The routing operations, suggested machines and durations will pre-fill here."
              />
            )}
            {!planLoading && plan && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                      <th className="text-left py-2 px-2 font-semibold w-12">Seq</th>
                      <th className="text-left py-2 px-2 font-semibold">Operation</th>
                      <th className="text-left py-2 px-2 font-semibold w-24">Cycle</th>
                      <th className="text-left py-2 px-2 font-semibold">Machine</th>
                      <th className="text-left py-2 px-2 font-semibold">Work Center</th>
                      <th className="text-left py-2 px-2 font-semibold">Start</th>
                      <th className="text-left py-2 px-2 font-semibold">End</th>
                      <th className="text-right py-2 px-2 font-semibold w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.operations.map((op) => {
                      const r = rows[op.operation_id] || {};
                      const scheduled = op.already_scheduled;
                      return (
                        <tr key={op.operation_id} className="border-b border-white/5 align-top">
                          <td className="py-2 px-2 font-mono text-slate-300">
                            {op.operation_sequence}
                          </td>
                          <td className="py-2 px-2">
                            <div className="text-slate-100 font-medium">{op.operation_name}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {op.operation_id}
                              {op.inspection_required && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-400/30 text-[10px] text-violet-200">QC</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-slate-300 text-xs">
                            <div>{op.standard_cycle_time_minutes ?? "—"} min</div>
                            <div className="text-[10px] text-slate-500">
                              {op.estimated_duration_minutes
                                ? `× qty = ${op.estimated_duration_minutes} min`
                                : "—"}
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            {scheduled ? (
                              <span className="text-slate-300 text-xs">—</span>
                            ) : (
                              <select
                                className="wf-select py-1 text-xs"
                                value={r.machine || ""}
                                onChange={(e) => setMachineForOp(op.operation_id, e.target.value)}
                              >
                                <option value="">-- Pick --</option>
                                {machines.map((m) => (
                                  <option key={m.machine_id} value={m.machine_id}>
                                    {m.machine_id} · {m.machine_name}
                                  </option>
                                ))}
                              </select>
                            )}
                            {op.suggested_machine_id && !scheduled && (
                              <div className="text-[10px] text-cyan-300/80 mt-1">
                                Suggested: {op.suggested_machine_id}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            {scheduled ? (
                              <span className="text-slate-300 text-xs">—</span>
                            ) : (
                              <select
                                className="wf-select py-1 text-xs"
                                value={r.workCenter || ""}
                                onChange={(e) => updateRow(op.operation_id, { workCenter: e.target.value })}
                              >
                                <option value="">-- Pick --</option>
                                {workCenters.map((w) => (
                                  <option key={w.work_center_id} value={w.work_center_id}>
                                    {w.work_center_id} · {w.work_center_name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            {scheduled ? (
                              <span className="text-slate-300 text-xs">—</span>
                            ) : (
                              <input
                                type="datetime-local"
                                className="wf-input py-1 text-xs"
                                value={r.start || ""}
                                onChange={(e) => updateRow(op.operation_id, { start: e.target.value, startEdited: true })}
                              />
                            )}
                          </td>
                          <td className="py-2 px-2">
                            {scheduled ? (
                              <span className="text-slate-300 text-xs">—</span>
                            ) : (
                              <input
                                type="datetime-local"
                                className="wf-input py-1 text-xs"
                                value={r.end || ""}
                                onChange={(e) => updateRow(op.operation_id, { end: e.target.value, endEdited: true })}
                              />
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {scheduled ? (
                              <StatusPill kind="ok">Scheduled</StatusPill>
                            ) : (
                              <button
                                type="button"
                                className="wf-btn wf-btn-ghost text-xs px-3 py-1"
                                disabled={!r.machine || savingOpId === op.operation_id || !gateOpen}
                                onClick={() => scheduleOne(op)}
                              >
                                {savingOpId === op.operation_id ? "…" : "Save"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </WfCardBody>
        </WfCard>

        <div className="space-y-5">
          <WfCard>
            <WfCardHeader title="Ontology" subtitle="Schedule reasoning" icon={<IconAtom />} />
            <WfCardBody className="space-y-2.5">
              <OntologyEdge from="Schedule" to="Lot" label="for" />
              <OntologyEdge from="Schedule" to="Operation" label="targets" />
              <OntologyEdge from="Schedule" to="Machine" label="binds" />
              <OntologyEdge from="Schedule" to="WorkCenter" label="in" />
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader
              title="Active Schedules"
              subtitle={`${schedules.length} total`}
              icon={<IconList />}
            />
            <WfCardBody>
              {schedules.length === 0 ? (
                <EmptyState title="No schedules yet" hint="Schedule a lot above." icon={<IconCalendar />} />
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {schedules.slice(0, 12).map((s) => (
                    <div
                      key={s.schedule_id}
                      className="px-3 py-2 rounded-md bg-slate-900/40 border border-slate-700/30 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-200">{s.schedule_id}</span>
                        <StatusPill kind="info">{s.schedule_status}</StatusPill>
                      </div>
                      <div className="text-slate-400 mt-1">
                        Lot <span className="text-slate-200">{s.lot_id}</span> ·
                        <span className="text-slate-200 ml-1">{s.operation_id || "—"}</span> →
                        <span className="text-slate-200 ml-1">{s.assigned_machine_id || "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </WfCardBody>
          </WfCard>
        </div>
      </div>

      {Object.keys(groupedByMachine).length > 0 && (
        <WfCard>
          <WfCardHeader
            title="Machine Swimlanes"
            subtitle="Schedule capacity by machine"
            icon={<IconBoard />}
          />
          <WfCardBody>
            <div className="space-y-3">
              {Object.entries(groupedByMachine).map(([machine, list]) => (
                <div key={machine} className="grid grid-cols-[180px_1fr] gap-3 items-start">
                  <div className="rounded-lg bg-slate-900/40 border border-slate-700/40 px-3 py-2 text-xs">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500">Machine</div>
                    <div className="font-mono text-slate-100 text-sm">{machine}</div>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {list.map((s) => (
                      <div
                        key={s.schedule_id}
                        className="rounded-lg bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-400/30 px-3 py-2 text-xs min-w-[150px]"
                      >
                        <div className="font-mono text-slate-200 text-[11px]">{s.schedule_id}</div>
                        <div className="text-slate-100 font-semibold mt-1">Lot {s.lot_id}</div>
                        <div className="text-slate-400 text-[10px] mt-1">{s.operation_id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </WfCardBody>
        </WfCard>
      )}
    </div>
  );
}

function IconCalendar() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>; }
function IconFlow()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="6" height="6" rx="1"/><rect x="15" y="4" width="6" height="6" rx="1"/><rect x="9" y="14" width="6" height="6" rx="1"/><path d="M9 7h6M6 10v4h6M18 10v4h-6"/></svg>; }
function IconAtom()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconList()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>; }
function IconBoard()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>; }

export default SchedulingBoard;
