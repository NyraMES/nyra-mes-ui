import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useAppContext } from "../../../context/AppContext";
import useIndustryBasePath from "../../../hooks/useIndustryBasePath";
import useAcPageRefresh from "../hooks/useAcPageRefresh";
import {
  createAcDispatchFromOrder,
  fetchAcDispatches,
  fetchAcGradeStock,
  fetchAcOpenCustomerOrders,
  fetchAcStockedLots,
  formatAcApiError,
  lotMatchesDispatchOrder
} from "../../../services/activatedCarbonApi";
import { isAcContextReady } from "../utils/acContextUtils";
import AcAlert from "../components/AcAlert";
import AcFormSelect from "../components/AcFormSelect";
import AcSaveBar from "../components/AcSaveBar";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString()} KG`;
}

function StockSummaryTable({ gradeStock, stockedLots, loading }) {
  if (loading) {
    return <p className="text-sm text-slate-600">Loading stock…</p>;
  }
  if (!gradeStock.length && !stockedLots.length) {
    return (
      <AcAlert variant="warning">
        No finished-goods stock yet. Complete execution, screening, and quality testing on a lot —
        it will appear here when stocked.
      </AcAlert>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-600">
            <th className="py-2 pr-4 font-semibold">Grade</th>
            <th className="py-2 pr-4 font-semibold">Product</th>
            <th className="py-2 pr-4 font-semibold text-right">In stock</th>
            <th className="py-2 font-semibold text-right">Stocked lots</th>
          </tr>
        </thead>
        <tbody>
          {gradeStock.map((row) => (
            <tr key={row.grade_code} className="border-b border-slate-100 text-slate-900">
              <td className="py-2.5 pr-4 font-medium">{row.grade_label || row.grade_code}</td>
              <td className="py-2.5 pr-4 font-mono text-slate-700">{row.product_code || "—"}</td>
              <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                {formatKg(row.quantity_kg)}
              </td>
              <td className="py-2.5 text-right tabular-nums">{row.stocked_lot_count ?? "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-slate-800 font-semibold">
            <td className="pt-3" colSpan={2}>
              Total
            </td>
            <td className="pt-3 text-right font-mono tabular-nums">
              {formatKg(gradeStock.reduce((sum, r) => sum + Number(r.quantity_kg || 0), 0))}
            </td>
            <td className="pt-3 text-right tabular-nums">{stockedLots.length}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function StockedLotsTable({ lots, highlightProductId, highlightProductCode }) {
  if (!lots.length) {
    return (
      <p className="text-sm text-slate-900">
        No stocked lots on hand. Lots appear here after execution, screening, and QC release to
        in-stock.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-600">
            <th className="py-2 pr-3 font-semibold">Lot</th>
            <th className="py-2 pr-3 font-semibold">Grade</th>
            <th className="py-2 pr-3 font-semibold">Product</th>
            <th className="py-2 pr-3 font-semibold text-right">Qty</th>
            <th className="py-2 font-semibold">Source PO</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => {
            const highlighted =
              (highlightProductId &&
                lot.product_id &&
                String(lot.product_id) === String(highlightProductId)) ||
              (highlightProductCode &&
                lot.product_code &&
                String(lot.product_code).toUpperCase() ===
                  String(highlightProductCode).toUpperCase());
            return (
              <tr
                key={lot.production_lot_id || lot.lot_code}
                className={`border-b border-slate-100 ${
                  highlighted ? "bg-emerald-50 text-emerald-950" : "text-slate-900"
                }`}
              >
                <td className="py-2.5 pr-3 font-mono font-medium">{lot.lot_code}</td>
                <td className="py-2.5 pr-3">{lot.grade_label || lot.grade_code || "—"}</td>
                <td className="py-2.5 pr-3 font-mono text-slate-700">{lot.product_code || "—"}</td>
                <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                  {formatKg(lot.lot_quantity)}
                </td>
                <td className="py-2.5 font-mono text-slate-600">{lot.order_code || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DispatchPage() {
  const { context, loading: contextLoading } = useAppContext();
  const basePath = useIndustryBasePath();
  const { focusTick } = useAcPageRefresh();
  const [searchParams] = useSearchParams();

  const [openOrders, setOpenOrders] = useState([]);
  const [gradeStock, setGradeStock] = useState([]);
  const [stockedLots, setStockedLots] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [customerOrderId, setCustomerOrderId] = useState("");
  const [lotCode, setLotCode] = useState("");
  const [dispatchQty, setDispatchQty] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transporterName, setTransporterName] = useState("");

  const reload = useCallback(async () => {
    const [orders, grades, lots, history] = await Promise.all([
      fetchAcOpenCustomerOrders(),
      fetchAcGradeStock(),
      fetchAcStockedLots(),
      fetchAcDispatches()
    ]);
    setOpenOrders(orders || []);
    setGradeStock(grades || []);
    setStockedLots(lots || []);
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

  const eligibleLots = useMemo(() => {
    if (!selectedOrder) return stockedLots;
    return stockedLots.filter((lot) => lotMatchesDispatchOrder(lot, selectedOrder));
  }, [stockedLots, selectedOrder]);

  useEffect(() => {
    if (!selectedOrder) return;
    setDispatchQty(String(selectedOrder.remaining_kg || ""));
    if (eligibleLots[0]?.lot_code) {
      setLotCode(eligibleLots[0].lot_code);
    } else {
      setLotCode("");
    }
  }, [selectedOrder, eligibleLots]);

  const canDispatch =
    selectedOrder &&
    Number(selectedOrder.remaining_kg) > 0 &&
    Number(selectedOrder.stock_on_hand_kg) >= Number(dispatchQty || 0) &&
    Number(dispatchQty) > 0 &&
    Number(dispatchQty) <= Number(selectedOrder.remaining_kg) &&
    eligibleLots.length > 0;

  const handleSave = async () => {
    if (!customerOrderId || !dispatchQty) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await createAcDispatchFromOrder({
        customer_order_id: customerOrderId,
        quantity_kg: dispatchQty,
        lot_code: lotCode || undefined,
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
        subtitle="View grade-wise stock and stocked lots, then ship against a customer PO."
      />

      {error && <AcAlert variant="error">{error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      <WfCard>
        <WfCardHeader
          title="Finished goods in stock"
          subtitle="By grade — from stocked lots after execution, screening & QC"
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4">
            <StockSummaryTable
              gradeStock={gradeStock}
              stockedLots={stockedLots}
              loading={loading}
            />
          </div>
        </WfCardBody>
      </WfCard>

      <WfCard>
        <WfCardHeader
          title="Stocked lots"
          subtitle={
            selectedOrder
              ? `Lots matching PO grade ${selectedOrder.product_code} are highlighted`
              : "All lots currently in finished-goods stock"
          }
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4">
            <StockedLotsTable
              lots={stockedLots}
              highlightProductId={selectedOrder?.product_id}
              highlightProductCode={selectedOrder?.product_code}
            />
          </div>
        </WfCardBody>
      </WfCard>

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
        <WfCardHeader title="Ship against customer PO" subtitle="Select PO · pick lot · confirm qty" />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 space-y-4">
            <AcFormSelect
              label="Customer PO"
              value={customerOrderId}
              loading={loading}
              onChange={(e) => {
                setCustomerOrderId(e.target.value);
                setLotCode("");
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
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Matching stocked lots</p>
                  <p className="font-mono">{eligibleLots.length}</p>
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
                label="Stocked lot"
                value={lotCode}
                loading={loading}
                onChange={(e) => setLotCode(e.target.value)}
              >
                <option value="">
                  {eligibleLots.length
                    ? "Auto-select oldest matching lot"
                    : "No matching stocked lots"}
                </option>
                {eligibleLots.map((lot) => (
                  <option key={lot.production_lot_id || lot.lot_code} value={lot.lot_code}>
                    {lot.lot_code} · {lot.grade_label || lot.grade_code} · {formatKg(lot.lot_quantity)}
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

            {selectedOrder && eligibleLots.length === 0 ? (
              <AcAlert variant="warning">
                No stocked lots match grade <strong>{selectedOrder.product_code}</strong>. Check the
                stocked lots table above — you may need a PO for the correct grade or complete QC on
                more lots.
              </AcAlert>
            ) : null}
          </div>

          <AcSaveBar
            onSave={handleSave}
            saving={saving}
            saveLabel="Confirm dispatch"
            disabled={loading || !customerOrderId || !canDispatch}
          />
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
