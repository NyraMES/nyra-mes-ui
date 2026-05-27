import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import api from "../../services/api";
import { useWorkflow } from "../WorkflowContext";
import { fetchProductionOrderById } from "../workflowData";
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


function LotSplitWorkflow() {
  const navigate = useNavigate();
  const location = useLocation();
  const { context, update, markStage } = useWorkflow();

  const [productionOrders, setProductionOrders] = useState([]);
  const [lots, setLots] = useState([]);
  const [poDetail, setPoDetail] = useState(null);

  const [productionOrderId, setProductionOrderId] = useState(context.productionOrderId || "");
  const [splitRows, setSplitRows] = useState([{ qty: "" }]);
  const [idsDialog, setIdsDialog] = useState({ open: false, items: [] });

  const loadAll = useCallback(async () => {
    try {
      const [po, lotsRes] = await Promise.all([
        api.get("/production-orders"),
        api.get("/production-lots")
      ]);
      setProductionOrders(po.data || []);
      setLots(lotsRes.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll, location.pathname]);

  useEffect(() => {
    if (context.productionOrderId) {
      setProductionOrderId(context.productionOrderId);
    }
  }, [context.productionOrderId]);

  useEffect(() => {
    if (!productionOrderId) {
      setPoDetail(null);
      return;
    }
    const fromList = productionOrders.find(
      (p) => p.production_order_id === productionOrderId
    );
    if (fromList) {
      setPoDetail(fromList);
      return;
    }
    let cancelled = false;
    fetchProductionOrderById(productionOrderId).then((po) => {
      if (!cancelled && po) setPoDetail(po);
    });
    return () => {
      cancelled = true;
    };
  }, [productionOrderId, productionOrders]);

  const selectedPO =
    productionOrders.find((p) => p.production_order_id === productionOrderId) ||
    poDetail;
  const plannedQty = Number(
    selectedPO?.planned_quantity ?? context.plannedQuantity ?? 0
  );

  useEffect(() => {
    if (!productionOrderId || plannedQty <= 0) return;
    setSplitRows((rows) => {
      const total = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
      if (total > 0) return rows;
      return [{ qty: String(plannedQty) }];
    });
  }, [productionOrderId, plannedQty]);

  const existingLotsForPO = useMemo(
    () => lots.filter((l) => l.production_order_id === productionOrderId),
    [lots, productionOrderId]
  );

  const totalSplit = splitRows.reduce(
    (s, r) => s + (Number(r.qty) || 0),
    0
  );

  const alreadySplit = existingLotsForPO.length > 0;
  const allocationOk = plannedQty > 0 && totalSplit === plannedQty && !alreadySplit;
  const lotCount = splitRows.length;

  const setRowQty = (i, v) => {
    setSplitRows((rows) => rows.map((r, idx) => (idx === i ? { qty: v } : r)));
  };

  const splitEvenly = (n) => {
    if (plannedQty <= 0) return;
    const base = Math.floor(plannedQty / n);
    const rem = plannedQty - base * n;
    setSplitRows(
      Array.from({ length: n }, (_, i) => ({
        qty: String(base + (i < rem ? 1 : 0))
      }))
    );
  };

  const addRow = () => setSplitRows((r) => [...r, { qty: "" }]);
  const removeRow = (i) =>
    setSplitRows((r) => r.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!allocationOk || alreadySplit) return;

    try {
      const res = await api.post(
        `/production-order/${productionOrderId}/lots/split`,
        {
          lots: splitRows.map((r) => ({
            lot_quantity: Number(r.qty),
            status: "Created"
          }))
        }
      );
      const createdLots = res.data || [];
      const firstLotId = createdLots[0]?.lot_id;
      update({
        lotId: firstLotId,
        productionOrderId,
        plannedQuantity: plannedQty
      });
      markStage("lot-split");
      await loadAll();
      const lotItems = createdLots.flatMap((l, i) => [
        { label: `Lot ${i + 1}`, value: l.lot_id },
        { label: `Lot ${i + 1} Qty`, value: String(l.lot_quantity) }
      ]);
      setIdsDialog({
        open: true,
        items: [
          { label: "Production Order", value: productionOrderId },
          ...lotItems
        ]
      });
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.detail || "Error creating lots");
    }
  };

  return (
    <div className="space-y-6">
      <GeneratedIdsDialog
        open={idsDialog.open}
        title="Lots created"
        subtitle="Each lot ID is prefixed with the production order, then the LOT sequence."
        items={idsDialog.items}
        continueLabel="Continue to Routing →"
        onContinue={() => {
          setIdsDialog({ open: false, items: [] });
          navigate("/workflow/routing");
        }}
      />
      <SectionHeader
        eyebrow="Stage 03 · Lot Split"
        title="Divide demand into manufacturable lots"
        subtitle="Each lot will flow through its own routing, feasibility check, schedule and inspection. The sum of lot quantities must equal the planned production quantity."
      />

      <ContextBanner
        items={[
          { label: "Customer", value: context.customerName },
          { label: "Order", value: context.orderId },
          { label: "Production Order", value: productionOrderId },
          { label: "Planned", value: plannedQty || "—" }
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WfCard className="lg:col-span-2" glow>
          <WfCardHeader
            title="Lot Allocation"
            subtitle="Validate: sum(lot.qty) = production.planned_qty"
            icon={<IconSplit />}
            right={
              <StatusPill kind={allocationOk ? "ok" : plannedQty ? "warn" : "neutral"}>
                {plannedQty ? `${totalSplit} / ${plannedQty}` : "Pick PO"}
              </StatusPill>
            }
          />
          <WfCardBody className="space-y-5">
            {alreadySplit && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-400/30 px-4 py-3 text-sm text-amber-200">
                This production order already has {existingLotsForPO.length} lot(s). Lot split is a one-time operation — use the existing lots below or pick another PO.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="wf-label">Production Order</label>
                <select
                  className="wf-select"
                  value={productionOrderId}
                  onChange={(e) => {
                    setProductionOrderId(e.target.value);
                    setSplitRows([{ qty: "" }]);
                  }}
                >
                  <option value="">-- Select production order --</option>
                  {productionOrders.map((p) => (
                    <option key={p.production_order_id} value={p.production_order_id}>
                      {p.production_order_id} · planned {p.planned_quantity} · {p.status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="wf-label">Quick split</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => splitEvenly(n)}
                      disabled={!plannedQty}
                      className="wf-btn wf-btn-ghost flex-1 justify-center"
                    >
                      ÷{n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/60">
                  <tr className="text-[11px] uppercase tracking-widest text-slate-500">
                    <th className="text-left py-2.5 px-3 font-semibold w-12">#</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Lot #</th>
                    <th className="text-left py-2.5 px-3 font-semibold w-44">Quantity</th>
                    <th className="text-left py-2.5 px-3 font-semibold w-32">% Allocation</th>
                    <th className="py-2.5 px-3 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {splitRows.map((r, i) => {
                    const pct = plannedQty ? (Number(r.qty || 0) / plannedQty) * 100 : 0;
                    return (
                      <tr key={i} className="border-t border-white/5">
                        <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                        <td className="py-2 px-3 font-mono text-slate-400 text-xs">
                          {productionOrderId ? `${productionOrderId}-LOT…` : "—"}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="1"
                            className="wf-input"
                            value={r.qty}
                            onChange={(e) => setRowQty(i, e.target.value)}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-400 to-indigo-400"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <button
                            type="button"
                            disabled={splitRows.length === 1}
                            onClick={() => removeRow(i)}
                            className="text-xs text-slate-400 hover:text-rose-300 disabled:opacity-30 disabled:hover:text-slate-400"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button type="button" className="wf-btn wf-btn-ghost" onClick={addRow}>
                + Add Lot
              </button>
              <div className="text-sm">
                Total: <span className="font-mono text-slate-200">{totalSplit}</span>
                <span className="text-slate-500"> / </span>
                <span className="font-mono text-slate-400">{plannedQty || "—"}</span>
                <span className="ml-3">
                  {plannedQty > 0 && totalSplit !== plannedQty && (
                    <StatusPill kind="warn">
                      {totalSplit > plannedQty ? "Over" : "Short"} by {Math.abs(plannedQty - totalSplit)}
                    </StatusPill>
                  )}
                  {plannedQty > 0 && totalSplit === plannedQty && (
                    <StatusPill kind="ok">Balanced</StatusPill>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
              <div className="text-xs text-slate-400">
                Next: <span className="text-cyan-300 font-medium">Routing Flow</span> defines operation sequence per lot.
              </div>
              <button
                type="button"
                className="wf-btn wf-btn-primary"
                disabled={!allocationOk || lotCount === 0 || alreadySplit}
                onClick={submit}
              >
                Create {lotCount} Lot{lotCount === 1 ? "" : "s"} →
              </button>
            </div>
          </WfCardBody>
        </WfCard>

        <div className="space-y-5">
          <WfCard>
            <WfCardHeader title="Ontology" subtitle="Lot relationships" icon={<IconAtom />} />
            <WfCardBody className="space-y-2.5">
              <OntologyEdge from="ProductionOrder" to="Lot" label="splits into" />
              <OntologyEdge from="Lot" to="Routing" label="follows" />
              <OntologyEdge from="Lot" to="Operation" label="executes" />
              <OntologyEdge from="Lot" to="Inspection" label="passes through" />
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader
              title="Validation Rules"
              subtitle="Manufacturing constraints"
              icon={<IconShield />}
            />
            <WfCardBody className="space-y-2.5 text-xs">
              <Rule ok={allocationOk} label="SUM(lot.qty) = PO.planned_qty" />
              <Rule ok={lotCount > 0} label="At least one lot defined" />
              <Rule
                ok={splitRows.every((r) => Number(r.qty) > 0)}
                label="Every lot has qty > 0"
              />
            </WfCardBody>
          </WfCard>

          {existingLotsForPO.length > 0 && (
            <WfCard>
              <WfCardHeader
                title="Existing lots"
                subtitle={`${existingLotsForPO.length} already created for this PO`}
                icon={<IconLot />}
              />
              <WfCardBody className="space-y-1.5">
                {existingLotsForPO.map((l) => (
                  <div key={l.lot_id} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-slate-900/40 border border-slate-700/30 text-xs">
                    <span className="font-mono text-slate-300">{l.lot_id}</span>
                    <span className="text-slate-400">qty {l.lot_quantity}</span>
                    <StatusPill kind="info">{l.status}</StatusPill>
                  </div>
                ))}
              </WfCardBody>
            </WfCard>
          )}
        </div>
      </div>
    </div>
  );
}

function Rule({ ok, label }) {
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

function IconSplit() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>; }
function IconAtom()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconShield(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.5 8.5 8 9 4.5-.5 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>; }
function IconLot()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7 12 3l9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10"/></svg>; }

export default LotSplitWorkflow;
