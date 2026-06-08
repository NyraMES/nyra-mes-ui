import { Navigate, Route, Routes } from "react-router-dom";

import ContextLoadWarning from "../../../components/ContextLoadWarning";
import WorkflowLayout from "../../../workflow/WorkflowLayout";
import IntelligenceHub from "../../../workflow/pages/IntelligenceHub";
import CustomerOrderWorkflow from "../../../workflow/pages/CustomerOrderWorkflow";
import ProductionOrderWorkflow from "../../../workflow/pages/ProductionOrderWorkflow";
import LotSplitWorkflow from "../../../workflow/pages/LotSplitWorkflow";
import RoutingFlow from "../../../workflow/pages/RoutingFlow";
import FeasibilityScreen from "../../../workflow/pages/FeasibilityScreen";
import SchedulingBoard from "../../../workflow/pages/SchedulingBoard";
import ExecutionScreen from "../../../workflow/pages/ExecutionScreen";
import InspectionNcrScreen from "../../../workflow/pages/InspectionNcrScreen";
import DispatchGate from "../../../workflow/pages/DispatchGate";
import TraceabilityGenealogy from "../../../workflow/pages/TraceabilityGenealogy";
import OeeDashboard from "../../../workflow/pages/OeeDashboard";
import OntologyExplorer from "../../../workflow/pages/OntologyExplorer";
import KgTriplesPage from "../../../workflow/pages/KgTriplesPage";
import CustomerMaster from "../../../workflow/pages/CustomerMaster";
import PartMaster from "../../../workflow/pages/PartMaster";
import RoutingMaster from "../../../workflow/pages/RoutingMaster";

/**
 * Automotive OEM industry module — wraps existing workflow pages under
 * /automotive-oem/* without modifying the original /workflow/* routes.
 */
export default function AutomotiveOemRoutes() {
  return (
    <>
      <ContextLoadWarning />
      <Routes>
        <Route element={<WorkflowLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<IntelligenceHub />} />
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
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </>
  );
}
