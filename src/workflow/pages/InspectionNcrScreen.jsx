import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../services/api";
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


function InspectionNcrScreen() {
  const { context, markStage } = useWorkflow();

  const [lots, setLots] = useState([]);
  const [results, setResults] = useState([]);
  const [ncrs, setNcrs] = useState([]);
  const [lotId, setLotId] = useState(context.lotId || "");

  // inspection form
  const [workOrderId, setWorkOrderId] = useState("");
  const [inspectedQty, setInspectedQty] = useState("");
  const [acceptedQty, setAcceptedQty] = useState("");
  const [rejectedQty, setRejectedQty] = useState("");
  const [params, setParams] = useState([{ name: "", observed: "", spec: "" }]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (context.lotId && !lotId) setLotId(context.lotId);
  }, [context.lotId]);

  const loadAll = async () => {
    try {
      const [l, r, n] = await Promise.all([
        api.get("/production-lots"),
        api.get("/inspection-results"),
        api.get("/ncrs")
      ]);
      setLots(l.data || []);
      setResults(r.data || []);
      setNcrs(n.data || []);
    } catch (e) { console.error(e); }
  };

  const inspectionStatus = useMemo(() => {
    const i = Number(inspectedQty) || 0;
    const r = Number(rejectedQty) || 0;
    if (i <= 0) return "neutral";
    if (r > 0) return "bad";
    return "ok";
  }, [inspectedQty, rejectedQty]);

  const updateParam = (i, key, v) =>
    setParams((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const addParam = () => setParams((r) => [...r, { name: "", observed: "", spec: "" }]);

  const canSave = lotId && Number(inspectedQty) > 0;

  const submit = async () => {
    if (!canSave) return;
    const inspected = Number(inspectedQty) || 0;
    const accepted = Number(acceptedQty) || 0;
    const rejected = Number(rejectedQty) || 0;
    const status = rejected > 0 ? "Failed" : "Passed";

    try {
      const inspRes = await api.post("/inspection-result", {
        work_order_id: workOrderId.trim() || undefined,
        lot_id: lotId,
        inspected_quantity: inspected,
        accepted_quantity: accepted,
        rejected_quantity: rejected,
        inspection_status: status
      });
      const inspectionId = inspRes.data?.inspection_id;

      if (status === "Failed" && inspectionId) {
        try {
          await api.post("/ncr", {
            inspection_id: inspectionId,
            defect_id: "AUTO",
            rejected_quantity: rejected,
            disposition: "rework",
            root_cause: "Auto-generated from failed inspection",
            corrective_action: "",
            status: "Open"
          });
        } catch (e) {
          // best-effort
        }
      }

      markStage("inspection");
      setWorkOrderId(""); setInspectedQty(""); setAcceptedQty(""); setRejectedQty("");
      setParams([{ name: "", observed: "", spec: "" }]);
      await loadAll();
    } catch (e) {
      alert(e.response?.data?.detail || "Error saving inspection");
    }
  };

  const lotInspections = results.filter((r) => r.lot_id === lotId);
  const openNcrCount = ncrs.filter((n) => n.status === "Open").length;
  const failedHere = lotInspections.some((r) => r.inspection_status === "Failed");

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Stage 08 · Inspection & NCR"
        title="Quality gate with auto-generated NCRs"
        subtitle="Capture inspection parameters and observed values. Failing observations automatically raise non-conformance reports linked to the lot."
        right={
          !failedHere && lotInspections.length > 0 && (
            <Link to="/workflow/dispatch" className="wf-btn wf-btn-primary">
              Open Dispatch Gate →
            </Link>
          )
        }
      />

      <ContextBanner
        items={[
          { label: "Lot", value: lotId || "—" },
          { label: "Inspections", value: lotInspections.length },
          { label: "Open NCRs", value: openNcrCount },
          { label: "Result", value: failedHere ? "Failed" : lotInspections.length ? "Passed" : "—" }
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WfCard className="lg:col-span-2" glow>
          <WfCardHeader
            title="Inspection Capture"
            subtitle="Pass / Fail decision drives NCR auto-generation"
            icon={<IconShield />}
            right={<StatusPill kind={inspectionStatus}>{inspectionStatus === "ok" ? "Will Pass" : inspectionStatus === "bad" ? "Will Fail · NCR" : "Pending"}</StatusPill>}
          />
          <WfCardBody className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3 wf-info-banner">
                Inspection and NCR IDs are assigned automatically when you save.
              </div>
              <div>
                <label className="wf-label">Lot</label>
                <select className="wf-select" value={lotId} onChange={(e) => setLotId(e.target.value)}>
                  <option value="">-- Pick lot --</option>
                  {lots.map((l) => (
                    <option key={l.lot_id} value={l.lot_id}>{l.lot_id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="wf-label">Work Order ID</label>
                <input className="wf-input" value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)} placeholder="optional" />
              </div>
              <div>
                <label className="wf-label">Inspected Qty</label>
                <input type="number" className="wf-input" value={inspectedQty} onChange={(e) => setInspectedQty(e.target.value)} />
              </div>
              <div>
                <label className="wf-label">Accepted Qty</label>
                <input type="number" className="wf-input" value={acceptedQty} onChange={(e) => setAcceptedQty(e.target.value)} />
              </div>
              <div>
                <label className="wf-label">Rejected Qty</label>
                <input type="number" className="wf-input" value={rejectedQty} onChange={(e) => setRejectedQty(e.target.value)} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">
                  Inspection Parameters
                </div>
                <button type="button" className="text-xs text-cyan-300 hover:text-cyan-200" onClick={addParam}>
                  + Add Parameter
                </button>
              </div>
              <div className="space-y-2">
                {params.map((p, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input className="wf-input" placeholder="Parameter (e.g. hardness)" value={p.name} onChange={(e) => updateParam(i, "name", e.target.value)} />
                    <input className="wf-input" placeholder="Spec (e.g. 60-65 HRC)" value={p.spec} onChange={(e) => updateParam(i, "spec", e.target.value)} />
                    <input className="wf-input" placeholder="Observed value" value={p.observed} onChange={(e) => updateParam(i, "observed", e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            {Number(rejectedQty) > 0 && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-400/30 px-4 py-3 text-sm text-rose-200">
                <div className="font-semibold flex items-center gap-2">
                  <IconAlert /> NCR will be auto-generated
                </div>
                <div className="text-xs text-rose-200/80 mt-1">
                  Rejection {">"} 0 triggers a non-conformance report linked to this inspection.
                </div>
              </div>
            )}

            <div className="flex items-center justify-end pt-3 border-t border-white/5">
              <button type="button" className="wf-btn wf-btn-primary" disabled={!canSave} onClick={submit}>
                Save Inspection {Number(rejectedQty) > 0 ? "+ Raise NCR" : ""}
              </button>
            </div>
          </WfCardBody>
        </WfCard>

        <div className="space-y-5">
          <WfCard>
            <WfCardHeader title="Ontology" subtitle="Quality reasoning" icon={<IconAtom />} />
            <WfCardBody className="space-y-2.5">
              <OntologyEdge from="Lot" to="Inspection" label="undergoes" />
              <OntologyEdge from="Inspection" to="Parameter" label="checks" />
              <OntologyEdge from="Inspection" to="NCR" label="creates" />
              <OntologyEdge from="NCR" to="Defect" label="references" />
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader
              title="Recent NCRs"
              subtitle={`${ncrs.length} total · ${openNcrCount} open`}
              icon={<IconAlert />}
            />
            <WfCardBody>
              {ncrs.length === 0 ? (
                <EmptyState title="No NCRs" hint="Clean run." icon={<IconAlert />} />
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {ncrs.slice(0, 12).map((n) => (
                    <div key={n.ncr_id} className="px-3 py-2 rounded-md bg-slate-900/40 border border-slate-700/30 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-200">{n.ncr_id}</span>
                        <StatusPill kind={n.status === "Open" ? "bad" : "neutral"}>{n.status}</StatusPill>
                      </div>
                      <div className="text-slate-400 mt-1">
                        Rejected <span className="text-rose-300">{n.rejected_quantity}</span> · {n.disposition}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </WfCardBody>
          </WfCard>
        </div>
      </div>

      <WfCard>
        <WfCardHeader title="Lot Inspection History" subtitle={`Results for ${lotId || "—"}`} icon={<IconList />} />
        <WfCardBody>
          {lotInspections.length === 0 ? (
            <EmptyState title="No inspections" hint="Capture an inspection above." icon={<IconShield />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                    <th className="text-left py-2 px-3 font-semibold">Inspection ID</th>
                    <th className="text-left py-2 px-3 font-semibold">Work Order</th>
                    <th className="text-left py-2 px-3 font-semibold">Inspected</th>
                    <th className="text-left py-2 px-3 font-semibold">Accepted</th>
                    <th className="text-left py-2 px-3 font-semibold">Rejected</th>
                    <th className="text-left py-2 px-3 font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {lotInspections.map((r) => (
                    <tr key={r.inspection_result_id} className="border-b border-white/5">
                      <td className="py-2 px-3 font-mono text-slate-200">{r.inspection_result_id}</td>
                      <td className="py-2 px-3 text-slate-300">{r.work_order_id}</td>
                      <td className="py-2 px-3 text-slate-300">{r.inspected_quantity}</td>
                      <td className="py-2 px-3 text-emerald-300">{r.accepted_quantity}</td>
                      <td className="py-2 px-3 text-rose-300">{r.rejected_quantity}</td>
                      <td className="py-2 px-3">
                        <StatusPill kind={r.inspection_status === "Passed" ? "ok" : "bad"}>{r.inspection_status}</StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </WfCardBody>
      </WfCard>
    </div>
  );
}

function IconShield() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.5 8.5 8 9 4.5-.5 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>; }
function IconAtom()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconAlert()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18A2 2 0 0 0 3.54 21h16.92a2 2 0 0 0 1.72-3L13.7 3.86a2 2 0 0 0-3.4 0z"/></svg>; }
function IconList()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>; }

export default InspectionNcrScreen;
