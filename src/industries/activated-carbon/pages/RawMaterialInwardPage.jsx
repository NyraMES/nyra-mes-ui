import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAppContext } from "../../../context/AppContext";
import useAcPageRefresh from "../hooks/useAcPageRefresh";

import {
  createAcRawMaterialInward,
  fetchAcRawMaterialInward,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import AcCreatedIdsDialog from "../components/AcCreatedIdsDialog";
import AcAlert from "../components/AcAlert";
import AcFormSelect from "../components/AcFormSelect";
import AcSaveBar from "../components/AcSaveBar";
import RawMaterialRoutingPreview from "../components/RawMaterialRoutingPreview";
import { findRawMaterialTypeByProductId } from "../utils/rawMaterialTypeStore";
import {
  findRawProductSelection,
  rawProductOptionValue
} from "../utils/acProductUtils";
import useAcMasters from "../hooks/useAcMasters";
import { isAcContextReady } from "../utils/acContextUtils";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function RawMaterialInwardPage() {
  const { context, loading: contextLoading } = useAppContext();
  const location = useLocation();
  const { focusTick } = useAcPageRefresh();
  const { masters, loading: mastersLoading, error: mastersError, reload: reloadMasters, ready } =
    useAcMasters();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [idsDialog, setIdsDialog] = useState({ open: false, items: [] });

  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1000");

  const suppliers = masters.suppliers || [];
  const rawProducts = masters.raw_products || [];

  useEffect(() => {
    if (!ready) return;
    if (!productId && rawProducts[0]) {
      setProductId(rawProductOptionValue(rawProducts[0]));
    }
  }, [ready, rawProducts, productId]);

  const selectedSupplier = suppliers.find(
    (s) => String(s.supplier_id) === String(supplierId)
  );

  const reloadOrders = useCallback(async () => {
    if (!isAcContextReady(context, contextLoading)) {
      setOrdersLoading(false);
      return;
    }
    setOrdersLoading(true);
    try {
      setOrders(await fetchAcRawMaterialInward());
    } finally {
      setOrdersLoading(false);
    }
  }, [context, contextLoading, context.tenant_code, context.workspace_code]);

  useEffect(() => {
    if (!isAcContextReady(context, contextLoading)) {
      return;
    }
    reloadOrders().catch((e) => setError(formatAcApiError(e, "Failed to load orders")));
  }, [context, contextLoading, context.tenant_code, context.workspace_code, location.key, focusTick, reloadOrders]);

  const handleSave = async () => {
    if (!supplierId || !productId || !quantity) return;
    if (!selectedSupplier) {
      setError("Select a supplier before recording inward.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const selectedProduct = findRawProductSelection(rawProducts, productId);
      const result = await createAcRawMaterialInward({
        supplier_id: String(selectedSupplier.supplier_id),
        product_id: selectedProduct?.product_id || productId,
        product_code: selectedProduct?.product_code,
        product_name: selectedProduct?.product_name,
        quantity,
        uom: "KG"
      });
      const items = [
        { label: "Inward order", value: result.order.order_code },
        {
          label: "Supplier",
          value:
            result.order.supplier_name ||
            selectedSupplier.supplier_name ||
            result.order.supplier_code
        },
        { label: "Order line", value: result.line.line_code },
        { label: "Quantity", value: `${quantity} KG` }
      ];
      setSuccess(`Inward order ${result.order.order_code} recorded.`);
      setIdsDialog({ open: true, items });
      await reloadOrders();
      await reloadMasters();
    } catch (e) {
      setError(formatAcApiError(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const noSuppliers = ready && suppliers.length === 0;
  const noProducts = ready && rawProducts.length === 0;

  const selectedMaterialType = findRawMaterialTypeByProductId(
    masters.raw_material_types || [],
    rawProducts,
    productId
  );

  return (
    <div className="max-w-5xl">
      <AcCreatedIdsDialog
        open={idsDialog.open}
        title="Inward order created"
        subtitle="IDs assigned from PostgreSQL sequences — use these on the shop floor."
        items={idsDialog.items}
        continueLabel="Done"
        onContinue={() => {
          setIdsDialog({ open: false, items: [] });
          setSuccess("");
        }}
        onClose={() => setIdsDialog({ open: false, items: [] })}
      />
      <SectionHeader
        eyebrow="Inbound"
        title="Raw Material Inward"
        subtitle="Supplier receipt only — not linked to a customer PO. After QC, release to production on Feasibility Gate."
      />

      {(mastersError || error) && <AcAlert variant="error">{mastersError || error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      <WfCard className="mb-6">
        <WfCardHeader
          title="New inward receipt"
          subtitle="Order ID auto-generated from sequence (e.g. ORD-AC-1002)."
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <AcFormSelect
              label="Supplier"
              value={supplierId}
              loading={mastersLoading}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">Select supplier…</option>
              {suppliers.map((s) => (
                <option key={s.supplier_id} value={String(s.supplier_id)}>
                  {s.supplier_name} ({s.supplier_code})
                </option>
              ))}
            </AcFormSelect>
            {noSuppliers && (
              <p className="text-xs text-amber-700 md:col-span-2">
                No suppliers yet.{" "}
                <Link to="/activated-carbon/masters?tab=suppliers" className="text-blue-700 underline font-medium">
                  Add a supplier in Masters
                </Link>
                .
              </p>
            )}

            <AcFormSelect
              label="Raw material"
              value={productId}
              loading={mastersLoading}
              onChange={(e) => setProductId(e.target.value)}
            >
              {rawProducts.map((p) => (
                <option key={p.product_code} value={rawProductOptionValue(p)}>
                  {p.product_code} — {p.product_name}
                </option>
              ))}
            </AcFormSelect>
            {noProducts && (
              <p className="text-xs text-amber-700 md:col-span-2">
                No raw materials in dropdown.{" "}
                <Link to="/activated-carbon/masters" className="text-blue-700 underline font-medium">
                  Add a raw material type in Masters
                </Link>{" "}
                then refresh this page (or navigate here again).
              </p>
            )}

            <label className="text-sm md:col-span-2">
              <span className="block mb-1 font-medium text-slate-700">Quantity (KG)</span>
              <input
                type="number"
                min="1"
                className="w-full max-w-xs rounded border border-slate-300 px-3 py-2"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>

            {selectedMaterialType ? (
              <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Fixed routing for selected feedstock
                </p>
                <RawMaterialRoutingPreview materialType={selectedMaterialType} compact />
              </div>
            ) : null}

            <p className="text-xs text-slate-500 md:col-span-2">
              Production order and lot are created when you{" "}
              <strong>release to production</strong> on Feasibility Gate (after QC).
            </p>
          </div>
          <AcSaveBar
            onSave={handleSave}
            saving={saving}
            saveLabel="Record inward"
            disabled={noSuppliers || noProducts || !supplierId}
          />
        </WfCardBody>
      </WfCard>

      <WfCard>
        <WfCardHeader
          title="Inward records"
          right={
            <button
              type="button"
              className="text-xs font-medium text-blue-700 hover:text-blue-900"
              disabled={ordersLoading || contextLoading || !context.loaded}
              onClick={() => reloadOrders().catch((e) => setError(formatAcApiError(e, "Failed to refresh")))}
            >
              {ordersLoading ? "Refreshing…" : "Refresh"}
            </button>
          }
        />
        <WfCardBody>
          {ordersLoading && orders.length === 0 ? (
            <p className="text-sm text-slate-600">Loading inward orders…</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-slate-600">No inward orders yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2">Order</th>
                  <th className="py-2">PO</th>
                  <th className="py-2">Material</th>
                  <th className="py-2 text-right">Received (KG)</th>
                  <th className="py-2 text-right">Released (KG)</th>
                  <th className="py-2 text-right">Available (KG)</th>
                  <th className="py-2">Supplier</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const received = Number(o.inward_quantity_kg ?? 0);
                  const released = Number(o.allocated_to_production_kg ?? 0);
                  const available = Number(
                    o.available_quantity_kg ?? Math.max(received - released, 0)
                  );
                  const material =
                    o.raw_product_code ||
                    (o.lines || []).find((l) =>
                      String(l.product_code || "").toUpperCase().startsWith("RAW-")
                    )?.product_code ||
                    "—";
                  return (
                    <tr
                      key={o.customer_order_id || o.order_code}
                      className="border-b border-slate-100"
                    >
                      <td className="py-2 font-mono">{o.order_code}</td>
                      <td className="py-2 font-mono text-slate-600">
                        {o.production_order_code || "—"}
                      </td>
                      <td className="py-2 font-mono text-slate-700">{material}</td>
                      <td className="py-2 text-right font-mono">{received || "—"}</td>
                      <td className="py-2 text-right font-mono">{released || "0"}</td>
                      <td className="py-2 text-right font-mono font-medium text-emerald-800">
                        {available}
                      </td>
                      <td className="py-2">
                        <div>{o.supplier_name || o.supplier_code || "—"}</div>
                      </td>
                      <td className="py-2">{o.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default RawMaterialInwardPage;
