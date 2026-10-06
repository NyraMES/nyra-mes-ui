import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import {
  getIndustrySelection,
  industryKeyForTenantCode,
  mergeIndustrySelectionFallback,
  resolveScopedTenantForIndustry
} from "../config/industrySelection";
import { resolvePlantScopeForIndustry } from "../config/hostConfig";
import api from "../services/api";
import {
  DEFAULT_APP_CONTEXT,
  applyTenantHeaders,
  fetchAppContext
} from "../services/appContextApi";
import { resolveAcAppContext } from "../industries/activated-carbon/utils/acContextUtils";
import { resolveChemAppContext } from "../industries/chemical/utils/chemContextUtils";
import { resolveDefaultWorkspaceCode } from "../services/mesCorePaths";

const AppContext = createContext(null);

/** True on the public marketing landing (e.g. /mes/ or /) before sign-in. */
function isPublicLandingPath(pathname = "") {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  const base = String(import.meta.env.VITE_BASE_PATH || "/").replace(/\/+$/, "") || "/";
  if (base !== "/") {
    return path === base;
  }
  return path === "/";
}

function resolveInitialContextScope(user, pathname = "") {
  const industryKey =
    (pathname.includes("/activated-carbon") && "activated-carbon") ||
    (pathname.includes("/chemical") && "chemical") ||
    ((pathname.includes("/automotive-oem") || pathname.includes("/workflow")) &&
      "automotive-oem") ||
    industryKeyForTenantCode(user?.tenant_code) ||
    null;

  const hostScope = resolvePlantScopeForIndustry(industryKey, user);
  if (hostScope?.tenant_code) {
    return hostScope;
  }

  if (user?.tenant_code && industryKey) {
    const scoped = resolveScopedTenantForIndustry(industryKey, user);
    if (scoped.tenant_code) {
      return scoped;
    }
  }

  if (user?.tenant_code) {
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

  if (typeof pathname === "string" && pathname.includes("/chemical")) {
    return resolveScopedTenantForIndustry("chemical", user);
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

    if (authEnabled && !isAuthenticated && isPublicLandingPath(pathname)) {
      const publicContext = {
        ...DEFAULT_APP_CONTEXT,
        fromFallback: false,
        loadError: null,
        loaded: false
      };
      setContext(publicContext);
      applyTenantHeaders(api, publicContext);
      setLoading(false);
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
        let next = await fetchAppContext(api, envScope);
        if (pathname.includes("/activated-carbon")) {
          next = resolveAcAppContext(next);
        }
        if (pathname.includes("/chemical")) {
          next = resolveChemAppContext(next);
        }
        if (!active) return;
        setContext(next);
        applyTenantHeaders(api, next);
      } catch {
        if (!active) return;
        const envScope = resolveInitialContextScope(
          isAuthenticated ? user : null,
          pathname
        );
        let fallback = {
          ...DEFAULT_APP_CONTEXT,
          tenant_code: envScope.tenant_code || null,
          workspace_code: envScope.workspace_code || null,
          fromFallback: true,
          loadError: "Context API unavailable",
          loaded: Boolean(envScope.tenant_code)
        };
        if (pathname.includes("/activated-carbon")) {
          fallback = resolveAcAppContext(fallback);
        }
        if (pathname.includes("/chemical")) {
          fallback = resolveChemAppContext(fallback);
        }
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
          : resolvePlantScopeForIndustry(industryKey, user);
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

        if (selection && industryKey) {
          const moduleMismatch =
            next.module_code && next.module_code !== selection.module_code;
          if (next.fromFallback || !next.module_code || moduleMismatch) {
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
