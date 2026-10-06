import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useAppContext } from "../../../context/AppContext";
import useIndustryBasePath from "../../../hooks/useIndustryBasePath";
import useAcPageRefresh from "../hooks/useAcPageRefresh";
import {
  bagMatchesDispatchOrder,
  createAcDispatchFromOrder,
  fetchAcDispatches,
  fetchAcInStockBags,
  fetchAcOpenCustomerOrders,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import { isAcContextReady } from "../utils/acContextUtils";
import AcAlert from "../components/AcAlert";
import AcFormSelect from "../components/AcFormSelect";
import AcSaveBar from "../components/AcSaveBar";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

const SOURCE_LABELS = {
  destoning: "Destoning",
  screening: "Screening",
  crushing: "Crushing",
  dedusting: "De-dusting",
  demagnetisation: "De-magnetisation",
  blending: "Blending",
  fg_qc: "Finished Goods"
};

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString()} KG`;
}

function sourceLabel(source) {
  return SOURCE_LABELS[source] || source || "In Stock";
}

function StockSummary({ bags, loading }) {
  const [openSource, setOpenSource] = useState("");

  const groups = useMemo(() => {
    const bySource = new Map();
    for (const bag of bags) {
      const key = bag.source || "in_stock";
      const current = bySource.get(key) || { source: key, bags: [], kg: 0 };
      current.bags.push(bag);
      current.kg += Number(bag.remaining_kg || 0);
      bySource.set(key, current);
    }
    return Array.from(bySource.values()).sort((a, b) =>
      sourceLabel(a.source).localeCompare(sourceLabel(b.source))
    );
  }, [bags]);

  const totalKg = bags.reduce((sum, bag) => sum + Number(bag.remaining_kg || 0), 0);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading stock…</p>;
  }
  if (!bags.length) {
    return (
      <p className="text-sm text-slate-600">
        No bags in stock yet. Set destination to In Stock on destoning, crushing, or
        de-magnetisation quality.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Available stock</p>
          <p className="text-lg font-semibold text-slate-900 tabular-nums">{formatKg(totalKg)}</p>
        </div>
        <p className="text-sm text-slate-600">{bags.length} bag{bags.length === 1 ? "" : "s"}</p>
      </div>
      <p className="text-xs text-slate-500">Click a process to see bag numbers and quantity.</p>
      <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
        {groups.map((group) => {
          const open = openSource === group.source;
          return (
            <div key={group.source}>
              <button
                type="button"
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50"
                onClick={() => setOpenSource(open ? "" : group.source)}
                aria-expanded={open}
              >
                <span className="font-medium text-slate-900">{sourceLabel(group.source)}</span>
                <span className="text-sm text-slate-700 tabular-nums">
                  {formatKg(group.kg)} · {group.bags.length} bag{group.bags.length === 1 ? "" : "s"}{" "}
                  <span className="text-slate-400">{open ? "▾" : "▸"}</span>
                </span>
              </button>
              {open ? (
                <table className="w-full text-sm border-t border-slate-100">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-4 py-2 font-semibold">Bag</th>
                      <th className="px-4 py-2 font-semibold">Grade</th>
                      <th className="px-4 py-2 font-semibold text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.bags.map((bag) => (
                      <tr key={bag.bag_code} className="border-t border-slate-50 text-slate-900">
                        <td className="px-4 py-2 font-mono">{bag.bag_code}</td>
                        <td className="px-4 py-2">{bag.grade || "In Stock"}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">
                          {formatKg(bag.remaining_kg)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DispatchPage() {
  const { context, loading: contextLoading } = useAppContext();
  const basePath = useIndustryBasePath();
  const { focusTick } = useAcPageRefresh();
  const [searchParams] = useSearchParams();

  const [openOrders, setOpenOrders] = useState([]);
  const [inStockBags, setInStockBags] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [customerOrderId, setCustomerOrderId] = useState("");
  const [bagCode, setBagCode] = useState("");
  const [dispatchQty, setDispatchQty] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transporterName, setTransporterName] = useState("");

  const reload = useCallback(async () => {
    const [orders, bags, history] = await Promise.all([
      fetchAcOpenCustomerOrders(),
      fetchAcInStockBags(),
      fetchAcDispatches()
    ]);
    setOpenOrders(orders || []);
    setInStockBags(bags || []);
    setDispatches(history || []);
    return orders || [];
  }, []);

  useEffect(() => {
    if (!isAcContextReady(context, contextLoading)) return;
    setLoading(true);
    setError("");
    reload()
      .catch((e) => setError(formatAcApiError(e, "Failed to load dispatch data")))
      .finally(() => setLoading(false));
  }, [context, contextLoading, context.tenant_code, context.workspace_code, focusTick, reload]);

  useEffect(() => {
    const preselect = searchParams.get("order");
    if (!preselect || !openOrders.length) return;
    const match = openOrders.find((o) => o.order_code === preselect);
    if (match) setCustomerOrderId(String(match.customer_order_id));
  }, [searchParams, openOrders]);

  const selectedOrder = useMemo(
    () => openOrders.find((o) => String(o.customer_order_id) === String(customerOrderId)),
    [openOrders, customerOrderId]
  );

  const eligibleBags = useMemo(() => {
    if (!selectedOrder) return inStockBags;
    return inStockBags.filter((bag) => bagMatchesDispatchOrder(bag, selectedOrder));
  }, [inStockBags, selectedOrder]);

  useEffect(() => {
    if (!selectedOrder) return;
    setDispatchQty(String(selectedOrder.remaining_kg || ""));
    setBagCode(eligibleBags[0]?.bag_code || "");
  }, [selectedOrder, eligibleBags]);

  const canDispatch =
    selectedOrder &&
    Number(selectedOrder.remaining_kg) > 0 &&
    Number(selectedOrder.stock_on_hand_kg) >= Number(dispatchQty || 0) &&
    Number(dispatchQty) > 0 &&
    Number(dispatchQty) <= Number(selectedOrder.remaining_kg);

  const handleSave = async () => {
    if (!customerOrderId || !dispatchQty) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await createAcDispatchFromOrder({
        customer_order_id: customerOrderId,
        quantity_kg: dispatchQty,
        bag_code: bagCode || undefined,
        vehicle_number: vehicleNumber || undefined,
        transporter_name: transporterName || undefined
      });
      setSuccess(
        `Dispatch ${result.dispatch_id} · ${formatKg(result.quantity_kg)} of ${result.grade_code || "FG"} shipped against ${result.order_code}.` +
          ` Stock now ${formatKg(result.stock_on_hand_after_kg)}.` +
          (Number(result.remaining_on_order_kg) > 0
            ? ` ${formatKg(result.remaining_on_order_kg)} still open on PO (status ${result.order_status}).`
            : " Customer PO closed.")
      );
      setVehicleNumber("");
      setTransporterName("");
      await reload();
    } catch (e) {
      setError(formatAcApiError(e, "Dispatch failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <SectionHeader
        eyebrow="Outbound"
        title="Dispatch"
        subtitle="Ship against a customer PO from In Stock bags (destoning, crushing, de-magnetisation, and other post-activation)."
      />

      {error && <AcAlert variant="error">{error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      {!loading && openOrders.length === 0 ? (
        <AcAlert variant="warning">
          No open customer POs. Create one on{" "}
          <Link to={`${basePath}/customer-sales`} className="underline font-medium text-amber-900">
            Customer PO
          </Link>{" "}
          before shipping.
        </AcAlert>
      ) : null}

      <WfCard>
        <WfCardHeader title="Ship against customer PO" subtitle="Select PO · pick in-stock bag · confirm qty" />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 space-y-4">
            <AcFormSelect
              label="Customer PO"
              value={customerOrderId}
              loading={loading}
              onChange={(e) => {
                setCustomerOrderId(e.target.value);
                setBagCode("");
                setDispatchQty("");
              }}
            >
              <option value="">Select customer PO…</option>
              {openOrders.map((o) => (
                <option key={o.customer_order_id} value={String(o.customer_order_id)}>
                  {o.order_code} · {o.customer_name || o.customer_code} · {o.product_code} ·{" "}
                  {Number(o.remaining_kg).toLocaleString()} KG due · stock{" "}
                  {Number(o.stock_on_hand_kg).toLocaleString()} KG
                </option>
              ))}
            </AcFormSelect>

            {selectedOrder ? (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Customer</p>
                  <p className="font-medium">
                    {selectedOrder.customer_name || selectedOrder.customer_code || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Grade / product</p>
                  <p className="font-mono font-medium">{selectedOrder.product_code}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">PO quantity</p>
                  <p className="font-mono">{formatKg(selectedOrder.ordered_kg)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Remaining to ship</p>
                  <p className="font-mono font-semibold text-blue-800">
                    {formatKg(selectedOrder.remaining_kg)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Stock on hand</p>
                  <p className="font-mono">{formatKg(selectedOrder.stock_on_hand_kg)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Matching in-stock bags</p>
                  <p className="font-mono">{eligibleBags.length}</p>
                </div>
                <div className="md:col-span-2">
                  {selectedOrder.can_dispatch_from_stock ? (
                    <p className="text-emerald-800 font-medium">Stock covers this PO — ready to dispatch.</p>
                  ) : (
                    <p className="text-amber-900">
                      Short by{" "}
                      {formatKg(
                        Math.max(
                          Number(selectedOrder.remaining_kg) - Number(selectedOrder.stock_on_hand_kg),
                          0
                        )
                      )}{" "}
                      — complete production or check tentative date on Customer PO.
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <AcFormSelect
                label="In-stock bag"
                value={bagCode}
                loading={loading}
                onChange={(e) => setBagCode(e.target.value)}
              >
                <option value="">
                  {eligibleBags.length
                    ? "Auto-select oldest in-stock bag"
                    : "No matching in-stock bags"}
                </option>
                {eligibleBags.map((bag) => (
                  <option key={bag.bag_code} value={bag.bag_code}>
                    {bag.bag_code} · {sourceLabel(bag.source)} · {bag.grade || "In Stock"} ·{" "}
                    {formatKg(bag.remaining_kg)}
                  </option>
                ))}
              </AcFormSelect>

              <label className="text-sm">
                <span className="block mb-1 font-medium text-slate-700">Dispatch qty</span>
                <input
                  type="number"
                  min="1"
                  max={selectedOrder ? Number(selectedOrder.remaining_kg) : undefined}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={dispatchQty}
                  onChange={(e) => setDispatchQty(e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1 font-medium text-slate-700">Vehicle number</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1 font-medium text-slate-700">Transporter</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                />
              </label>
            </div>

            {selectedOrder && Number(selectedOrder.stock_on_hand_kg) <= 0 ? (
              <AcAlert variant="warning">
                No In Stock bags are available for <strong>{selectedOrder.product_code}</strong>.
                Set destoning, crushing, or de-magnetisation destination to In Stock first.
              </AcAlert>
            ) : null}

            <AcSaveBar
              onSave={handleSave}
              saving={saving}
              saveLabel="Confirm dispatch"
              disabled={loading || !customerOrderId || !canDispatch}
            />
          </div>
        </WfCardBody>
      </WfCard>

      <WfCard>
        <WfCardHeader
          title="Available stock"
          subtitle="In Stock bags from destoning, crushing, de-magnetisation, and other post-activation steps"
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4">
            <StockSummary bags={inStockBags} loading={loading} />
          </div>
        </WfCardBody>
      </WfCard>

      <WfCard>
        <WfCardHeader title="Dispatch history" />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4">
            {dispatches.length === 0 ? (
              <p className="text-sm text-slate-600">No dispatches yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-2 font-semibold">Dispatch ID</th>
                    <th className="py-2 font-semibold">PO</th>
                    <th className="py-2 font-semibold">Status</th>
                    <th className="py-2 font-semibold">Vehicle</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatches.map((d) => (
                    <tr key={d.dispatch_id} className="border-b border-slate-100 text-slate-900">
                      <td className="py-2 font-mono">{d.dispatch_id}</td>
                      <td className="py-2 font-mono">{d.order_id || "—"}</td>
                      <td className="py-2">{d.dispatch_status || "Shipped"}</td>
                      <td className="py-2">{d.vehicle_number || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default DispatchPage;
