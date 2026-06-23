import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchAcKilnFeedLots } from "../../../services/activatedCarbonApi";
import { EmptyState } from "../../../workflow/ui";
import { buildAcKilnLoaderRows, formatLoaderTime } from "../utils/acKilnLoaderUtils";

const CYCLE_TONE_CLASS = {
  active: "text-cyan-300",
  warn: "text-amber-300",
  neutral: "text-slate-400"
};

function LoaderTimeline({ progress, totalHours }) {
  const pct = Math.round(progress * 100);
  const endLabel = totalHours >= 1 ? `${totalHours.toFixed(totalHours % 1 === 0 ? 0 : 1)}h` : `${Math.round(totalHours * 60)}m`;

  return (
    <div className="relative mt-2 rounded border border-slate-600/50 bg-slate-950/50 overflow-hidden">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.2) 1px, transparent 1px)",
          backgroundSize: "16px 16px"
        }}
      />
      <div className="relative h-16 px-2 py-1.5">
        <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-px bg-slate-600/60" />
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 rounded-full transition-all duration-500"
          style={{ width: `calc(${pct}% - 4px)`, maxWidth: "calc(100% - 8px)" }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-rose-500 border-2 border-slate-900"
          style={{ left: `calc(${pct}% + 4px)` }}
        />
        <div
          className="absolute top-0 bottom-0 border-l border-dashed border-slate-500/50"
          style={{ left: "calc(100% - 12px)" }}
        />
        <div className="absolute bottom-0.5 left-2 text-[9px] text-slate-500 tabular-nums">0h</div>
        <div className="absolute bottom-0.5 right-2 text-[9px] text-slate-500 tabular-nums">{endLabel}</div>
      </div>
    </div>
  );
}

function KilnLoaderCard({ row }) {
  const kilnLabel = row.resourceName?.replace(/kiln/i, "Kiln") || row.resourceCode;

  return (
    <article className="rounded-lg border border-slate-600/50 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-700/40 bg-slate-900/60">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-100 truncate">{kilnLabel} — Loader</h4>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            {row.isActive && row.kg > 0
              ? `${row.kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg in kiln`
              : "0 — 0.00 kg"}
          </div>
        </div>
        <Link
          to="/activated-carbon/kiln-feed"
          className="shrink-0 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1"
        >
          Load
        </Link>
      </div>

      <div className="px-3 py-2.5 space-y-1.5">
        {row.isActive ? (
          <>
            <div className="space-y-1 text-[11px]">
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="text-slate-500">
                  Inward{" "}
                  <span className="font-mono text-slate-200" title={row.inwardFull || undefined}>
                    {row.inwardCode}
                  </span>
                </span>
                <span className="text-slate-500">
                  Loaded <span className="text-slate-200 tabular-nums">{formatLoaderTime(row.loadedAt)}</span>
                </span>
              </div>
              <div className="text-slate-500">
                Lot{" "}
                <span className="font-mono text-slate-200">{row.lotCode || "—"}</span>
                {row.kg > 0 ? (
                  <span className="text-slate-400">
                    {" "}
                    · {row.kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
                  </span>
                ) : null}
              </div>
              <div className="text-slate-500">
                Cycle time left{" "}
                <span className={`font-medium tabular-nums ${CYCLE_TONE_CLASS[row.cycleStatus?.tone] || "text-slate-300"}`}>
                  {row.cycleStatus?.text || "—"}
                </span>
              </div>
            </div>
            <LoaderTimeline progress={row.progress} totalHours={row.totalHours} />
          </>
        ) : (
          <p className="text-xs text-slate-500 py-4 text-center">No active load — kiln idle</p>
        )}
      </div>
    </article>
  );
}

export default function AcKilnFeedLoaderPanel({ dashboard }) {
  const [kilnLots, setKilnLots] = useState([]);
  const [loading, setLoading] = useState(false);

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
    return <p className="text-sm text-slate-400 py-6 text-center">Loading kiln feed…</p>;
  }

  if (!rows.length) {
    return <EmptyState title="No kilns configured" hint="Add activation lines in Masters." />;
  }

  return (
    <div className="space-y-2">
      {loading ? <p className="text-[11px] text-slate-500">Refreshing feed lots…</p> : null}
      {rows.map((row) => (
        <KilnLoaderCard key={row.resourceCode} row={row} />
      ))}
    </div>
  );
}
