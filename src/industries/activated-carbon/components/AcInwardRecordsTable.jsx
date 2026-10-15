import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../auth/AuthContext";
import { useAppContext } from "../../../context/AppContext";
import useAcPageRefresh from "../hooks/useAcPageRefresh";
import { fetchAcRawMaterialInward, formatAcApiError } from "../../../services/activatedCarbonApi";
import { isAcContextReady } from "../utils/acContextUtils";
import { userCanSeeAcSupplier } from "../utils/acPrivileges";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function localDayKey(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return localDayKey(new Date());
}

function orderDayKey(order) {
  return localDayKey(order.created_at) || localDayKey(order.order_date);
}

function formatTs(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function isDone(status) {
  const raw = String(status || "").toUpperCase();
  return raw === "COMPLETED" || raw === "RELEASED" || raw === "QC_PASSED" || raw === "RECONCILED";
}

function statusLabel(status) {
  const raw = String(status || "").toUpperCase();
  if (raw === "DENIED" || raw === "FAIL" || raw === "QC_FAILED") return "Denied";
  if (isDone(status)) return "Done";
  return "Pending";
}

function materialCode(order) {
  return (
    order.raw_product_code ||
    (order.lines || []).find((l) => String(l.product_code || "").toUpperCase().startsWith("RAW-"))
      ?.product_code ||
    "—"
  );
}

function nextStepLabel(order) {
  if (isDone(order.released_to_production_status)) return "Released";
  if (isDone(order.rm_outward_status)) return "Ready to release";
  if (isDone(order.lab_status)) return "RMS outward";
  if (isDone(order.rms_inward_status)) return "Lab";
  return "RMS inward";
}

function Fact({ label, value }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <span className="min-w-[6.5rem]">
      <span className="block text-xs text-slate-400">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function StepRow({ step, facts, status, when }) {
  const shown = (facts || []).filter(Boolean);
  return (
    <tr className="border-b border-white/10">
      <td />
      <td className="py-2.5 pr-4 pl-6 font-semibold align-top">{step}</td>
      <td colSpan={2} className="py-2.5 pr-4 align-top">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {shown.length ? shown : <span className="text-slate-400">Not recorded yet</span>}
        </div>
      </td>
      <td className="py-2.5 align-top">
        <div>{status}</div>
        {when ? <div className="text-xs text-slate-400 mt-0.5">{when}</div> : null}
      </td>
    </tr>
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
  const { user } = useAuth();
  const showSupplier = userCanSeeAcSupplier(user?.roles || [], user);
  const { focusTick } = useAcPageRefresh();
  const [ownedOrders, setOwnedOrders] = useState([]);
  const [ownedLoading, setOwnedLoading] = useState(ordersProp == null);
  const [error, setError] = useState("");
  const [day, setDay] = useState(todayKey);
  const [openId, setOpenId] = useState("");

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
  const dayOrders = useMemo(
    () => (orders || []).filter((order) => orderDayKey(order) === day),
    [orders, day]
  );

  return (
    <WfCard className={className}>
      <WfCardHeader
        title="Today's inward records"
        subtitle={`${dayOrders.length} receipt${dayOrders.length === 1 ? "" : "s"} for ${day === todayKey() ? "today" : day}. Click a row to see Inward, Lab, and Outward.`}
        right={
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-600 flex items-center gap-2">
              <span>Day</span>
              <input
                type="date"
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={day}
                onChange={(e) => {
                  setDay(e.target.value || todayKey());
                  e.target.blur();
                }}
              />
            </label>
            <button
              type="button"
              className="wf-btn wf-btn-ghost"
              disabled={ordersLoading || contextLoading || !context.loaded}
              onClick={() =>
                Promise.resolve(refresh()).catch((e) =>
                  setError(formatAcApiError(e, "Failed to refresh"))
                )
              }
            >
              {ordersLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        }
      />
      <WfCardBody>
        {error ? <p className="text-sm text-red-700 mb-2">{error}</p> : null}
        {ordersLoading && orders.length === 0 ? (
          <p className="text-sm text-slate-600">Loading inward orders…</p>
        ) : dayOrders.length === 0 ? (
          <p className="text-sm text-slate-600">
            No inward orders for this day. Pick another date to see older receipts.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-2 w-8" />
                  <th className="py-2 pr-4">Inward</th>
                  {showSupplier ? <th className="py-2 pr-4">Supplier</th> : null}
                  <th className="py-2 pr-4 text-right">{showSupplier ? "Supplier weight (KG)" : "Challan weight (KG)"}</th>
                  <th className="py-2 pr-4 text-right">Our weight (KG)</th>
                  <th className="py-2 pr-4 text-right">No. of bags</th>
                  <th className="py-2 pr-4 text-right">Bag weight (KG)</th>
                  <th className="py-2">Stage</th>
                </tr>
              </thead>
              <tbody>
                {dayOrders.map((o) => {
                  const id = String(o.customer_order_id || o.order_code);
                  const open = openId === id;
                  const received = Number(o.inward_quantity_kg ?? 0);
                  const released = Number(o.allocated_to_production_kg ?? 0);
                  const available = Number(
                    o.available_quantity_kg ?? Math.max(received - released, 0)
                  );
                  return (
                    <Fragment key={id}>
                      <tr
                        className="border-b border-slate-200 cursor-pointer"
                        onClick={() => setOpenId(open ? "" : id)}
                      >
                        <td className="py-2.5 pr-2 text-slate-600">{open ? "▾" : "▸"}</td>
                        <td className="py-2.5 pr-4 font-mono">{o.order_code}</td>
                        {showSupplier ? (
                          <td className="py-2.5 pr-4">{o.supplier_name || o.supplier_code || "—"}</td>
                        ) : null}
                        <td className="py-2.5 pr-4 text-right font-mono">
                          {formatKg(o.supplier_weight_kg)}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono">
                          {formatKg(o.our_weight_kg ?? received)}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono">
                          {o.rms_bag_count != null ? o.rms_bag_count : "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono">
                          {formatKg(o.rms_bag_weight_kg)}
                        </td>
                        <td className="py-2.5">{nextStepLabel(o)}</td>
                      </tr>
                      {open ? (
                        <>
                          <StepRow
                            step="Inward"
                            status={statusLabel(o.rms_inward_status)}
                            when={formatTs(o.rms_inward_at)}
                            facts={[
                              <Fact key="dc" label="DC" value={o.dc_number} />,
                              <Fact key="mat" label="Material" value={materialCode(o)} />,
                              <Fact key="sup" label={showSupplier ? "Supplier kg" : "Challan kg"} value={formatKg(o.supplier_weight_kg)} />,
                              <Fact key="our" label="Our kg" value={formatKg(o.our_weight_kg ?? received)} />,
                              <Fact
                                key="bags"
                                label="No. of bags"
                                value={o.rms_bag_count != null ? String(o.rms_bag_count) : null}
                              />,
                              <Fact key="bagwt" label="Bag weight kg" value={formatKg(o.rms_bag_weight_kg)} />
                            ]}
                          />
                          <StepRow
                            step="Lab"
                            status={statusLabel(o.lab_status)}
                            when={formatTs(o.lab_at)}
                            facts={[
                              <Fact
                                key="moi"
                                label="Moisture"
                                value={o.lab_moisture_pct != null ? `${o.lab_moisture_pct}%` : null}
                              />,
                              <Fact
                                key="dust"
                                label="Dust"
                                value={o.lab_dust_pct != null ? `${o.lab_dust_pct}%` : null}
                              />,
                              <Fact
                                key="vol"
                                label="Volatility"
                                value={o.lab_volatility != null ? `${o.lab_volatility}%` : null}
                              />
                            ]}
                          />
                          <StepRow
                            step="Outward"
                            status={statusLabel(o.rm_outward_status)}
                            when={formatTs(o.rm_outward_at)}
                            facts={[
                              <Fact key="rel" label="Released kg" value={formatKg(released)} />,
                              <Fact key="rem" label="Remaining kg" value={formatKg(available)} />,
                              <Fact
                                key="prod"
                                label="To production"
                                value={statusLabel(o.released_to_production_status)}
                              />
                            ]}
                          />
                        </>
                      ) : null}
                    </Fragment>
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
