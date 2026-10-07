import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { buildCumulativeKilnSeries, KILN_LIVE_WINDOW_HOURS } from "../utils/acKilnLoaderUtils";

const INK = "#0f172a";

function formatBagQty(stem) {
  const kg = Number(stem.incrementKg ?? stem.kg);
  return Number.isFinite(kg) && kg > 0 ? `${kg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg` : "";
}

function clusterStems(stems, spanH) {
  const sorted = [...stems].sort((a, b) => a.hour - b.hour || a.kg - b.kg);
  const threshold = Math.max(spanH * 0.028, 0.08);
  const clusters = [];
  for (const stem of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(stem.hour - last.hour) <= threshold) {
      last.items.push(stem);
      last.hour = stem.hour;
      last.kg = stem.kg;
    } else {
      clusters.push({ hour: stem.hour, kg: stem.kg, items: [stem] });
    }
  }
  return clusters;
}

function bubbleLabel(cluster) {
  const first = cluster.items[0];
  const qty = formatBagQty(first);
  if (cluster.items.length === 1) {
    return [first.inwardCode || first.lotCode || "Load", first.bagCode, qty].filter(Boolean).join(" · ");
  }
  return `${cluster.items.length} loads at this time`;
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
  const clusters = useMemo(() => clusterStems(stems, spanH), [stems, spanH]);
  const yMax = Math.max(cumulativeKg * 1.35, 10);
  const hourTicks = Array.from({ length: Math.floor(spanH) + 1 }, (_, i) => i);
  const hostRef = useRef(null);
  const [hoverKey, setHoverKey] = useState(null);
  const [pinnedKey, setPinnedKey] = useState(null);
  const activeKey = pinnedKey ?? hoverKey;

  useEffect(() => {
    if (pinnedKey == null) return undefined;
    const onDoc = (event) => {
      if (!hostRef.current?.contains(event.target)) setPinnedKey(null);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [pinnedKey]);

  return (
    <div className={`w-full ${heightClass} flex flex-col`} style={{ color: INK }} ref={hostRef}>
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
                  return [`${Number(value).toFixed(2)} kg${inward ? ` · ${inward}` : ""}`, "On loader"];
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
          {clusters.map((cluster, index) => {
            const key = `${cluster.hour}-${cluster.kg}-${index}`;
            const open = activeKey === key;
            const left = `calc(56px + (100% - 80px) * ${spanH > 0 ? cluster.hour / spanH : 0})`;
            const top = `calc(16px + (100% - 56px) * ${yMax > 0 ? 1 - cluster.kg / yMax : 0.5})`;
            const flipDown = cluster.kg / yMax > 0.72;
            return (
              <div
                key={key}
                style={{
                  position: "absolute",
                  left,
                  top,
                  transform: "translate(-50%, -50%)",
                  zIndex: open ? 20 : 4 + index
                }}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={bubbleLabel(cluster)}
                  onMouseEnter={() => setHoverKey(key)}
                  onMouseLeave={() => setHoverKey((prev) => (prev === key ? null : prev))}
                  onFocus={() => setHoverKey(key)}
                  onBlur={() => setHoverKey((prev) => (prev === key ? null : prev))}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPinnedKey((prev) => (prev === key ? null : key));
                  }}
                  style={{
                    width: open ? 18 : 14,
                    height: open ? 18 : 14,
                    borderRadius: "50%",
                    background: open ? "#1d4ed8" : "#2563eb",
                    border: "2px solid #ffffff",
                    boxShadow: open ? "0 0 0 3px rgba(37,99,235,0.28)" : "0 0 0 1px rgba(15,23,42,0.12)",
                    cursor: "pointer",
                    padding: 0,
                    position: "relative",
                    display: "block"
                  }}
                >
                  {cluster.items.length > 1 ? (
                    <span
                      style={{
                        position: "absolute",
                        top: -8,
                        right: -9,
                        minWidth: 16,
                        height: 16,
                        borderRadius: 999,
                        background: "#0f172a",
                        color: "#ffffff",
                        fontSize: 9,
                        fontWeight: 700,
                        lineHeight: "16px",
                        textAlign: "center",
                        padding: "0 4px"
                      }}
                    >
                      {cluster.items.length}
                    </span>
                  ) : null}
                </button>
                {open ? (
                  <div
                    role="tooltip"
                    style={{
                      position: "absolute",
                      left: "50%",
                      [flipDown ? "top" : "bottom"]: "100%",
                      transform: "translateX(-50%)",
                      marginTop: flipDown ? 8 : 0,
                      marginBottom: flipDown ? 0 : 8,
                      minWidth: 168,
                      maxWidth: 240,
                      background: "#ffffff",
                      color: INK,
                      border: "1px solid #94a3b8",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 11,
                      lineHeight: 1.35,
                      boxShadow: "0 8px 20px rgba(15,23,42,0.16)",
                      textAlign: "left",
                      pointerEvents: "none",
                      whiteSpace: "normal"
                    }}
                  >
                    {cluster.items.map((stem, itemIndex) => {
                      const qty = formatBagQty(stem);
                      return (
                        <div
                          key={`${stem.bagCode || "bag"}-${stem.clock}-${itemIndex}`}
                          style={{
                            paddingTop: itemIndex ? 6 : 0,
                            marginTop: itemIndex ? 6 : 0,
                            borderTop: itemIndex ? "1px solid #e2e8f0" : "none"
                          }}
                        >
                          <div style={{ fontWeight: 700, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                            {stem.inwardCode || stem.lotCode || "Inward"}
                          </div>
                          <div style={{ color: "#334155" }}>
                            {[stem.bagCode, qty].filter(Boolean).join(" · ") || "Load"}
                          </div>
                          {stem.clock ? <div style={{ color: "#64748b" }}>{stem.clock}</div> : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {stems.length > 0 ? (
        <p className="text-[11px] text-slate-500 mt-1.5">
          {stems.length} load{stems.length === 1 ? "" : "s"} on the line · hover or tap a bubble for inward, bag, and
          weight
        </p>
      ) : null}
    </div>
  );
}
