import { Navigate, Route, Routes } from "react-router-dom";

import { AC_CAPABILITIES } from "../menu/activatedCarbonMenu";
import ActivatedCarbonLayout from "../ActivatedCarbonLayout";
import ActivatedCarbonDashboard from "../pages/ActivatedCarbonDashboard";
import { useAppContext } from "../../../context/AppContext";
import { isAcContextReady, resolveAcAppContext } from "../utils/acContextUtils";
import { lazy, Suspense } from "react";
const RawMaterialPage = lazy(() => import("../pages/RawMaterialPage"));
const KilnParametersPage = lazy(() => import("../pages/KilnParametersPage"));
const YieldAnalysisPage = lazy(() => import("../pages/YieldAnalysisPage"));
const TraceabilityPage = lazy(() => import("../pages/TraceabilityPage"));
const MastersPage = lazy(() => import("../pages/MastersPage"));
const DispatchPage = lazy(() => import("../pages/DispatchPage"));
const CustomerSalesPage = lazy(() => import("../pages/CustomerSalesPage"));
const FeasibilityScreen = lazy(() => import("../pages/AcFeasibilityPage"));
const AcExecutionPage = lazy(() => import("../pages/AcExecutionPage"));
const ActivatedCarbonRoutingBuilderPage = lazy(
  () => import("../pages/ActivatedCarbonRoutingBuilderPage")
);
const AcReportsPage = lazy(() => import("../pages/AcReportsPage"));
const BagTraceabilityPage = lazy(() => import("../pages/BagTraceabilityPage"));
const KilnTelemetryPage = lazy(() => import("../pages/KilnTelemetryPage"));
const KilnFeedPage = lazy(() => import("../pages/KilnFeedPage"));
const AcRoutingPage = lazy(() => import("../pages/AcRoutingPage"));

function PageLoading() {
  return <p className="text-sm text-slate-300 py-8">Loading page…</p>;
}

function LazyPage({ children }) {
  return <Suspense fallback={<PageLoading />}>{children}</Suspense>;
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
        <Route
          path="kiln-telemetry"
          element={
            <LazyPage>
              <KilnTelemetryPage />
            </LazyPage>
          }
        />
        <Route
          path="raw-material"
          element={
            <CapabilityRoute capability={AC_CAPABILITIES.RAW_MATERIAL_INWARD}>
              <LazyPage>
                <RawMaterialPage />
              </LazyPage>
            </CapabilityRoute>
          }
        />
        <Route
          path="raw-material-inward"
          element={<Navigate to="/activated-carbon/raw-material?tab=inward" replace />}
        />
        <Route
          path="kiln-feed"
          element={
            <LazyPage>
              <KilnFeedPage />
            </LazyPage>
          }
        />
        <Route
          path="raw-material-qc"
          element={<Navigate to="/activated-carbon/raw-material?tab=release" replace />}
        />
        <Route
          path="bag-tracing"
          element={
            <CapabilityRoute capability={AC_CAPABILITIES.BAG_TRACING}>
              <LazyPage>
                <BagTraceabilityPage />
              </LazyPage>
            </CapabilityRoute>
          }
        />
        <Route
          path="reports"
          element={
            <CapabilityRoute capability={AC_CAPABILITIES.REPORTS}>
              <LazyPage>
                <AcReportsPage />
              </LazyPage>
            </CapabilityRoute>
          }
        />
        <Route
          path="routing-builder"
          element={
            <LazyPage>
              <ActivatedCarbonRoutingBuilderPage />
            </LazyPage>
          }
        />
        <Route
          path="routing"
          element={
            <LazyPage>
              <AcRoutingPage />
            </LazyPage>
          }
        />
        <Route
          path="feasibility"
          element={
            <LazyPage>
              <FeasibilityScreen />
            </LazyPage>
          }
        />
        <Route
          path="execution"
          element={
            <LazyPage>
              <AcExecutionPage />
            </LazyPage>
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
          element={
            <CapabilityRoute capability={AC_CAPABILITIES.HOURLY_KILN_PARAMETERS}>
              <LazyPage>
                <KilnParametersPage />
              </LazyPage>
            </CapabilityRoute>
          }
        />
        <Route
          path="yield-analysis"
          element={
            <CapabilityRoute capability={AC_CAPABILITIES.YIELD_ANALYSIS}>
              <LazyPage>
                <YieldAnalysisPage />
              </LazyPage>
            </CapabilityRoute>
          }
        />
        <Route
          path="traceability"
          element={
            <CapabilityRoute capability={AC_CAPABILITIES.TRACEABILITY}>
              <LazyPage>
                <TraceabilityPage />
              </LazyPage>
            </CapabilityRoute>
          }
        />
        <Route
          path="masters"
          element={
            <LazyPage>
              <MastersPage />
            </LazyPage>
          }
        />
        <Route
          path="customer-sales"
          element={
            <LazyPage>
              <CustomerSalesPage />
            </LazyPage>
          }
        />
        <Route
          path="dispatch"
          element={
            <LazyPage>
              <DispatchPage />
            </LazyPage>
          }
        />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}
