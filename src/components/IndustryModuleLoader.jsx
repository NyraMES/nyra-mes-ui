import { lazy, Suspense, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import {
  getIndustrySelection,
  resolveScopedTenantForIndustry
} from "../config/industrySelection";
import { useAppContext } from "../context/AppContext";
import GenericCoreDashboard from "./GenericCoreDashboard";
import ActivatedCarbonRoutes from "../industries/activated-carbon/routes/ActivatedCarbonRoutes";

function ModuleLoading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-slate-500 wf-shell wf-ac-shell">
      <div className="text-center">
        <p className="text-sm">Loading industry module…</p>
      </div>
    </div>
  );
}

const MODULE_LOADERS = {
  "automotive-oem": lazy(
    () => import("../industries/automotive-oem/routes/AutomotiveOemRoutes")
  ),
  "activated-carbon": ActivatedCarbonRoutes
};

/**
 * Reads module_code from AppContext and lazy-loads the matching industry module.
 * Falls back to GenericCoreDashboard when module_code is unknown.
 */
function inferModuleCode(pathname, context) {
  if (context.module_code) return context.module_code;
  if (pathname.startsWith("/activated-carbon")) return "activated-carbon";
  if (pathname.startsWith("/automotive-oem")) return "automotive-oem";
  return null;
}

function IndustryModuleLoader() {
  const { user } = useAuth();
  const { context, loading, selectIndustryContext } = useAppContext();
  const { pathname } = useLocation();
  const hasLoadedOnce = useRef(false);

  if (!loading) {
    hasLoadedOnce.current = true;
  }

  // Direct URL to an industry module: load the correct tenant/workspace headers.
  useEffect(() => {
    if (loading) return;
    const industryKey = pathname.startsWith("/activated-carbon")
      ? "activated-carbon"
      : pathname.startsWith("/automotive-oem")
        ? "automotive-oem"
        : null;
    if (!industryKey) return;

    const selection = getIndustrySelection(industryKey);
    if (!selection) return;

    const scope = resolveScopedTenantForIndustry(industryKey, user);
    const targetTenant = scope.tenant_code;
    const targetWorkspace = scope.workspace_code;
    if (!targetTenant) return;

    const tenantMismatch = context.tenant_code !== targetTenant;
    const workspaceMismatch =
      targetWorkspace && context.workspace_code !== targetWorkspace;

    if (tenantMismatch || workspaceMismatch) {
      void selectIndustryContext({
        tenant_code: targetTenant,
        workspace_code: targetWorkspace,
        industryKey
      });
    }
  }, [
    loading,
    pathname,
    context.tenant_code,
    context.workspace_code,
    selectIndustryContext,
    user
  ]);

  const onIndustryRoute =
    pathname.startsWith("/activated-carbon") ||
    pathname.startsWith("/automotive-oem");

  // Avoid blanking the whole module while tenant headers refresh.
  if (loading && !hasLoadedOnce.current && !onIndustryRoute) {
    return <ModuleLoading />;
  }

  const moduleCode = inferModuleCode(pathname, context);
  const LazyModule = moduleCode ? MODULE_LOADERS[moduleCode] : null;

  if (!LazyModule) {
    return <GenericCoreDashboard />;
  }

  if (moduleCode === "activated-carbon") {
    return <ActivatedCarbonRoutes />;
  }

  return (
    <Suspense fallback={<ModuleLoading />}>
      <LazyModule />
    </Suspense>
  );
}

export default IndustryModuleLoader;
