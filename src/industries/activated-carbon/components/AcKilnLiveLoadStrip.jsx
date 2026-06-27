import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { fetchAcKilnFeedLots } from "../../../services/activatedCarbonApi";
import { EmptyState, StatusPill } from "../../../workflow/ui";
import {
  buildAcKilnLoaderRows,
  buildKilnLoadChartSeries,
  formatLoaderTime
} from "../utils/acKilnLoaderUtils";

const LIVE_CHART_TICK_MS = 30_000;

const CYCLE_TONE_CLASS = {
  active: "text-cyan-300",
  warn: "text-amber-300",
  neutral: "text-slate-400"
};

const STATUS_KIND = { RUNNING: "ok", COOLING: "warn", IDLE: "neutral" };

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0 kg";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
}

function formatFeedTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)} min ago`;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function KilnLoadChart({ row, nowMs }) {
  const series = useMemo(() => buildKilnLoadChartSeries(row, nowMs), [row, nowMs]);
  const endLabel =
    row.totalHours >= 1
      ? `${row.totalHours.toFixed(row.totalHours % 1 === 0 ? 0 : 1)}h`
      : `${Math.round(row.totalHours * 60)}m`;
  const lineColor = row.status === "RUNNING" ? "#f43f5e" : row.status === "COOLING" ? "#fbbf24" : "#64748b";

  return (
    <div className="h-[88px] w-full mt-2 rounded border border-slate-700/50 bg-slate-950/40 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 6, right: 6, bottom: 2, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.25)" vertical={false} />
          <XAxis
            dataKey="hour"
            type="number"
            domain={[0, "dataMax"]}
            tick={{ fill: "#64748b", fontSize: 9 }}
            tickLine={false}
            axisLine={{ stroke: "#475569" }}
            tickFormatter={(h) => (h === 0 ? "0h" : h >= row.totalHours * 0.95 ? endLabel : `${Number(h).toFixed(1)}h`)}
            ticks={[0, row.totalHours].filter((v, i, a) => a.indexOf(v) === i)}
          />
          <YAxis
            hide
            domain={[0, (max) => Math.max(max, row.kg * 1.1 || 100)]}
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid rgba(51,65,85,0.6)",
              borderRadius: 6,
              fontSize: 11
            }}
            formatter={(value) => [formatKg(value), "Stock"]}
            labelFormatter={(h) => `${Number(h).toFixed(1)} h`}
          />
          {row.isActive && row.totalHours > 0 ? (
            <ReferenceLine
              x={row.totalHours}
              stroke="#94a3b8"
              strokeDasharray="4 3"
              strokeWidth={1}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="kg"
            stroke={lineColor}
            strokeWidth={2}
            dot={series.length <= 6 ? { r: 3, fill: lineColor } : false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function KilnLiveLoadCard({ row, nowMs, readOnly = false }) {
  const kilnLabel = row.resourceName || row.resourceCode;
  const isLive = row.status === "RUNNING";

  return (
    <article className="flex-shrink-0 w-full sm:w-[min(100%,280px)] rounded-lg border border-slate-600/50 bg-slate-900/40 overflow-hidden flex flex-col">
      <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-slate-700/40 bg-slate-900/60">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-sm font-semibold text-slate-100 truncate">{kilnLabel}</h4>
            {isLive ? (
              <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            ) : null}
          </div>
          <div className="text-[11px] text-cyan-200/90 font-mono tabular-nums mt-0.5">
            {row.kg > 0 ? formatKg(row.kg) : "0 kg"} in kiln
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusPill kind={STATUS_KIND[row.status] || "neutral"}>{row.status}</StatusPill>
          {readOnly ? (
            <span className="rounded bg-slate-600/80 text-slate-300 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 wf-btn--disabled">
              Load
            </span>
          ) : (
            <Link
              to="/activated-carbon/execution"
              className="rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1"
            >
              Load
            </Link>
          )}
        </div>
      </div>

      <div className="px-3 py-2 flex-1 flex flex-col">
        {row.isActive ? (
          <div className="space-y-0.5 text-[10px] text-slate-500">
            <div>
              Inward <span className="font-mono text-slate-300">{row.inwardCode}</span>
              {" · "}
              Loaded <span className="text-slate-300 tabular-nums">{formatLoaderTime(row.loadedAt)}</span>
            </div>
            <div>
              Lot <span className="font-mono text-slate-300">{row.lotCode || "—"}</span>
              {" · "}
              Cycle{" "}
              <span className={CYCLE_TONE_CLASS[row.cycleStatus?.tone] || "text-slate-300"}>
                {row.cycleStatus?.text || "—"}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 py-1">No active load — kiln idle</p>
        )}

        <KilnLoadChart row={row} nowMs={nowMs} />
      </div>
    </article>
  );
}

export default function AcKilnLiveLoadStrip({ dashboard, refreshedAt, readOnly = false }) {
  const [kilnLots, setKilnLots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), LIVE_CHART_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dashboard) {
      setKilnLots([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const lots = await fetchAcKilnFeedLots().catch(() => []);
        if (!cancelled) setKilnLots(lots);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboard]);

  const rows = useMemo(
    () =>
      buildAcKilnLoaderRows({
        kilns: dashboard?.kilns || [],
        kilnLots,
        lotLines: dashboard?.lot_lines || []
      }),
    [dashboard, kilnLots]
  );

  if (!dashboard) {
    return <p className="text-sm text-slate-400 py-4 text-center">Loading kiln data…</p>;
  }

  if (!rows.length) {
    return <EmptyState title="No kilns configured" hint="Add activation lines in Masters." />;
  }

  const runningCount = rows.filter((r) => r.status === "RUNNING").length;
  const totalStock = rows.reduce((sum, r) => sum + (r.kg || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          Kiln live load
          {runningCount > 0 ? ` · ${runningCount} running` : ""}
        </span>
        <span className="tabular-nums text-slate-300">
          {totalStock > 0 ? `${formatKg(totalStock)} total` : "—"}
          {loading ? " · refreshing…" : ""}
        </span>
      </div>

      <div className="flex flex-wrap lg:flex-nowrap gap-3 overflow-x-auto pb-1">
        {rows.map((row) => (
          <KilnLiveLoadCard key={row.resourceCode} row={row} nowMs={nowMs} readOnly={readOnly} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-700/40 text-[10px] text-slate-500">
        <span>
          {refreshedAt
            ? `Updated ${formatFeedTime(refreshedAt) || "recently"} · auto-refresh every 10 min`
            : "Auto-refresh every 10 min"}
        </span>
        {readOnly ? (
          <span className="text-xs text-slate-500 wf-btn--disabled">Telemetry</span>
        ) : (
          <Link
            to="/activated-carbon/kiln-telemetry"
            className="text-xs text-cyan-300 hover:text-cyan-100 inline-flex items-center gap-0.5"
          >
            Telemetry
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}
