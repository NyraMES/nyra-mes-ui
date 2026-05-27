import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

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
  EmptyState,
  GeneratedIdsDialog
} from "../ui";


function DispatchGate() {
  const navigate = useNavigate();
  const { context, markStage } = useWorkflow();

  const [lots, setLots] = useState([]);
  const [results, setResults] = useState([]);
  const [ncrs, setNcrs] = useState([]);
  const [dispatches, setDispatches] = useState([]);

  const [lotId, setLotId] = useState(context.lotId || "");
  const [orderId, setOrderId] = useState("");
  const [idsDialog, setIdsDialog] = useState({ open: false, items: [] });
  const [customerId, setCustomerId] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [partId, setPartId] = useState(context.partId || "");
  const [dispatchQty, setDispatchQty] = useState("");
  const [execSummary, setExecSummary] = useState(null);
  const [execLoading, setExecLoading] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (context.lotId && !lotId) setLotId(context.lotId);
  }, [context.lotId]);

  useEffect(() => {
    if (!lotId) {
      setExecSummary(null);
      return;
    }
    setExecLoading(true);
    api
      .get(`/lot/${lotId}/execution-summary`, { params: { sync: false } })
      .then((r) => setExecSummary(r.data || null))
      .catch(() => setExecSummary(null))
      .finally(() => setExecLoading(false));
  }, [lotId]);

  useEffect(() => {
    if (!execSummary) return;
    if (execSummary.customer_order_id) setOrderId(execSummary.customer_order_id);
    if (execSummary.customer_id) setCustomerId(execSummary.customer_id);
    if (execSummary.part_id) setPartId(execSummary.part_id);
    if (execSummary.lot_quantity != null) {
      setDispatchQty(String(execSummary.lot_quantity));
    }
  }, [execSummary]);

  const loadAll = async () => {
    try {
      const [l, r, n, d] = await Promise.all([
        api.get("/production-lots"),
        api.get("/inspection-results"),
        api.get("/ncrs"),
        api.get("/dispatches")
      ]);
      setLots(l.data || []);
      setResults(r.data || []);
      setNcrs(n.data || []);
      setDispatches(d.data || []);
    } catch (e) { console.error(e); }
  };

  const selectedLot = lots.find((l) => l.lot_id === lotId);
  const opsTotal = execSummary?.operations_total ?? 0;
  const opsCompleted = execSummary?.operations_completed ?? 0;
  const lotOpsComplete =
    opsTotal > 0 && opsCompleted === opsTotal;

  const lotResults = results.filter((r) => r.lot_id === lotId);
  const qualityPassed = lotResults.some((r) => r.inspection_status === "Passed");

  const openNcrs = ncrs.filter((n) => {
    if (n.status !== "Open") return false;
    const ir = results.find((r) => r.inspection_result_id === n.inspection_result_id);
    return ir && ir.lot_id === lotId;
  });

  const gates = [
    {
      id: "ops",
      label: "All operations complete",
      ok: lotOpsComplete,
      hint: lotId
        ? execLoading
          ? "Checking work orders…"
          : opsTotal === 0
            ? "No work orders for this lot — run execution first."
            : lotOpsComplete
              ? `All ${opsTotal} routing steps completed.`
              : `${opsCompleted} of ${opsTotal} steps completed.`
        : "Pick a lot."
    },
    {
      id: "qa",
      label: "Quality inspection passed",
      ok: qualityPassed,
      hint: lotResults.length === 0
        ? "Record a Passed inspection in Stage 08."
        : qualityPassed
          ? "At least one Passed inspection on this lot."
          : `Found ${lotResults.length} inspection(s) but none Passed.`
    },
    {
      id: "ncr",
      label: "No open NCRs",
      ok: openNcrs.length === 0,
      hint: openNcrs.length
        ? `${openNcrs.length} open NCR blocking dispatch`
        : "Quality issues closed."
    }
  ];

  const canDispatch = gates.every((g) => g.ok);

  const formValid =
    orderId && lotId && partId && Number(dispatchQty) > 0 && canDispatch;

  const submit = async () => {
    if (!formValid) return;
    try {
      const resolvedCustomer = customerId || context.customerId || "";
      if (!resolvedCustomer) {
        alert("Customer could not be resolved from the lot. Re-select the lot and try again.");
        return;
      }
      const res = await api.post("/dispatch", {
        customer_id: resolvedCustomer,
        order_id: orderId,
        vehicle_number: vehicleNumber.trim(),
        transporter_name: transporterName.trim(),
        dispatch_status: "Ready",
        lines: [
          {
            lot_id: lotId,
            part_id: partId,
            dispatch_quantity: Number(dispatchQty),
            accepted_quantity: Number(dispatchQty),
            rejected_quantity: 0
          }
        ]
      });
      const createdDispatchId = res.data?.dispatch_id;

      markStage("dispatch");
      setVehicleNumber("");
      setTransporterName("");
      await loadAll();
      setIdsDialog({
        open: true,
        items: [
          { label: "Dispatch ID", value: createdDispatchId || "—" },
          { label: "Lot", value: lotId },
          { label: "Customer Order", value: orderId },
          { label: "Quantity", value: String(dispatchQty) }
        ]
      });
    } catch (e) {
      alert(formatApiError(e, "Error dispatching"));
    }
  };

  return (
    <div className="space-y-6">
      <GeneratedIdsDialog
        open={idsDialog.open}
        title="Dispatch created"
        subtitle="Dispatch ID was assigned from the DSP sequence."
        items={idsDialog.items}
        continueLabel="View Traceability →"
        onContinue={() => {
          setIdsDialog({ open: false, items: [] });
          navigate("/workflow/traceability");
        }}
      />
      <SectionHeader
        eyebrow="Stage 09 · Dispatch Gate"
        title="Ship only what's truly ready"
        subtitle="The dispatch gate enforces operational, quality and NCR closure rules. The lot cannot leave the plant until every gate passes."
        right={
          canDispatch && (
            <Link to="/workflow/traceability" className="wf-btn wf-btn-ghost">
              View Genealogy →
            </Link>
          )
        }
      />

      <ContextBanner
        items={[
          { label: "Lot", value: lotId || "—" },
          { label: "Prod. order", value: execSummary?.production_order_id || selectedLot?.production_order_id || "—" },
          { label: "Customer order", value: orderId || "—" },
          { label: "Gates Passed", value: `${gates.filter((g) => g.ok).length}/${gates.length}` },
          { label: "Status", value: canDispatch ? "Cleared" : "Blocked" }
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WfCard className="lg:col-span-2" glow>
          <WfCardHeader
            title="Dispatch Authorization"
            subtitle="Gate must be GREEN to dispatch"
            icon={<IconTruck />}
            right={<StatusPill kind={canDispatch ? "ok" : "bad"}>{canDispatch ? "Cleared" : "Blocked"}</StatusPill>}
          />
          <WfCardBody className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="wf-label">Lot</label>
                <select className="wf-select" value={lotId} onChange={(e) => setLotId(e.target.value)}>
                  <option value="">-- Pick lot --</option>
                  {lots.map((l) => (
                    <option key={l.lot_id} value={l.lot_id}>
                      {l.lot_id} · PO {l.production_order_id || "—"}
                    </option>
                  ))}
                </select>
              </div>
              {lotId && (
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2.5 text-xs text-slate-300 space-y-1">
                  <div>
                    <span className="text-slate-500">Production order · </span>
                    <span className="font-mono text-slate-200">
                      {execSummary?.production_order_id || selectedLot?.production_order_id || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Customer order · </span>
                    <span className="font-mono text-slate-200">{orderId || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Part · </span>
                    <span className="font-mono text-slate-200">
                      {partId || execSummary?.part_id || "—"}
                      {execSummary?.part_name ? ` (${execSummary.part_name})` : ""}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {gates.map((g) => (
                <div
                  key={g.id}
                  className={[
                    "rounded-2xl p-4 ring-1",
                    g.ok
                      ? "bg-emerald-500/8 ring-emerald-400/30"
                      : "bg-rose-500/8 ring-rose-400/30"
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg ${g.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                      {g.ok ? <IconCheck /> : <IconX />}
                    </div>
                    <StatusPill kind={g.ok ? "ok" : "bad"}>{g.ok ? "Pass" : "Block"}</StatusPill>
                  </div>
                  <div className="text-sm font-semibold text-slate-100 mt-3">{g.label}</div>
                  <div className="text-xs text-slate-400 mt-1 leading-snug">{g.hint}</div>
                </div>
              ))}
            </div>

            <div className="md:col-span-3 wf-info-banner">
              Dispatch ID is generated automatically from the DSP sequence when you ship.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="wf-label">Part</label>
                <input
                  className="wf-input"
                  value={partId}
                  readOnly
                  placeholder="From lot"
                  title="Filled automatically from the lot"
                />
              </div>
              <div>
                <label className="wf-label">Dispatch Qty</label>
                <input type="number" className="wf-input" value={dispatchQty} onChange={(e) => setDispatchQty(e.target.value)} />
              </div>
              <div>
                <label className="wf-label">Vehicle</label>
                <input className="wf-input" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="KA-01-XX-1234" />
              </div>
              <div className="md:col-span-2">
                <label className="wf-label">Transporter</label>
                <input className="wf-input" value={transporterName} onChange={(e) => setTransporterName(e.target.value)} placeholder="Carrier name" />
              </div>
            </div>

            {!canDispatch && lotId && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-400/30 px-4 py-3 text-sm text-rose-200">
                <div className="font-semibold flex items-center gap-2"><IconLock /> Dispatch blocked</div>
                <div className="text-xs text-rose-200/80 mt-1">
                  Resolve the blocking gates above. Ask Nyra: <em>“Why is lot {lotId} blocked from dispatch?”</em>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end pt-3 border-t border-white/5">
              <button type="button" className="wf-btn wf-btn-primary" disabled={!formValid} onClick={submit}>
                {canDispatch ? "Dispatch Lot →" : "Cannot Dispatch"}
              </button>
            </div>
          </WfCardBody>
        </WfCard>

        <div className="space-y-5">
          <WfCard>
            <WfCardHeader title="Ontology" subtitle="Dispatch reasoning" icon={<IconAtom />} />
            <WfCardBody className="space-y-2.5">
              <OntologyEdge from="Dispatch" to="Order" label="fulfills" />
              <OntologyEdge from="Dispatch" to="Lot" label="ships" />
              <OntologyEdge from="Lot" to="Inspection" label="requires" />
              <OntologyEdge from="Lot" to="NCR" label="cleared from" />
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader title="Recent Dispatches" subtitle={`${dispatches.length} total`} icon={<IconList />} />
            <WfCardBody>
              {dispatches.length === 0 ? (
                <EmptyState title="No dispatches yet" hint="Once a lot clears the gate it will appear here." icon={<IconTruck />} />
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {dispatches.slice(0, 10).map((d) => (
                    <div key={d.dispatch_id} className="px-3 py-2 rounded-md bg-slate-900/40 border border-slate-700/30 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-200">{d.dispatch_id}</span>
                        <StatusPill kind="info">{d.dispatch_status}</StatusPill>
                      </div>
                      <div className="text-slate-400 mt-1">
                        {d.order_id} · {d.transporter_name || "—"}
                      </div>
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

function IconTruck() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h11v10H2zM13 10h5l3 3v4h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>; }
function IconAtom()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconCheck() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>; }
function IconX()     { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M6 18 18 6"/></svg>; }
function IconLock()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>; }
function IconList()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>; }

export default DispatchGate;
