import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { EmptyState, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

const SLICE_COLORS = {
  Yield: "#34d399",
  "Process loss": "#475569"
};

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} KG`;
}

function AcYieldPiePanel({ yieldSummary }) {
  const yieldPct = useMemo(() => {
    const raw = yieldSummary?.average_yield_pct;
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
  }, [yieldSummary]);

  const chartData = useMemo(() => {
    if (yieldPct == null) return [];
    const loss = Math.max(0, 100 - yieldPct);
    return [
      { name: "Yield", value: yieldPct, pct: yieldPct },
      { name: "Process loss", value: loss, pct: loss }
    ].filter((row) => row.value > 0);
  }, [yieldPct]);

  const lotKg = Number(yieldSummary?.total_lot_quantity);
  const plannedKg = Number(yieldSummary?.total_planned_quantity);
  const outputKg = yieldPct != null && Number.isFinite(lotKg) ? (lotKg * yieldPct) / 100 : null;
  const lossKg = outputKg != null && Number.isFinite(lotKg) ? Math.max(0, lotKg - outputKg) : null;

  return (
    <WfCard>
      <WfCardHeader
        title="Yield Overview"
        subtitle="In Stock + dispatched ÷ raw charged — capped at 100%"
        icon={<IconPie />}
        right={
          yieldPct != null ? (
            <span className="text-sm font-semibold text-emerald-300 tabular-nums">{yieldPct.toFixed(1)}%</span>
          ) : null
        }
      />
      <WfCardBody>
        {yieldPct == null || chartData.length === 0 ? (
          <EmptyState
            title="No yield data yet"
            hint="Register kiln feed lots and quality results to calculate recovery %."
          />
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative w-full max-w-[220px] aspect-square shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="58%"
                    outerRadius="88%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={SLICE_COLORS[entry.name] || "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid rgba(51,65,85,0.6)",
                      borderRadius: "8px",
                      fontSize: "12px"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-emerald-300 tabular-nums">{yieldPct.toFixed(1)}%</div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400 mt-0.5">Avg yield</div>
              </div>
            </div>

            <div className="flex-1 w-full space-y-3 min-w-0">
              {chartData.map((row) => (
                <div key={row.name} className="flex items-center gap-3 text-sm">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: SLICE_COLORS[row.name] || "#64748b" }}
                  />
                  <span className="text-slate-300 flex-1 min-w-0">{row.name}</span>
                  <span className="font-semibold text-slate-100 tabular-nums shrink-0">
                    {row.pct.toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums shrink-0 w-24 text-right">
                    {row.name === "Yield" && outputKg != null
                      ? formatKg(outputKg)
                      : row.name === "Process loss" && lossKg != null
                        ? formatKg(lossKg)
                        : ""}
                  </span>
                </div>
              ))}

              <div className="pt-2 border-t border-slate-700/40 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-400">
                <div>
                  <div className="uppercase tracking-wider text-[10px]">Lots</div>
                  <div className="text-slate-200 font-mono mt-0.5">{yieldSummary?.lot_count ?? "—"}</div>
                </div>
                <div>
                  <div className="uppercase tracking-wider text-[10px]">Charged mass</div>
                  <div className="text-slate-200 font-mono mt-0.5">
                    {Number.isFinite(lotKg) ? formatKg(lotKg) : "—"}
                  </div>
                </div>
                <div>
                  <div className="uppercase tracking-wider text-[10px]">Planned mass</div>
                  <div className="text-slate-200 font-mono mt-0.5">
                    {Number.isFinite(plannedKg) ? formatKg(plannedKg) : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </WfCardBody>
    </WfCard>
  );
}

function IconPie() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-9-9" />
      <path d="M12 3v9h9" />
    </svg>
  );
}

export default AcYieldPiePanel;
