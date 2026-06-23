import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { fetchMesCoreProductionLots, fetchMesCoreLotFeasibility } from "../../services/mesCoreApi";
import api from "../../services/api";
import { isActivatedCarbonShell } from "../../config/legacyApiGuard";
import useIndustryBasePath from "../../hooks/useIndustryBasePath";
import { feasibilityLabel, isFeasibilityReady } from "../../utils/workflowValidation";
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


function RoutingFlow({
  loadPlan,
  generatePlan,
  loadLots,
  feasibilityPath,
  mastersPath,
  emptyLotsHint,
  stageEyebrow = "Stage 04 · Routing Flow",
  showOemRoutingMaster = true,
  feasibilityFirst = false,
  executionPath
}) {
  const location = useLocation();
  const industryBase = useIndustryBasePath();
  const { context, markStage, update } = useWorkflow();
  const [lots, setLots] = useState([]);
  const [lotId, setLotId] = useState(context.lotId || "");
  const [lotsLoading, setLotsLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [planError, setPlanError] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [feasibility, setFeasibility] = useState(null);
  const [lotFeasibility, setLotFeasibility] = useState(null);
  const [lotFeasibilityLoading, setLotFeasibilityLoading] = useState(false);

  const selectLot = (value) => {
    setLotId(value);
    if (value) update({ lotId: value });
  };

  useEffect(() => {
    setLotsLoading(true);
    const loader = loadLots || fetchMesCoreProductionLots;
    loader()
      .then((rows) => setLots(rows || []))
      .catch(() => setLots([]))
      .finally(() => setLotsLoading(false));
  }, [location.pathname, location.key, loadLots]);

  useEffect(() => {
    if (!lots.length || lotId) return;
    const terminal = new Set([
      "COMPLETED",
      "QC_PENDING",
      "STOCKED",
      "DISPATCHED",
      "CLOSED",
      "CANCELLED"
    ]);
    const open = lots.filter((l) => {
      const status = (l.status || "").toUpperCase();
      return !l.routing_complete && !terminal.has(status);
    });
    const preferred = context.lotId;
    const pick =
      (preferred &&
        open.find(
          (l) =>
            l.lot_id === preferred ||
            l.lot_code === preferred ||
            l.production_lot_id === preferred
        )) ||
      open[0] ||
      lots[0];
    if (pick) selectLot(pick.lot_id || pick.lot_code);
  }, [lots, lotId, context.lotId]);

  useEffect(() => {
    if (!lots.length) return;
    const preferred = context.lotId;
    if (!preferred) return;
    const match = lots.find(
      (l) =>
        l.lot_id === preferred ||
        l.lot_code === preferred ||
        l.production_lot_id === preferred
    );
    if (match) setLotId(match.lot_id || match.lot_code);
  }, [context.lotId, lots]);

  useEffect(() => {
    if (lotId) loadRoutingPlan(lotId);
    else {
      setPlan(null);
      setPlanError("");
      setFeasibility(null);
      setLotFeasibility(null);
    }
  }, [lotId]);

  useEffect(() => {
    if (!lotId || !feasibilityFirst) {
      setLotFeasibility(null);
      return;
    }
    setLotFeasibilityLoading(true);
    fetchMesCoreLotFeasibility(lotId)
      .then((gate) => setLotFeasibility(gate || null))
      .catch(() =>
        setLotFeasibility({
          overall_status: "BLOCKED",
          blocked_reason: "No feasibility check found for this lot. Run Feasibility Gate first."
        })
      )
      .finally(() => setLotFeasibilityLoading(false));
  }, [lotId, feasibilityFirst]);

  const loadRoutingPlan = async (id) => {
    setPlanLoading(true);
    setPlanError("");
    try {
      let data;
      if (loadPlan) {
        data = await loadPlan(id);
      } else if (isActivatedCarbonShell()) {
        throw new Error("Routing plan loader is not configured for Activated Carbon.");
      } else {
        data = (await api.get(`/lot/${id}/routing-plan`)).data;
      }
      setPlan(data || null);
    } catch (e) {
      let detail =
        e.response?.data?.detail ||
        e.message ||
        (typeof e.response?.data === "object"
          ? JSON.stringify(e.response.data)
          : null) ||
        "Could not load routing plan";
      if (detail === "Not Found") {
        detail =
          "Routing API not found — restart the local API, then refresh.";
      }
      setPlanError(typeof detail === "string" ? detail : JSON.stringify(detail));
      setPlan(null);
    } finally {
      setPlanLoading(false);
    }
  };

  const generateRoute = async () => {
    if (!lotId || generating) return;
    if (!canGenerateRoute) {
      setGenerateError(
        feasibilityFirst && canGenerate && !lotFeasibilityReady
          ? lotFeasibility?.blocked_reason ||
              "Feasibility Gate must pass before generating work orders for this lot."
          : plan
            ? "No pending operations to generate. Route may already be complete."
            : "Load a routing plan first — pick a lot and wait for operations to appear."
      );
      return;
    }
    setGenerating(true);
    setGenerateError("");
    try {
      let res;
      if (generatePlan) {
        res = await generatePlan(lotId);
      } else if (isActivatedCarbonShell()) {
        throw new Error("Route generation is not configured for Activated Carbon.");
      } else {
        res = (await api.post(`/lot/${lotId}/generate-route`)).data;
      }
      setFeasibility(res?.feasibility || null);
      await loadRoutingPlan(lotId);
      markStage("routing");
    } catch (e) {
      const msg =
        e.response?.data?.detail ||
        e.message ||
        "Error generating route";
      setGenerateError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setGenerating(false);
    }
  };

  const operations = plan?.operations || [];
  const canGenerate = Boolean(
    plan?.can_generate || (plan?.pending_work_orders ?? 0) > 0
  );
  const lotFeasibilityReady = isFeasibilityReady(lotFeasibility?.overall_status);
  const canGenerateRoute =
    canGenerate && (!feasibilityFirst || lotFeasibilityReady);
  const routingComplete = Boolean(plan?.routing_complete);
  const feasibilityReady = isFeasibilityReady(feasibility?.overall_status);

  function lotOptionLabel(l) {
    const id = l.lot_id || l.lot_code;
    const inward = l.order_code ? ` · ${l.order_code}` : "";
    const feas = l.feasibility_status
      ? feasibilityLabel(l.feasibility_status)
      : "Feasibility not checked";
    return `${id}${inward} · PO ${l.production_order_id ?? "—"} · qty ${l.lot_quantity ?? "—"} · ${feas}`;
  }

  const flowSteps = useMemo(() => {
    if (operations.length > 0) {
      return operations.map((op) => {
        const s = (op.status || "").toLowerCase();
        let status = "pending";
        if (s.includes("complete")) status = "done";
        else if (s.includes("progress")) status = "active";
        else if (op.work_order_generated) status = "active";
        return {
          id: op.operation_id || op.operation_code,
          title: op.operation_name,
          code: op.operation_code,
          seq: op.operation_sequence,
          status,
          meta: op.process_name
            ? `Process: ${op.process_name}`
            : op.work_order_generated
              ? `WO: ${op.work_order_id || "generated"}`
              : "Awaiting generate"
        };
      });
    }
    return [];
  }, [operations]);

  const generateLabel = generating
    ? "Generating…"
    : !plan
      ? "Generate Route"
      : plan.generated_work_orders === 0
        ? "Generate Route"
        : canGenerate
          ? `Sync ${plan.pending_work_orders} New Operation(s)`
          : "Route Complete";

  const routingMasterLink =
    mastersPath ||
    (plan?.part_id
      ? `${industryBase}/masters/routings?part=${encodeURIComponent(plan.part_id)}`
      : context.partId
        ? `${industryBase}/masters/routings?part=${encodeURIComponent(context.partId)}`
        : `${industryBase}/masters/routings`);

  const feasibilityLink = feasibilityPath || `${industryBase}/feasibility`;
  const executionLink = executionPath || `${industryBase}/execution`;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={stageEyebrow}
        title="Operation sequence per lot"
        subtitle={
          feasibilityFirst
            ? "Pick a lot after Feasibility Gate passes, then generate work orders for each routing step."
            : "Shows the active routing from Master Data (including new processes). Generate creates work orders — feasibility runs after that and only gates scheduling, not this step."
        }
      />

      <ContextBanner
        items={[
          { label: "Customer", value: context.customerName },
          { label: "Order", value: context.orderId },
          { label: "Lot", value: lotId || "—" },
          {
            label: plan?.raw_material_code ? "Feedstock" : "Part",
            value: plan?.raw_material_code
              ? `${plan.raw_material_code} → ${plan.part_id || "—"}`
              : plan?.part_id || context.partId || "—"
          },
          { label: "Routing", value: plan?.routing_id || "—" }
        ]}
        action={
          routingComplete ? (
            <Link to={executionLink} className="wf-btn wf-btn-primary">
              Continue to Execution →
            </Link>
          ) : feasibilityFirst && lotId ? (
            <Link to={feasibilityLink} className="wf-btn wf-btn-primary">
              Feasibility Gate →
            </Link>
          ) : !feasibilityFirst && lotId ? (
            <Link to={feasibilityLink} className="wf-btn wf-btn-primary">
              Check Feasibility →
            </Link>
          ) : null
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WfCard className="lg:col-span-2" glow>
          <WfCardHeader
            title="Process Routing"
            subtitle={
              plan
                ? `${plan.routing_id} · ${plan.total_operations} operation(s) · ${plan.generated_work_orders} work order(s)`
                : "Pick a lot to load its part routing"
            }
            icon={<IconFlow />}
            right={
              plan ? (
                canGenerate ? (
                  <StatusPill kind="warn">Pending generate</StatusPill>
                ) : (
                  <StatusPill kind="ok">Route complete</StatusPill>
                )
              ) : (
                <StatusPill kind="neutral">No lot</StatusPill>
              )
            }
          />
          <WfCardBody className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="wf-label">Lot</label>
                <select
                  className="wf-select wf-lot-select"
                  value={lotId}
                  onChange={(e) => selectLot(e.target.value)}
                >
                  <option value="">
                    {lotsLoading ? "Loading lots…" : "-- Pick a lot --"}
                  </option>
                  {lots.map((l) => {
                    const id = l.lot_id || l.lot_code;
                    return (
                      <option key={id || l.production_lot_id} value={id}>
                        {lotOptionLabel(l)}
                      </option>
                    );
                  })}
                </select>
                {!lotsLoading && lots.length === 0 && (
                  <div className="text-[11px] text-amber-200 mt-1">
                    {emptyLotsHint ||
                      "No lots yet — complete Lot Split first, then return here."}
                  </div>
                )}
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className="wf-btn wf-btn-ghost flex-1 justify-center"
                  onClick={() => loadRoutingPlan(lotId)}
                  disabled={!lotId || planLoading}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="wf-btn wf-btn-primary flex-1 justify-center"
                  onClick={generateRoute}
                  disabled={!lotId || !canGenerateRoute || generating || planLoading || lotFeasibilityLoading}
                  title={
                    feasibilityFirst && canGenerate && !lotFeasibilityReady
                      ? lotFeasibility?.blocked_reason ||
                        "Run Feasibility Gate for this lot first"
                      : !canGenerate && plan
                        ? "All routing operations already have work orders"
                        : !plan && lotId
                          ? "Save a routing for this part in Master Data first"
                          : undefined
                  }
                >
                  {generateLabel}
                </button>
              </div>
            </div>

            {plan && plan.resolved_from === "raw_material_type" && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/30 px-4 py-3 text-sm text-emerald-100">
                Routing resolved from raw material type{" "}
                <span className="font-mono font-semibold">{plan.raw_material_code}</span>
                {" → "}
                finished product{" "}
                <span className="font-mono font-semibold">{plan.part_id}</span>
                {" "}via{" "}
                <span className="font-mono">{plan.routing_id}</span>.
              </div>
            )}

            {generateError && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-400/30 px-4 py-3 text-sm text-rose-100">
                <div className="font-semibold mb-1">Generate route failed</div>
                <div className="text-xs opacity-90">{generateError}</div>
              </div>
            )}

            {planError && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-400/30 px-4 py-3 text-sm text-amber-100">
                <div className="font-semibold mb-1">No routing loaded for this lot</div>
                <div className="text-xs opacity-90">{planError}</div>
                {showOemRoutingMaster && (
                  <Link
                    to={routingMasterLink}
                    className="inline-block mt-2 text-xs text-cyan-300 underline"
                  >
                    Open Routing Master →
                  </Link>
                )}
                {!showOemRoutingMaster && (
                  <p className="text-xs mt-2 opacity-90">
                    Routing is seeded for finished product{" "}
                    <code className="font-mono">AC-GRAN-8x30</code> as{" "}
                    <code className="font-mono">RT-AC-8x30-V1</code> — see{" "}
                    <Link to={mastersPath || `${industryBase}/masters`} className="text-cyan-300 underline">
                      Masters → Routing
                    </Link>
                    . Re-run{" "}
                    <code className="font-mono">run_local_api.ps1</code> if missing.
                  </p>
                )}
              </div>
            )}

            {feasibilityFirst && lotId && canGenerate && !lotFeasibilityLoading && !lotFeasibilityReady && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-400/30 px-4 py-3 text-sm text-amber-100">
                Feasibility Gate has not passed for this lot
                {lotFeasibility?.blocked_reason ? (
                  <> — {lotFeasibility.blocked_reason}</>
                ) : (
                  <> — open Feasibility Gate, run the check, then return here.</>
                )}{" "}
                <Link to={feasibilityLink} className="text-cyan-300 underline font-semibold">
                  Go to Feasibility Gate
                </Link>
              </div>
            )}

            {feasibilityFirst && lotId && lotFeasibilityReady && canGenerate && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/30 px-4 py-3 text-sm text-emerald-100">
                Feasibility Gate passed — you can generate work orders for this lot.
              </div>
            )}

            {plan && canGenerate && !feasibilityFirst && (
              <div className="rounded-lg bg-blue-500/10 border border-blue-400/30 px-4 py-3 text-sm text-blue-100">
                {plan.pending_work_orders} operation(s) from the active routing do not have work
                orders yet
                {plan.generated_work_orders > 0
                  ? " (includes newly added processes after an earlier generate)."
                  : "."}{" "}
                Click <span className="font-semibold">{generateLabel}</span> to materialise them.
              </div>
            )}

            {planLoading && (
              <div className="text-sm text-slate-400 py-4 text-center">Loading routing plan…</div>
            )}

            {!planLoading && flowSteps.length > 0 && (
              <div className="rounded-xl bg-slate-900/40 border border-slate-700/30 p-4">
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-3">
                  Sequence Visualization
                </div>
                <FlowDiagram steps={flowSteps} />
              </div>
            )}

            {feasibility && (
              <div
                className={[
                  "rounded-lg px-4 py-3 text-sm border",
                  feasibilityReady
                    ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-100"
                    : "bg-amber-500/10 border-amber-400/30 text-amber-100"
                ].join(" ")}
              >
                Feasibility (runs after generate — does not block route generation):{" "}
                <span className="font-semibold">{feasibility.overall_status}</span>
                {feasibility.blocked_reason && !feasibilityReady && (
                  <div className="text-xs mt-1 opacity-90">{feasibility.blocked_reason}</div>
                )}
              </div>
            )}

            {!planLoading && operations.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                      <th className="text-left py-2 px-3 font-semibold w-12">Seq</th>
                      <th className="text-left py-2 px-3 font-semibold">Operation</th>
                      <th className="text-left py-2 px-3 font-semibold">Process</th>
                      <th className="text-left py-2 px-3 font-semibold">Work Order</th>
                      <th className="text-left py-2 px-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.map((op) => (
                      <tr key={op.operation_id} className="border-b border-white/5">
                        <td className="py-2 px-3 text-slate-400">{op.operation_sequence}</td>
                        <td className="py-2 px-3 text-slate-100 font-medium">
                          {op.operation_name}
                          <div className="text-[10px] font-mono text-slate-500">{op.operation_code}</div>
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {op.process_name || op.process_id || "—"}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-300 text-xs">
                          {op.work_order_id || "—"}
                        </td>
                        <td className="py-2 px-3">
                          <StatusPill
                            kind={
                              op.work_order_generated
                                ? (op.status || "").toLowerCase().includes("complete")
                                  ? "ok"
                                  : "info"
                                : "warn"
                            }
                          >
                            {op.work_order_generated ? op.status : "Not generated"}
                          </StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!planLoading && !lotId && (
              <EmptyState
                icon={<IconFlow />}
                title="Pick a lot to view routing"
                hint="Operations come from the active routing saved for that lot's part."
              />
            )}
          </WfCardBody>
        </WfCard>

        <div className="space-y-5">
          <WfCard>
            <WfCardHeader title="How it works" subtitle="Routing vs feasibility gate" icon={<IconBook />} />
            <WfCardBody className="space-y-2 text-xs text-slate-300">
              {showOemRoutingMaster ? (
                <p>
                  1. Define operations (and new processes) in{" "}
                  <Link to={routingMasterLink} className="text-cyan-300 underline">
                    Routing Master
                  </Link>{" "}
                  for the same part as the lot.
                </p>
              ) : (
                <p>
                  1. Product routing RT-AC-8x30-V1 defines Pyrolysis → Activation → Screening → QC.
                </p>
              )}
              <p>2. Pick the lot here — all routing steps appear, including newly added processes.</p>
              {feasibilityFirst ? (
                <>
                  <p>
                    3. Complete <strong>Feasibility Gate</strong> for the lot (before Kiln Feed).
                  </p>
                  <p>4. Charge the kiln on <strong>Kiln Feed</strong>, then generate work orders here.</p>
                  <p>5. Continue to Execution to run each operation on the shop floor.</p>
                </>
              ) : (
                <>
                  <p>3. Click Generate / Sync to create work orders for pending operations.</p>
                  <p>4. Feasibility runs after generate and only blocks scheduling — not route generation.</p>
                </>
              )}
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader title="Ontology" subtitle="Routing relationships" icon={<IconAtom />} />
            <WfCardBody className="space-y-2.5">
              <OntologyEdge from="Lot" to="Routing" label="follows" />
              <OntologyEdge from="Routing" to="Operation" label="hasOperation" />
              <OntologyEdge from="Operation" to="Process" label="executes" />
              <OntologyEdge from="Operation" to="Machine" label="requires" />
            </WfCardBody>
          </WfCard>
        </div>
      </div>
    </div>
  );
}

function IconFlow() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="6" height="6" rx="1"/><rect x="15" y="4" width="6" height="6" rx="1"/><rect x="9" y="14" width="6" height="6" rx="1"/><path d="M9 7h6M6 10v4h6M18 10v4h-6"/></svg>; }
function IconAtom() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconBook() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4zM4 17h14"/></svg>; }

export default RoutingFlow;
