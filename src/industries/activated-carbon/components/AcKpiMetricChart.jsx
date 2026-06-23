import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const RADIAN = Math.PI / 180;

function renderSlicePercentLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.06) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#0f172a"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={700}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

const DEFAULT_COLORS = [
  "#34d399",
  "#38bdf8",
  "#a78bfa",
  "#fbbf24",
  "#f472b6",
  "#64748b",
  "#22d3ee",
  "#fb923c"
];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatValue(value, unit) {
  if (value === "—" || value == null) return "—";
  const n = num(value);
  if (unit === "%") return `${n.toFixed(1)}%`;
  if (unit === "kg") return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
  if (unit === "count") return n.toLocaleString();
  return String(value);
}

export function buildChartSlices(kpis, colors = DEFAULT_COLORS) {
  return (kpis || [])
    .map((kpi, idx) => ({
      id: kpi.id,
      name: kpi.title,
      value: num(kpi.value),
      unit: kpi.unit,
      color: colors[idx % colors.length],
      hasL3: (kpi.drillTo || []).length > 0
    }))
    .filter((row) => row.value > 0);
}

const EXEC_COLORS = ["#34d399", "#38bdf8", "#a78bfa", "#fbbf24"];

/** Build executive pie slices — relative share for mixed % / kg / count KPIs. */
export function buildExecutiveSlices(l1Kpis) {
  const rows = (l1Kpis || []).map((kpi, idx) => {
    const raw = num(kpi.value);
    let weight = raw;
    if (kpi.unit === "kg") weight = raw / 250;
    if (kpi.unit === "count") weight = raw * 20;
    if (weight <= 0) weight = 0.5;

    return {
      id: kpi.id,
      name: kpi.title,
      weight,
      unit: kpi.unit,
      displayValue: formatValue(raw, kpi.unit),
      color: EXEC_COLORS[idx % EXEC_COLORS.length],
      kpi
    };
  });

  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  return rows.map((row) => ({
    ...row,
    value: total > 0 ? (row.weight / total) * 100 : 100 / Math.max(rows.length, 1)
  }));
}

