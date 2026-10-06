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
import AcInwardRecordsTable from "../components/AcInwardRecordsTable";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function RawMaterialInwardPage({ embedded = false, onInwardCreated = null }) {
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
  const [dcNumber, setDcNumber] = useState("");
  const [supplierWeight, setSupplierWeight] = useState("");
  const [ourWeight, setOurWeight] = useState("1000");

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
    if (!supplierId || !productId || !dcNumber.trim() || !supplierWeight || !ourWeight) return;
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
        quantity: ourWeight,
        dc_number: dcNumber.trim(),
        supplier_weight_kg: supplierWeight,
        our_weight_kg: ourWeight,
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
        { label: "DC number", value: dcNumber.trim() },
        { label: "Supplier weight", value: `${supplierWeight} KG` },
        { label: "Our weight", value: `${ourWeight} KG` }
      ];
      setSuccess(`Inward order ${result.order.order_code} recorded.`);
      setIdsDialog({ open: true, items });
      onInwardCreated?.(result.order.customer_order_id);
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
    <div className="max-w-6xl">
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
      {!embedded && (
        <SectionHeader
          eyebrow="Inbound"
          title="Raw Material Inward"
          subtitle="Supplier receipt only — not linked to a customer PO. After inbound prep, release to production."
        />
      )}

      {(mastersError || error) && <AcAlert variant="error">{mastersError || error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      <WfCard className="mb-6">
        <WfCardHeader
          title="New inward receipt"
          subtitle="Order ID auto-generated from sequence (e.g. ORD-AC-1002)."
        />
        <WfCardBody>
          <div className="wf-ac-gate-receipt-grid">
            <div className="wf-light-panel rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <label className="text-sm">
              <span className="block mb-1 font-medium text-slate-700">DC number *</span>
              <input
                type="text"
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={dcNumber}
                onChange={(e) => setDcNumber(e.target.value)}
                placeholder="Supplier delivery challan"
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium text-slate-700">Supplier weight (KG) *</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={supplierWeight}
                onChange={(e) => setSupplierWeight(e.target.value)}
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block mb-1 font-medium text-slate-700">Our weight (KG) *</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="w-full max-w-xs rounded border border-slate-300 px-3 py-2"
                value={ourWeight}
                onChange={(e) => setOurWeight(e.target.value)}
              />
            </label>

            <p className="text-xs text-slate-500 md:col-span-2">
              Next: open <strong>2 · Inbound prep</strong> for Lab → RMS bags → crusher → RM outward,
              then <strong>Release</strong>.
            </p>
            <div className="md:col-span-2">
              <AcSaveBar
                onSave={handleSave}
                saving={saving}
                saveLabel="Record inward"
                disabled={
                  noSuppliers ||
                  noProducts ||
                  !supplierId ||
                  !dcNumber.trim() ||
                  !supplierWeight ||
                  !ourWeight
                }
              />
            </div>
            </div>
            <aside className="wf-ac-gate-receipt-flow rounded-lg border border-blue-200 bg-blue-50/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Process flow
              </p>
              {selectedMaterialType ? (
                <RawMaterialRoutingPreview
                  materialType={selectedMaterialType}
                  compact
                  sidebar
                  inboundOnly
                />
              ) : (
                <p className="text-xs text-slate-600">
                  Select a raw material to see its inward process.
                </p>
              )}
            </aside>
          </div>
        </WfCardBody>
      </WfCard>

      <AcInwardRecordsTable
        orders={orders}
        loading={ordersLoading}
        onRefresh={() => reloadOrders().catch((e) => setError(formatAcApiError(e, "Failed to refresh")))}
        className=""
      />
    </div>
  );
}

export default RawMaterialInwardPage;
