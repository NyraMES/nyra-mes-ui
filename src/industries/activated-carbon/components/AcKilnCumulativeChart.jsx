import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { buildCumulativeKilnSeries, KILN_LIVE_WINDOW_HOURS } from "../utils/acKilnLoaderUtils";

const INK = "#0f172a";

function labelOffsets(stems, spanH) {
  const placed = [];
  return stems.map((stem) => {
    const x = spanH > 0 ? stem.hour / spanH : 0;
    const nearby = placed.filter((row) => Math.abs(row.x - x) < 0.16);
    const dy = 10 + nearby.length * 44;
    const dx = nearby.length ? (nearby.length % 2 === 0 ? -22 : 22) : 0;
    placed.push({ x });
    return { dx, dy };
  });
}

function formatBagQty(stem) {
  const kg = Number(stem.incrementKg ?? stem.kg);
  return Number.isFinite(kg) && kg > 0 ? `${kg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg` : "";
}

export default function AcKilnCumulativeChart({
  events = [],
  nowMs = Date.now(),
  windowHours = KILN_LIVE_WINDOW_HOURS,
  heightClass = "h-80"
}) {
  const { series, stems, spanH, cumulativeKg } = useMemo(
    () => buildCumulativeKilnSeries(events, nowMs, windowHours),
    [events, nowMs, windowHours]
  );
  const yMax = Math.max(cumulativeKg * 1.35, 10);
  const hourTicks = Array.from({ length: Math.floor(spanH) + 1 }, (_, i) => i);
  const shifts = labelOffsets(stems, spanH);

  return (
    <div className={`w-full ${heightClass} flex flex-col`} style={{ color: INK }}>
      <div
        className="relative flex-1 min-h-[180px] overflow-x-auto rounded-md border border-slate-200"
        style={{
          backgroundColor: "#ffffff",
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px)",
          backgroundSize: "16px 16px"
        }}
      >
        <div className="min-w-[640px] h-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 16, right: 28, bottom: 28, left: 8 }}>
              <CartesianGrid stroke="#cbd5e1" />
              <XAxis
                dataKey="hour"
                type="number"
                domain={[0, spanH]}
                ticks={hourTicks}
                tick={{ fill: "#334155", fontSize: 11 }}
                tickFormatter={(h) => (h >= spanH ? "now" : `${Math.round(spanH - h)}h ago`)}
                axisLine={{ stroke: "#94a3b8" }}
              />
              <YAxis
                dataKey="kg"
                width={48}
                domain={[0, yMax]}
                tick={{ fill: "#334155", fontSize: 10 }}
                tickFormatter={(v) => `${Number(v).toFixed(0)}`}
                axisLine={{ stroke: "#94a3b8" }}
              />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  fontSize: 12,
                  color: INK
                }}
                formatter={(value, _name, item) => {
                  const inward = item?.payload?.inwardCode || item?.payload?.lotCode;
                  return [`${Number(value).toFixed(2)} kg${inward ? ` · ${inward}` : ""}`, "Load"];
                }}
                labelFormatter={(_h, payload) => payload?.[0]?.payload?.clock || ""}
              />
              <Line
                type="linear"
                dataKey="kg"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          {stems.map((stem, index) => {
            const shift = shifts[index] || { dx: 0, dy: 10 };
            const left = `calc(56px + (100% - 80px) * ${spanH > 0 ? stem.hour / spanH : 0} + ${shift.dx}px)`;
            const top = `calc(16px + (100% - 56px) * ${yMax > 0 ? 1 - stem.kg / yMax : 0.5} + ${shift.dy}px)`;
            const qty = formatBagQty(stem);
            return (
              <div
                key={`${stem.lotCode}-${stem.bagCode || "bag"}-${stem.clock}-${index}`}
                style={{
                  position: "absolute",
                  left,
                  top,
                  transform: "translate(-50%, 0)",
                  zIndex: 3 + index,
                  pointerEvents: "none",
                  textAlign: "center"
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#2563eb",
                    border: "2px solid #ffffff",
                    margin: "0 auto 4px"
                  }}
                />
                <div
                  style={{
                    background: "#ffffff",
                    color: INK,
                    border: "1px solid #94a3b8",
                    borderRadius: 8,
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    lineHeight: 1.25,
                    minWidth: 108,
                    boxShadow: "0 1px 2px rgba(15,23,42,0.18)"
                  }}
                >
                  <div>{stem.inwardCode || stem.lotCode || "Inward"}</div>
                  <div style={{ fontWeight: 600, color: "#334155" }}>
                    {[stem.bagCode, qty].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
