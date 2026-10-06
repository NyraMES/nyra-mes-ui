import { Link } from "react-router-dom";

import { EmptyState, StatusPill } from "../../../workflow/ui";

const STATUS_ORDER = { RUNNING: 0, COOLING: 1, IDLE: 2 };

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
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

function statusKind(status) {
  const s = (status || "").toUpperCase();
  if (s === "RUNNING") return "ok";
  if (s === "COOLING") return "warn";
  return "neutral";
}

function KilnFeedRow({ kiln }) {
  const stockKg = kiln.active_lot_kg;
  const hasStock = stockKg != null && Number(stockKg) > 0;
  const feedTime = formatFeedTime(kiln.last_reading_at);

  return (
    <article className="relative rounded-lg border border-slate-700/50 bg-slate-900/50 overflow-hidden">
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${
          kiln.status === "RUNNING"
            ? "bg-emerald-400"
            : kiln.status === "COOLING"
              ? "bg-amber-400"
              : "bg-slate-600"
        }`}
      />
      <div className="pl-3 pr-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-medium text-slate-100">{kiln.resource_code}</span>
              {kiln.status === "RUNNING" ? (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              ) : null}
            </div>
            <div className="text-xs text-slate-400 truncate mt-0.5">{kiln.resource_name}</div>
          </div>
          <StatusPill kind={statusKind(kiln.status)}>{kiln.status || "IDLE"}</StatusPill>
        </div>

        <div className="mt-2 rounded-md bg-slate-950/60 border border-slate-700/40 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Stock in kiln</div>
          <div className={`text-lg font-bold tabular-nums mt-0.5 ${hasStock ? "text-cyan-200" : "text-slate-500"}`}>
            {hasStock ? formatKg(stockKg) : "Empty"}
          </div>
          {kiln.active_lot_code ? (
            <div className="text-xs text-slate-400 font-mono mt-1">
              {kiln.active_inward_order_code || kiln.active_order_code || kiln.active_lot_code}
            </div>
          ) : (
            <div className="text-xs text-slate-500 mt-1">No active lot</div>
          )}
        </div>

        {feedTime ? (
          <div className="text-[10px] text-slate-500 mt-1.5 tabular-nums">Updated {feedTime}</div>
        ) : null}
      </div>
    </article>
  );
}

export default function AcKilnLiveFeed({ kilns = [], refreshedAt }) {
  if (!kilns.length) {
    return <EmptyState title="No kilns configured" hint="Seed RES-KILN-01 in master data." />;
  }

  const sorted = [...kilns].sort((a, b) => {
    const ao = STATUS_ORDER[(a.status || "").toUpperCase()] ?? 9;
    const bo = STATUS_ORDER[(b.status || "").toUpperCase()] ?? 9;
    return ao - bo || String(a.resource_code).localeCompare(String(b.resource_code));
  });

  const runningCount = kilns.filter((k) => (k.status || "").toUpperCase() === "RUNNING").length;
  const totalStock = kilns.reduce((sum, k) => sum + (Number(k.active_lot_kg) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          Live feed
          {runningCount > 0 ? ` · ${runningCount} kiln${runningCount === 1 ? "" : "s"} running` : ""}
        </span>
        {totalStock > 0 ? (
          <span className="tabular-nums text-slate-300">{formatKg(totalStock)} total in kilns</span>
        ) : null}
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5 ac-kiln-live-feed">
        {sorted.map((kiln) => (
          <KilnFeedRow key={kiln.resource_code} kiln={kiln} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-700/40">
        {refreshedAt ? (
          <span className="text-[10px] text-slate-500">
            Updated {formatFeedTime(refreshedAt) || "recently"} · auto-refresh every 10 min
          </span>
        ) : (
          <span className="text-[10px] text-slate-500">Auto-refresh every 10 min</span>
        )}
        <Link
          to="/activated-carbon/kiln-telemetry"
          className="text-xs text-cyan-300 hover:text-cyan-100 inline-flex items-center gap-0.5"
        >
          Telemetry
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
