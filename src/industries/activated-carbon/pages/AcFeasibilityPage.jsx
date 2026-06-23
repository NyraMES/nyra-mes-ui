import { useCallback, useState } from "react";

import { useAppContext } from "../../../context/AppContext";
import FeasibilityScreen from "../../../workflow/pages/FeasibilityScreen";
import { useWorkflow } from "../../../workflow/WorkflowContext";
import {
  fetchAcFeasibilityLots,
  runAcFeasibilityCheck
} from "../../../services/activatedCarbonApi";
import AcReleaseToProductionPanel from "../components/AcReleaseToProductionPanel";
import { isAcContextReady } from "../utils/acContextUtils";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

/**
 * Activated carbon feasibility — after raw material QC, before kiln feed and lot routing.
 */
function AcFeasibilityPage() {
  const { context, loading: contextLoading } = useAppContext();
  const { update: updateWorkflow } = useWorkflow();
  const [lotRefreshKey, setLotRefreshKey] = useState(0);
  const [newLotCode, setNewLotCode] = useState("");
  const contextReady = isAcContextReady(context, contextLoading);

  const loadLots = useCallback(async () => {
    void lotRefreshKey;
    return fetchAcFeasibilityLots();
  }, [lotRefreshKey]);

  const handleReleased = ({ lotCode, result }) => {
    if (lotCode) {
      setNewLotCode(lotCode);
      updateWorkflow({
        lotId: lotCode,
        orderId: result?.order?.order_code,
        productionOrderId:
          result?.production_order?.production_order_code ||
          result?.production_order?.production_order_id
      });
    }
    setLotRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <AcReleaseToProductionPanel onReleased={handleReleased} />

      {contextReady ? (
        <FeasibilityScreen
          key={`${lotRefreshKey}-${newLotCode}`}
          runCheck={runAcFeasibilityCheck}
          loadLots={loadLots}
          initialLotId={newLotCode || undefined}
          machineLabel="Kiln"
          machineHint="Activation kiln available and assigned on routing steps"
          afterPassHint="Feasibility passed — continue to Kiln Feed to charge the activation kiln."
          afterPassPath="/activated-carbon/kiln-feed"
          afterPassLabel="Proceed to Kiln Feed →"
        />
      ) : (
        <WfCard>
          <WfCardBody>
            <p className="text-sm text-slate-600">Loading plant context…</p>
          </WfCardBody>
        </WfCard>
      )}

      <WfCard className="border-blue-200 bg-blue-50/30">
        <WfCardHeader
          title="What feasibility checks"
          subtitle="Each card above reads live data from the database for the selected lot."
        />
        <WfCardBody>
          <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
            <li>
              After <strong>Release to production</strong>, pick the new <strong>lot code</strong>{" "}
              (e.g. LOT-AC-2) in the dropdown below — it shows the linked inward order (e.g.
              ORD-AC-3).
            </li>
            <li>
              <strong>Material</strong> — production order linked to QC-passed supplier inward.
            </li>
            <li>
              <strong>Kiln</strong> — kiln resources and equipment master, plus machine assignment
              on each routing operation.
            </li>
            <li>
              <strong>Tool / Workforce / Routing / Schedule</strong> — plant capacity before the
              kiln is charged.
            </li>
            <li>
              When all cards show <strong>Available</strong>, continue to{" "}
              <strong>Kiln Feed</strong>, then <strong>Lot Routing</strong>.
            </li>
          </ul>
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default AcFeasibilityPage;
