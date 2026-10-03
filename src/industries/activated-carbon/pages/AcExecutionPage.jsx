import ExecutionScreen from "../../../workflow/pages/ExecutionScreen";
import AcActivationProductionFlow from "../components/AcActivationProductionFlow";

/**
 * Activated carbon unified shop-floor execution — route on the right, current step in the center.
 */
export default function AcExecutionPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <AcActivationProductionFlow activeStepId="execution" />
      <ExecutionScreen variant="ac-unified" />
    </div>
  );
}
