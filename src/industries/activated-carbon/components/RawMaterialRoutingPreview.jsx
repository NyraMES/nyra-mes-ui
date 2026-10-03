import { Link } from "react-router-dom";

import { AC_INBOUND_FIXED_END, AC_INBOUND_FIXED_START } from "../constants/acRawMaterialProcessCatalog";

function RawMaterialRoutingPreview({ materialType, compact = false }) {
  if (!materialType) {
    return (
      <p className="text-sm text-slate-600">
        Select a raw material type to view its fixed routing and parameters.
      </p>
    );
  }

  const inboundOps = materialType.inbound_operations || [];
  const operations = materialType.operations || [];
  const parameters = materialType.process_parameters || [];
  const inboundParams = parameters.filter(
    (p) => String(p.used_at || "").toLowerCase() === "inbound" || p.used_at === "inward"
  );
  const feasibilityParams = parameters.filter(
    (p) => p.used_at === "feasibility" || p.used_at === "both"
  );
  const executionParams = parameters.filter(
    (p) => p.used_at === "execution" || p.used_at === "both"
  );

  return (
    <div className={`wf-ac-routing-preview ${compact ? "wf-ac-routing-preview--compact" : ""}`}>
      <div className="wf-ac-routing-preview-header">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {materialType.product_code} — {materialType.product_name}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Produces{" "}
            <span className="font-mono">{materialType.finished_product_code}</span>
            {materialType.finished_product_name
              ? ` · ${materialType.finished_product_name}`
              : ""}{" "}
            via routing{" "}
            <span className="font-mono">{materialType.routing_code}</span>
          </div>
        </div>
        {!compact && (
          <Link to="/activated-carbon/masters" className="text-xs text-blue-700 hover:underline">
            Edit in Masters →
          </Link>
        )}
      </div>

      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mt-3 mb-1">
        After inward receipt (this page)
      </div>
      <div className="wf-ac-routing-flow">
        <div className="wf-ac-routing-flow-step">
          <span className="wf-ac-routing-flow-seq">✓</span>
          <span className="wf-ac-routing-flow-label">{AC_INBOUND_FIXED_START.operation_name}</span>
          <span className="wf-ac-routing-flow-arrow" aria-hidden="true">
            →
          </span>
        </div>
        {inboundOps.map((op, index) => (
          <div key={op.operation_code || `in${index}`} className="wf-ac-routing-flow-step">
            <span className="wf-ac-routing-flow-seq">{op.operation_sequence}</span>
            <span className="wf-ac-routing-flow-label">{op.operation_name}</span>
            <span className="wf-ac-routing-flow-arrow" aria-hidden="true">
              →
            </span>
          </div>
        ))}
        <div className="wf-ac-routing-flow-step">
          <span className="wf-ac-routing-flow-seq">QC</span>
          <span className="wf-ac-routing-flow-label">{AC_INBOUND_FIXED_END.operation_name}</span>
          <span className="wf-ac-routing-flow-arrow" aria-hidden="true">
            →
          </span>
        </div>
      </div>

      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mt-4 mb-1">
        After release to production
      </div>
      <div className="wf-ac-routing-flow">
        {operations.map((op, index) => (
          <div key={op.operation_code || index} className="wf-ac-routing-flow-step">
            <span className="wf-ac-routing-flow-seq">{op.operation_sequence}</span>
            <span className="wf-ac-routing-flow-label">{op.operation_name}</span>
            {index < operations.length - 1 && (
              <span className="wf-ac-routing-flow-arrow" aria-hidden="true">
                →
              </span>
            )}
          </div>
        ))}
      </div>

      {!compact && parameters.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {feasibilityParams.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Feasibility gate checks
              </div>
              <ul className="text-sm space-y-1">
                {feasibilityParams.map((p) => (
                  <li key={p.key} className="text-slate-700">
                    <span className="font-medium">{p.label}</span>
                    {p.default_value ? (
                      <span className="text-slate-500">
                        {" "}
                        (target {p.default_value}
                        {p.unit ? ` ${p.unit}` : ""})
                      </span>
                    ) : null}
                  </li>
                ))}
                <li className="text-slate-500 text-xs pt-1">+ kiln availability &amp; capacity</li>
              </ul>
            </div>
          )}
          {executionParams.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Execution parameters
              </div>
              <ul className="text-sm space-y-1">
                {executionParams.map((p) => (
                  <li key={p.key} className="text-slate-700">
                    {p.label}
                    {p.unit ? ` (${p.unit})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {compact && (
        <p className="text-xs text-slate-500 mt-2">
          {inboundOps.length} inbound prep · {operations.length} shop step(s) after release ·{" "}
          {inboundParams.length + executionParams.length} tracking field(s)
        </p>
      )}
    </div>
  );
}

export default RawMaterialRoutingPreview;
