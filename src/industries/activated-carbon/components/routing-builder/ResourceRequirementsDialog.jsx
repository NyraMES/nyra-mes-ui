import { useEffect, useMemo, useState } from "react";

const REQUIREMENT_ROWS = [
  { type: "PRIMARY", label: "Primary machine", poolKey: "machines", qty: false },
  { type: "LABOR", label: "Labor pool", poolKey: "labor_pools", qty: true },
  { type: "TOOL", label: "Tools", poolKey: "tools", qty: false, multi: true }
];

function ResourceRequirementsDialog({
  open,
  operation,
  plantResources,
  saving,
  onClose,
  onSave
}) {
  const [primaryId, setPrimaryId] = useState("");
  const [laborId, setLaborId] = useState("");
  const [laborQty, setLaborQty] = useState("1");
  const [toolIds, setToolIds] = useState([]);

  const machines = plantResources?.machines || [];
  const tools = plantResources?.tools || [];
  const laborPools = plantResources?.labor_pools || [];

  const existing = useMemo(
    () => operation?.resource_requirements || [],
    [operation]
  );

  useEffect(() => {
    if (!open) return;
    const primary = existing.find((r) => r.requirement_type === "PRIMARY");
    const labor = existing.find((r) => r.requirement_type === "LABOR");
    const toolRows = existing.filter((r) => r.requirement_type === "TOOL");
    setPrimaryId(primary?.resource_id || "");
    setLaborId(labor?.resource_id || "");
    setLaborQty(String(labor?.quantity ?? 1));
    setToolIds(toolRows.map((r) => r.resource_id));
  }, [open, existing]);

  if (!open || !operation) return null;

  const toggleTool = (resourceId) => {
    setToolIds((prev) =>
      prev.includes(resourceId)
        ? prev.filter((id) => id !== resourceId)
        : [...prev, resourceId]
    );
  };

  const handleSave = () => {
    const requirements = [];
    if (primaryId) {
      requirements.push({
        resource_id: primaryId,
        requirement_type: "PRIMARY",
        quantity: 1,
        uom: "EA"
      });
    }
    if (laborId) {
      requirements.push({
        resource_id: laborId,
        requirement_type: "LABOR",
        quantity: Number(laborQty) > 0 ? Number(laborQty) : 1,
        uom: "EA"
      });
    }
    toolIds.forEach((resourceId) => {
      requirements.push({
        resource_id: resourceId,
        requirement_type: "TOOL",
        quantity: 1,
        uom: "EA"
      });
    });
    onSave(requirements);
  };

  const poolFor = (poolKey) => {
    if (poolKey === "machines") return machines;
    if (poolKey === "tools") return tools;
    return laborPools;
  };

  return (
    <div className="ac-rb-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ac-rb-dialog ac-rb-dialog--wide"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="ac-rb-dialog-title">Resource requirements</h3>
        <p className="ac-rb-dialog-subtitle">
          {operation.operation_name}{" "}
          <span className="font-mono text-slate-500">({operation.operation_code})</span>
        </p>
        <p className="text-xs text-slate-500 mb-4">
          <strong>Machine (PRIMARY):</strong> ties to process / schedule time on the asset.{" "}
          <strong>Labor:</strong> how many operators are needed on this step (headcount), compared
          to the pool size in Masters — not hour-by-hour availability yet.
        </p>

        <div className="space-y-4">
          {REQUIREMENT_ROWS.map((row) => {
            const pool = poolFor(row.poolKey);
            if (row.multi) {
              return (
                <div key={row.type}>
                  <div className="text-sm font-medium text-slate-700 mb-2">{row.label}</div>
                  {pool.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No tools in Masters → Plant resources. Add RES-TOOL-* first.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {pool.map((r) => {
                        const selected = toolIds.includes(r.resource_id);
                        return (
                          <button
                            key={r.resource_id}
                            type="button"
                            className={`text-xs px-2 py-1 rounded border ${
                              selected
                                ? "border-blue-600 bg-blue-50 text-blue-800"
                                : "border-slate-300 bg-white text-slate-700"
                            }`}
                            onClick={() => toggleTool(r.resource_id)}
                          >
                            {r.resource_code}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={row.type} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm block">
                  <span className="block mb-1 font-medium text-slate-700">{row.label}</span>
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={row.type === "PRIMARY" ? primaryId : laborId}
                    onChange={(e) =>
                      row.type === "PRIMARY"
                        ? setPrimaryId(e.target.value)
                        : setLaborId(e.target.value)
                    }
                  >
                    <option value="">— None —</option>
                    {pool.map((r) => (
                      <option key={r.resource_id} value={r.resource_id}>
                        {r.resource_code} · {r.resource_name}
                      </option>
                    ))}
                  </select>
                </label>
                {row.qty && laborId ? (
                  <label className="text-sm block">
                    <span className="block mb-1 font-medium text-slate-700">Operators required</span>
                    <input
                      type="number"
                      min="1"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={laborQty}
                      onChange={(e) => setLaborQty(e.target.value)}
                    />
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="ac-rb-dialog-actions mt-6">
          <button type="button" className="ac-rb-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="ac-rb-btn ac-rb-btn--primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save requirements"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResourceRequirementsDialog;
