import { useCallback, useEffect, useState } from "react";

import { useAppContext } from "../../../context/AppContext";
import useAcPageRefresh from "../hooks/useAcPageRefresh";
import { fetchAcRawMaterialInward, formatAcApiError } from "../../../services/activatedCarbonApi";
import { isAcContextReady } from "../utils/acContextUtils";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function formatTs(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function isDone(status) {
  const raw = String(status || "").toUpperCase();
  return raw === "COMPLETED" || raw === "RELEASED" || raw === "QC_PASSED";
}

function MarkWithDate({ status, at }) {
  const done = isDone(status);
  return (
    <div>
      <div className={`text-base leading-none ${done ? "text-emerald-700" : "text-rose-600"}`}>
        {done ? "✓" : "✗"}
      </div>
      <div className="text-[11px] text-slate-500 mt-1">{done ? formatTs(at) : "—"}</div>
    </div>
  );
}

function materialCode(order) {
  return (
    order.raw_product_code ||
    (order.lines || []).find((l) => String(l.product_code || "").toUpperCase().startsWith("RAW-"))
      ?.product_code ||
    "—"
  );
}

export default function AcInwardRecordsTable({
  orders: ordersProp = null,
  loading: loadingProp = null,
  onRefresh = null,
  refreshToken = 0,
  className = "mb-6"
}) {
  const { context, loading: contextLoading } = useAppContext();
  const { focusTick } = useAcPageRefresh();
  const [ownedOrders, setOwnedOrders] = useState([]);
  const [ownedLoading, setOwnedLoading] = useState(ordersProp == null);
  const [error, setError] = useState("");

  const managed = ordersProp == null;
  const orders = managed ? ownedOrders : ordersProp;
  const ordersLoading = managed ? ownedLoading : Boolean(loadingProp);

  const reloadOwned = useCallback(async () => {
    if (!managed) return;
    if (!isAcContextReady(context, contextLoading)) {
      setOwnedLoading(false);
      return;
    }
    setOwnedLoading(true);
    try {
      setOwnedOrders(await fetchAcRawMaterialInward());
      setError("");
    } catch (e) {
      setError(formatAcApiError(e, "Failed to load inward records"));
    } finally {
      setOwnedLoading(false);
    }
  }, [managed, context, contextLoading, context.tenant_code, context.workspace_code]);

  useEffect(() => {
    if (!managed) return;
    reloadOwned();
  }, [managed, reloadOwned, refreshToken, focusTick]);

  const refresh = () => {
    if (onRefresh) {
      onRefresh();
      return;
    }
    reloadOwned();
  };

  const contextReady = isAcContextReady(context, contextLoading);

  return (
    <WfCard className={className}>
      <WfCardHeader
        title="Inward records"
        right={
          <button
            type="button"
            className="text-xs font-medium text-blue-700 hover:text-blue-900"
            disabled={ordersLoading || contextLoading || !context.loaded}
            onClick={() =>
              Promise.resolve(refresh()).catch((e) =>
                setError(formatAcApiError(e, "Failed to refresh"))
              )
            }
          >
            {ordersLoading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />
      <WfCardBody>
        {error ? <p className="text-sm text-red-700 mb-2">{error}</p> : null}
        {ordersLoading && orders.length === 0 ? (
          <p className="text-sm text-slate-600">Loading inward orders…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-600">No inward orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[72rem]">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2">Order</th>
                  <th className="py-2">DC</th>
                  <th className="py-2">Material</th>
                  <th className="py-2 text-right">Supplier (KG)</th>
                  <th className="py-2 text-right">Our wt (KG)</th>
                  <th className="py-2 text-right">Released (KG)</th>
                  <th className="py-2 text-right">Available (KG)</th>
                  <th className="py-2">Supplier</th>
                  <th className="py-2">Lab status</th>
                  <th className="py-2">RMS inward status</th>
                  <th className="py-2">RM outward status</th>
                  <th className="py-2">Released to production</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const received = Number(o.inward_quantity_kg ?? 0);
                  const released = Number(o.allocated_to_production_kg ?? 0);
                  const available = Number(
                    o.available_quantity_kg ?? Math.max(received - released, 0)
                  );
                  return (
                    <tr
                      key={o.customer_order_id || o.order_code}
                      className="border-b border-slate-100 align-top"
                    >
                      <td className="py-2 font-mono">{o.order_code}</td>
                      <td className="py-2 font-mono text-slate-600">{o.dc_number || "—"}</td>
                      <td className="py-2 font-mono text-slate-700">{materialCode(o)}</td>
                      <td className="py-2 text-right font-mono">{o.supplier_weight_kg ?? "—"}</td>
                      <td className="py-2 text-right font-mono">
                        {(o.our_weight_kg ?? received) || "—"}
                      </td>
                      <td className="py-2 text-right font-mono">{released || "0"}</td>
                      <td className="py-2 text-right font-mono font-medium text-emerald-800">
                        {available}
                      </td>
                      <td className="py-2">{o.supplier_name || o.supplier_code || "—"}</td>
                      <td className="py-2">
                        <MarkWithDate status={o.lab_status} at={o.lab_at} />
                      </td>
                      <td className="py-2">
                        <MarkWithDate status={o.rms_inward_status} at={o.rms_inward_at} />
                      </td>
                      <td className="py-2">
                        <MarkWithDate status={o.rm_outward_status} at={o.rm_outward_at} />
                      </td>
                      <td className="py-2">
                        <MarkWithDate
                          status={o.released_to_production_status}
                          at={o.released_to_production_at}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!contextReady ? (
          <p className="text-xs text-slate-500 mt-2">Waiting for workspace context…</p>
        ) : null}
      </WfCardBody>
    </WfCard>
  );
}