/** Executive pie — donut centred, slice % on chart, legend below (no side bars). */
export function AcKpiExecutivePie({
  slices,
  centerLabel,
  centerValue,
  size = 220,
  compact = false,
  onSliceClick,
  onLegendClick
}) {
  const chartSlices = slices || [];
  const total = chartSlices.reduce((s, row) => s + row.value, 0);
  if (!chartSlices.length || total <= 0) {
    return <p className="text-sm text-slate-400 py-8 text-center">No data to chart yet.</p>;
  }

  const handleLegend = onLegendClick || onSliceClick;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartSlices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="86%"
              paddingAngle={2}
              stroke="none"
              label={renderSlicePercentLabel}
              labelLine={false}
              onClick={onSliceClick ? (_, index) => onSliceClick(chartSlices[index]) : undefined}
              style={onSliceClick ? { cursor: "pointer" } : undefined}
            >
              {chartSlices.map((row) => (
                <Cell key={row.id} fill={row.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(_value, name) => {
                const row = chartSlices.find((s) => s.name === name);
                const share = total > 0 && row ? (row.value / total) * 100 : 0;
                return [
                  `${row?.displayValue ?? formatValue(row?.value, row?.unit)} (${share.toFixed(1)}% of chart)`,
                  name
                ];
              }}
              contentStyle={{
                background: "#0f172a",
                border: "1px solid rgba(51,65,85,0.6)",
                borderRadius: "8px",
                fontSize: "12px"
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerValue != null ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-2">
            <div className={`font-bold text-slate-50 tabular-nums ${compact ? "text-lg" : "text-2xl"}`}>
              {centerValue}
            </div>
            {centerLabel ? (
              <div
                className={`uppercase tracking-wider text-slate-400 mt-0.5 leading-tight ${
                  compact ? "text-[9px] px-1" : "text-[10px]"
                }`}
              >
                {centerLabel}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={`w-full mt-4 pt-3 border-t border-slate-700/40 ${
          compact ? "flex flex-col gap-2" : "grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 max-w-3xl"
        }`}
      >
        {chartSlices.map((row) => {
          const share = total > 0 ? (row.value / total) * 100 : 0;
          const clickable = Boolean(handleLegend && row.kpi?.drillTo?.length);
          return (
            <button
              key={row.id}
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => handleLegend(row) : undefined}
              className={`text-left rounded-lg px-2 py-1.5 transition-colors ${
                clickable ? "hover:bg-slate-800/60 cursor-pointer" : "cursor-default"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                <span className="text-xs text-slate-300 leading-tight">{row.name}</span>
              </div>
              <div className="mt-1 ml-4 text-sm font-semibold text-slate-50 tabular-nums">
                {row.displayValue ?? formatValue(row.kpi?.value ?? row.value, row.unit)}
              </div>
              <div className="ml-4 text-[11px] text-slate-500 tabular-nums">{share.toFixed(1)}% of chart</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AcKpiDonutChart({ slices, centerLabel, centerValue, size = 200, onSliceClick }) {
  const chartSlices = slices || [];
  const total = chartSlices.reduce((s, row) => s + row.value, 0);
  if (!chartSlices.length || total <= 0) {
    return <p className="text-sm text-slate-400 py-8 text-center">No data to chart yet.</p>;
  }

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="56%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="none"
              onClick={onSliceClick ? (_, index) => onSliceClick(slices[index]) : undefined}
              style={onSliceClick ? { cursor: "pointer" } : undefined}
            >
              {slices.map((row) => (
                <Cell key={row.id} fill={row.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [formatValue(value, slices.find((s) => s.name === name)?.unit), name]}
              contentStyle={{
                background: "#0f172a",
                border: "1px solid rgba(51,65,85,0.6)",
                borderRadius: "8px",
                fontSize: "12px"
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerValue != null ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-2">
            <div className="text-2xl font-bold text-slate-50 tabular-nums">{centerValue}</div>
            {centerLabel ? (
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">{centerLabel}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex-1 w-full space-y-2.5 min-w-0">
        {slices.map((row) => {
          const pct = total > 0 ? (row.value / total) * 100 : 0;
          return (
            <div key={row.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                  <span className="text-slate-300 truncate">{row.name}</span>
                </div>
                <span className="font-semibold text-slate-100 tabular-nums shrink-0">
                  {row.displayValue ?? formatValue(row.value, row.unit)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, pct)}%`, background: row.color }}
                />
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">{pct.toFixed(1)}% of group</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STOCK_COLORS = {
  "ac-charcoal-stock": "#3b82f6",
  "ac-gcharcoal-stock": "#06b6d4",
  "ac-exkiln-with-stone": "#f59e0b",
  "ac-exkiln-without-stone": "#8b5cf6",
  "ac-final-grade-stock": "#34d399"
};

export function stockSliceColors(kpis) {
  return buildChartSlices(
    kpis,
    kpis.map((k) => STOCK_COLORS[k.id] || "#64748b")
  );
}

function barRowsFromSlices(slices) {
  return [...(slices || [])].sort((a, b) => num(b.value) - num(a.value));
}

/** L2 breakdown — ranked horizontal bars (not a pie). */
export function AcKpiBarBreakdown({
  slices,
  summaryLabel,
  summaryValue,
  onRowClick,
  emptyMessage = "No data to chart yet."
}) {
  const rows = barRowsFromSlices(slices);
  const max = Math.max(...rows.map((row) => num(row.value)), 1);

  if (!rows.length) {
    return <p className="text-sm text-slate-400 py-8 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      {summaryValue != null ? (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-wider text-slate-500">{summaryLabel || "Summary"}</div>
          <div className="text-xl font-bold text-slate-50 tabular-nums">{summaryValue}</div>
        </div>
      ) : null}

      <div className="space-y-3.5">
        {rows.map((row) => {
          const value = num(row.value);
          const width = max > 0 ? (value / max) * 100 : 0;
          const clickable = Boolean(onRowClick && row.hasL3);

          return (
            <button
              key={row.id}
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onRowClick(row) : undefined}
              className={`w-full text-left rounded-lg border border-slate-700/40 bg-slate-900/30 px-3 py-2.5 transition-colors ${
                clickable ? "hover:border-cyan-500/40 hover:bg-slate-900/60 cursor-pointer" : "cursor-default"
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: row.color }} />
                  <span className="text-sm text-slate-200 truncate">{row.name}</span>
                </div>
                <span className="text-sm font-semibold text-slate-50 tabular-nums shrink-0">
                  {row.displayValue ?? formatValue(value, row.unit)}
                </span>
              </div>
              <div className="h-3 rounded-md bg-slate-800/90 overflow-hidden">
                <div
                  className="h-full rounded-md transition-all"
                  style={{ width: `${Math.min(100, width)}%`, background: row.color }}
                />
              </div>
              {clickable ? (
                <div className="text-[11px] text-cyan-400/80 mt-1.5">Tap bar for operational detail →</div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** L2 yield view — stacked progress strip (yield vs loss). */
export function AcKpiYieldSplitBar({ yieldPct, slices = [] }) {
  const y = Math.min(100, Math.max(0, num(yieldPct)));
  const loss = Math.max(0, 100 - y);
  const yieldRow = slices.find((row) => row.id === "yield-slice");
  const lossRow = slices.find((row) => row.id === "loss-slice");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">Plant yield</div>
            <div className="text-3xl font-bold text-emerald-400 tabular-nums mt-1">{y.toFixed(1)}%</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-slate-500">Process loss</div>
            <div className="text-2xl font-semibold text-slate-400 tabular-nums mt-1">{loss.toFixed(1)}%</div>
          </div>
        </div>
        <div className="mt-4 h-4 rounded-full bg-slate-800 overflow-hidden flex">
          <div className="h-full bg-emerald-400 transition-all" style={{ width: `${y}%` }} title="Recovered yield" />
          <div className="h-full bg-slate-600 transition-all" style={{ width: `${loss}%` }} title="Process loss" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(yieldRow || lossRow) &&
          [yieldRow, lossRow].filter(Boolean).map((row) => (
            <div
              key={row.id}
              className="rounded-lg border border-slate-700/40 bg-slate-900/30 px-3 py-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: row.color }} />
                <span className="text-sm text-slate-300">{row.name}</span>
              </div>
              <div className="text-xl font-semibold text-slate-50 tabular-nums">
                {formatValue(row.value, row.unit)}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

/** L2 material flow — connected stock pipeline (not a pie). */
export function AcKpiStockPipeline({ slices, totalLabel = "Total WIP", totalValue, onStageClick }) {
  const rows = (slices || []).filter((row) => num(row.value) > 0);
  const max = Math.max(...rows.map((row) => num(row.value)), 1);

  if (!rows.length) {
    return <p className="text-sm text-slate-400 py-8 text-center">No stock data yet.</p>;
  }

  return (
    <div className="space-y-4">
      {totalValue != null ? (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-wider text-slate-500">{totalLabel}</div>
          <div className="text-xl font-bold text-slate-50 tabular-nums">{totalValue}</div>
        </div>
      ) : null}

      <div className="overflow-x-auto pb-1">
        <div className="flex items-stretch gap-2 min-w-max">
          {rows.map((row, idx) => {
            const value = num(row.value);
            const height = 48 + (value / max) * 72;
            const clickable = Boolean(onStageClick && row.hasL3);

            return (
              <div key={row.id} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={clickable ? () => onStageClick(row) : undefined}
                  className={`flex flex-col items-center w-[108px] rounded-lg border border-slate-700/50 bg-slate-900/40 px-2 py-3 transition-colors ${
                    clickable ? "hover:border-cyan-500/40 hover:bg-slate-900/70 cursor-pointer" : "cursor-default"
                  }`}
                >
                  <div
                    className="w-full rounded-t-md mb-2 transition-all"
                    style={{ height: `${height}px`, background: `${row.color}33`, borderTop: `3px solid ${row.color}` }}
                  />
                  <div className="text-[11px] text-slate-300 text-center leading-tight min-h-[2.5rem] line-clamp-2">
                    {row.name}
                  </div>
                  <div className="text-sm font-semibold text-slate-50 tabular-nums mt-1">
                    {formatValue(value, row.unit)}
                  </div>
                </button>
                {idx < rows.length - 1 ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" className="text-slate-600 shrink-0" aria-hidden>
                    <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Stock stages along the material path — bar height reflects relative inventory.
      </p>
    </div>
  );
}

/** L3 operational detail — metric tiles with relative gauges (not a pie). */
export function AcKpiDetailMetrics({ kpis, parentLabel, parentValue, formatKpiValue }) {
  const rows = (kpis || []).map((kpi, idx) => ({
    id: kpi.id,
    name: kpi.title,
    value: num(kpi.value),
    unit: kpi.unit,
    color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
    display: formatKpiValue ? formatKpiValue(kpi) : formatValue(kpi.value, kpi.unit)
  }));

  const max = Math.max(...rows.map((row) => row.value), 1);

  if (!rows.length) {
    return <p className="text-sm text-slate-400 py-8 text-center">No operational metrics yet.</p>;
  }

  return (
    <div className="space-y-4">
      {parentValue != null ? (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-cyan-400/80">{parentLabel || "Stage"}</div>
          <div className="text-2xl font-bold text-slate-50 tabular-nums mt-1">{parentValue}</div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((row) => {
          const width = max > 0 ? (row.value / max) * 100 : 0;
          return (
            <div
              key={row.id}
              className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-3 py-3 border-l-[3px]"
              style={{ borderLeftColor: row.color }}
            >
              <div className="text-xs text-slate-400 truncate">{row.name}</div>
              <div className="text-xl font-semibold text-slate-50 tabular-nums mt-1">
                {row.display}
                {row.unit && row.unit !== "%" && row.unit !== "count" ? (
                  <span className="text-xs font-normal text-slate-400 ml-1">{row.unit}</span>
                ) : null}
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, width)}%`, background: row.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
