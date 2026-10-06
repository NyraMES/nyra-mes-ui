import ExecutionScreen from "../../../workflow/pages/ExecutionScreen";

/**
 * Activated carbon unified shop-floor execution — kiln feed first.
 */
export default function AcExecutionPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <ExecutionScreen variant="ac-unified" />
    </div>
  );
}
