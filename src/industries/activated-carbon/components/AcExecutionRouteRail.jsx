import { StatusPill } from "../../../workflow/ui";

function statusKind(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("complete")) return "ok";
  if (s.includes("progress")) return "info";
  if (s.includes("hold")) return "neutral";
  if (s.includes("ready")) return "warn";
  return "neutral";
}

/**
 * Right-rail process chain for unified AC execution (raw material route → finished goods).
 */
export default function AcExecutionRouteRail({
  operations = [],
  activeId = "",
  onSelect,
  readOnlyFuture = true
}) {
  if (!operations.length) {
    return (
      <p className="text-xs text-slate-500 py-4 text-center">
        No route steps yet. Load the kiln — routing is created automatically.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {operations.map((op, index) => {
        const id = op.work_order_id || op.lot_operation_id;
        const isActive = id === activeId;
        const isNext = op.can_start && op.status === "Ready";
        const isFuture =
          op.status !== "Completed" &&
          op.status !== "In Progress" &&
          op.status !== "On Hold" &&
          !op.can_start;
        const clickable = onSelect && (!readOnlyFuture || !isFuture);

        const body = (
          <>
            <span
              className={[
                "w-7 h-7 rounded-md border flex items-center justify-center font-mono text-[10px] shrink-0",
                isActive
                  ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-100"
                  : "bg-slate-900/70 border-slate-700/50 text-slate-400"
              ].join(" ")}
            >
              {op.seq ?? index + 1}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-slate-100 truncate">{op.operation_name}</span>
              <span className="block text-[10px] text-slate-500 font-mono truncate">
                {op.operation_code}
                {op.is_mandatory === false ? " · optional" : ""}
              </span>
            </span>
            {isNext && !isActive && (
              <span className="text-[9px] uppercase tracking-wide text-emerald-300 font-semibold shrink-0">
                Next
              </span>
            )}
            <StatusPill kind={statusKind(op.status)}>{op.status}</StatusPill>
          </>
        );

        if (!clickable) {
          return (
            <div
              key={id}
              className={[
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 opacity-60",
                isActive ? "border-cyan-400/40 bg-cyan-500/5" : "border-slate-800/60 bg-slate-900/30"
              ].join(" ")}
            >
              {body}
            </div>
          );
        }

        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={[
              "w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
              isActive
                ? "border-cyan-400/50 bg-cyan-500/10"
                : isNext
                  ? "border-emerald-400/40 bg-emerald-500/5 hover:border-emerald-400/60"
                  : "border-slate-700/50 bg-slate-900/40 hover:border-slate-600"
            ].join(" ")}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
