import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "../../../workflow/ui";
import AcKilnCumulativeChart from "./AcKilnCumulativeChart";
import {
  buildAcKilnLoaderRows,
  formatLoaderTime,
  pendingKilnChargeLots
} from "../utils/acKilnLoaderUtils";

const LIVE_TICK_MS = 15_000;

function formatKgRange(kg) {
  const n = Number(kg);
  if (!Number.isFinite(n) || n <= 0) return "0 — 0.00 kg";
  const whole = n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `${whole} — ${n.toFixed(2)} kg`;
}

function kilnLoaderTitle(row, index) {
  const letter = String.fromCharCode(65 + index);
  const raw = String(row.resourceName || row.resourceCode || "").trim();
  if (/^kiln\s+[a-z]$/i.test(raw)) return `${raw} — Loader`;
  return `Kiln ${letter} — Loader`;
}

function KilnFeedChart({ row, nowMs }) {
  return (
    <AcKilnCumulativeChart
      events={row.feedEvents || []}
      nowMs={nowMs}
      heightClass="h-44"
    />
  );
}

function KilnFeedLiveCard({ row, index, nowMs, onLoad, selected }) {
  const readyHint = (row.pendingLots || []).map((lot) => lot.lotCode).filter(Boolean).join(", ");

  return (
    <article
      className={`rounded-xl border bg-white overflow-hidden ${
        selected ? "border-blue-400 shadow-sm" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-800">{kilnLoaderTitle(row, index)}</h3>
          <p className="text-sm text-slate-500 tabular-nums mt-1">{formatKgRange(row.kg)}</p>
          {row.isActive ? (
            <p className="text-xs text-slate-500 mt-1">
              Live · {row.lotCode || "—"}
              {row.inwardCode && row.inwardCode !== "—" ? ` · ${row.inwardCode}` : ""}
              {row.loadedAt ? ` · loaded ${formatLoaderTime(row.loadedAt)}` : ""}
              {row.cycleStatus?.text ? ` · ${row.cycleStatus.text}` : ""}
            </p>
          ) : readyHint ? (
            <p className="text-xs text-slate-500 mt-1">Ready to load {readyHint}</p>
          ) : (
            <p className="text-xs text-slate-400 mt-1">Idle — no charge in the kiln</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onLoad?.(row)}
          className="shrink-0 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
        >
          Load
        </button>
      </div>
      <div className="px-4 pb-4">
        <KilnFeedChart row={row} nowMs={nowMs} />
      </div>
    </article>
  );
}

export default function AcKilnFeedLiveTrack({
  dashboard,
  kilnLots = [],
  selectedKilnCode,
  onLoad,
  loading = false
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), LIVE_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const lotLines = dashboard?.lot_lines || [];
  const pendingLots = useMemo(() => pendingKilnChargeLots(lotLines), [lotLines]);
  const rows = useMemo(
    () =>
      buildAcKilnLoaderRows({
        kilns: dashboard?.kilns || [],
        kilnLots,
        lotLines
      }).map((row) => ({
        ...row,
        pendingLots: row.isActive ? [] : pendingLots
      })),
    [dashboard, kilnLots, lotLines, pendingLots]
  );

  if (!dashboard) {
    return <p className="text-sm text-slate-500 py-6 text-center">Loading kiln live track…</p>;
  }

  if (!rows.length) {
    return <EmptyState title="No kilns configured" hint="Add activation lines in Masters → Plant resources." />;
  }

  const liveCount = rows.filter((row) => row.isActive).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${liveCount ? "bg-red-500 animate-pulse" : "bg-slate-300"}`} />
          Live kiln feed
          {liveCount ? ` · ${liveCount} loaded` : ""}
          {loading ? " · refreshing…" : ""}
        </span>
      </div>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <KilnFeedLiveCard
            key={row.resourceCode}
            row={row}
            index={index}
            nowMs={nowMs}
            selected={selectedKilnCode === row.resourceCode}
            onLoad={onLoad}
          />
        ))}
      </div>
    </div>
  );
}
