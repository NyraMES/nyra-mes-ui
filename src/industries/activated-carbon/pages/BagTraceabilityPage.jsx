import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  createAcInwardBag,
  fetchAcInwardBags,
  fetchAcRawMaterialInward,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import { useAuth } from "../../../auth/AuthContext";
import { useAppContext } from "../../../context/AppContext";
import { isAcContextReady } from "../utils/acContextUtils";
import { userCanSeeAcSupplier } from "../utils/acPrivileges";
import AcAlert from "../components/AcAlert";
import AcFormSelect from "../components/AcFormSelect";
import AcSaveBar from "../components/AcSaveBar";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;
}

function BagTraceabilityPage() {
  const { user } = useAuth();
  const showSupplier = userCanSeeAcSupplier(user?.roles || [], user);
  const { context, loading: contextLoading } = useAppContext();
  const [orders, setOrders] = useState([]);
  const [bags, setBags] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const contextReady = isAcContextReady(context, contextLoading);

  const reload = useCallback(async () => {
    if (!contextReady) return;
    setLoading(true);
    setError("");
    try {
      const inward = await fetchAcRawMaterialInward();
      setOrders(inward);
      const allBags = await fetchAcInwardBags();
      setBags(allBags);
      if (!orderId && inward[0]) {
        setOrderId(String(inward[0].customer_order_id));
      }
    } catch (e) {
      setError(formatAcApiError(e, "Failed to load bag registry"));
    } finally {
      setLoading(false);
    }
  }, [contextReady, context.tenant_code, context.workspace_code]);

  useEffect(() => {
    reload();
  }, [reload]);

  const selectedOrder = useMemo(
    () => orders.find((o) => String(o.customer_order_id) === String(orderId)),
    [orders, orderId]
  );

  const bagsForOrder = useMemo(() => {
    if (!selectedOrder) return bags;
    return bags.filter(
      (bag) =>
        String(bag.customer_order_id) === String(selectedOrder.customer_order_id) ||
        String(bag.order_code) === String(selectedOrder.order_code)
    );
  }, [bags, selectedOrder]);

  const registeredKg = bagsForOrder.reduce((sum, row) => sum + (Number(row.weight_kg) || 0), 0);
  const inwardKg = Number(
    selectedOrder?.inward_quantity_kg ?? selectedOrder?.quantity ?? 0
  );

  const handleSave = async () => {
    if (!selectedOrder || !weightKg) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const bag = await createAcInwardBag({
        customer_order_id: selectedOrder.customer_order_id,
        order_code: selectedOrder.order_code,
        weight_kg: Number(weightKg),
        label: label.trim() || undefined
      });
      setSuccess(`Bag ${bag.bag_code} registered — containedIn → ${selectedOrder.order_code}`);
      setWeightKg("");
      setLabel("");
      await reload();
    } catch (e) {
      setError(formatAcApiError(e, "Could not register bag"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <SectionHeader
        eyebrow="Inbound genealogy"
        title="Bag traceability"
        subtitle="Register weighed bags against inward orders — stages containedIn triples (testbed bag-level RMS)."
      />

      <p className="text-sm text-slate-300 max-w-3xl">
        Each bag links to its inward order in the knowledge graph. Preview on{" "}
        <Link to="/workflow/kg" className="text-cyan-300 underline">
          KG Triples
        </Link>{" "}
        after save.
      </p>

      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      {success ? <AcAlert variant="success">{success}</AcAlert> : null}

      <WfCard>
        <WfCardHeader title="Register bag" subtitle="Bag code auto-generated (RI_BAG_* inward, RO_BAG_* outward)." />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            {loading ? (
              <p className="text-sm text-slate-600 md:col-span-2">Loading inward orders…</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-amber-800 md:col-span-2">
                No inward orders yet.{" "}
                <Link to="/activated-carbon/raw-material?tab=inward" className="text-blue-700 underline">
                  Record raw material inward
                </Link>{" "}
                first.
              </p>
            ) : (
              <>
                <AcFormSelect
                  label="Inward order"
                  className="md:col-span-2"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                >
                  {orders.map((order) => (
                    <option key={order.customer_order_id} value={String(order.customer_order_id)}>
                      {order.order_code}
                      {showSupplier && (order.supplier_name || order.supplier_code)
                        ? ` · ${order.supplier_name || order.supplier_code}`
                        : ""}{" "}
                      · {formatKg(order.inward_quantity_kg ?? order.quantity)}
                    </option>
                  ))}
                </AcFormSelect>
                <label className="text-sm">
                  <span className="block mb-1 font-medium text-slate-700">Bag weight (kg)</span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="block mb-1 font-medium text-slate-700">Label / scanner ref</span>
                  <input
                    type="text"
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    placeholder="Optional QR or label id"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </label>
                {selectedOrder ? (
                  <p className="text-xs text-slate-600 md:col-span-2">
                    Registered {formatKg(registeredKg)} of {formatKg(inwardKg)} on{" "}
                    {selectedOrder.order_code}
                  </p>
                ) : null}
                <div className="md:col-span-2">
                  <AcSaveBar
                    onSave={handleSave}
                    saving={saving}
                    saveLabel="Register bag"
                    disabled={!selectedOrder || !weightKg}
                  />
                </div>
              </>
            )}
          </div>
        </WfCardBody>
      </WfCard>

      <WfCard>
        <WfCardHeader
          title="Bag registry"
          subtitle={selectedOrder ? `Bags for ${selectedOrder.order_code}` : "All registered bags"}
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 overflow-x-auto">
            {bagsForOrder.length === 0 ? (
              <p className="text-sm text-slate-600">No bags registered yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-3">Bag</th>
                    <th className="py-2 pr-3">Inward</th>
                    <th className="py-2 pr-3">Weight</th>
                    <th className="py-2 pr-3">Label</th>
                    <th className="py-2">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {bagsForOrder.map((bag) => (
                    <tr key={bag.bag_id || bag.bag_code} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-mono text-slate-800">{bag.bag_code}</td>
                      <td className="py-2 pr-3 font-mono text-slate-700">{bag.order_code}</td>
                      <td className="py-2 pr-3 tabular-nums text-slate-800">
                        {formatKg(bag.weight_kg)}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{bag.label || "—"}</td>
                      <td className="py-2 text-xs text-slate-500">
                        {bag.created_at
                          ? new Date(bag.created_at).toLocaleString()
                          : "—"}
                      </td>
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

export default BagTraceabilityPage;
