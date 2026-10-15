import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "../../../auth/AuthContext";
import { AC_CAPABILITIES } from "../menu/activatedCarbonMenu";
import ActivatedCarbonLayout from "../ActivatedCarbonLayout";
import ActivatedCarbonDashboard from "../pages/ActivatedCarbonDashboard";
import { useAppContext } from "../../../context/AppContext";
import { isAcContextReady, resolveAcAppContext } from "../utils/acContextUtils";
import { canAccessAcMenuItem } from "../utils/acMenuAccess";
import { lazy, Suspense } from "react";
const RawMaterialPage = lazy(() => import("../pages/RawMaterialPage"));
const MastersPage = lazy(() => import("../pages/MastersPage"));
const DispatchPage = lazy(() => import("../pages/DispatchPage"));
const AcExecutionPage = lazy(() => import("../pages/AcExecutionPage"));
const ActivatedCarbonRoutingBuilderPage = lazy(
  () => import("../pages/ActivatedCarbonRoutingBuilderPage")
);
const AcReportsPage = lazy(() => import("../pages/AcReportsPage"));
const AcAdminPage = lazy(() => import("../pages/AcAdminPage"));
const BagTraceabilityPage = lazy(() => import("../pages/BagTraceabilityPage"));

function PageLoading() {
  return <p className="text-sm text-slate-300 py-8">Loading page…</p>;
}

function LazyPage({ children }) {
  return <Suspense fallback={<PageLoading />}>{children}</Suspense>;
}

function RoleRoute({ menuId, children }) {
  const { user } = useAuth() || {};
  if (!canAccessAcMenuItem(menuId, user?.roles || [], user)) {
    return <Navigate to="/activated-carbon/dashboard" replace />;
  }
  return children;
}

function CapabilityRoute({ capability, children }) {
  const { context, loading } = useAppContext();
  const resolved = resolveAcAppContext(context);
  if (capability) {
    if (!isAcContextReady(resolved, loading)) {
      return <PageLoading />;
    }
    const caps = new Set(resolved.enabled_capabilities || []);
    if (!caps.has(capability)) {
      return <Navigate to="/activated-carbon/dashboard" replace />;
    }
  }
  return children;
}

/**
 * Route paths are relative to App's /activated-carbon/* splat (RR v7).
 */
export default function ActivatedCarbonRoutes() {
  return (
    <Routes>
      <Route element={<ActivatedCarbonLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ActivatedCarbonDashboard />} />
        <Route path="kiln-telemetry" element={<Navigate to="/activated-carbon/dashboard" replace />} />
        <Route
          path="raw-material"
          element={
            <RoleRoute menuId="raw-material">
            <CapabilityRoute capability={AC_CAPABILITIES.RAW_MATERIAL_INWARD}>
              <LazyPage>
                <RawMaterialPage />
              </LazyPage>
            </CapabilityRoute>
            </RoleRoute>
          }
        />
        <Route
          path="raw-material-inward"
          element={<Navigate to="/activated-carbon/raw-material?tab=inward" replace />}
        />
        <Route
          path="kiln-feed"
          element={<Navigate to="/activated-carbon/execution" replace />}
        />
        <Route
          path="raw-material-qc"
          element={<Navigate to="/activated-carbon/raw-material?tab=release" replace />}
        />
        <Route
          path="bag-tracing"
          element={
            <RoleRoute menuId="bag-tracing">
            <CapabilityRoute capability={AC_CAPABILITIES.BAG_TRACING}>
              <LazyPage>
                <BagTraceabilityPage />
              </LazyPage>
            </CapabilityRoute>
            </RoleRoute>
          }
        />
        <Route
          path="reports"
          element={
            <RoleRoute menuId="reports">
            <CapabilityRoute capability={AC_CAPABILITIES.REPORTS}>
              <LazyPage>
                <AcReportsPage />
              </LazyPage>
            </CapabilityRoute>
            </RoleRoute>
          }
        />
        <Route
          path="routing-builder"
          element={
            <RoleRoute menuId="routing-builder">
            <LazyPage>
              <ActivatedCarbonRoutingBuilderPage />
            </LazyPage>
            </RoleRoute>
          }
        />
        <Route
          path="routing"
          element={<Navigate to="/activated-carbon/execution" replace />}
        />
        <Route
          path="feasibility"
          element={<Navigate to="/activated-carbon/execution" replace />}
        />
        <Route
          path="execution"
          element={
            <RoleRoute menuId="execution">
            <LazyPage>
              <AcExecutionPage />
            </LazyPage>
            </RoleRoute>
          }
        />
        <Route
          path="screening"
          element={<Navigate to="/activated-carbon/execution" replace />}
        />
        <Route
          path="quality-testing"
          element={<Navigate to="/activated-carbon/execution" replace />}
        />
        <Route
          path="kiln-parameters"
          element={<Navigate to="/activated-carbon/execution?stage=activation&tab=kiln-parameters" replace />}
        />
        <Route
          path="yield-analysis"
          element={<Navigate to="/activated-carbon/dashboard" replace />}
        />
        <Route
          path="traceability"
          element={<Navigate to="/activated-carbon/dashboard" replace />}
        />
        <Route
          path="admin"
          element={
            <RoleRoute menuId="admin">
            <LazyPage>
              <AcAdminPage />
            </LazyPage>
            </RoleRoute>
          }
        />
        <Route
          path="users"
          element={<Navigate to="/activated-carbon/admin?tab=users" replace />}
        />
        <Route
          path="masters"
          element={
            <RoleRoute menuId="masters">
            <LazyPage>
              <MastersPage />
            </LazyPage>
            </RoleRoute>
          }
        />
        <Route path="customer-sales" element={<Navigate to="/activated-carbon/admin?tab=work-orders" replace />} />
        <Route
          path="dispatch"
          element={
            <RoleRoute menuId="dispatch">
            <LazyPage>
              <DispatchPage />
            </LazyPage>
            </RoleRoute>
          }
        />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}
