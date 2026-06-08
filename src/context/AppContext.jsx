import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import {
  getIndustrySelection,
  industryKeyForTenantCode,
  mergeIndustrySelectionFallback,
  resolveScopedTenantForIndustry
} from "../config/industrySelection";
import { resolveAppHostBinding } from "../config/hostConfig";
import api from "../services/api";
import {
  DEFAULT_APP_CONTEXT,
  applyTenantHeaders,
  fetchAppContext
} from "../services/appContextApi";
import { resolveDefaultWorkspaceCode } from "../services/mesCorePaths";

const AppContext = createContext(null);

function resolveInitialContextScope(user, pathname = "") {
  const hostBinding = resolveAppHostBinding();
  if (hostBinding?.tenant_code) {
    return {
      tenant_code: hostBinding.tenant_code,
      workspace_code: hostBinding.workspace_code
    };
  }

  if (user?.tenant_code) {
    const industryKey =
      (pathname.includes("/activated-carbon") && "activated-carbon") ||
      ((pathname.includes("/automotive-oem") || pathname.includes("/workflow")) &&
        "automotive-oem") ||
      industryKeyForTenantCode(user.tenant_code) ||
      null;
    return resolveScopedTenantForIndustry(industryKey, user);
  }

  if (import.meta.env.VITE_TENANT_CODE) {
    return {
      tenant_code: import.meta.env.VITE_TENANT_CODE,
      workspace_code: import.meta.env.VITE_WORKSPACE_CODE || null
    };
  }

  if (typeof pathname === "string" && pathname.includes("/activated-carbon")) {
    return resolveScopedTenantForIndustry("activated-carbon", user);
  }

  return {};
}

export function AppProvider({ children }) {
  const { authEnabled, loading: authLoading, isAuthenticated, user } = useAuth();
  const [context, setContext] = useState(DEFAULT_APP_CONTEXT);
  const [loading, setLoading] = useState(true);

  const loadContext = useCallback(async (scope = {}) => {
    const next = await fetchAppContext(api, scope);
    setContext(next);
    applyTenantHeaders(api, next);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";

    if (authEnabled && authLoading) {
      setLoading(true);
      return () => {
        active = false;
      };
    }

    (async () => {
      setLoading(true);
      try {
        const envScope = resolveInitialContextScope(
          isAuthenticated ? user : null,
          pathname
        );
        const next = await fetchAppContext(api, envScope);
        if (!active) return;
        setContext(next);
        applyTenantHeaders(api, next);
      } catch {
        if (!active) return;
        const envScope = resolveInitialContextScope(
          isAuthenticated ? user : null,
          pathname
        );
        const fallback = {
          ...DEFAULT_APP_CONTEXT,
          tenant_code: envScope.tenant_code || null,
          workspace_code: envScope.workspace_code || null,
          fromFallback: true,
          loadError: "Context API unavailable",
          loaded: Boolean(envScope.tenant_code)
        };
        setContext(fallback);
        applyTenantHeaders(api, fallback);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authEnabled, authLoading, isAuthenticated, user?.tenant_code]);

  const refreshContext = useCallback(
    async (scope = {}) => {
      setLoading(true);
      try {
        return await loadContext(scope);
      } catch {
        const envScope = {
          tenant_code: import.meta.env.VITE_TENANT_CODE || null,
          workspace_code: import.meta.env.VITE_WORKSPACE_CODE || null
        };
        const fallback = {
          ...DEFAULT_APP_CONTEXT,
          tenant_code: envScope.tenant_code,
          workspace_code: envScope.workspace_code,
          fromFallback: true,
          loadError: "Context API unavailable",
          loaded: Boolean(envScope.tenant_code)
        };
        setContext(fallback);
        applyTenantHeaders(api, fallback);
        return fallback;
      } finally {
        setLoading(false);
      }
    },
    [loadContext]
  );

  const selectIndustryContext = useCallback(
    async ({ tenant_code, workspace_code, industryKey } = {}) => {
      const scoped =
        tenant_code != null && String(tenant_code).trim()
          ? { tenant_code, workspace_code }
          : resolveScopedTenantForIndustry(industryKey, user);
      const resolvedTenant = scoped.tenant_code;
      const resolvedWorkspace =
        scoped.workspace_code ?? resolveDefaultWorkspaceCode(resolvedTenant);

      if (!resolvedTenant) {
        const fallback = mergeIndustrySelectionFallback(
          {
            ...DEFAULT_APP_CONTEXT,
            fromFallback: true,
            loadError: "Tenant is not configured for this industry module"
          },
          industryKey || ""
        );
        setContext(fallback);
        applyTenantHeaders(api, fallback);
        return fallback;
      }

      try {
        const next = await loadContext({
          tenant_code: resolvedTenant,
          workspace_code: resolvedWorkspace
        });
        const selection = industryKey ? getIndustrySelection(industryKey) : null;

        if (next.fromFallback && selection) {
          const merged = mergeIndustrySelectionFallback(
            {
              ...next,
              tenant_code: resolvedTenant || next.tenant_code,
              workspace_code: resolvedWorkspace ?? next.workspace_code
            },
            industryKey
          );
          setContext(merged);
          applyTenantHeaders(api, merged);
          return merged;
        }

        if (selection && !next.module_code) {
          const merged = {
            ...next,
            module_code: selection.module_code,
            landing_page: next.landing_page || selection.landing_path
          };
          setContext(merged);
          applyTenantHeaders(api, merged);
          return merged;
        }

        return next;
      } catch {
        const selection = industryKey ? getIndustrySelection(industryKey) : null;
        const fallback = mergeIndustrySelectionFallback(
          {
            ...DEFAULT_APP_CONTEXT,
            tenant_code: resolvedTenant || selection?.tenant_code || null,
            workspace_code: resolvedWorkspace ?? selection?.workspace_code ?? null,
            fromFallback: true,
            loadError: "Could not load industry context"
          },
          industryKey || ""
        );
        setContext(fallback);
        applyTenantHeaders(api, fallback);
        return fallback;
      }
    },
    [loadContext, user]
  );

  const value = useMemo(
    () => ({
      context,
      loading,
      refreshContext,
      selectIndustryContext
    }),
    [context, loading, refreshContext, selectIndustryContext]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    return {
      context: DEFAULT_APP_CONTEXT,
      loading: false,
      refreshContext: async () => DEFAULT_APP_CONTEXT,
      selectIndustryContext: async () => DEFAULT_APP_CONTEXT
    };
  }
  return ctx;
}

export default AppContext;
