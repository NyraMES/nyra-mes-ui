import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchChemDashboard, formatChemApiError } from "../../../services/chemicalApi";
import FlowDiagram from "../../../workflow/FlowDiagram";
import {
  SectionHeader,
  WfCard,
  WfCardBody,
  WfCardHeader,
  StatusPill,
  EmptyState
} from "../../../workflow/ui";
import { useAppContext } from "../../../context/AppContext";
import { isChemContextReady } from "../utils/chemContextUtils";

function toFlowStatus(status) {
  if (status === "complete" || status === "done") return "done";
  if (status === "active") return "active";
  return "pending";
}

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function ReactorStatusStrip({ reactors }) {
  if (!reactors?.length) {
    return (
      <EmptyState
        title="No reactors configured"
        description="Add batch reactor resources in master data to see live status."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {reactors.map((reactor) => (
        <div
          key={reactor.resource_code}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-800">{reactor.resource_name}</div>
              <div className="text-xs text-slate-500">{reactor.resource_code}</div>
            </div>
            <StatusPill status={reactor.status === "RUNNING" ? "active" : "pending"}>
              {reactor.status}
            </StatusPill>
          </div>
          {reactor.active_lot_code ? (
            <div className="mt-3 text-xs text-slate-600">
              Active batch: <strong>{reactor.active_lot_code}</strong>
              {reactor.active_lot_kg != null ? ` · ${formatKg(reactor.active_lot_kg)} kg` : null}
            </div>
          ) : (
            <div className="mt-3 text-xs text-slate-400">No active batch</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ChemicalDashboard() {
  const { context, loading: contextLoading } = useAppContext();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const contextReady = isChemContextReady(context, contextLoading);

  const loadDashboard = useCallback(async () => {
    if (!contextReady) return;
    setLoading(true);
    setLoadError("");
    try {
      setData(await fetchChemDashboard());
    } catch (e) {
      setLoadError(formatChemApiError(e, "Could not load dashboard"));
    } finally {
      setLoading(false);
    }
  }, [contextReady, context.tenant_code, context.workspace_code]);

  useEffect(() => {
    if (!contextReady) return;
    loadDashboard();
  }, [contextReady, context.tenant_code, context.workspace_code, loadDashboard]);

  const flowSteps = useMemo(
    () =>
      (data?.process_steps || []).map((step) => ({
        id: step.path,
        title: step.label,
        status: toFlowStatus(step.status),
        seq: step.step_order,
        count: step.record_count
      })),
    [data?.process_steps]
  );

  const batchSummary = data?.batch_summary;
  const rawMaterial = data?.raw_material;

  if (!contextReady || loading) {
    return <p className="text-sm text-slate-500 py-8">Loading chemical dashboard…</p>;
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Chemical Processing Intelligence Hub"
        subtitle="Batch reactor visibility — feedstock to dispatch with quality and yield insights."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <WfCard>
          <WfCardHeader title="Active batches" />
          <WfCardBody>
            <div className="text-2xl font-semibold text-slate-900">
              {batchSummary?.lot_count ?? 0}
            </div>
          </WfCardBody>
        </WfCard>
        <WfCard>
          <WfCardHeader title="Batch quantity (kg)" />
          <WfCardBody>
            <div className="text-2xl font-semibold text-slate-900">
              {formatKg(batchSummary?.total_lot_quantity)}
            </div>
          </WfCardBody>
        </WfCard>
        <WfCard>
          <WfCardHeader title="Quality checks" />
          <WfCardBody>
            <div className="text-2xl font-semibold text-slate-900">
              {data?.quality_check_count ?? 0}
            </div>
          </WfCardBody>
        </WfCard>
        <WfCard>
          <WfCardHeader title="FG stock (kg)" />
          <WfCardBody>
            <div className="text-2xl font-semibold text-slate-900">
              {formatKg(data?.finished_goods_stock_kg)}
            </div>
          </WfCardBody>
        </WfCard>
      </div>

      <WfCard>
        <WfCardHeader title="Batch process flow" subtitle="Capability-gated manufacturing sequence" />
        <WfCardBody>
          {flowSteps.length ? (
            <FlowDiagram steps={flowSteps} />
          ) : (
            <EmptyState title="No process steps" description="Enable capabilities to see the flow." />
          )}
        </WfCardBody>
      </WfCard>

      <WfCard>
        <WfCardHeader title="Reactor status" />
        <WfCardBody>
          <ReactorStatusStrip reactors={data?.reactors} />
        </WfCardBody>
      </WfCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <WfCard>
          <WfCardHeader title="Raw material feedstock" />
          <WfCardBody>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Ordered (kg)</dt>
                <dd className="font-medium">{formatKg(rawMaterial?.ordered_kg)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Charged (kg)</dt>
                <dd className="font-medium">{formatKg(rawMaterial?.charged_kg)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Pending (kg)</dt>
                <dd className="font-medium">{formatKg(rawMaterial?.pending_kg)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Open receipts</dt>
                <dd className="font-medium">{rawMaterial?.open_order_count ?? 0}</dd>
              </div>
            </dl>
          </WfCardBody>
        </WfCard>

        <WfCard>
          <WfCardHeader title="Production lots" />
          <WfCardBody>
            {!data?.lot_lines?.length ? (
              <EmptyState title="No batches yet" description="Create a production order to start." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="py-2 pr-4">Lot</th>
                      <th className="py-2 pr-4">Stage</th>
                      <th className="py-2 pr-4">Qty (kg)</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lot_lines.slice(0, 8).map((row) => (
                      <tr key={row.lot_code} className="border-b border-slate-100">
                        <td className="py-2 pr-4 font-medium">{row.lot_code}</td>
                        <td className="py-2 pr-4 text-slate-600">{row.pipeline_stage || "—"}</td>
                        <td className="py-2 pr-4">{formatKg(row.lot_quantity)}</td>
                        <td className="py-2">
                          <StatusPill status={row.is_in_progress ? "active" : "pending"}>
                            {row.status || "—"}
                          </StatusPill>
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
    </div>
  );
}
