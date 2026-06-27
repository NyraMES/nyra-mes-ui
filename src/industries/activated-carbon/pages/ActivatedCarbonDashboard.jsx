import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../../auth/AuthContext";
import { fetchAcDashboard, formatAcApiError } from "../../../services/activatedCarbonApi";
import { apiBaseUrl } from "../../../auth/cognitoConfig";
import useAcOntologyConfig from "../hooks/useAcOntologyConfig";
import { getEnabledDashboardPanels } from "../utils/acOntologyConfigStore";
import { userIsAcDemoViewer } from "../utils/acMenuAccess";
import AcDemoDisabledAction from "../components/AcDemoDisabledAction";
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
import { isAcContextReady } from "../utils/acContextUtils";
import AcIsa95KpiPanel from "../components/AcIsa95KpiPanel";
import AcKilnLiveLoadStrip from "../components/AcKilnLiveLoadStrip";
import AcKpiShopFloorPanel from "../components/AcKpiShopFloorPanel";
import AcYieldReportsPanel from "../components/AcYieldReportsPanel";

const LIVE_FEED_REFRESH_MS = 10 * 60 * 1000;

const COL_SPAN_CLASS = {
  12: "xl:col-span-12",
  8: "xl:col-span-8",
  6: "xl:col-span-6",
  4: "xl:col-span-4",
  3: "xl:col-span-3"
};

function toFlowStatus(status) {
  if (status === "complete" || status === "done") return "done";
  if (status === "active") return "active";
  return "pending";
}

