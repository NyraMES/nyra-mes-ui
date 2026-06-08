import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { formatApiError } from "../../services/api";
import {
  createMesCoreProductionOrder,
  fetchMesCoreProductionOrders,
} from "../../services/mesCoreApi";
import { displayBusinessCode } from "../../utils/businessCodes";
import { quantitiesBalanced, quantityDelta } from "../../utils/workflowValidation";
import { useWorkflow } from "../WorkflowContext";
import { fetchAllOrderLines } from "../workflowData";
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


function ProductionOrderWorkflow() {
  const navigate = useNavigate();
  const { context, update, markStage } = useWorkflow();

  const [orderLineId, setOrderLineId] = useState(context.orderLineId || "");
  const [plannedQuantity, setPlannedQuantity] = useState(
    context.plannedQuantity != null ? String(context.plannedQuantity) : ""
  );
  const [orderLines, setOrderLines] = useState([]);
  const [productionOrders, setProductionOrders] = useState([]);
  const [idsDialog, setIdsDialog] = useState({ open: false, items: [] });
  const syncedLineIdRef = useRef("");

  const loadAll = useCallback(async () => {
    try {
      const [productionOrders, lines] = await Promise.all([
        fetchMesCoreProductionOrders(),
        fetchAllOrderLines(),
      ]);
      setProductionOrders(productionOrders || []);
      setOrderLines(lines || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (context.orderLineId) {
      const match = orderLines.find(
        (l) =>
          l.order_line_id === context.orderLineId ||
          l.order_line_code === context.orderLineId
      );
      setOrderLineId(match?.order_line_id || context.orderLineId);
    }
  }, [context.orderLineId, orderLines]);

  useEffect(() => {
    if (!orderLineId) {
      if (syncedLineIdRef.current) {
        syncedLineIdRef.current = "";
        setPlannedQuantity("");
      }
      return;
    }

    const line = orderLines.find(
      (l) =>
        l.order_line_id === orderLineId || l.order_line_code === orderLineId
    );
    const fromContext =
      context.orderLineId === orderLineId && context.plannedQuantity != null
        ? String(context.plannedQuantity)
        : null;
    const fromLine = line
      ? String(line.quantity ?? line.line_quantity ?? "")
      : "";

    if (syncedLineIdRef.current === orderLineId) {
      if (plannedQuantity || !fromLine) return;
      setPlannedQuantity(fromContext || fromLine);
      return;
    }

    syncedLineIdRef.current = orderLineId;
    setPlannedQuantity(fromContext || fromLine || "");
  }, [
    orderLineId,
    orderLines,
    context.orderLineId,
    context.plannedQuantity,
    plannedQuantity
  ]);

  const selectedLine = useMemo(
    () =>
      orderLines.find(
        (l) =>
          l.order_line_id === orderLineId || l.order_line_code === orderLineId
      ),
    [orderLines, orderLineId]
  );

  const resolvedLineId = selectedLine?.order_line_id || orderLineId;

  const linePO = useMemo(
    () =>
      productionOrders.find(
        (po) =>
          po.order_line_id === resolvedLineId ||
          po.order_line_id === orderLineId
      ),
    [productionOrders, resolvedLineId, orderLineId]
  );

  const usedLineIds = useMemo(
    () => new Set(productionOrders.map((po) => po.order_line_id).filter(Boolean)),
    [productionOrders]
  );

  const availableLines = orderLines.filter((l) => {
    const matchesContext =
      l.order_line_id === context.orderLineId ||
      l.order_line_code === context.orderLineId;
    if (matchesContext || l.order_line_id === orderLineId) {
      return true;
    }
    if (usedLineIds.has(l.order_line_id)) return false;
    return true;
  });

  const demandQty = Number(
    selectedLine?.quantity ?? selectedLine?.line_quantity ?? 0
  );
  const plannedQtyNum = Number(plannedQuantity);
  const qtyBalanced =
    demandQty > 0 && quantitiesBalanced(plannedQtyNum, demandQty);
  const qtyDelta = quantityDelta(plannedQtyNum, demandQty);

  const canSave =
    resolvedLineId && plannedQtyNum > 0 && qtyBalanced && !linePO;

  const submit = async () => {
    if (!canSave) return;
    try {
      const created = await createMesCoreProductionOrder({
        order_line_id: resolvedLineId,
        planned_quantity: Number(plannedQuantity),
        status: "Planned",
      });
      const poId = created.production_order_id;

      const qty = Number(plannedQuantity);
      update({
        productionOrderId: poId,
        orderLineId: resolvedLineId,
        plannedQuantity: qty,
        partId: selectedLine?.part_code || selectedLine?.part_id || context.partId,
        orderId: selectedLine?.order_id || context.orderId,
      });
      markStage("production-order");
      setProductionOrders((prev) => {
        const exists = prev.some((p) => p.production_order_id === poId);
        if (exists) return prev;
        return [created, ...prev];
      });
      await loadAll();
      setIdsDialog({
        open: true,
        items: [
          { label: "Production Order", value: poId },
          {
            label: "Order Line",
            value: selectedLine?.order_line_code || orderLineId,
          },
          { label: "Planned Qty", value: String(plannedQuantity) },
        ],
      });
    } catch (e) {
      console.error(e);
      alert(formatApiError(e, "Error creating production order"));
    }
  };

  return (
    <div className="space-y-6">
      <GeneratedIdsDialog
        open={idsDialog.open}
        title="Production order released"
        subtitle="Lot IDs will include this production order code when you split."
        items={idsDialog.items}
        continueLabel="Continue to Lot Split →"
        onContinue={() => {
          setIdsDialog({ open: false, items: [] });
          navigate("/workflow/lot-split");
        }}
      />
      <SectionHeader
        eyebrow="Stage 02 · Production Order"
        title="Release production from customer demand"
        subtitle="A production order inherits its line, part and quantity from the upstream customer order. This is the bridge between sales and the shop floor."
      />

      <ContextBanner
        items={[
          { label: "Customer", value: context.customerName },
          { label: "Order", value: context.orderId },
          { label: "Order Line", value: displayBusinessCode(context.orderLineId, selectedLine?.order_line_code) },
          { label: "Part", value: selectedLine?.part_code || selectedLine?.part_id || context.partId }
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WfCard className="lg:col-span-2" glow>
          <WfCardHeader
            title="Release Production Order"
            subtitle="Auto-loads from upstream customer order"
            icon={<IconFactory />}
            right={selectedLine && (
              <StatusPill kind="info">Inherits OrderLine</StatusPill>
            )}
          />
          <WfCardBody className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 wf-info-banner">
                Production order ID is generated from the PROD sequence when you release.
              </div>

              <div>
                <label className="wf-label">Source Order Line</label>
                <select
                  className="wf-select"
                  value={orderLineId}
                  onChange={(e) => {
                    syncedLineIdRef.current = "";
                    setOrderLineId(e.target.value);
                  }}
                >
                  <option value="">-- Pick order line --</option>
                  {availableLines.map((l) => (
                    <option key={l.order_line_id} value={l.order_line_id}>
                      {l.order_line_code || l.order_line_id} · {l.order_id} · {l.part_code || l.part_id} · qty {l.quantity ?? l.line_quantity}
                    </option>
                  ))}
                </select>
                {context.orderLineId && (
                  <div className="text-[11px] text-cyan-300 mt-1">
                    Auto-populated from upstream context
                  </div>
                )}
              </div>

              <div>
                <label className="wf-label">Planned Quantity</label>
                <input
                  type="number"
                  min={1}
                  className="wf-input"
                  value={plannedQuantity}
                  onChange={(e) => setPlannedQuantity(e.target.value)}
                />
                {selectedLine && demandQty > 0 && !qtyBalanced && (
                  <div className="text-xs text-amber-200 mt-1">
                    Must match order line demand ({demandQty}
                    {qtyDelta != null && qtyDelta !== 0
                      ? ` — ${qtyDelta > 0 ? "over" : "short"} by ${Math.abs(qtyDelta)}`
                      : ""}
                    )
                  </div>
                )}
              </div>

              <div>
                <label className="wf-label">Status</label>
                <select className="wf-select" defaultValue="Planned" disabled>
                  <option>Planned</option>
                </select>
              </div>
            </div>

            {linePO && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-400/30 px-4 py-3 text-xs text-amber-200">
                Note: this order line already has production order
                <span className="font-mono font-semibold mx-1">{linePO.production_order_id}</span>
                ({linePO.status}). Pick a different line or proceed to view it.
              </div>
            )}

            {selectedLine && (
              <div className="rounded-lg bg-slate-900/40 border border-slate-700/40 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Info label="Order" value={selectedLine.order_id} />
                <Info label="Order Line" value={selectedLine.order_line_code || selectedLine.order_line_id} />
                <Info label="Part" value={selectedLine.part_code || selectedLine.part_id} />
                <Info label="Demand Qty" value={selectedLine.quantity ?? selectedLine.line_quantity} />
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
              <div className="text-xs text-slate-400">
                Next: <span className="text-cyan-300 font-medium">Lot Split</span> divides this quantity into manufacturable lots.
              </div>
              <button
                type="button"
                className="wf-btn wf-btn-primary"
                disabled={!canSave}
                onClick={submit}
              >
                Release &amp; Split into Lots →
              </button>
            </div>
          </WfCardBody>
        </WfCard>

        <div className="space-y-5">
          <WfCard>
            <WfCardHeader
              title="Validation Rules"
              subtitle="Quantity gate before lot split"
              icon={<IconShield />}
            />
            <WfCardBody className="space-y-2.5 text-xs">
              <ValidationRule ok={Boolean(orderLineId)} label="Order line selected" />
              <ValidationRule ok={plannedQtyNum > 0} label="Planned quantity &gt; 0" />
              <ValidationRule
                ok={!selectedLine || qtyBalanced}
                label="PO.planned_qty = OrderLine.quantity"
              />
              <ValidationRule ok={!linePO} label="No duplicate PO on this line" />
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader title="Ontology" subtitle="Process knowledge graph" icon={<IconAtom />} />
            <WfCardBody className="space-y-2.5">
              <OntologyEdge from="Order" to="ProductionOrder" label="triggers" />
              <OntologyEdge from="ProductionOrder" to="OrderLine" label="fulfills" />
              <OntologyEdge from="ProductionOrder" to="Lot" label="splits into" />
              <OntologyEdge from="Lot" to="Routing" label="follows" />
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader
              title="Workflow Progress"
              subtitle="Where the demand is in the pipeline"
              icon={<IconFlow />}
            />
            <WfCardBody>
              <div className="space-y-2">
                <StageRow label="Customer Order" done={Boolean(context.orderId)} />
                <StageRow label="Production Order" active />
                <StageRow label="Lot Split" />
                <StageRow label="Routing → Feasibility → Schedule" />
                <StageRow label="Execution" />
                <StageRow label="Inspection · NCR · Dispatch" />
              </div>
            </WfCardBody>
          </WfCard>
        </div>
      </div>

      <WfCard>
        <WfCardHeader
          title="Production Orders"
          subtitle={`${productionOrders.length} orders released`}
          icon={<IconList />}
        />
        <WfCardBody>
          {productionOrders.length === 0 ? (
            <EmptyState title="No production orders yet" hint="Create one above to start the workflow." icon={<IconFactory />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                    <th className="text-left py-2 px-3 font-semibold">PO ID</th>
                    <th className="text-left py-2 px-3 font-semibold">Order Line</th>
                    <th className="text-left py-2 px-3 font-semibold">Planned Qty</th>
                    <th className="text-left py-2 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {productionOrders.map((po) => (
                    <tr key={po.production_order_id} className="border-b border-white/5 hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-mono text-slate-200">{po.production_order_id}</td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {po.order_line_code || displayBusinessCode(po.order_line_id)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">{po.planned_quantity}</td>
                      <td className="py-2.5 px-3"><StatusPill kind="info">{po.status}</StatusPill></td>
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

function ValidationRule({ ok, label }) {
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

function Info({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-slate-200 font-medium mt-0.5">{value ?? "—"}</div>
    </div>
  );
}

function StageRow({ label, done = false, active = false }) {
  let dot = "bg-slate-700";
  if (done) dot = "bg-emerald-400";
  if (active) dot = "bg-blue-400 shadow-[0_0_10px_2px_rgba(96,165,250,0.6)]";

  return (
    <div className={`flex items-center gap-3 text-xs ${active ? "text-slate-100" : done ? "text-emerald-200" : "text-slate-500"}`}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span>{label}</span>
      {active && <span className="ml-auto text-[10px] text-blue-300 uppercase tracking-widest">Current</span>}
      {done && <span className="ml-auto text-[10px] text-emerald-300 uppercase tracking-widest">Done</span>}
    </div>
  );
}

function IconShield(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.5 8.5 8 9 4.5-.5 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>; }
function IconFactory() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V10l5 3V10l5 3V6l8 5v10z"/></svg>; }
function IconAtom()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconFlow()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="6" height="6" rx="1"/><rect x="15" y="4" width="6" height="6" rx="1"/><rect x="9" y="14" width="6" height="6" rx="1"/><path d="M9 7h6M6 10v4h6M18 10v4h-6"/></svg>; }
function IconList()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>; }

export default ProductionOrderWorkflow;
