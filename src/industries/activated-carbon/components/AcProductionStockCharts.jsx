import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
}

function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <div className={`rounded-lg border border-slate-700/50 bg-slate-900/40 overflow-hidden ${className}`}>
      <div className="px-3 py-2 border-b border-slate-700/40">
        <div className="text-sm font-medium text-slate-100">{title}</div>
        {subtitle ? <div className="text-[11px] text-slate-500 mt-0.5">{subtitle}</div> : null}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function EmptyChartNote({ message }) {
  return <p className="text-sm text-slate-400 py-10 text-center">{message}</p>;
}

const NARROW_CHART_WRAP = "max-w-[220px] mx-auto w-full";

const STOCK_Y_AXIS = {
  stroke: "#cbd5e1",
  fontSize: 11,
  tickLine: { stroke: "#64748b" },
  axisLine: { stroke: "#64748b" },
  tickFormatter: (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })
};

const STOCK_X_AXIS = {
  stroke: "#cbd5e1",
  fontSize: 10,
  tickLine: { stroke: "#64748b" },
  axisLine: { stroke: "#64748b" },
  interval: 0,
  angle: -28,
  textAnchor: "end",
  height: 52
};

export function AcFlowStageBar({ stages = [] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {stages.map((stage) => (
        <div
          key={stage.id || stage.label}
          className="rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-3 text-center"
        >
          <div className="text-[11px] uppercase tracking-wide text-slate-400 leading-tight min-h-[2rem] flex items-center justify-center">
            {stage.label}
          </div>
          <div className="text-lg font-bold text-slate-50 tabular-nums mt-1">{formatKg(stage.value)}</div>
        </div>
      ))}
    </div>
  );
}

