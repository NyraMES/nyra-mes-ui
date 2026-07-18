import { useMemo } from "react";
import { Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";

function formatTick(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatLimit(value, uom) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  const text = Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : String(value);
  return uom ? `${text} ${uom}` : text;
}

function TrendTooltip({ active, payload, label, uom, normalMin, normalMax }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  return (
    <div className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs shadow-lg">
      <div className="text-slate-400">{formatTick(label)}</div>
      <div className="text-slate-100 font-medium tabular-nums">
        {Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}
        {uom ? ` ${uom}` : ""}
      </div>
      {normalMin != null && normalMax != null ? (
        <div className="mt-1 text-slate-500">
          Normal: {formatLimit(normalMin, uom)} – {formatLimit(normalMax, uom)}
        </div>
      ) : null}
    </div>
  );
}

function computeDelta(points) {
  if (points.length < 2) return null;
  const prev = Number(points[points.length - 2]?.value_numeric);
  const latest = Number(points[points.length - 1]?.value_numeric);
  if (!Number.isFinite(prev) || !Number.isFinite(latest)) return null;
  return latest - prev;
}

function computeYDomain(values, normalMin, normalMax) {
  const nums = [...values, normalMin, normalMax].map(Number).filter(Number.isFinite);
  if (!nums.length) return ["auto", "auto"];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const padding = (max - min) * 0.12 || Math.abs(max) * 0.08 || 1;
  return [min - padding, max + padding];
}

function ParameterTrendSparkline({
  points = [],
  uom = "",
  color = "#22d3ee",
  normalMin = null,
  normalMax = null
}) {
  const chartData = useMemo(
    () =>
      points
        .map((row) => ({
          ts: row.reading_timestamp,
          value: Number(row.value_numeric)
        }))
        .filter((row) => Number.isFinite(row.value)),
    [points]
  );

  const delta = useMemo(() => computeDelta(points), [points]);
  const minLimit = normalMin != null ? Number(normalMin) : null;
  const maxLimit = normalMax != null ? Number(normalMax) : null;
  const hasLimits = Number.isFinite(minLimit) && Number.isFinite(maxLimit);
  const bandLow = hasLimits ? Math.min(minLimit, maxLimit) : null;
  const bandHigh = hasLimits ? Math.max(minLimit, maxLimit) : null;
  const yDomain = useMemo(
    () => computeYDomain(chartData.map((row) => row.value), bandLow, bandHigh),
    [chartData, bandLow, bandHigh]
  );

  if (chartData.length < 2) {
    return (
      <div className="mt-3 space-y-1">
        {hasLimits ? (
          <div className="text-xs text-emerald-400/90 tabular-nums">
            Normal: {formatLimit(bandLow, uom)} – {formatLimit(bandHigh, uom)}
          </div>
        ) : null}
        <div className="h-12 rounded-md border border-dashed border-slate-700/60 bg-slate-950/30 flex items-center justify-center text-xs text-slate-500">
          Trend appears after 2+ readings
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
        <span className="text-slate-500">Trend ({chartData.length} pts)</span>
        {hasLimits ? (
          <span className="text-emerald-400 tabular-nums font-medium">
            Normal {formatLimit(bandLow, uom)} – {formatLimit(bandHigh, uom)}
          </span>
        ) : null}
        {delta != null ? (
          <span
            className={`font-medium tabular-nums ${
              delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-slate-400"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            {uom ? ` ${uom}` : ""}
          </span>
        ) : null}
      </div>
      <div className="h-24 w-full rounded-md bg-slate-950/40 border border-slate-800/60 px-1 py-1">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={96}>
          <LineChart data={chartData} margin={{ top: 6, right: 8, left: 4, bottom: 2 }}>
            <YAxis hide domain={yDomain} />
            {hasLimits ? (
              <>
                <ReferenceArea
                  y1={bandLow}
                  y2={bandHigh}
                  fill="#10b981"
                  fillOpacity={0.28}
                  ifOverflow="extendDomain"
                />
                <ReferenceLine
                  y={bandLow}
                  stroke="#6ee7b7"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  label={{
                    value: formatLimit(bandLow, uom),
                    position: "insideTopLeft",
                    fill: "#6ee7b7",
                    fontSize: 10
                  }}
                />
                <ReferenceLine
                  y={bandHigh}
                  stroke="#6ee7b7"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  label={{
                    value: formatLimit(bandHigh, uom),
                    position: "insideBottomLeft",
                    fill: "#6ee7b7",
                    fontSize: 10
                  }}
                />
              </>
            ) : null}
            <Tooltip
              content={
                <TrendTooltip
                  uom={uom}
                  normalMin={bandLow}
                  normalMax={bandHigh}
                />
              }
              labelFormatter={formatTick}
              cursor={{ stroke: "rgba(148,163,184,0.35)", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              dot={chartData.length <= 12 ? { r: 2.5, fill: color, strokeWidth: 0 } : false}
              activeDot={{ r: 4, fill: color }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ParameterTrendSparkline;
