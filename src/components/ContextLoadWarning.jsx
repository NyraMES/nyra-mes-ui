import { useAppContext } from "../context/AppContext";

/**
 * Non-blocking banner when GET /api/context failed — UI keeps working.
 */
function ContextLoadWarning({ className = "" }) {
  const { context, loading } = useAppContext();

  if (loading || !context.fromFallback) {
    return null;
  }

  return (
    <div
      className={`context-load-warning ${className}`}
      role="status"
      title={context.loadError || undefined}
    >
      <span className="context-load-warning-icon" aria-hidden>
        ⚠
      </span>
      <span>
        Workspace context unavailable — showing generic view.
        {context.loadError ? ` (${context.loadError})` : ""}
      </span>
    </div>
  );
}

export default ContextLoadWarning;
