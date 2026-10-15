import { Link } from "react-router-dom";

import useIndustryBasePath from "../../../hooks/useIndustryBasePath";
import AcAlert from "./AcAlert";

/**
 * Grade-wise in-stock summary for dashboard and dispatch readiness.
 */
export default function AcGradeStockAlert({ gradeStock = [], readOnly = false }) {
  const basePath = useIndustryBasePath();
  const rows = gradeStock.filter((g) => Number(g.quantity_kg) > 0);
  const totalKg = rows.reduce((sum, row) => sum + Number(row.quantity_kg || 0), 0);

  if (!rows.length) {
    return (
      <AcAlert variant="warning">
        No finished-goods stock by grade yet. Complete execution, screening, and quality testing,
        then dispatch from In Stock.
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
          {readOnly ? (
            <span className="inline-block mt-2 text-xs font-semibold text-emerald-900/50">
              View stocked lots & dispatch →
            </span>
          ) : (
            <Link
              to={`${basePath}/dispatch`}
              className="inline-block mt-2 text-xs font-semibold text-emerald-900 underline"
            >
              View stocked lots & dispatch →
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
