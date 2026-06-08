import { Navigate, Route, Routes } from "react-router-dom";

import { AC_CAPABILITIES } from "../menu/activatedCarbonMenu";
import ActivatedCarbonLayout from "../ActivatedCarbonLayout";
import ActivatedCarbonDashboard from "../pages/ActivatedCarbonDashboard";
import { useAppContext } from "../../../context/AppContext";
import { isAcContextReady } from "../utils/acContextUtils";
import { lazy, Suspense } from "react";
const RawMaterialInwardPage = lazy(() => import("../pages/RawMaterialInwardPage"));
const KilnFeedPage = lazy(() => import("../pages/KilnFeedPage"));
const KilnParametersPage = lazy(() => import("../pages/KilnParametersPage"));
const YieldAnalysisPage = lazy(() => import("../pages/YieldAnalysisPage"));
const TraceabilityPage = lazy(() => import("../pages/TraceabilityPage"));
const MastersPage = lazy(() => import("../pages/MastersPage"));
const DispatchPage = lazy(() => import("../pages/DispatchPage"));
const CustomerSalesPage = lazy(() => import("../pages/CustomerSalesPage"));
const FeasibilityScreen = lazy(() => import("../pages/AcFeasibilityPage"));
const ExecutionScreen = lazy(() => import("../../../workflow/pages/ExecutionScreen"));
const AcRoutingPage = lazy(() => import("../pages/AcRoutingPage"));
const ActivatedCarbonRoutingBuilderPage = lazy(
  () => import("../pages/ActivatedCarbonRoutingBuilderPage")
);
const RawMaterialQcPage = lazy(() => import("../pages/RawMaterialQcPage"));
const QualityTestingPage = lazy(() => import("../pages/QualityTestingPage"));

function PageLoading() {
  return <p className="text-sm text-slate-300 py-8">Loading page…</p>;
}

function LazyPage({ children }) {
  return <Suspense fallback={<PageLoading />}>{children}</Suspense>;
}

function CapabilityRoute({ capability, children }) {
  const { context, loading } = useAppContext();
  if (capability) {
    if (!isAcContextReady(context, loading)) {
      return <PageLoading />;
    }
    const caps = new Set(context.enabled_capabilities || []);
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
          path="raw-material-inward"
          element={
            <CapabilityRoute capability={AC_CAPABILITIES.RAW_MATERIAL_INWARD}>
              <LazyPage>
                <RawMaterialInwardPage />
              </LazyPage>
            </CapabilityRoute>
          }
        />
        <Route
          path="kiln-feed"
          element={
            <CapabilityRoute capability={AC_CAPABILITIES.KILN_FEED}>
              <LazyPage>
                <KilnFeedPage />
              </LazyPage>
            </CapabilityRoute>
          }
        />
        <Route
          path="raw-material-qc"
          element={
            <CapabilityRoute capability={AC_CAPABILITIES.RAW_MATERIAL_QC}>
              <LazyPage>
                <RawMaterialQcPage />
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
              <ExecutionScreen />
            </LazyPage>
          }
        />
        <Route
          path="screening"
          element={<Navigate to="execution" replace />}
        />
        <Route
          path="quality-testing"
          element={
            <CapabilityRoute capability={AC_CAPABILITIES.QUALITY_TESTING}>
              <LazyPage>
                <QualityTestingPage />
              </LazyPage>
            </CapabilityRoute>
          }
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
            <CapabilityRoute capability={AC_CAPABILITIES.DISPATCH}>
              <LazyPage>
                <DispatchPage />
              </LazyPage>
            </CapabilityRoute>
          }
        />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}
