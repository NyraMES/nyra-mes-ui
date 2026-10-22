import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../../../auth/AuthContext";
import { fetchAcDashboard, formatAcApiError } from "../../../services/activatedCarbonApi";
import { apiBaseUrl } from "../../../auth/cognitoConfig";
import { userIsAcDemoViewer } from "../utils/acMenuAccess";
import AcDemoDisabledAction from "../components/AcDemoDisabledAction";
import { SectionHeader } from "../../../workflow/ui";
import { useAppContext } from "../../../context/AppContext";
import { isAcContextReady } from "../utils/acContextUtils";
import AcManagementDashboard from "../components/AcManagementDashboard";
import AcEngineerPerformanceDashboard from "../components/AcEngineerPerformanceDashboard";
import { userSeesAcPlantDashboard } from "../utils/acPrivileges";

const LIVE_FEED_REFRESH_MS = 10 * 60 * 1000;

function ActivatedCarbonDashboard() {
  const { context, loading: contextLoading } = useAppContext();
  const { user } = useAuth();
  const demoViewer = userIsAcDemoViewer(user?.roles || []);
  const plantDashboard = userSeesAcPlantDashboard(user?.roles || [], user);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const lastFetchedMsRef = useRef(0);

  const contextReady = isAcContextReady(context, contextLoading);

  const loadDashboard = useCallback(
    async ({ silent = false, force = false } = {}) => {
      if (!plantDashboard || !contextReady) {
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
      } catch (e) {
        if (!silent) {
          setLoadError(formatAcApiError(e, "Could not load dashboard"));
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [plantDashboard, contextReady, context.tenant_code, context.workspace_code]
  );

  useEffect(() => {
    if (!plantDashboard || !contextReady) return;
    loadDashboard({ force: true });
  }, [plantDashboard, contextReady, context.tenant_code, context.workspace_code, loadDashboard]);

  useEffect(() => {
    if (!plantDashboard || !contextReady) return undefined;
    const timer = setInterval(() => {
      loadDashboard({ silent: true, force: true });
    }, LIVE_FEED_REFRESH_MS);
    return () => clearInterval(timer);
  }, [contextReady, loadDashboard]);

  if (!plantDashboard) {
    return <AcEngineerPerformanceDashboard />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dashboard"
        subtitle="All records to date. Machine output is the current month. Refreshes every 10 minutes."
        right={
          demoViewer ? (
            <AcDemoDisabledAction>Refresh</AcDemoDisabledAction>
          ) : (
            <button
              type="button"
              className="wf-btn wf-btn-ghost"
              disabled={loading}
              onClick={() => loadDashboard({ force: true })}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          )
        }
      />

      {loadError && (
        <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {loadError}
          {/localhost|127\.0\.0\.1/i.test(apiBaseUrl || "") && (
            <p className="mt-2 text-xs text-rose-300/90">
              Start the local API, then refresh.
            </p>
          )}
        </div>
      )}

      {(!contextReady || (loading && !data)) && (
        <p className="text-sm text-slate-300">Loading plant dashboard…</p>
      )}

      {data ? <AcManagementDashboard dashboard={data} /> : null}
    </div>
  );
}

export default ActivatedCarbonDashboard;
