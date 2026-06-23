import { Link } from "react-router-dom";

import useIndustryBasePath from "../../../hooks/useIndustryBasePath";
import AcAlert from "./AcAlert";

/**
 * Grade-wise in-stock summary for dashboard and dispatch readiness.
 */
export default function AcGradeStockAlert({ gradeStock = [], openOrders = [] }) {
  const basePath = useIndustryBasePath();
  const rows = gradeStock.filter((g) => Number(g.quantity_kg) > 0);
  const pendingDispatch = openOrders.filter((o) => Number(o.remaining_kg) > 0);
  const totalKg = rows.reduce((sum, row) => sum + Number(row.quantity_kg || 0), 0);

  if (!rows.length && !pendingDispatch.length) {
    return (
      <AcAlert variant="warning">
        No finished-goods stock by grade yet. Complete execution, screening, and quality testing on a
        lot, then raise a{" "}
        <Link to={`${basePath}/customer-sales`} className="underline font-medium text-amber-900">
          Customer PO
        </Link>{" "}
        before dispatch.
      </AcAlert>
    );
  }

  return (
    <div className="space-y-3">
      {rows.length > 0 ? (
        <div className="wf-light-panel rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Grade-wise in stock
            </p>
            <p className="text-sm font-semibold text-emerald-900 font-mono tabular-nums">
              Total {totalKg.toLocaleString()} KG
            </p>
          </div>
          <ul className="text-sm space-y-1.5">
            {rows.map((row) => (
              <li key={row.grade_code} className="flex justify-between gap-3 text-emerald-900">
                <span>
                  {row.grade_label || row.grade_code}
                  {row.product_code ? (
                    <span className="text-emerald-700 font-mono text-xs ml-1">· {row.product_code}</span>
                  ) : null}
                  {Number(row.stocked_lot_count) > 0 ? (
                    <span className="text-emerald-700 text-xs ml-1">
                      · {row.stocked_lot_count} lot{row.stocked_lot_count === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </span>
                <span className="font-mono tabular-nums shrink-0 text-emerald-800 font-medium">
                  {Number(row.quantity_kg).toLocaleString()} {row.uom || "KG"}
                </span>
              </li>
            ))}
          </ul>
          <Link
            to={`${basePath}/dispatch`}
            className="inline-block mt-2 text-xs font-semibold text-emerald-900 underline"
          >
            View stocked lots & dispatch →
          </Link>
        </div>
      ) : null}

      {pendingDispatch.length > 0 ? (
        <div className="wf-light-panel rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-2">
            Customer POs awaiting dispatch
          </p>
          <ul className="text-sm space-y-2">
            {pendingDispatch.map((order) => (
              <li key={order.customer_order_id} className="text-amber-950">
                <div className="flex justify-between gap-3">
                  <span className="font-mono font-medium">{order.order_code}</span>
                  <span className="font-mono tabular-nums">
                    {Number(order.remaining_kg).toLocaleString()} KG due
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-0.5">
                  {order.product_code} · stock {Number(order.stock_on_hand_kg).toLocaleString()} KG
                  {order.can_dispatch_from_stock ? " · ready to ship" : " · short — see Customer PO"}
                </p>
              </li>
            ))}
          </ul>
          <Link
            to={`${basePath}/dispatch`}
            className="inline-block mt-2 text-xs font-semibold text-amber-900 underline"
          >
            Open Dispatch →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