export function AcCharcoalStockChart({ chart, narrow = true }) {
  const { data = [], keys = [], colors = [] } = chart || {};
  if (!data.length) {
    return <EmptyChartNote message="No charcoal stock on inward receipts yet." />;
  }

  return (
    <div className={`h-[280px] ${narrow ? NARROW_CHART_WRAP : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 12, left: 2 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" vertical={false} />
          <XAxis dataKey="supplier" {...STOCK_X_AXIS} />
          <YAxis
            {...STOCK_Y_AXIS}
            label={{ value: "kg", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 10, offset: 8 }}
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid rgba(51,65,85,0.6)",
              borderRadius: 8,
              fontSize: 12
            }}
            formatter={(value, name) => [formatKg(value), name]}
            labelFormatter={(label) => `Supplier: ${label}`}
          />
          {keys.map((key, idx) => (
            <Bar key={key} dataKey={key} stackId="charcoal" fill={colors[idx] || "#38bdf8"} maxBarSize={narrow ? 44 : 72} radius={idx === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
              <LabelList
                dataKey={key}
                position="center"
                fill="#0f172a"
                fontSize={10}
                formatter={(v) => (Number(v) > 0 ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "")}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AcGcharcoalStockChart({ chart, narrow = true }) {
  const { data = [], keys = [], colors = [] } = chart || {};
  if (!data.length) {
    return (
      <EmptyChartNote message="No lots awaiting kiln (CREATED). Material in kiln shows under Exkiln KPI / pipeline chart." />
    );
  }

  return (
    <div className={`h-[280px] ${narrow ? NARROW_CHART_WRAP : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 12, left: 2 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" vertical={false} />
          <XAxis dataKey="supplier" {...STOCK_X_AXIS} />
          <YAxis
            {...STOCK_Y_AXIS}
            label={{ value: "kg", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 10, offset: 8 }}
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid rgba(51,65,85,0.6)",
              borderRadius: 8,
              fontSize: 12
            }}
            formatter={(value, name) => [formatKg(value), name]}
            labelFormatter={(label) => `Supplier: ${label}`}
          />
          {keys.map((key, idx) => (
            <Bar key={key} dataKey={key} stackId="gc" fill={colors[idx] || "#fbbf24"} maxBarSize={narrow ? 44 : 72} radius={idx === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
              <LabelList
                dataKey={key}
                position="center"
                fill="#0f172a"
                fontSize={10}
                formatter={(v) => (Number(v) > 0 ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "")}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Testbed-style grade list — full-width colour strip + kg below the label. */
export function AcGradeWiseStockChart({ grades = [] }) {
  if (!grades.length) {
    return <EmptyChartNote message="No grade-wise finished stock yet." />;
  }

  return (
    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
      {grades.map((row) => (
        <div key={row.grade}>
          <div className="text-sm font-medium text-slate-200">{row.grade}</div>
          <div
            className="mt-1.5 h-5 w-full rounded-sm"
            style={{ background: row.color }}
          />
          <div className="text-sm text-slate-100 tabular-nums mt-1">{formatKg(row.weight)}</div>
        </div>
      ))}
    </div>
  );
}

/** Simple vertical stock bars with value on top — easy read for shop-floor users. */
export function AcSimpleVerticalBarChart({
  data = [],
  dataKey = "total",
  categoryKey = "name",
  barColor = "#fb923c",
  emptyMessage = "No stock data yet.",
  narrow = true
}) {
  if (!data.length) {
    return <EmptyChartNote message={emptyMessage} />;
  }

  return (
    <div className={`h-[280px] ${narrow ? NARROW_CHART_WRAP : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 12, bottom: 12, left: 2 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" vertical={false} />
          <XAxis dataKey={categoryKey} {...STOCK_X_AXIS} />
          <YAxis
            {...STOCK_Y_AXIS}
            label={{ value: "kg", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 10, offset: 8 }}
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid rgba(51,65,85,0.6)",
              borderRadius: 8,
              fontSize: 13
            }}
            formatter={(value) => [formatKg(value), "Stock"]}
            labelFormatter={(label) => String(label)}
          />
          <Bar dataKey={dataKey} fill={barColor} radius={[6, 6, 0, 0]} maxBarSize={narrow ? 44 : 72}>
            <LabelList
              dataKey={dataKey}
              position="top"
              fill="#f1f5f9"
              fontSize={12}
              fontWeight={600}
              formatter={(v) =>
                Number(v) > 0 ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }) : ""
              }
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AcImpuritiesChart({ rows = [], colors = {}, seriesKeys = ["Stones", "Unburnt", "Minus20"] }) {
  if (!rows.length) {
    return <EmptyChartNote message="No impurity data to display. Complete raw material QC on inward receipts." />;
  }

  const keys = seriesKeys?.length ? seriesKeys : ["Stones", "Unburnt", "Minus20"];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
        {keys.map((key) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: colors[key] || "#64748b" }} />
            {key === "Minus20" ? "-20" : key}
          </span>
        ))}
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 8, right: 16, bottom: 28, left: 8 }}
            stackOffset="none"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" horizontal={false} />
            <XAxis
              type="number"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              label={{ value: "Weight (kg)", position: "insideBottom", offset: -4, fill: "#94a3b8", fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="inward_number"
              width={80}
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              label={{
                value: "Inward",
                angle: -90,
                position: "insideLeft",
                fill: "#94a3b8",
                fontSize: 11,
                offset: 4
              }}
            />
            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid rgba(51,65,85,0.6)",
                borderRadius: 8,
                fontSize: 12
              }}
              formatter={(value, name) => [`${Number(value).toLocaleString()} kg`, name === "Minus20" ? "-20" : name]}
            />
            {keys.map((key) => (
              <Bar key={key} dataKey={key} stackId="imp" fill={colors[key] || "#64748b"} maxBarSize={18} radius={2}>
                <LabelList
                  dataKey={key}
                  position="center"
                  fill="#0f172a"
                  fontSize={10}
                  formatter={(v, _name, item) => {
                    const value = Number(v);
                    if (!Number.isFinite(value) || value <= 0) return "";
                    const total = Number(item?.payload?.total || 0);
                    if (total > 0 && value / total < 0.08) return "";
                    return `${value.toLocaleString()} kg`;
                  }}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AcRmsLossChart({ bundle }) {
  const rows = bundle?.rows || [];
  const avgPct = bundle?.avgPct ?? 0;
  const end = new Date();
  const start = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const rangeLabel = `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;

  if (!rows.length) {
    return (
      <ChartCard title="RMS Total Loss % — Last 30 days" subtitle={rangeLabel}>
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100/90">
          No completed outwards in the last 30 days.
        </div>
      </ChartCard>
    );
  }

  const barColors = ["#87CEEB", "#FFA500"];

  return (
    <ChartCard title="RMS Total Loss % — Last 30 days" subtitle={rangeLabel}>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 24, right: 12, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" vertical={false} />
            <XAxis dataKey="inward_number" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} unit="%" domain={[0, "auto"]} />
            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid rgba(51,65,85,0.6)",
                borderRadius: 8,
                fontSize: 12
              }}
              formatter={(value) => [`${Number(value).toFixed(2)}%`, "RMS loss"]}
            />
            <ReferenceLine
              y={avgPct}
              stroke="#94a3b8"
              strokeDasharray="6 4"
              label={{ value: `Avg: ${avgPct.toFixed(2)}%`, position: "insideTopRight", fill: "#cbd5e1", fontSize: 11 }}
            />
            <Bar dataKey="rms_total_loss_pct" radius={[4, 4, 0, 0]}>
              {rows.map((_, idx) => (
                <Cell key={idx} fill={barColors[idx % barColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function AcKilnYieldChart({ bundle }) {
  const dates = bundle?.dates || [];
  const series = bundle?.series || [];
  const mode = bundle?.mode || (dates.length <= 1 ? "snapshot" : "trend");
  const avgPct = Object.values(bundle?.averages || {}).find((v) => v != null);

  if (!series.length || series.every((s) => s.data.every((v) => v == null))) {
    return (
      <ChartCard title="Kiln Yield (All Kilns)" subtitle="Yield % by activation line">
        <EmptyChartNote message="Complete and stock lots to build yield trend." />
      </ChartCard>
    );
  }

  const chartRows = dates.map((date, idx) => {
    const row = { date };
    series.forEach((s) => {
      row[s.label] = s.data[idx] ?? null;
    });
    return row;
  });

  const subtitle =
    mode === "trend"
      ? `Plant yield by completed lot · avg ${avgPct != null ? `${Number(avgPct).toFixed(1)}%` : "—"}`
      : `Snapshot · plant avg ${avgPct != null ? `${Number(avgPct).toFixed(1)}%` : "—"}`;

  const useBarChart = mode === "snapshot" || dates.length <= 1;
  const dataKey = series[0]?.label || "Yield %";
  const barColor = series[0]?.color || "#fbbf24";

  return (
    <ChartCard title="Kiln Yield (All Kilns)" subtitle={subtitle}>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          {useBarChart ? (
            <BarChart data={chartRows} margin={{ top: 20, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={dates.length > 3 ? -20 : 0}
                textAnchor={dates.length > 3 ? "end" : "middle"}
                height={dates.length > 3 ? 48 : 28}
              />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(51,65,85,0.6)",
                  borderRadius: 8,
                  fontSize: 12
                }}
                formatter={(value) => (value != null ? `${Number(value).toFixed(1)}%` : "—")}
              />
              {avgPct != null ? (
                <ReferenceLine
                  y={avgPct}
                  stroke="#94a3b8"
                  strokeDasharray="6 4"
                  label={{
                    value: `Avg ${Number(avgPct).toFixed(1)}%`,
                    position: "insideTopLeft",
                    fill: "#cbd5e1",
                    fontSize: 11
                  }}
                />
              ) : null}
              <Bar dataKey={dataKey} fill={barColor} radius={[4, 4, 0, 0]} maxBarSize={56}>
                <LabelList
                  dataKey={dataKey}
                  position="top"
                  fill="#e2e8f0"
                  fontSize={11}
                  formatter={(v) => (v != null ? `${Number(v).toFixed(1)}%` : "")}
                />
              </Bar>
            </BarChart>
          ) : (
            <LineChart data={chartRows} margin={{ top: 16, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={48}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                unit="%"
                label={{ value: "Yield %", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(51,65,85,0.6)",
                  borderRadius: 8,
                  fontSize: 12
                }}
                formatter={(value) => (value != null ? `${Number(value).toFixed(1)}%` : "—")}
              />
              {series.map((s) => (
                <Line
                  key={s.label}
                  type="monotone"
                  dataKey={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 4, fill: s.color, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
              {avgPct != null ? (
                <ReferenceLine
                  y={avgPct}
                  stroke="#94a3b8"
                  strokeDasharray="6 4"
                  label={{
                    value: `Avg ${Number(avgPct).toFixed(1)}%`,
                    position: "insideTopLeft",
                    fill: "#cbd5e1",
                    fontSize: 11
                  }}
                />
              ) : null}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function AcProductionStockPanel({ detail, loading }) {
  if (loading) {
    return <p className="text-sm text-slate-400 py-8 text-center">Loading stock analytics…</p>;
  }
  if (!detail) {
    return <EmptyChartNote message="Stock detail unavailable." />;
  }

  return (
    <div className="space-y-4">
      <AcFlowStageBar stages={detail.stages} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <ChartCard title="Charcoal Stock" subtitle="Supplier-wise inward (stacked by material)" className="lg:col-span-5">
          <AcCharcoalStockChart chart={detail.charcoal} />
        </ChartCard>
        <ChartCard title="GC Stock" subtitle="Lots awaiting kiln (CREATED status)" className="lg:col-span-5">
          {detail.gcharcoal?.data?.length ? (
            <AcGcharcoalStockChart chart={detail.gcharcoal} />
          ) : detail.exkilnPipeline?.data?.length ? (
            <>
              <p className="text-[11px] text-slate-500 mb-2">No CREATED lots — showing kiln / shop-floor WIP by lot.</p>
              <AcSimpleVerticalBarChart
                data={detail.exkilnPipeline.data}
                categoryKey="name"
                dataKey="total"
                barColor="#38bdf8"
                emptyMessage="No material on kiln or shop floor."
                narrow={false}
              />
            </>
          ) : (
            <AcGcharcoalStockChart chart={detail.gcharcoal} />
          )}
        </ChartCard>
        <ChartCard title="Grade-wise Stock" subtitle="Finished grades in inventory" className="lg:col-span-2">
          <AcGradeWiseStockChart grades={detail.grades} />
        </ChartCard>
      </div>

      <ChartCard title="Impurities by Inward" subtitle="QC-based impurity estimate per inward receipt">
        <AcImpuritiesChart rows={detail.impurities} colors={detail.impurityColors} />
      </ChartCard>
    </div>
  );
}

export function AcYieldAnalyticsPanel({ detail, loading, yieldPct, slices }) {
  if (loading) {
    return <p className="text-sm text-slate-400 py-8 text-center">Loading yield analytics…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">Plant yield</div>
            <div className="text-3xl font-bold text-emerald-400 tabular-nums mt-1">
              {yieldPct != null ? `${Number(yieldPct).toFixed(1)}%` : "—"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-slate-500">Process loss</div>
            <div className="text-2xl font-semibold text-slate-400 tabular-nums mt-1">
              {detail?.processLoss != null ? `${Number(detail.processLoss).toFixed(1)}%` : "—"}
            </div>
          </div>
        </div>
        {yieldPct != null ? (
          <div className="mt-4 h-4 rounded-full bg-slate-800 overflow-hidden flex">
            <div className="h-full bg-emerald-400" style={{ width: `${Math.min(100, yieldPct)}%` }} />
            <div className="h-full bg-slate-600" style={{ width: `${Math.max(0, 100 - yieldPct)}%` }} />
          </div>
        ) : null}
      </div>

      {detail ? (
        <>
          <AcRmsLossChart bundle={detail.rmsLoss} />
          <AcKilnYieldChart bundle={detail.kilnYield} />
        </>
      ) : null}

      {slices?.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-700/40">
          {slices.map((row) => (
            <div key={row.id} className="rounded-lg border border-slate-700/40 bg-slate-900/30 px-3 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: row.color }} />
                <span className="text-sm text-slate-300">{row.name}</span>
              </div>
              <div className="text-xl font-semibold text-slate-50 tabular-nums">
                {row.unit === "%" ? `${Number(row.value).toFixed(1)}%` : Number(row.value).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
