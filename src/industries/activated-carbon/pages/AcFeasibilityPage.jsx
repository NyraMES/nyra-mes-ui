import FeasibilityScreen from "../../../workflow/pages/FeasibilityScreen";
import { fetchAcFeasibilityLots, runAcFeasibilityCheck } from "../../../services/activatedCarbonApi";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

/**
 * Activated carbon feasibility — run after kiln feed, before lot routing.
 */
function AcFeasibilityPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <FeasibilityScreen
        runCheck={runAcFeasibilityCheck}
        loadLots={fetchAcFeasibilityLots}
        machineLabel="Kiln"
        machineHint="Activation kiln available and assigned on routing steps"
      />

      <WfCard className="border-blue-200 bg-blue-50/30">
        <WfCardHeader
          title="What feasibility checks"
          subtitle="Each card above reads live data from the database for the selected lot."
        />
        <WfCardBody>
          <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
            <li>
              <strong>Material</strong> — customer order + raw material QC on the PO linked to
              this lot (<code className="text-xs">trn.customer_order.metadata</code>).
            </li>
            <li>
              <strong>Kiln</strong> — kiln resources and equipment master, plus machine
              assignment on each routing operation (
              <code className="text-xs">mst.resource</code>,{" "}
              <code className="text-xs">mst.operation_resource_requirement</code>).
            </li>
            <li>
              <strong>Tool</strong> — tool pool and per-operation TOOL requirements (
              <code className="text-xs">mst.resource</code>, type TOOL).
            </li>
            <li>
              <strong>Workforce</strong> — labor pools and per-operation LABOR requirements (
              <code className="text-xs">mst.resource</code>, type LABOR).
            </li>
            <li>
              <strong>Routing</strong> — active product routing and operations for the finished
              product on the PO (<code className="text-xs">mst.routing</code>,{" "}
              <code className="text-xs">mst.routing_operation</code>).
            </li>
            <li>
              <strong>Schedule</strong> — whether another lot already holds the kiln time slot (
              <code className="text-xs">exec.operation_execution</code> schedule metadata).
            </li>
            <li>
              When all cards show <strong>Available</strong>, continue to <strong>Lot Routing</strong>.
            </li>
          </ul>
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default AcFeasibilityPage;
