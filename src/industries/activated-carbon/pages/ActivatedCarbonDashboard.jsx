import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchAcDashboard, formatAcApiError } from "../../../services/activatedCarbonApi";
import { apiBaseUrl } from "../../../auth/cognitoConfig";
import useAcPageRefresh from "../hooks/useAcPageRefresh";
import FlowDiagram from "../../../workflow/FlowDiagram";
import {
  SectionHeader,
  WfCard,
  WfCardBody,
  WfCardHeader,
  KpiTile,
  StatusPill,
  EmptyState
} from "../../../workflow/ui";
import { useAppContext } from "../../../context/AppContext";
import { isAcContextReady } from "../utils/acContextUtils";
import KilnTelemetryPanel from "../components/KilnTelemetryPanel";

function formatKgParts(value) {
  if (value == null || value === "") return { value: "—", unit: "" };
  const n = Number(value);
  if (!Number.isFinite(n)) return { value: String(value), unit: "" };
  return { value: n.toLocaleString(), unit: "KG" };
}

function toFlowStatus(status) {
  if (status === "complete" || status === "done") return "done";
  if (status === "active") return "active";
  return "pending";
}

function ActivatedCarbonDashboard() {
  const { context, loading: contextLoading } = useAppContext();
  const { locationKey, focusTick } = useAcPageRefresh();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const contextReady = isAcContextReady(context, contextLoading);

  const loadDashboard = useCallback(async () => {
    if (!contextReady) {
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      setData(await fetchAcDashboard());
    } catch (e) {
      setLoadError(formatAcApiError(e, "Could not load dashboard"));
    } finally {
      setLoading(false);
    }
  }, [contextReady, context.tenant_code, context.workspace_code]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, locationKey, focusTick]);

  const raw = data?.raw_material;
  const yieldSummary = data?.yield_summary;

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

  const lotLines = data?.lot_lines || [];
  const activeOrders = data?.active_orders || [];
  const primaryActive = activeOrders[0];
  const rawOrdered = formatKgParts(raw?.ordered_kg);
  const rawCharged = formatKgParts(raw?.charged_kg);
  const rawPending = formatKgParts(raw?.pending_kg);

  const lotCount = yieldSummary?.lot_count ?? 0;
  const yieldPct =
    yieldSummary?.average_yield_pct != null ? `${yieldSummary.average_yield_pct}%` : "—";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={context.industry_template_name || "Activated Carbon Manufacturing"}
        title="Operational Intelligence Hub"
        subtitle="Raw material type → fixed routing → feasibility (kiln + parameters) → execution"
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="wf-btn wf-btn-ghost"
              disabled={loading}
              onClick={() => loadDashboard()}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <Link to="/activated-carbon/raw-material-inward" className="wf-btn wf-btn-primary">
              Start Production Flow
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
            </Link>
          </div>
        }
      />

      {loadError && (
        <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {loadError}
          {/localhost|127\.0\.0\.1/i.test(apiBaseUrl || "") && (
            <p className="mt-2 text-xs text-rose-300/90">
              Start the local API (<code className="font-mono">.\scripts\run_local_api.ps1</code>), then refresh.
            </p>
          )}
        </div>
      )}

      {(!contextReady || (loading && !data)) && (
        <p className="text-sm text-slate-300">Loading plant dashboard…</p>
      )}

      <div className="wf-kpi-grid wf-kpi-grid--ac">
        <KpiTile
          label="Raw Material Ordered"
          value={rawOrdered.value}
          sub={rawOrdered.unit ? `${rawOrdered.unit} · ${raw?.open_order_count ?? 0} orders` : `${raw?.open_order_count ?? 0} orders`}
          accent="blue"
          icon={<IconBox />}
        />
        <KpiTile
          label="Charged to Kiln"
          value={rawCharged.value}
          sub={rawCharged.unit || "Total feed mass"}
          accent="cyan"
          icon={<IconFlame />}
        />
        <KpiTile
          label="Yet to Load"
          value={rawPending.value}
          sub={rawPending.unit || "Pending charge"}
          accent="amber"
          icon={<IconScale />}
        />
        <KpiTile
          label="In progress"
          value={activeOrders.length}
          sub={
            primaryActive
              ? `${primaryActive.lot_code} · ${primaryActive.pipeline_stage}`
              : "No active shop-floor lot"
          }
          accent="indigo"
          icon={<IconLot />}
        />
        <KpiTile
          label="Quality Checks"
          value={data?.quality_check_count ?? "—"}
          sub="Batch tests"
          accent="violet"
          icon={<IconQC />}
        />
        <KpiTile
          label="Yield"
          value={yieldPct.replace(/%$/, "")}
          sub={yieldPct === "—" ? "Planned vs lot mass" : "% avg"}
          accent="emerald"
          icon={<IconChart />}
        />
      </div>

      <KilnTelemetryPanel />

      <WfCard>
        <WfCardHeader
          title="Orders in progress"
          subtitle="Active lots on the shop floor (dispatched lots are not listed)"
          icon={<IconLot />}
          right={
            activeOrders.length > 0 ? (
              <StatusPill kind="info">{activeOrders.length} active</StatusPill>
            ) : null
          }
        />
        <WfCardBody>
          {activeOrders.length === 0 ? (
            <EmptyState
              title="No lots in progress"
              hint="Start with raw material inward, kiln feed, and feasibility — or all lots are dispatched."
            />
          ) : (
            <div className="space-y-2">
              {activeOrders.map((row) => (
                <div
                  key={row.lot_code}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-sm text-slate-100">{row.lot_code}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      PO{" "}
                      <span className="font-mono text-slate-300">
                        {row.production_order_code || "—"}
                      </span>
                      {row.order_code ? (
                        <>
                          {" "}
                          · Order <span className="font-mono">{row.order_code}</span>
                        </>
                      ) : null}
                      {row.lot_quantity != null
                        ? ` · ${Number(row.lot_quantity).toLocaleString()} KG`
                        : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill kind="warn">{row.pipeline_stage}</StatusPill>
                    {row.feasibility_status && (
                      <StatusPill
                        kind={
                          row.feasibility_status === "READY" || row.feasibility_status === "OK"
                            ? "ok"
                            : row.feasibility_status === "BLOCKED"
                              ? "bad"
                              : "neutral"
                        }
                      >
                        Feasibility {row.feasibility_status}
                      </StatusPill>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </WfCardBody>
      </WfCard>

      <WfCard glow>
        <WfCardHeader
          title="Live Production Pipeline"
          subtitle="Manufacturing sequence from raw material inward through dispatch"
          icon={<IconFlow />}
          right={<StatusPill kind="info">Live</StatusPill>}
        />
        <WfCardBody>
          {flowSteps.length === 0 ? (
            <EmptyState
              title="No pipeline steps"
              hint="Seed demo data or check API connection."
              icon={<IconFlow />}
            />
          ) : (
            <FlowDiagram steps={flowSteps} compact />
          )}
        </WfCardBody>
      </WfCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WfCard>
          <WfCardHeader title="Kiln Status" subtitle="Activation line state" icon={<IconFlame />} />
          <WfCardBody>
            {!data?.kilns?.length ? (
              <EmptyState title="No kilns configured" hint="Seed RES-KILN-01 in master data." />
            ) : (
              <div className="space-y-3">
                {data.kilns.map((kiln) => (
                  <div
                    key={kiln.resource_code}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/40 border border-slate-700/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-sm text-slate-100">{kiln.resource_code}</div>
                      <div className="text-xs text-slate-400 truncate">{kiln.resource_name}</div>
                      {kiln.active_lot_code && (
                        <div className="text-xs text-slate-500 mt-1 font-mono">
                          Lot {kiln.active_lot_code}
                          {kiln.active_lot_kg != null
                            ? ` · ${Number(kiln.active_lot_kg).toLocaleString()} KG`
                            : ""}
                        </div>
                      )}
                    </div>
                    <StatusPill kind={kiln.status === "RUNNING" ? "ok" : kiln.status === "COOLING" ? "warn" : "neutral"}>
                      {kiln.status}
                    </StatusPill>
                  </div>
                ))}
              </div>
            )}
          </WfCardBody>
        </WfCard>

        <WfCard>
          <WfCardHeader
            title="Production Lots"
            subtitle="Order → PO → lot genealogy (Auto OEM style registry)"
            icon={<IconLot />}
          />
          <WfCardBody>
            {lotLines.length === 0 ? (
              <EmptyState title="No lots yet" hint="Create kiln feed batches to register production lots." />
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                <div className="wf-lot-registry-head hidden sm:grid">
                  <span>Order</span>
                  <span>Prod Order</span>
                  <span>Lot</span>
                  <span>Qty</span>
                  <span>Status</span>
                </div>
                {lotLines.map((row) => (
                  <div key={row.lot_code} className="wf-lot-registry-row">
                    <span className="font-mono truncate" title={row.order_code || "—"}>
                      {row.order_code || "—"}
                    </span>
                    <span className="font-mono truncate" title={row.production_order_code || "—"}>
                      {row.production_order_code || "—"}
                    </span>
                    <span className="font-mono truncate text-slate-200" title={row.lot_code}>
                      {row.lot_code}
                    </span>
                    <span className="whitespace-nowrap">
                      {row.lot_quantity != null ? Number(row.lot_quantity).toLocaleString() : "—"}
                    </span>
                    <StatusPill
                      kind={
                        (row.status || "").toUpperCase() === "DISPATCHED"
                          ? "ok"
                          : row.is_in_progress
                            ? "warn"
                            : (row.status || "").toLowerCase().includes("stock")
                              ? "ok"
                              : row.feasibility_status === "BLOCKED"
                                ? "bad"
                                : "info"
                      }
                    >
                      {row.pipeline_stage || row.status || "—"}
                    </StatusPill>
                  </div>
                ))}
              </div>
            )}
          </WfCardBody>
        </WfCard>
      </div>

    </div>
  );
}

function IconBox() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
}
function IconFlame() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.5-1.5-3-1.5-5.5 2 0 4 2.5 4 5.5a4 4 0 1 1-8 0c0-2 1-3.5 2-4.5z"/></svg>;
}
function IconScale() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 16 3-8 3 8"/><path d="M2 16h20"/><path d="M6 16V8"/></svg>;
}
function IconLot() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7 12 3l9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/></svg>;
}
function IconQC() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>;
}
function IconChart() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 16V9M12 16V5M17 16v-3"/></svg>;
}
function IconFlow() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="12" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5 15.5 10.5M8.5 16.5 15.5 13.5"/></svg>;
}

export default ActivatedCarbonDashboard;
