import { useEffect, useState } from "react";

import {
  fetchAcKilnFeedLots,
  fetchAcRawMaterialInward,
  fetchAcRawMaterialQc
} from "../../../services/activatedCarbonApi";
import { buildAcYieldDetailBundle } from "../utils/acStockAnalytics";
import { AcKilnYieldChart, AcRmsLossChart } from "./AcProductionStockCharts";

export default function AcYieldReportsPanel({ dashboard }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dashboard) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [qc, inward, kilnLots] = await Promise.all([
          fetchAcRawMaterialQc().catch(() => []),
          fetchAcRawMaterialInward().catch(() => []),
          fetchAcKilnFeedLots().catch(() => [])
        ]);
        if (cancelled) return;
        setDetail(
          buildAcYieldDetailBundle({
            dashboard,
            qcRows: qc,
            kilnLots,
            inwardOrders: inward
          })
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dashboard]);

  if (!dashboard || loading) {
    return <p className="text-sm text-slate-400 py-6 text-center">Loading yield reports…</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AcRmsLossChart bundle={detail?.rmsLoss} />
      <AcKilnYieldChart bundle={detail?.kilnYield} />
    </div>
  );
}
