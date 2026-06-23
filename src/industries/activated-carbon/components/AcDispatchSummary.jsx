import { Link } from "react-router-dom";

import useIndustryBasePath from "../../../hooks/useIndustryBasePath";

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString()} KG`;
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return String(value);
  }
}

/**
 * Recent customer shipments + totals for dashboard and dispatch context.
 */
export default function AcDispatchSummary({ dashboard }) {
  const basePath = useIndustryBasePath();
  const dispatchCount = Number(dashboard?.dispatch_count || 0);
  const dispatchedKg = Number(dashboard?.dispatched_kg_total || 0);
  const inStockKg = Number(dashboard?.finished_goods_stock_kg || 0);
  const recent = dashboard?.recent_dispatches || [];
  const openPos = dashboard?.open_customer_orders || [];

  return (
    <div className="wf-light-panel rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">
          Outbound & dispatch
        </p>
        <Link
          to={`${basePath}/dispatch`}
          className="text-xs font-semibold text-sky-900 underline"
        >
          Open Dispatch →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="rounded-lg bg-white border border-sky-100 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-600">Shipments</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{dispatchCount}</p>
        </div>
        <div className="rounded-lg bg-white border border-sky-100 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-600">Dispatched</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{formatKg(dispatchedKg)}</p>
        </div>
        <div className="rounded-lg bg-white border border-emerald-100 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-600">In stock now</p>
          <p className="text-lg font-bold text-emerald-900 tabular-nums">{formatKg(inStockKg)}</p>
        </div>
        <div className="rounded-lg bg-white border border-amber-100 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-600">Open POs</p>
          <p className="text-lg font-bold text-amber-950 tabular-nums">{openPos.length}</p>
        </div>
      </div>

      {recent.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-sky-200 text-left text-slate-700">
                <th className="py-1.5 pr-3 font-semibold">Dispatch</th>
                <th className="py-1.5 pr-3 font-semibold">PO</th>
                <th className="py-1.5 pr-3 font-semibold">Lot</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Qty</th>
                <th className="py-1.5 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.dispatch_id} className="border-b border-sky-100 text-slate-900">
                  <td className="py-1.5 pr-3 font-mono text-xs">{row.dispatch_id}</td>
                  <td className="py-1.5 pr-3 font-mono">{row.order_code || "—"}</td>
                  <td className="py-1.5 pr-3 font-mono">{row.lot_code || "—"}</td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                    {formatKg(row.quantity_kg)}
                  </td>
                  <td className="py-1.5 text-xs text-slate-700">{formatDate(row.dispatch_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-900">
          No shipments recorded yet. Confirm dispatch against a customer PO — stock is reduced and
          the PO closes when fully shipped.
        </p>
      )}
    </div>
  );
}
