import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../../../auth/AuthContext";
import { useAppContext } from "../../../context/AppContext";
import useAcPageRefresh from "../hooks/useAcPageRefresh";

import {
  createAcRawMaterialInward,
  fetchAcRawMaterialInward,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
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
import { userCanSeeAcSupplier } from "../utils/acPrivileges";
import AcInwardRecordsTable from "../components/AcInwardRecordsTable";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function RawMaterialInwardPage({ embedded = false }) {
  const { context, loading: contextLoading } = useAppContext();
  const { user } = useAuth();
  const showSupplier = userCanSeeAcSupplier(user?.roles || [], user);
  const location = useLocation();
  const { focusTick } = useAcPageRefresh();
  const { masters, loading: mastersLoading, error: mastersError, reload: reloadMasters, ready } =
    useAcMasters();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const savingRef = useRef(false);

  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [dcNumber, setDcNumber] = useState("");
  const [supplierWeight, setSupplierWeight] = useState("");
  const [ourWeight, setOurWeight] = useState("0");

  const suppliers = masters.suppliers || [];
  const rawProducts = masters.raw_products || [];


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
    if (savingRef.current) return;
    const supplierKg = Number(supplierWeight);
    const ourKg = Number(ourWeight);
    if (!productId || !dcNumber.trim() || !supplierWeight) return;
    if (showSupplier && !selectedSupplier) {
      setError("Select a supplier before recording inward.");
      return;
    }
    if (!showSupplier) {
      setError("A supervisor records the supplier on a new gate receipt.");
      return;
    }
    if (!(ourKg > 0)) {
      setError("Our weight must be greater than zero.");
      return;
    }
    if (!(supplierKg > 0)) {
      setError("Supplier weight must be greater than zero.");
      return;
    }
    if (ourKg > supplierKg) {
      setError("Our weight cannot be greater than the supplier weight.");
      return;
    }
    savingRef.current = true;
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
      const orderId = result.order.customer_order_id;
      setCreated({
        orderId,
        orderCode: result.order.order_code,
        bags: result.bags || []
      });
      setSuccess(
        `Inward ${result.order.order_code} saved. The RMS engineer generates bags on Inbound prep.`
      );
      await reloadOrders();
      await reloadMasters();
    } catch (e) {
      setError(formatAcApiError(e, "Save failed"));
    } finally {
      savingRef.current = false;
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
      {!embedded && (
        <SectionHeader
          eyebrow="Inbound"
          title="Raw Material Inward"
          subtitle="Gate receipt — not linked to a customer PO. After inbound prep, release to production."
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
            {showSupplier ? (
            <AcFormSelect
              label="Supplier"
              value={supplierId}
              loading={mastersLoading}
              disabled={Boolean(created)}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">Select supplier…</option>
              {suppliers.map((s) => (
                <option key={s.supplier_id} value={String(s.supplier_id)}>
                  {s.supplier_name} ({s.supplier_code})
                </option>
              ))}
            </AcFormSelect>
            ) : (
              <p className="text-sm text-slate-600 md:col-span-2">
                A supervisor records the supplier on a new gate receipt.
              </p>
            )}
            {showSupplier && noSuppliers && (
              <p className="text-xs text-amber-700 md:col-span-2">
                No suppliers yet.{" "}
                <Link to="/activated-carbon/admin?tab=suppliers" className="text-blue-700 underline font-medium">
                  Add a supplier in Admin
                </Link>
                .
              </p>
            )}

            <AcFormSelect
              label="Raw material"
              value={productId}
              loading={mastersLoading}
              disabled={Boolean(created)}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Select raw material…</option>
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
                className="w-full rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                value={dcNumber}
                disabled={Boolean(created)}
                onChange={(e) => setDcNumber(e.target.value)}
                placeholder={showSupplier ? "Supplier delivery challan" : "Delivery challan"}
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium text-slate-700">{showSupplier ? "Supplier weight (KG) *" : "Challan weight (KG) *"}</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="w-full rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                value={supplierWeight}
                disabled={Boolean(created)}
                onChange={(e) => setSupplierWeight(e.target.value)}
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block mb-1 font-medium text-slate-700">Our weight (KG) *</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                value={ourWeight}
                disabled={Boolean(created)}
                onChange={(e) => setOurWeight(e.target.value)}
              />
            </label>

            {created ? (
              <div className="md:col-span-2">
                <p className="text-sm text-slate-700 m-0">
                  {created.orderCode} is saved. Bag generation is on Inbound prep for the RMS engineer.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500 md:col-span-2">
                  Save the gate receipt. The RMS engineer generates bags on Inbound prep.
                </p>
                <div className="md:col-span-2">
                  <AcSaveBar
                    onSave={handleSave}
                    saving={saving}
                    saveLabel="Save inward"
                    disabled={
                      noSuppliers ||
                      noProducts ||
                      !supplierId ||
                      !productId ||
                      !dcNumber.trim() ||
                      !supplierWeight ||
                      !(Number(ourWeight) > 0) ||
                      Number(ourWeight) > Number(supplierWeight)
                    }
                  />
                </div>
              </>
            )}
            </div>
            <aside className="wf-ac-gate-receipt-flow rounded-lg border border-blue-200 bg-blue-50/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Process flow
              </p>
              {created?.orderCode ? (
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  Inward {created.orderCode}
                </p>
              ) : null}
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
