import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

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
import GenealogyGraph from "../GenealogyGraph";


function TraceabilityGenealogy() {
  const { context, markStage } = useWorkflow();
  const location = useLocation();

  const [lots, setLots] = useState([]);
  const [lotId, setLotId] = useState(context.lotId || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api.get("/production-lots").then((r) => setLots(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (context.lotId && !lotId) setLotId(context.lotId);
  }, [context.lotId]);

  const loadGenealogy = useCallback(async () => {
    if (!lotId) {
      setData(null);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const [trace, execSummary, ncrs, results] = await Promise.all([
        api.get(`/traceability/${lotId}`).then((r) => r.data),
        api
          .get(`/lot/${lotId}/execution-summary`, { params: { sync: false } })
          .then((r) => r.data)
          .catch(() => null),
        api.get("/ncrs").then((r) => r.data).catch(() => []),
        api.get("/inspection-results").then((r) => r.data).catch(() => [])
      ]);

      let po = null;
      if (trace.production_order_id) {
        try {
          po = (await api.get(`/production-order/${trace.production_order_id}`)).data;
        } catch {
          po = {
            production_order_id: trace.production_order_id,
            order_line_id: null,
            planned_quantity: null,
            status: null
          };
        }
      }

      let dispatches = [];
      if (trace.dispatch_id) {
        try {
          const d = (await api.get(`/dispatch/${trace.dispatch_id}`)).data;
          dispatches = d ? [d] : [];
        } catch {
          dispatches = [
            {
              dispatch_id: trace.dispatch_id,
              dispatch_status: "Dispatched",
              vehicle_number: null
            }
          ];
        }
      }

      const lotInspections = results.filter((r) => r.lot_id === lotId);
      const lotNcrs = ncrs.filter((n) => {
        const ir = results.find((r) => r.inspection_result_id === n.inspection_result_id);
        return ir && ir.lot_id === lotId;
      });

      setData({
        trace,
        order: trace.order_id
          ? {
              order_id: trace.order_id,
              customer_id: trace.customer_id,
              status: null,
              delivery_date: null
            }
          : null,
        orderLine: po?.order_line_id ? { order_line_id: po.order_line_id } : null,
        part: trace.part_id
          ? { part_id: trace.part_id, part_name: execSummary?.part_name || trace.part_id }
          : null,
        po,
        lot: {
          lot_id: trace.lot_id,
          lot_quantity: trace.lot_quantity,
          status: trace.status,
          production_order_id: trace.production_order_id
        },
        execSummary,
        operations: execSummary?.operations || [],
        inspections: lotInspections,
        ncrs: lotNcrs,
        dispatches
      });
      markStage("traceability");
    } catch (e) {
      console.error(e);
      setLoadError(formatApiError(e, "Could not load traceability"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [lotId, markStage]);

  useEffect(() => {
    loadGenealogy();
  }, [loadGenealogy, location.pathname]);

  const levels = useMemo(() => {
    if (!data) return [];
    const lvls = [];

    if (data.order) {
      lvls.push({
        label: "Customer",
        nodes: [{
          id: data.order.customer_id,
          kind: "customer",
          title: data.order.customer_id,
          sub: "Customer entity"
        }]
      });
    }

    if (data.order) {
      lvls.push({
        label: "Order",
        nodes: [{
          id: data.order.order_id,
          kind: "order",
          title: data.order.order_id,
          sub: data.order.delivery_date ? `Delivery ${data.order.delivery_date}` : data.order.status
        }]
      });
    }

    if (data.po) {
      lvls.push({
        label: "Production Order",
        nodes: [{
          id: data.po.production_order_id,
          kind: "production",
          title: data.po.production_order_id,
          sub: `Planned ${data.po.planned_quantity} · ${data.po.status}`
        }]
      });
    }

    if (data.lot) {
      lvls.push({
        label: "Lot",
        nodes: [{
          id: data.lot.lot_id,
          kind: "lot",
          title: data.lot.lot_id,
          sub: `Qty ${data.lot.lot_quantity} · ${data.lot.status}`
        }]
      });
    }

    if (data.operations?.length) {
      lvls.push({
        label: "Operations",
        nodes: data.operations.slice(0, 6).map((op) => ({
          id: op.lot_operation_id,
          kind: "operation",
          title: op.operation_name,
          sub: `${op.operation_code} · ${op.status}`
        }))
      });
    }

    if (data.inspections?.length) {
      lvls.push({
        label: "Inspections",
        nodes: data.inspections.map((ir) => ({
          id: ir.inspection_result_id,
          kind: "inspection",
          title: ir.inspection_result_id,
          sub: `${ir.inspection_status} · acc ${ir.accepted_quantity}/${ir.inspected_quantity}`
        }))
      });
    }

    if (data.ncrs?.length) {
      lvls.push({
        label: "NCRs",
        nodes: data.ncrs.map((n) => ({
          id: n.ncr_id,
          kind: "ncr",
          title: n.ncr_id,
          sub: `${n.disposition} · ${n.status}`
        }))
      });
    }

    if (data.dispatches?.length) {
      lvls.push({
        label: "Dispatch",
        nodes: data.dispatches.map((d) => ({
          id: d.dispatch_id,
          kind: "dispatch",
          title: d.dispatch_id,
          sub: `${d.dispatch_status} · ${d.vehicle_number || "—"}`
        }))
      });
    }

    return lvls;
  }, [data]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Stage 10 · Traceability"
        title="Manufacturing genealogy graph"
        subtitle="For any lot, see the connected path: Customer → Order → Production Order → Operations → Machines → Inspection → NCR → Dispatch."
      />

      <ContextBanner
        items={[
          { label: "Lot", value: lotId || "—" },
          { label: "Levels", value: levels.length },
          { label: "Inspections", value: data?.inspections?.length ?? "—" },
          { label: "NCRs", value: data?.ncrs?.length ?? "—" },
          { label: "Dispatches", value: data?.dispatches?.length ?? "—" }
        ]}
      />

      <WfCard glow>
        <WfCardHeader
          title="Genealogy"
          subtitle="Connected manufacturing knowledge"
          icon={<IconGraph />}
          right={
            <div className="flex items-center gap-2">
              <select className="wf-select max-w-xs" value={lotId} onChange={(e) => setLotId(e.target.value)}>
                <option value="">-- Pick lot --</option>
                {lots.map((l) => (
                  <option key={l.lot_id} value={l.lot_id}>
                    {l.lot_id} · {l.status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="wf-btn wf-btn-ghost"
                disabled={!lotId || loading}
                onClick={loadGenealogy}
              >
                Refresh
              </button>
            </div>
          }
        />
        <WfCardBody>
          {loadError && (
            <div className="mb-4 rounded-lg bg-rose-500/10 border border-rose-400/30 px-4 py-3 text-sm text-rose-200">
              {loadError}
            </div>
          )}
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading genealogy…</div>
          ) : levels.length === 0 ? (
            <EmptyState
              title="Pick a lot to render its genealogy"
              hint="Every node will trace back to the originating customer order."
              icon={<IconGraph />}
            />
          ) : (
            <GenealogyGraph levels={levels} />
          )}
        </WfCardBody>
      </WfCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WfCard>
          <WfCardHeader title="Lot Summary" subtitle="Resolved entities" icon={<IconInfo />} />
          <WfCardBody className="space-y-2.5 text-sm">
            <Row k="Customer" v={data?.order?.customer_id} />
            <Row k="Order" v={data?.order?.order_id} />
            <Row k="Order Line" v={data?.orderLine?.order_line_id} />
            <Row k="Production Order" v={data?.po?.production_order_id} />
            <Row k="Part" v={data?.part?.part_name || data?.lot?.part_id} />
            <Row k="Lot" v={data?.lot?.lot_id} />
            <Row k="Lot Qty" v={data?.lot?.lot_quantity} />
            <Row k="Operations" v={data?.operations?.length} />
            <Row k="Dispatch" v={data?.trace?.dispatch_id || data?.dispatches?.[0]?.dispatch_id} />
            <Row k="Quality" v={data?.trace?.final_quality_status} />
            <Row k="Lot status" v={data?.lot?.status} />
            <Row k="Closed at" v={data?.trace?.closed_at} />
          </WfCardBody>
        </WfCard>

        <WfCard>
          <WfCardHeader title="Ontology" subtitle="Edges encoded in the graph" icon={<IconAtom />} />
          <WfCardBody className="space-y-2.5">
            <OntologyEdge from="Customer" to="Order" label="places" />
            <OntologyEdge from="Order" to="ProductionOrder" label="becomes" />
            <OntologyEdge from="ProductionOrder" to="Lot" label="splits into" />
            <OntologyEdge from="Lot" to="Operation" label="executes" />
            <OntologyEdge from="Lot" to="Inspection" label="inspected by" />
            <OntologyEdge from="Inspection" to="NCR" label="creates" />
            <OntologyEdge from="Lot" to="Dispatch" label="dispatched as" />
          </WfCardBody>
        </WfCard>

        <WfCard>
          <WfCardHeader title="Ask Nyra · Suggestions" subtitle="Reasoning hooks" icon={<IconAi />} />
          <WfCardBody className="space-y-2 text-sm">
            <Suggestion text={`Show full traceability for lot ${lotId || "X"}`} />
            <Suggestion text={`Why is lot ${lotId || "X"} blocked?`} />
            <Suggestion text={`Which machine caused delay on ${lotId || "lot"}?`} />
            <Suggestion text="What is the FPY of this customer this month?" />
          </WfCardBody>
        </WfCard>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] uppercase tracking-widest text-slate-500">{k}</span>
      <span className="text-slate-200 font-medium">{v ?? "—"}</span>
    </div>
  );
}

function Suggestion({ text }) {
  return (
    <div className="rounded-md bg-slate-900/40 border border-slate-700/40 px-3 py-2 text-slate-200 hover:border-cyan-400/40 cursor-pointer transition-colors">
      <span className="text-cyan-300 mr-2">›</span>{text}
    </div>
  );
}

function IconGraph() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="12" cy="14" r="2.5"/><circle cx="5" cy="20" r="2.5"/><circle cx="19" cy="20" r="2.5"/><path d="m7 7 4 6M17 7l-4 6M7 19l4-4M17 19l-4-4"/></svg>; }
function IconAtom()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconInfo()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>; }
function IconAi()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 13c1 2 7 2 8 0M9 9h.01M15 9h.01"/></svg>; }

export default TraceabilityGenealogy;
