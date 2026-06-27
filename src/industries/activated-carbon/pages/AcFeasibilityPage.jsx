import { useCallback } from "react";

import { useAuth } from "../../../auth/AuthContext";
import { useAppContext } from "../../../context/AppContext";
import FeasibilityScreen from "../../../workflow/pages/FeasibilityScreen";
import {
  fetchAcFeasibilityLots,
  runAcFeasibilityCheck
} from "../../../services/activatedCarbonApi";
import { isAcContextReady } from "../utils/acContextUtils";
import { userIsAcDemoViewer } from "../utils/acMenuAccess";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

/**
 * Activated carbon feasibility — lots released to production, before shop-floor execution.
 */
function AcFeasibilityPage() {
  const { context, loading: contextLoading } = useAppContext();
  const { user } = useAuth();
  const readOnly = userIsAcDemoViewer(user?.roles || []);
  const contextReady = isAcContextReady(context, contextLoading);

  const loadLots = useCallback(async () => fetchAcFeasibilityLots(), []);

  return (
    <div className="space-y-6 max-w-6xl">
      {contextReady ? (
        <FeasibilityScreen
          readOnly={readOnly}
          runCheck={runAcFeasibilityCheck}
          loadLots={loadLots}
          machineLabel="Kiln"
          machineHint="Activation kiln available and assigned on routing steps"
          afterPassHint="Feasibility passed — the shop-floor route is generated automatically. Continue to Execution to run each process step."
          afterPassPath="/activated-carbon/execution"
          afterPassLabel="Proceed to Execution →"
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
          subtitle="Each card reads live data from the database for the selected production lot."
        />
        <WfCardBody>
          <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
            <li>
              Lots listed here were <strong>released to production</strong> and have not started
              shop-floor execution yet.
            </li>
            <li>
              Pick a <strong>lot code</strong> (e.g. LOT-AC-2) — the label shows the linked inward
              order (e.g. ORD-AC-3).
            </li>
            <li>
              <strong>Material</strong> — production order linked to QC-passed supplier inward.
            </li>
            <li>
              <strong>Kiln</strong> — kiln resources and equipment master, plus machine assignment
              on each routing operation.
            </li>
            <li>
              When all cards show <strong>Available</strong>, continue to{" "}
              <strong>Execution</strong> — kiln feed, screening, and quality testing run as
              process steps there.
            </li>
          </ul>
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default AcFeasibilityPage;
