import { useAppContext } from "../context/AppContext";

/**
 * Displays tenant, industry template, and workspace from Nyra MES Core context API.
 * Works in both legacy (topbar) and workflow layouts.
 */
function TenantContextBar({ className = "", compact = false }) {
  const { context, loading } = useAppContext();

  const tenant = context.tenant_display_name || context.tenant_name || "Demo Plant";
  const industryTemplate =
    context.industry_template_name ||
    context.template_display_name ||
    context.template_name ||
    "Industry Template";
  const workspace =
    context.workspace_name || context.workspace_code || "—";

  if (compact) {
    return (
      <div
        className={`hidden lg:flex flex-col text-left leading-tight min-w-0 ${className}`}
        title={`Tenant: ${tenant}\nIndustry Template: ${industryTemplate}\nWorkspace: ${workspace}`}
      >
        <span className="text-[10px] uppercase tracking-wider text-slate-500 truncate">
          Tenant:{" "}
          <span className="font-medium text-slate-700">
            {loading ? "…" : tenant}
          </span>
        </span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 truncate">
          Industry Template:{" "}
          <span className="font-medium text-slate-700">
            {loading ? "…" : industryTemplate}
          </span>
        </span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 truncate">
          Workspace:{" "}
          <span className="font-medium text-slate-700">
            {loading ? "…" : workspace}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className={`mes-context-bar ${className}`}>
      <div className="mes-context-line">
        <span className="mes-context-label">Tenant:</span>
        <span className="mes-context-value">{loading ? "Loading…" : tenant}</span>
      </div>
      <div className="mes-context-line">
        <span className="mes-context-label">Industry Template:</span>
        <span className="mes-context-value">
          {loading ? "Loading…" : industryTemplate}
        </span>
      </div>
      <div className="mes-context-line">
        <span className="mes-context-label">Workspace:</span>
        <span className="mes-context-value">{loading ? "Loading…" : workspace}</span>
      </div>
      {context.fromFallback && !loading && (
        <div className="mes-context-fallback" title={context.loadError || undefined}>
          Offline context
        </div>
      )}
    </div>
  );
}

export default TenantContextBar;
