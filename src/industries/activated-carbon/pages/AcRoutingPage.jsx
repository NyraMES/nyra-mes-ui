import useIndustryBasePath from "../../../hooks/useIndustryBasePath";
import {
  fetchAcOpenLots,
  fetchAcRoutingPlan,
  generateAcRoute
} from "../../../services/activatedCarbonApi";
import AcActivationProductionFlow from "../components/AcActivationProductionFlow";
import RoutingFlow from "../../../workflow/pages/RoutingFlow";

export default function AcRoutingPage() {
  const base = useIndustryBasePath();

  return (
    <div className="space-y-6">
      <AcActivationProductionFlow activeStepId="routing" />
      <RoutingFlow
        loadPlan={fetchAcRoutingPlan}
        generatePlan={generateAcRoute}
        loadLots={fetchAcOpenLots}
        feasibilityPath={`${base}/feasibility`}
        mastersPath={`${base}/masters`}
        emptyLotsHint="No open lots — release on Raw Material, run Feasibility Gate, charge the kiln on Kiln Feed, then generate routing here."
        stageEyebrow="Stage 05 · Lot Routing · Activated Carbon"
        showOemRoutingMaster={false}
        feasibilityFirst
        executionPath={`${base}/execution`}
      />
    </div>
  );
}
