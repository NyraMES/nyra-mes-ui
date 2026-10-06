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
        feasibilityPath={`${base}/kiln-feed`}
        mastersPath={`${base}/masters`}
        emptyLotsHint="No open lots — release on Raw Material, charge the kiln on Kiln Feed, then generate routing here."
        stageEyebrow="Stage 04 · Lot Routing · Activated Carbon"
        showOemRoutingMaster={false}
        executionPath={`${base}/execution`}
      />
    </div>
  );
}
