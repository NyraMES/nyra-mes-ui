import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import {
  createAcCustomerSalesOrder,
  fetchAcDeliveryCommitment,
  fetchAcFinishedGoodsStock,
  fetchAcGradeStock,
  fetchAcMasters,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import useIndustryBasePath from "../../../hooks/useIndustryBasePath";
import AcAlert from "../components/AcAlert";
import AcFormSelect from "../components/AcFormSelect";
import AcSaveBar from "../components/AcSaveBar";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function CustomerSalesPage() {
  const basePath = useIndustryBasePath();
  const [masters, setMasters] = useState(null);
  const [stock, setStock] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1000");
  const [preview, setPreview] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const m = await fetchAcMasters();
        setMasters(m);
        let s = [];
        try {
          s = await fetchAcGradeStock();
        } catch (stockErr) {
          console.warn(stockErr);
          try {
            s = await fetchAcFinishedGoodsStock();
          } catch (fgErr) {
            console.warn(fgErr);
          }
        }
        setStock(s || []);
        if (m?.customers?.[0]) {
          setCustomerId((prev) => prev || String(m.customers[0].customer_id));
        }
        if (m?.finished_products?.[0]) {
          setProductId((prev) => prev || String(m.finished_products[0].product_id));
        }
      } catch (e) {
        setError(formatAcApiError(e, "Failed to load customer sales data"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!productId || !quantity) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      fetchAcDeliveryCommitment(productId, quantity)
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [productId, quantity]);

  const handleSave = async () => {
    if (!customerId || !productId || !quantity) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await createAcCustomerSalesOrder({
        customer_id: customerId,
        finished_product_id: productId,
        quantity
      });
      setLastOrder(result);
      setSuccess(`Customer order ${result.order.order_code} created.`);
      try {
        setStock(await fetchAcGradeStock());
      } catch {
        setStock(await fetchAcFinishedGoodsStock());
      }
      if (result.commitment?.can_dispatch_from_stock) {
        setSuccess(
          `Customer order ${result.order.order_code} created — stock available. Proceed to Dispatch.`
        );
      }
    } catch (e) {
      setError(formatAcApiError(e, "Failed to create customer order"));
    } finally {
      setSaving(false);
    }
  };

  const customers = masters?.customers || [];
  const products = masters?.finished_products || [];

  return (
    <div className="max-w-4xl">
      <SectionHeader
        eyebrow="Sales"
        title="Customer purchase order"
        subtitle="Stock available is Screening-after-Destoning In Stock bags plus historical destoning In Stock. If short, a tentative delivery date is estimated from raw material and routing lead time."
      />

      {(error || loading) && error && <AcAlert variant="error">{error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      <WfCard className="mb-6">
        <WfCardHeader title="Available in stock" subtitle="Destoning and post-activation bags whose destination is In Stock." />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4">
            {stock.length === 0 ? (
              <p className="text-sm text-slate-600">No bags in stock yet — set destination to In Stock on destoning or post-activation quality.</p>
            ) : (
              <ul className="text-sm space-y-2">
                {stock.map((row) => (
                  <li key={row.grade_code || row.product_id} className="flex justify-between gap-4 text-slate-900">
                    <span>
                      {row.grade_label || row.product_name || row.product_code}
                      {row.product_code ? ` — ${row.product_code}` : ""}
                    </span>
                    <span className="font-mono">{row.quantity_kg} {row.uom || "KG"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </WfCardBody>
      </WfCard>

      <WfCard className="mb-6">
        <WfCardHeader title="New customer PO" subtitle="Does not consume supplier inward — only finished product demand." />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 space-y-4 max-w-2xl">
            <AcFormSelect
              label="Customer"
              value={customerId}
              loading={loading}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.customer_id} value={String(c.customer_id)}>
                  {c.customer_name} ({c.customer_code})
                </option>
              ))}
            </AcFormSelect>
            <AcFormSelect
              label="Finished product"
              value={productId}
              loading={loading}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p.product_id} value={String(p.product_id)}>
                  {p.product_code} — {p.product_name}
                </option>
              ))}
            </AcFormSelect>
            <label className="text-sm block">
              <span className="block mb-1 font-medium text-slate-700">Quantity (KG)</span>
              <input
                type="number"
                min="1"
                className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            {preview && (
              <div
                className={`text-sm rounded-lg border px-4 py-3 ${
                  preview.can_dispatch_from_stock
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                <p className="font-medium mb-1">
                  {preview.can_dispatch_from_stock
                    ? "Ready to dispatch from stock"
                    : "Manufacturing required"}
                </p>
                <p>{preview.message}</p>
                {preview.tentative_delivery_date && !preview.can_dispatch_from_stock && (
                  <p className="mt-2 font-mono text-xs">
                    Tentative: {preview.tentative_delivery_date}
                    {preview.manufacturing_lead_days != null &&
                      ` (~${preview.manufacturing_lead_days} shop days)`}
                  </p>
                )}
              </div>
            )}
            <AcSaveBar onSave={handleSave} saving={saving} saveLabel="Create customer PO" />
          </div>
        </WfCardBody>
      </WfCard>

      {lastOrder?.commitment && (
        <WfCard>
          <WfCardHeader title="Last commitment" />
          <WfCardBody>
            <div className="wf-light-panel rounded-xl p-4 text-sm text-slate-800 space-y-3">
              <p>Order: {lastOrder.order.order_code}</p>
              <p>{lastOrder.commitment.message}</p>
              {lastOrder.commitment.can_dispatch_from_stock ? (
                <Link
                  to={`${basePath}/dispatch?order=${encodeURIComponent(lastOrder.order.order_code)}`}
                  className="inline-flex text-sm font-medium text-emerald-700 underline"
                >
                  Go to Dispatch →
                </Link>
              ) : null}
            </div>
          </WfCardBody>
        </WfCard>
      )}
    </div>
  );
}

export default CustomerSalesPage;
