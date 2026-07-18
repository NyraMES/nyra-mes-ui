import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext";
import { userHasAnyRole } from "./roles";
import { inferIndustryFromPath } from "../config/industrySelection";

export function ProtectedRoute({ roles = [] }) {
  const { isAuthenticated, loading, authEnabled, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-600">
        Checking session…
      </div>
    );
  }

  if (authEnabled && !isAuthenticated) {
    const industryKey = inferIndustryFromPath(location.pathname);
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname + location.search,
          industry: industryKey || undefined,
          fromLanding: Boolean(industryKey)
        }}
      />
    );
  }

  if (roles.length > 0 && !userHasAnyRole(user?.roles || [], roles)) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6 text-center">
          <div className="text-lg font-semibold text-amber-100">Access denied</div>
          <p className="mt-2 text-sm text-amber-100/80">
            Your account does not have permission for this screen.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;
