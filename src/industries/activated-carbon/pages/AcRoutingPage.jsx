import useIndustryBasePath from "../../../hooks/useIndustryBasePath";
import {
  fetchAcRoutingPlan,
  fetchAcRoutingLots,
  generateAcRoute
} from "../../../services/activatedCarbonApi";
import RoutingFlow from "../../../workflow/pages/RoutingFlow";

export default function AcRoutingPage() {
  const base = useIndustryBasePath();

  return (
    <div className="space-y-6">
      <RoutingFlow
        loadPlan={fetchAcRoutingPlan}
        generatePlan={generateAcRoute}
        loadLots={fetchAcRoutingLots}
        feasibilityPath={`${base}/feasibility`}
        mastersPath={`${base}/masters`}
        emptyLotsHint="No lots yet — create kiln feed batches first, then run Feasibility Gate."
        stageEyebrow="Stage 05 · Lot Routing · Activated Carbon"
        showOemRoutingMaster={false}
        feasibilityFirst
        executionPath={`${base}/execution`}
      />
    </div>
  );
}
