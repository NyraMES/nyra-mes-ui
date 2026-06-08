import { useEffect, useRef, useSyncExternalStore } from "react";

import { useAuth } from "../auth/AuthContext";
import { useAppContext } from "../context/AppContext";
import {
  industryKeyForTenantCode,
  resolveScopedTenantForIndustry
} from "../config/industrySelection";

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

    const tenantCode = String(user.tenant_code).trim();
    const workspaceCode = resolveScopedTenantForIndustry(
      industryKeyForTenantCode(tenantCode) || "activated-carbon",
      user
    ).workspace_code;

    const path = pathname || "";
    let industryKey = industryKeyForTenantCode(tenantCode);
    if (path.includes("/activated-carbon")) industryKey = "activated-carbon";
    else if (path.includes("/automotive-oem") || path.includes("/workflow")) {
      industryKey = "automotive-oem";
    }

    const needsSync =
      context.tenant_code !== tenantCode ||
      (workspaceCode && context.workspace_code !== workspaceCode) ||
      context.fromFallback;

    if (!needsSync || syncingRef.current) return;

    syncingRef.current = true;
    void selectIndustryContext({
      tenant_code: tenantCode,
      workspace_code: workspaceCode,
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