function ActivatedCarbonDashboard() {
  const { context, loading: contextLoading } = useAppContext();
  const { user } = useAuth();
  const demoViewer = userIsAcDemoViewer(user?.roles || []);
  const { config: ontologyConfig } = useAcOntologyConfig();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const lastFetchedMsRef = useRef(0);

  const contextReady = isAcContextReady(context, contextLoading);

  const enabledPanels = useMemo(
    () => getEnabledDashboardPanels(ontologyConfig),
    [ontologyConfig]
  );
  const panelById = useMemo(
    () => Object.fromEntries(enabledPanels.map((p) => [p.id, p])),
    [enabledPanels]
  );

  const loadDashboard = useCallback(async ({ silent = false, force = false } = {}) => {
    if (!contextReady) {
      return;
    }
    const now = Date.now();
    if (
      !force &&
      lastFetchedMsRef.current > 0 &&
      now - lastFetchedMsRef.current < LIVE_FEED_REFRESH_MS
    ) {
      return;
    }
    if (!silent) {
      setLoading(true);
      setLoadError("");
    }
    try {
      setData(await fetchAcDashboard());
      lastFetchedMsRef.current = Date.now();
      setLastRefreshedAt(new Date().toISOString());
    } catch (e) {
      if (!silent) {
        setLoadError(formatAcApiError(e, "Could not load dashboard"));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [contextReady, context.tenant_code, context.workspace_code]);

  useEffect(() => {
    if (!contextReady) return;
    loadDashboard({ force: true });
  }, [contextReady, context.tenant_code, context.workspace_code, loadDashboard]);

  useEffect(() => {
    if (!contextReady) return undefined;
    const timer = setInterval(() => {
      loadDashboard({ silent: true, force: true });
    }, LIVE_FEED_REFRESH_MS);
    return () => clearInterval(timer);
  }, [contextReady, loadDashboard]);

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
  const showShopFloor = Boolean(panelById["kpi-shop-floor"]);
  const showKpiSidebar = Boolean(panelById["isa95-sidebar"]);
  const showTopRow = showShopFloor || showKpiSidebar;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={context.industry_template_name || "Activated Carbon Manufacturing"}
        title="Operational Intelligence Hub"
        subtitle="Raw material type → fixed routing → feasibility (kiln + parameters) → execution"
        right={
          <div className="flex items-center gap-2">
            {demoViewer ? (
              <>
                <AcDemoDisabledAction>Refresh</AcDemoDisabledAction>
                <AcDemoDisabledAction>Configure dashboard</AcDemoDisabledAction>
                <AcDemoDisabledAction>
                  Kiln telemetry
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
                </AcDemoDisabledAction>
                <AcDemoDisabledAction className="wf-btn wf-btn-primary">
                  Start Production Flow
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
                </AcDemoDisabledAction>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="wf-btn wf-btn-ghost"
                  disabled={loading}
                  onClick={() => loadDashboard({ force: true })}
                >
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
                <Link
                  to="/activated-carbon/masters?tab=ontology-ui"
                  className="wf-btn wf-btn-ghost"
                >
                  Configure dashboard
                </Link>
                <Link to="/activated-carbon/kiln-telemetry" className="wf-btn wf-btn-ghost inline-flex items-center gap-1.5">
                  Kiln telemetry
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
                </Link>
                <Link to="/activated-carbon/raw-material?tab=inward" className="wf-btn wf-btn-primary">
                  Start Production Flow
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
                </Link>
              </>
            )}
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

      {showTopRow ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {showShopFloor ? (
            <div className={COL_SPAN_CLASS[panelById["kpi-shop-floor"]?.colSpan] || "xl:col-span-8"}>
              <AcKpiShopFloorPanel dashboard={data} readOnly={demoViewer} />
            </div>
          ) : null}
          {showKpiSidebar ? (
            <div className={COL_SPAN_CLASS[panelById["isa95-sidebar"]?.colSpan] || "xl:col-span-4"}>
              <AcIsa95KpiPanel dashboard={data} variant="sidebar" />
            </div>
          ) : null}
        </div>
      ) : null}

      {enabledPanels
        .filter((p) => !["kpi-shop-floor", "isa95-sidebar"].includes(p.id))
        .map((panel) => {
          if (panel.id === "flow-pipeline") {
            return (
              <WfCard key={panel.id}>
                <WfCardHeader
                  title={panel.label || "Live pipeline"}
                  subtitle="Manufacturing process step counts"
                  icon={<IconFlow />}
                  right={<StatusPill kind="info">Live</StatusPill>}
                />
                <WfCardBody className="py-2 px-2 overflow-x-auto">
                  {flowSteps.length === 0 ? (
                    <EmptyState title="No steps" hint="Seed demo data." icon={<IconFlow />} />
                  ) : (
                    <FlowDiagram steps={flowSteps} compact dense />
                  )}
                </WfCardBody>
              </WfCard>
            );
          }

          if (panel.id === "kiln-live-load") {
            return (
              <WfCard key={panel.id}>
                <WfCardHeader
                  title={panel.label || "Kiln live load"}
                  subtitle="Stock in kiln, cycle progress, and feed load"
                  icon={<IconFlame />}
                  right={<StatusPill kind="info">Live</StatusPill>}
                />
                <WfCardBody className="py-3">
                  <AcKilnLiveLoadStrip dashboard={data} refreshedAt={lastRefreshedAt} readOnly={demoViewer} />
                </WfCardBody>
              </WfCard>
            );
          }

          if (panel.id === "yield-reports") {
            return (
              <WfCard key={panel.id}>
                <WfCardHeader
                  title={panel.label || "Yield reports"}
                  subtitle="RMS loss by inward and kiln yield trend"
                  icon={<IconChart />}
                />
                <WfCardBody>
                  <AcYieldReportsPanel dashboard={data} />
                </WfCardBody>
              </WfCard>
            );
          }

          if (panel.id === "lot-registry") {
            return (
              <WfCard key={panel.id}>
                <WfCardHeader
                  title={panel.label || "Production lots"}
                  subtitle="Order → PO → lot genealogy"
                  icon={<IconLot />}
                />
                <WfCardBody>
                  {lotLines.length === 0 ? (
                    <EmptyState title="No lots yet" hint="Release QC-passed material on Feasibility Gate to register production lots." />
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
            );
          }

          return null;
        })}
    </div>
  );
}

function IconFlame() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.5-1.5-3-1.5-5.5 2 0 4 2.5 4 5.5a4 4 0 1 1-8 0c0-2 1-3.5 2-4.5z"/></svg>;
}
function IconLot() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7 12 3l9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/></svg>;
}
function IconFlow() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="12" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5 15.5 10.5M8.5 16.5 15.5 13.5"/></svg>;
}
function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-6 4 3 5-8" />
    </svg>
  );
}
export default ActivatedCarbonDashboard;
