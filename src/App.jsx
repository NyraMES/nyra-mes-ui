import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./auth/ProtectedRoute";
import DemoRouteGuard from "./components/DemoRouteGuard";
import { ROUTER_BASENAME } from "./basePath";
import Layout from "./components/Layout";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";

import CustomerPage from "./pages/CustomerPage";
import PartPage from "./pages/PartPage";

import OrdersPage from "./pages/OrdersPage";
import ProductionPage from "./pages/ProductionPage";
import LotExecutionPage from "./pages/LotExecutionPage";
import QualityPage from "./pages/QualityPage";
import MaintenancePage from "./pages/MaintenancePage";
import DispatchPage from "./pages/DispatchPage";

import MesDashboard from "./pages/MesDashboard";
import ProcessLibrary from "./pages/ProcessLibrary";
import MesPartMaster from "./pages/PartMaster";
import RouteEntry from "./pages/RouteEntry";
import WorkOrderDataCapture from "./pages/WorkOrderDataCapture";

// Workflow Intelligence layer
import WorkflowLayout from "./workflow/WorkflowLayout";
import IntelligenceHub from "./workflow/pages/IntelligenceHub";
import CustomerOrderWorkflow from "./workflow/pages/CustomerOrderWorkflow";
import ProductionOrderWorkflow from "./workflow/pages/ProductionOrderWorkflow";
import LotSplitWorkflow from "./workflow/pages/LotSplitWorkflow";
import RoutingFlow from "./workflow/pages/RoutingFlow";
import FeasibilityScreen from "./workflow/pages/FeasibilityScreen";
import SchedulingBoard from "./workflow/pages/SchedulingBoard";
import ExecutionScreen from "./workflow/pages/ExecutionScreen";
import InspectionNcrScreen from "./workflow/pages/InspectionNcrScreen";
import DispatchGate from "./workflow/pages/DispatchGate";
import TraceabilityGenealogy from "./workflow/pages/TraceabilityGenealogy";
import OeeDashboard from "./workflow/pages/OeeDashboard";
import OntologyExplorer from "./workflow/pages/OntologyExplorer";
import KgTriplesPage from "./workflow/pages/KgTriplesPage";
import CustomerMaster from "./workflow/pages/CustomerMaster";
import PartMaster from "./workflow/pages/PartMaster";
import RoutingMaster from "./workflow/pages/RoutingMaster";

import IndustryModuleLoader from "./components/IndustryModuleLoader";


function App() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DemoRouteGuard />}>
          {/* Metadata-driven industry modules (lazy-loaded) */}
          <Route path="/automotive-oem/*" element={<IndustryModuleLoader />} />
          <Route path="/activated-carbon/*" element={<IndustryModuleLoader />} />

          {/* Manufacturing Workflow Intelligence experience */}
          <Route path="/workflow" element={<WorkflowLayout />}>
            <Route index element={<IntelligenceHub />} />
            <Route path="customer-order" element={<CustomerOrderWorkflow />} />
            <Route path="production-order" element={<ProductionOrderWorkflow />} />
            <Route path="lot-split" element={<LotSplitWorkflow />} />
            <Route path="routing" element={<RoutingFlow />} />
            <Route path="feasibility" element={<FeasibilityScreen />} />
            <Route path="scheduling" element={<SchedulingBoard />} />
            <Route path="execution" element={<ExecutionScreen />} />
            <Route path="inspection" element={<InspectionNcrScreen />} />
            <Route path="dispatch" element={<DispatchGate />} />
            <Route path="traceability" element={<TraceabilityGenealogy />} />
            <Route path="oee" element={<OeeDashboard />} />
            <Route path="ontology" element={<OntologyExplorer />} />
            <Route path="kg" element={<KgTriplesPage />} />
            <Route path="masters/customers" element={<CustomerMaster />} />
            <Route path="masters/parts" element={<PartMaster />} />
            <Route path="masters/routings" element={<RoutingMaster />} />
          </Route>

          {/* Legacy redirects → unified Workflow Intelligence experience */}
          <Route path="masters/customers" element={<Navigate to="/workflow/masters/customers" replace />} />
          <Route path="masters/parts" element={<Navigate to="/workflow/masters/parts" replace />} />

          {/* Remaining legacy CRUD pages */}
          <Route element={<Layout />}>
            <Route path="dashboard" element={<MesDashboard />} />
            <Route path="process-library" element={<ProcessLibrary />} />
            <Route path="part-master" element={<MesPartMaster />} />
            <Route path="route-entry" element={<RouteEntry />} />
            <Route path="work-order-data-capture" element={<WorkOrderDataCapture />} />

            <Route path="masters/customers/legacy" element={<CustomerPage />} />
            <Route path="masters/parts/legacy" element={<PartPage />} />

            <Route path="orders" element={<OrdersPage />} />
            <Route path="production" element={<ProductionPage />} />
            <Route path="production/lot-execution" element={<LotExecutionPage />} />
            <Route path="quality" element={<QualityPage />} />
            <Route path="maintenance" element={<MaintenancePage />} />
            <Route path="dispatch" element={<DispatchPage />} />
          </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
