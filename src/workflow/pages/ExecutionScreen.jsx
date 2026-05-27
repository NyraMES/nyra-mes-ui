import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import WorkOrderCaptureForm from "../../components/WorkOrderCaptureForm";
import api, { formatApiError } from "../../services/api";
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
import FlowDiagram from "../FlowDiagram";


function statusKind(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("complete")) return "ok";
  if (s.includes("progress")) return "info";
  if (s.includes("hold")) return "neutral";
  if (s.includes("ready")) return "warn";
  return "neutral";
}

function mapWoStatus(dbStatus) {
  const s = String(dbStatus || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (s === "released" || s === "ready") return "Ready";
  if (s === "inprogress") return "In Progress";
  if (s === "completed") return "Completed";
  if (s === "onhold") return "On Hold";
  return dbStatus || "Pending";
}

function recomputeCanStart(ops) {
  const sorted = [...ops].sort((a, b) => (a.seq ?? 999999) - (b.seq ?? 999999));
  return sorted.map((op) => {
    if (op.status !== "Ready") return { ...op, can_start: false };
    const seq = op.seq ?? 999999;
    const blocked = sorted.some(
      (p) => (p.seq ?? 999999) < seq && p.status !== "Completed"
    );
    return { ...op, can_start: !blocked };
  });
}

function applyWoToOperations(ops, woCode, wo) {
  if (!wo) return ops;
  const merged = ops.map((op) => {
    const id = op.work_order_id || op.lot_operation_id;
    if (id !== woCode) return op;
    const status = mapWoStatus(wo.work_order_status);
    return {
      ...op,
      status,
      work_order_status: wo.work_order_status,
      started_at: wo.started_at,
      completed_at: wo.completed_at,
      actual_output_quantity: wo.actual_output_quantity,
      scrap_quantity: wo.scrap_quantity,
      rework_quantity: wo.rework_quantity,
      operator_name: wo.operator_name ?? op.operator_name,
      actual_machine_id: wo.actual_machine_id ?? op.actual_machine_id,
      downtime_minutes: wo.downtime_minutes ?? op.downtime_minutes,
      can_start: false
    };
  });
  return recomputeCanStart(merged);
}

function ExecutionScreen() {
  const { context, markStage } = useWorkflow();

  const [lots, setLots] = useState([]);
  const [lotId, setLotId] = useState(context.lotId || "");
  const [operatorName, setOperatorName] = useState("");
  const [summary, setSummary] = useState(null);
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [executionReady, setExecutionReady] = useState(false);
  const [selectedWoId, setSelectedWoId] = useState("");

  const [outputQty, setOutputQty] = useState("");
  const [scrapQty, setScrapQty] = useState("");
  const [downtimeMin, setDowntimeMin] = useState("");
  const [machineId, setMachineId] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const captureRef = useRef(null);

  useEffect(() => {
    api.get("/production-lots").then((r) => setLots(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (context.lotId && !lotId) setLotId(context.lotId);
  }, [context.lotId]);

  useEffect(() => {
    if (lotId) loadSummary({ sync: true });
    else {
      setSummary(null);
      setOperations([]);
      setSelectedWoId("");
    }
  }, [lotId]);

  const woId = (op) => op?.work_order_id || op?.lot_operation_id;

  const sortedOperations = useMemo(() => {
    return [...operations].sort((a, b) => {
      const sa = a.seq ?? 999999;
      const sb = b.seq ?? 999999;
      if (sa !== sb) return sa - sb;
      return String(woId(a)).localeCompare(String(woId(b)));
    });
  }, [operations]);

  const nextStartableOp = useMemo(
    () => sortedOperations.find((o) => o.can_start && o.status === "Ready") || null,
    [sortedOperations]
  );

  const pickDefaultWoId = (ops, preferId) => {
    if (preferId && ops.some((o) => woId(o) === preferId)) return preferId;
    const inProgress = ops.find((o) => o.status === "In Progress");
    if (inProgress) return woId(inProgress);
    const onHold = ops.find((o) => o.status === "On Hold");
    if (onHold) return woId(onHold);
    const nextUp = ops.find((o) => o.can_start && o.status === "Ready");
    if (nextUp) return woId(nextUp);
    return ops.length ? woId(ops[0]) : "";
  };

  const loadSummary = async (options = {}) => {
    if (!lotId) return;
    const { sync = false, silent = false, preserveSelection = false, preferId } = options;
    const keepId = preserveSelection ? (preferId ?? selectedWoId) : "";
    if (!silent) setLoading(true);
    try {
      const r = await api.get(`/lot/${lotId}/execution-summary`, {
        params: { sync }
      });
      const d = r.data || {};
      setSummary({
        lot_id: d.lot_id,
        production_order_id: d.production_order_id,
        part_id: d.part_id,
        part_name: d.part_name,
        lot_status: d.lot_status,
        schedules_count: d.schedules_count ?? 0,
        operations_ready: d.operations_ready ?? 0,
        operations_on_hold: d.operations_on_hold ?? 0,
        operations_total: d.operations_total ?? 0,
        operations_completed: d.operations_completed ?? 0
      });
      setExecutionReady(!!d.execution_ready);
      const ops = Array.isArray(d.operations) ? d.operations : [];
      setOperations(ops);
      setSelectedWoId(pickDefaultWoId(ops, keepId));
    } catch (e) {
      if (e.response?.status !== 404) console.error(e);
      setSummary(null);
      setOperations([]);
      setExecutionReady(false);
      setSelectedWoId("");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const refreshInBackground = (preferId) => {
    void loadSummary({
      sync: false,
      silent: true,
      preserveSelection: true,
      preferId
    });
  };

  const selectedOp = useMemo(
    () => sortedOperations.find((o) => woId(o) === selectedWoId) || null,
    [sortedOperations, selectedWoId]
  );

  useEffect(() => {
    if (!selectedOp) return;
    setMachineId(
      selectedOp.actual_machine_id || selectedOp.assigned_machine_id || ""
    );
    setHoldReason("");
    if (selectedOp.operator_name) {
      setOperatorName(selectedOp.operator_name);
    }
    if (selectedOp.status === "Completed") {
      setOutputQty(String(selectedOp.actual_output_quantity ?? ""));
      setScrapQty(String(selectedOp.scrap_quantity ?? ""));
      if (selectedOp.downtime_minutes != null) {
        setDowntimeMin(String(selectedOp.downtime_minutes));
      }
    } else {
      setOutputQty("");
      setScrapQty("");
      setDowntimeMin("");
    }
  }, [selectedWoId, selectedOp]);

  const flowSteps = useMemo(() => {
    return sortedOperations.map((op) => {
      const s = (op.status || "").toLowerCase();
      let status = "pending";
      if (s.includes("complete")) status = "done";
      else if (s.includes("progress")) status = "active";
      else if (s.includes("hold")) status = "pending";
      else if (s.includes("ready")) status = "pending";
      return {
        id: woId(op),
        title: op.operation_name,
        code: op.operation_code,
        seq: op.seq,
        status,
        meta: op.status
      };
    });
  }, [sortedOperations]);

  const startOp = async () => {
    if (!selectedOp || !operatorName.trim()) {
      alert("Enter operator name to start.");
      return;
    }
    const id = woId(selectedOp);
    if (!id || acting) return;
    setActing(true);
    try {
      const res = await api.put(`/work-order/${id}/start`, {
        operator_name: operatorName.trim()
      });
      setOperations((ops) => applyWoToOperations(ops, id, res.data));
      setSelectedWoId(id);
      refreshInBackground(id);
    } catch (e) {
      alert(formatApiError(e, "Error starting operation"));
    } finally {
      setActing(false);
    }
  };

  const holdOp = async () => {
    if (!selectedOp || acting) return;
    const reason = holdReason.trim();
    if (!reason) {
      alert("Enter a reason for putting this operation on hold (e.g. material not available).");
      return;
    }
    const id = woId(selectedOp);
    setActing(true);
    try {
      const res = await api.put(`/work-order/${id}/hold`, { reason });
      setHoldReason("");
      setOperations((ops) => applyWoToOperations(ops, id, res.data));
      setSelectedWoId(id);
      refreshInBackground(id);
    } catch (e) {
      alert(formatApiError(e, "Error putting operation on hold"));
    } finally {
      setActing(false);
    }
  };

  const resumeOp = async () => {
    if (!selectedOp || acting) return;
    const id = woId(selectedOp);
    setActing(true);
    try {
      const res = await api.put(`/work-order/${id}/resume`);
      setOperations((ops) => applyWoToOperations(ops, id, res.data));
      setSelectedWoId(id);
      refreshInBackground(id);
    } catch (e) {
      alert(formatApiError(e, "Error resuming operation"));
    } finally {
      setActing(false);
    }
  };

  const completeOp = async () => {
    if (!selectedOp || acting) return;
    const id = woId(selectedOp);
    if (!id) return;
    if (!(Number(outputQty) > 0)) {
      alert("Enter actual output quantity before completing.");
      return;
    }

    if (captureRef.current?.hasTemplates) {
      if (!captureRef.current.validate()) {
        alert("Fill in all mandatory capture parameters before completing.");
        return;
      }
    }

    setActing(true);
    try {
      if (captureRef.current?.hasTemplates) {
        const saved = await captureRef.current.submit();
        if (!saved) return;
      }

      const downtimeVal = downtimeMin.trim() ? Number(downtimeMin) : undefined;
      const res = await api.put(`/work-order/${id}/complete`, {
        actual_output_quantity: Number(outputQty) || 0,
        scrap_quantity: Number(scrapQty) || 0,
        rework_quantity: 0,
        operator_name: operatorName.trim() || undefined,
        machine_id: machineId.trim() || undefined,
        downtime_minutes: downtimeVal
      });
      const woPayload = {
        ...res.data,
        downtime_minutes:
          res.data?.downtime_minutes != null ? res.data.downtime_minutes : downtimeVal,
        actual_machine_id: res.data?.actual_machine_id || machineId.trim() || undefined
      };
      const updated = applyWoToOperations(operations, id, woPayload);
      setOperations(updated);
      setSelectedWoId(id);
      markStage("execution");
      refreshInBackground(id);
    } catch (e) {
      alert(formatApiError(e, "Error completing operation"));
    } finally {
      setActing(false);
    }
  };

  const allComplete =
    sortedOperations.length > 0 && sortedOperations.every((o) => o.status === "Completed");

  const canActOnSelected =
    selectedOp &&
    ["Ready", "In Progress", "On Hold"].includes(selectedOp.status);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Stage 07 · Work Order Execution"
        title="Shop floor — operation by operation"
        subtitle="After scheduling, run each routing step here: start, record output/scrap, complete, or put on hold if material or machine is not ready."
        right={
          allComplete && (
            <Link to="/workflow/inspection" className="wf-btn wf-btn-primary">
              Proceed to Inspection →
            </Link>
          )
        }
      />

      <ContextBanner
        items={[
          { label: "Lot", value: lotId || "—" },
          { label: "Part", value: summary?.part_name || context.partId || "—" },
          { label: "Schedules", value: summary ? String(summary.schedules_count) : "—" },
          { label: "Routing steps", value: summary ? String(summary.operations_total) : "—" },
          { label: "Ready", value: summary ? String(summary.operations_ready) : "—" },
          { label: "On hold", value: summary ? String(summary.operations_on_hold ?? 0) : "—" },
          { label: "Selected", value: selectedOp?.operation_name || "—" }
        ]}
      />

      {lotId && !loading && summary && (
        <div
          className={[
            "rounded-xl border px-4 py-3 text-sm",
            executionReady
              ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-100"
              : "bg-amber-500/10 border-amber-400/30 text-amber-100"
          ].join(" ")}
        >
          {executionReady ? (
            <>
              <span className="font-semibold">Shop floor ready.</span>{" "}
              Select each operation in routing order, start it, enter production data, then complete —
              or put on hold if material/machine is not available. Machine is pre-filled from scheduling when assigned.
            </>
          ) : operations.length === 0 ? (
            <>
              <span className="font-semibold">Not ready yet.</span>{" "}
              Finish <Link to="/workflow/scheduling" className="underline text-cyan-200">Scheduling</Link> for this lot,
              then return here — work orders sync automatically.
            </>
          ) : (
            <>
              <span className="font-semibold">In progress.</span>{" "}
              {summary.operations_completed} of {summary.operations_total} completed.
            </>
          )}
        </div>
      )}

      {loading && lotId && (
        <div className="text-sm text-slate-400 text-center py-4">
          Syncing schedules → work orders for lot {lotId}…
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WfCard className="lg:col-span-2" glow>
          <WfCardHeader
            title="Routing Operations"
            subtitle={summary ? `Lot ${summary.lot_id} · ${summary.part_name || summary.part_id}` : "Pick a lot to run"}
            icon={<IconPlay />}
            right={
              selectedOp && (
                <StatusPill kind={statusKind(selectedOp.status)}>{selectedOp.status}</StatusPill>
              )
            }
          />
          <WfCardBody className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="wf-label">Lot</label>
                <select className="wf-select" value={lotId} onChange={(e) => setLotId(e.target.value)}>
                  <option value="">-- Pick lot --</option>
                  {lots.map((l) => (
                    <option key={l.lot_id} value={l.lot_id}>{l.lot_id} · qty {l.lot_quantity}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="wf-label">Operator (required to start)</label>
                <input
                  className="wf-input"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="Shop floor user"
                />
              </div>
            </div>

            {sortedOperations.length === 0 && !loading && (
              <EmptyState
                title="No work orders for this lot"
                hint="Schedule this lot in Scheduling — each operation becomes a shop-floor work order you run here."
                icon={<IconPlay />}
              />
            )}

            {sortedOperations.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">
                  Select operation (routing order)
                </div>
                {nextStartableOp && (
                  <div className="text-xs text-cyan-200/90">
                    Next to run: step {nextStartableOp.seq} · {nextStartableOp.operation_name}
                  </div>
                )}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {sortedOperations.map((op) => {
                    const id = woId(op);
                    const selected = id === selectedWoId;
                    const isNext = nextStartableOp && woId(nextStartableOp) === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedWoId(id)}
                        className={[
                          "w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                          selected
                            ? "border-cyan-400/50 bg-cyan-500/10"
                            : isNext
                              ? "border-emerald-400/40 bg-emerald-500/5 hover:border-emerald-400/60"
                              : "border-slate-700/50 bg-slate-900/40 hover:border-slate-600"
                        ].join(" ")}
                      >
                        <span className="w-7 h-7 rounded-md bg-slate-900/70 border border-slate-700/50 flex items-center justify-center font-mono text-[10px] text-slate-400 shrink-0">
                          {op.seq}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-slate-100 truncate">{op.operation_name}</span>
                          <span className="block text-[10px] text-slate-500 font-mono truncate">
                            {op.operation_code}
                            {op.assigned_machine_id ? ` · ${op.assigned_machine_id}` : ""}
                            {op.status === "Completed" &&
                            op.downtime_minutes != null &&
                            op.downtime_minutes !== ""
                              ? ` · downtime ${op.downtime_minutes}m`
                              : ""}
                          </span>
                        </span>
                        {isNext && (
                          <span className="text-[10px] uppercase tracking-wide text-emerald-300 font-semibold shrink-0">
                            Next
                          </span>
                        )}
                        <StatusPill kind={statusKind(op.status)}>{op.status}</StatusPill>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedOp && selectedOp.status === "Completed" && (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
                <div className="text-sm font-semibold text-emerald-100">{selectedOp.operation_name} — completed</div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-300">
                  <div>Output: <span className="font-mono">{selectedOp.actual_output_quantity ?? 0}</span></div>
                  <div>Scrap: <span className="font-mono">{selectedOp.scrap_quantity ?? 0}</span></div>
                  <div>Rework: <span className="font-mono">{selectedOp.rework_quantity ?? 0}</span></div>
                  <div>
                    Downtime:{" "}
                    <span className="font-mono text-amber-200">
                      {selectedOp.downtime_minutes != null && selectedOp.downtime_minutes !== ""
                        ? `${selectedOp.downtime_minutes} min`
                        : "—"}
                    </span>
                  </div>
                  {selectedOp.operator_name && (
                    <div>Operator: <span className="font-mono">{selectedOp.operator_name}</span></div>
                  )}
                  {(selectedOp.actual_machine_id || selectedOp.assigned_machine_id) && (
                    <div>
                      Machine:{" "}
                      <span className="font-mono">
                        {selectedOp.actual_machine_id || selectedOp.assigned_machine_id}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedOp && canActOnSelected && (
              <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-400/30 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-blue-300 font-semibold">
                      Step {selectedOp.seq}
                    </div>
                    <div className="text-xl font-bold text-slate-100 mt-1">{selectedOp.operation_name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-1">{selectedOp.operation_code}</div>
                    {selectedOp.assigned_work_center_id && (
                      <div className="text-xs text-slate-500 mt-1">
                        Work center: {selectedOp.assigned_work_center_id}
                      </div>
                    )}
                  </div>
                  <StatusPill kind={statusKind(selectedOp.status)}>{selectedOp.status}</StatusPill>
                </div>

                {selectedOp.status === "On Hold" && selectedOp.hold_reason && (
                  <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-400/30 px-3 py-2 text-sm text-amber-100">
                    On hold: {selectedOp.hold_reason}
                  </div>
                )}

                {selectedOp.status === "Ready" && !selectedOp.can_start && (
                  <div className="mt-3 rounded-lg bg-slate-800/60 border border-slate-600/40 px-3 py-2 text-sm text-slate-300">
                    Complete the previous routing step before starting this one.
                  </div>
                )}

                {(selectedOp.status === "Ready" || selectedOp.status === "In Progress") && (
                  <div className="mt-4">
                    <label className="wf-label">Hold reason (for Put on hold)</label>
                    <input
                      className="wf-input"
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                      placeholder="Material not available, machine breakdown…"
                    />
                  </div>
                )}

                {(selectedOp.status === "Ready" || selectedOp.status === "In Progress") && (
                  <div className="mt-4 rounded-xl border border-cyan-400/20 bg-slate-900/50 p-4">
                    <WorkOrderCaptureForm
                      ref={captureRef}
                      workOrderId={woId(selectedOp)}
                      capturedBy={operatorName}
                      captureStage="execution"
                      theme="workflow"
                      title="Capture parameters"
                      subtitle={
                        selectedOp.status === "In Progress"
                          ? "Enter actual values for each parameter defined during routing."
                          : "Review parameters that must be recorded when this operation runs."
                      }
                      readOnly={selectedOp.status !== "In Progress"}
                      showSubmitButton={false}
                    />
                  </div>
                )}

                {selectedOp.status === "Ready" && (
                  <div className="mt-5">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        className="wf-btn wf-btn-ghost"
                        onClick={holdOp}
                        disabled={acting || !holdReason.trim()}
                      >
                        Put on hold
                      </button>
                      <button
                        type="button"
                        className="wf-btn wf-btn-primary"
                        onClick={startOp}
                        disabled={acting || !selectedOp.can_start}
                      >
                        {acting ? "Saving…" : "▶ Start"}
                      </button>
                    </div>
                    {selectedOp.can_start && !operatorName.trim() && (
                      <p className="text-xs text-amber-200/90 mt-2 text-right">
                        Enter operator name above, then click Start.
                      </p>
                    )}
                    {!selectedOp.can_start && nextStartableOp && (
                      <p className="text-xs text-slate-400 mt-2 text-right">
                        Select step {nextStartableOp.seq} ({nextStartableOp.operation_name}) to start next.
                      </p>
                    )}
                  </div>
                )}

                {selectedOp.status === "On Hold" && (
                  <div className="mt-5">
                    <button
                      type="button"
                      className="wf-btn wf-btn-primary w-full"
                      onClick={resumeOp}
                      disabled={acting}
                    >
                      {acting ? "Saving…" : "Resume operation"}
                    </button>
                  </div>
                )}

                {selectedOp.status === "In Progress" && (
                  <div className="mt-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="wf-label">Machine</label>
                        <input
                          className="wf-input"
                          value={machineId}
                          onChange={(e) => setMachineId(e.target.value)}
                          placeholder={selectedOp.assigned_machine_id || "MCH-…"}
                        />
                        {selectedOp.assigned_machine_id && (
                          <div className="text-[10px] text-slate-500 mt-1">From schedule</div>
                        )}
                      </div>
                      <div>
                        <label className="wf-label">Output Qty</label>
                        <input
                          type="number"
                          className="wf-input"
                          value={outputQty}
                          onChange={(e) => setOutputQty(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="wf-label">Scrap Qty</label>
                        <input
                          type="number"
                          className="wf-input"
                          value={scrapQty}
                          onChange={(e) => setScrapQty(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="wf-label">Downtime (min)</label>
                        <input
                          type="number"
                          className="wf-input"
                          value={downtimeMin}
                          onChange={(e) => setDowntimeMin(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        className="wf-btn wf-btn-ghost"
                        onClick={holdOp}
                        disabled={acting}
                      >
                        Put on hold
                      </button>
                      <button
                        type="button"
                        className="wf-btn wf-btn-primary"
                        onClick={completeOp}
                        disabled={acting}
                      >
                        {acting ? "Saving…" : "Complete →"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {operations.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
                  Full Routing
                </div>
                <FlowDiagram steps={flowSteps} />
              </div>
            )}
          </WfCardBody>
        </WfCard>

        <div className="space-y-5">
          <WfCard>
            <WfCardHeader title="How it works" subtitle="After scheduling" icon={<IconAtom />} />
            <WfCardBody className="space-y-3 text-xs text-slate-400">
              <p>1. Pick the lot scheduled in Stage 06.</p>
              <p>2. Work through each routing step in order.</p>
              <p>3. <span className="text-slate-200">Start</span> with operator name.</p>
              <p>4. <span className="text-slate-200">Complete</span> — enter capture parameters, output, scrap, machine, and downtime.</p>
              <p>5. <span className="text-slate-200">Put on hold</span> if material or machine is not ready — resume later.</p>
              <OntologyEdge from="WorkOrder" to="Operation" label="executes" />
              <OntologyEdge from="WorkOrder" to="Machine" label="runs on" />
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader title="Live status" subtitle="All operations" icon={<IconWave />} />
            <WfCardBody>
              {operations.length === 0 ? (
                <EmptyState title="No operations" hint="Pick a lot to view status." icon={<IconWave />} />
              ) : (
                <div className="space-y-2">
                  {operations.map((op) => (
                    <div key={woId(op)} className="flex items-center gap-3 text-xs">
                      <span className="w-6 h-6 rounded-md bg-slate-900/70 border border-slate-700/50 flex items-center justify-center font-mono text-[10px] text-slate-400">
                        {op.seq}
                      </span>
                      <span className="flex-1 text-slate-200 truncate">{op.operation_name}</span>
                      <StatusPill kind={statusKind(op.status)}>{op.status}</StatusPill>
                    </div>
                  ))}
                </div>
              )}
            </WfCardBody>
          </WfCard>
        </div>
      </div>
    </div>
  );
}

function IconPlay() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>; }
function IconAtom() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconWave() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12c2 0 2-4 4-4s2 8 4 8 2-12 4-12 2 16 4 16 2-8 4-8"/></svg>; }

export default ExecutionScreen;
