import { useEffect, useRef, useSyncExternalStore } from "react";

import { useAuth } from "../auth/AuthContext";
import { useAppContext } from "../context/AppContext";
import {
  getIndustrySelection,
  industryKeyForTenantCode
} from "../config/industrySelection";
import { resolvePlantScopeForIndustry } from "../config/hostConfig";

/** Track SPA navigations without requiring React Router context. */
function subscribePathname(onChange) {
  const notify = () => onChange();
  window.addEventListener("popstate", notify);
  const { pushState, replaceState } = history;
  history.pushState = function (...args) {
    pushState.apply(this, args);
    notify();
  };
  history.replaceState = function (...args) {
    replaceState.apply(this, args);
    notify();
  };
  return () => {
    window.removeEventListener("popstate", notify);
    history.pushState = pushState;
    history.replaceState = replaceState;
  };
}

function getPathname() {
  return window.location.pathname || "";
}

function usePathname() {
  return useSyncExternalStore(subscribePathname, getPathname, () => "");
}

/**
 * After Cognito sign-in, align X-Tenant-Code headers with custom:tenant_code
 * so /api/context and industry APIs do not return 403 for admin users.
 */
export default function TenantContextSync() {
  const { authEnabled, isAuthenticated, user, loading: authLoading } = useAuth();
  const { selectIndustryContext, context } = useAppContext();
  const pathname = usePathname();
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!authEnabled || authLoading || !isAuthenticated || !user?.tenant_code) {
      return;
    }

    const path = pathname || "";
    let industryKey = industryKeyForTenantCode(user.tenant_code);
    if (path.includes("/activated-carbon")) industryKey = "activated-carbon";
    else if (path.includes("/chemical")) industryKey = "chemical";
    else if (path.includes("/automotive-oem") || path.includes("/workflow")) {
      industryKey = "automotive-oem";
    }

    const scope = resolvePlantScopeForIndustry(industryKey, user);
    const targetTenant = scope.tenant_code;
    const targetWorkspace = scope.workspace_code;

    const needsSync =
      context.tenant_code !== targetTenant ||
      (targetWorkspace && context.workspace_code !== targetWorkspace) ||
      context.fromFallback ||
      (industryKey &&
        context.module_code &&
        getIndustrySelection(industryKey)?.module_code !== context.module_code);

    if (!needsSync || syncingRef.current) return;

    syncingRef.current = true;
    void selectIndustryContext({
      tenant_code: targetTenant,
      workspace_code: targetWorkspace,
      industryKey: industryKey || undefined
    }).finally(() => {
      syncingRef.current = false;
    });
  }, [
    authEnabled,
    authLoading,
    isAuthenticated,
    user?.tenant_code,
    pathname,
    context.tenant_code,
    context.workspace_code,
    context.fromFallback,
    selectIndustryContext
  ]);

  return null;
}
