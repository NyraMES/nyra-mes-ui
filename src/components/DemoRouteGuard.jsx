import { Navigate, Outlet, useLocation } from "react-router-dom";

import { isDemoBlockedPath, isDemoMode } from "../config/demoMode";
import { useAppContext } from "../context/AppContext";

/** Redirects sensitive legacy / ontology routes when demo mode is active. */
export default function DemoRouteGuard() {
  const { context, loading } = useAppContext();
  const location = useLocation();

  if (!loading && isDemoMode(context) && isDemoBlockedPath(location.pathname)) {
    return <Navigate to="/workflow" replace />;
  }

  return <Outlet />;
}
