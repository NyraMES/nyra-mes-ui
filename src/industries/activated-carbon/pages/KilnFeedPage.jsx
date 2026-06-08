import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAppContext } from "../../../context/AppContext";
import useAcPageRefresh from "../hooks/useAcPageRefresh";
import {
  createAcKilnFeedLot,
  createAcMakeToStockOrder,
  enrichAcInwardOrder,
  fetchAcKilnFeedLots,
  fetchAcRawMaterialInward,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import AcCreatedIdsDialog from "../components/AcCreatedIdsDialog";
import AcAlert from "../components/AcAlert";
import AcFormSelect from "../components/AcFormSelect";
import AcSaveBar from "../components/AcSaveBar";
import useAcMasters from "../hooks/useAcMasters";
import { isAcContextReady } from "../utils/acContextUtils";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function KilnFeedPage() {
  const { context, loading: contextLoading } = useAppContext();
  const location = useLocation();
  const { focusTick } = useAcPageRefresh();
  const { masters, loading: mastersLoading, error: mastersError, reload: reloadMasters, ready } =
    useAcMasters();
  const [lots, setLots] = useState([]);
  const [lotsLoading, setLotsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [idsDialog, setIdsDialog] = useState({ open: false, items: [] });

  const [productionOrderId, setProductionOrderId] = useState("");
  const [lotQuantity, setLotQuantity] = useState("1000");
  const [kilnCode, setKilnCode] = useState("");
  const [inwardOrders, setInwardOrders] = useState([]);
  const [releaseInwardId, setReleaseInwardId] = useState("");
  const [releaseQty, setReleaseQty] = useState("1000");
  const [releasing, setReleasing] = useState(false);

  const poCapacityById = useMemo(() => {
    const map = new Map();
    for (const po of masters.production_orders) {
      const id = String(po.production_order_id);
      const planned = Number(po.planned_quantity || 0);
      const charged = lots
        .filter(
          (l) =>
            String(l.production_order_id) === id ||
            String(l.production_order_code) === String(po.production_order_code)
        )
        .reduce((sum, l) => sum + Number(l.lot_quantity || 0), 0);
      map.set(id, {
        planned,
        charged,
        remaining: Math.max(planned - charged, 0)
      });
    }
    return map;
  }, [lots, masters.production_orders]);

  useEffect(() => {
    if (!ready) return;
    if (!kilnCode && masters.kilns[0]) {
      setKilnCode(masters.kilns[0].resource_code);
    }
    if (masters.production_orders.length === 0) return;

    const current = poCapacityById.get(String(productionOrderId));
    if (current && current.remaining > 0) {
      setLotQuantity(String(current.remaining));
      return;
    }

    const withRoom = masters.production_orders.find(
      (po) => (poCapacityById.get(String(po.production_order_id))?.remaining ?? 0) > 0
    );
    const pick = withRoom || masters.production_orders[0];
    const pickId = String(pick.production_order_id);
    if (String(productionOrderId) !== pickId) {
      setProductionOrderId(pickId);
    }
    const cap = poCapacityById.get(pickId);
    if (cap?.remaining > 0) {
      setLotQuantity(String(cap.remaining));
    }
  }, [ready, masters.production_orders, masters.kilns, kilnCode, poCapacityById]);

  const reloadLots = async () => {
    setLotsLoading(true);
    try {
      setLots(await fetchAcKilnFeedLots());
    } finally {
      setLotsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAcContextReady(context, contextLoading)) return;
    reloadLots().catch((e) => setError(formatAcApiError(e, "Failed to load lots")));
    fetchAcRawMaterialInward()
      .then(setInwardOrders)
      .catch(() => setInwardOrders([]));
  }, [context, contextLoading, context.tenant_code, context.workspace_code, location.key, focusTick]);

  const qcPassedInward = inwardOrders
    .map(enrichAcInwardOrder)
    .filter((o) => (o.status || "").toUpperCase() === "QC_PASSED");

  const selectedInward = qcPassedInward.find(
    (o) => String(o.customer_order_id) === String(releaseInwardId)
  );
  const inwardAvailableKg = Number(selectedInward?.available_quantity_kg ?? 0);
  const releaseQtyNum = Number(releaseQty || 0);
  const exceedsInwardStock =
    selectedInward && releaseQtyNum > 0 && releaseQtyNum > inwardAvailableKg;

  const handleReleaseToProduction = async () => {
    if (!releaseInwardId || !releaseQty) return;
    setReleasing(true);
    setError("");
    setSuccess("");
    try {
      const result = await createAcMakeToStockOrder({
        inward_order_id: releaseInwardId,
        quantity: releaseQty,
        uom: "KG"
      });
      setProductionOrderId(String(result.production_order.production_order_id));
      setSuccess(
        `Production order ${result.production_order.production_order_code} ready for kiln feed.`
      );
      await reloadMasters();
      const refreshed = await fetchAcRawMaterialInward();
      setInwardOrders(refreshed);
      const updated = refreshed.find(
        (o) => String(o.customer_order_id) === String(releaseInwardId)
      );
      if (updated) {
        setReleaseQty(String(updated.available_quantity_kg ?? 0));
      }
    } catch (e) {
      setError(formatAcApiError(e, "Release to production failed"));
    } finally {
      setReleasing(false);
    }
  };

  useEffect(() => {
    if (!releaseInwardId || inwardAvailableKg <= 0) return;
    setReleaseQty(String(inwardAvailableKg));
  }, [releaseInwardId, inwardAvailableKg]);

  const handleSave = async () => {
    if (!productionOrderId || !lotQuantity) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const lot = await createAcKilnFeedLot({
        production_order_id: productionOrderId,
        lot_quantity: lotQuantity,
        kiln_resource_code: kilnCode || undefined,
        status: "IN_PROGRESS"
      });
      const po = masters.production_orders.find(
        (p) => p.production_order_id === productionOrderId
      );
      setSuccess(`Lot ${lot.lot_code} charged to kiln. Continue to Routing to generate work orders.`);
      setIdsDialog({
        open: true,
        items: [
          { label: "Production lot", value: lot.lot_code },
          { label: "Production order", value: po?.production_order_code || "—" },
          { label: "Feed quantity", value: `${lot.lot_quantity} KG` },
          { label: "Kiln", value: kilnCode || "—" },
          { label: "Status", value: lot.status || "IN_PROGRESS" }
        ]
      });
      await reloadLots();
      await reloadMasters();
    } catch (e) {
      setError(formatAcApiError(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const noPo = ready && masters.production_orders.length === 0;
  const noKilns = ready && masters.kilns.length === 0;

  const selectedPo = masters.production_orders.find(
    (p) => String(p.production_order_id) === String(productionOrderId)
  );

  const poCapacity = useMemo(() => {
    if (!productionOrderId) return null;
    return poCapacityById.get(String(productionOrderId)) || null;
  }, [productionOrderId, poCapacityById]);

  const feedQty = Number(lotQuantity || 0);
  const exceedsPoCapacity =
    poCapacity != null && feedQty > 0 && feedQty > poCapacity.remaining;

  return (
    <div className="max-w-5xl">
      <AcCreatedIdsDialog
        open={idsDialog.open}
        title="Kiln feed recorded"
        subtitle="Lot ID was assigned from the production lot sequence."
        items={idsDialog.items}
        continueLabel="Done"
        onContinue={() => {
          setIdsDialog({ open: false, items: [] });
        }}
        onClose={() => setIdsDialog({ open: false, items: [] })}
      />
      <SectionHeader
        eyebrow="Pyrolysis"
        title="Kiln Feed"
        subtitle="Release QC-passed supplier inward to production, then charge the kiln."
      />

      {(mastersError || error) && <AcAlert variant="error">{mastersError || error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      <WfCard className="mb-6">
        <WfCardHeader
          title="Release to production (make-to-stock)"
          subtitle="Separate from customer PO — creates a production order for kiln feed."
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 max-w-2xl space-y-4">
            <AcFormSelect
              label="QC-passed inward order"
              value={releaseInwardId}
              onChange={(e) => setReleaseInwardId(e.target.value)}
            >
              <option value="">Select inward…</option>
              {qcPassedInward.map((o) => {
                const avail = Number(o.available_quantity_kg ?? 0);
                return (
                  <option
                    key={o.customer_order_id}
                    value={String(o.customer_order_id)}
                    disabled={avail <= 0}
                  >
                    {o.order_code}
                    {o.raw_product_code ? ` · ${o.raw_product_code}` : ""}
                    {` · ${avail} KG available`}
                    {o.supplier_name ? ` · ${o.supplier_name}` : ""}
                  </option>
                );
              })}
            </AcFormSelect>
            {qcPassedInward.length === 0 && (
              <p className="text-xs text-amber-800">
                No QC-passed inward orders. Complete{" "}
                <Link to="/activated-carbon/raw-material-qc" className="text-blue-700 underline">
                  Raw Material QC
                </Link>{" "}
                first.
              </p>
            )}
            {selectedInward && (
              <p className="text-sm text-slate-700">
                Received{" "}
                <span className="font-mono font-medium">
                  {Number(selectedInward.inward_quantity_kg ?? 0)}
                </span>{" "}
                KG · already released{" "}
                <span className="font-mono">
                  {Number(selectedInward.allocated_to_production_kg ?? 0)}
                </span>{" "}
                KG ·{" "}
                <span className="font-mono font-semibold text-emerald-800">
                  {inwardAvailableKg} KG available
                </span>
              </p>
            )}
            <label className="text-sm block">
              <span className="block mb-1 font-medium text-slate-700">Production quantity (KG)</span>
              <input
                type="number"
                min="1"
                max={inwardAvailableKg > 0 ? inwardAvailableKg : undefined}
                className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                value={releaseQty}
                onChange={(e) => setReleaseQty(e.target.value)}
              />
            </label>
            {exceedsInwardStock && (
              <p className="text-xs text-red-700">
                Cannot release more than {inwardAvailableKg} KG still available on this inward
                receipt.
              </p>
            )}
            <AcSaveBar
              onSave={handleReleaseToProduction}
              saving={releasing}
              saveLabel="Release to production"
              disabled={
                !releaseInwardId ||
                !releaseQty ||
                inwardAvailableKg <= 0 ||
                exceedsInwardStock
              }
            />
          </div>
        </WfCardBody>
      </WfCard>

      <WfCard className="mb-6">
        <WfCardHeader
          title="New kiln feed"
          subtitle="Lot ID auto-generated from sequence (e.g. LOT-AC-3)."
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <AcFormSelect
              label="Production order"
              className="md:col-span-2"
              value={productionOrderId}
              loading={mastersLoading}
              onChange={(e) => {
                const id = e.target.value;
                setProductionOrderId(id);
                const cap = poCapacityById.get(String(id));
                if (cap?.remaining > 0) {
                  setLotQuantity(String(cap.remaining));
                }
              }}
            >
              {masters.production_orders.map((po) => {
                const id = String(po.production_order_id);
                const cap = poCapacityById.get(id);
                const remaining = cap?.remaining ?? 0;
                return (
                  <option key={id} value={id} disabled={remaining <= 0}>
                    {po.production_order_code}
                    {po.product_code ? ` · ${po.product_code}` : ""}
                    {` · ${remaining.toLocaleString()} KG free`}
                    {remaining <= 0 ? " (full)" : ""}
                    {` · ${po.status}`}
                  </option>
                );
              })}
            </AcFormSelect>
            {noPo && (
              <p className="text-xs text-amber-800 md:col-span-2">
                No make-to-stock production orders. Record{" "}
                <Link to="/activated-carbon/raw-material-inward" className="text-blue-700 underline">
                  supplier inward
                </Link>
                , pass{" "}
                <Link to="/activated-carbon/raw-material-qc" className="text-blue-700 underline">
                  QC
                </Link>
                , then use <strong>Release to production</strong> above.
              </p>
            )}

            {poCapacity && (
              <p
                className={`text-xs md:col-span-2 ${
                  poCapacity.remaining <= 0 ? "text-amber-800" : "text-slate-600"
                }`}
              >
                PO capacity: {poCapacity.planned.toLocaleString()} KG planned ·{" "}
                {poCapacity.charged.toLocaleString()} KG already in lot(s) ·{" "}
                <strong>{poCapacity.remaining.toLocaleString()} KG remaining</strong> for new kiln
                feeds.
                {poCapacity.remaining <= 0 && (
                  <>
                    {" "}
                    Use <strong>Release to production</strong> above with a QC-passed inward receipt
                    to open a new PO, or pick another PO with free capacity.
                  </>
                )}
              </p>
            )}

            <label className="text-sm">
              <span className="block mb-1 font-medium text-slate-700">Feed quantity (KG)</span>
              <input
                type="number"
                min="1"
                max={poCapacity?.remaining || undefined}
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={lotQuantity}
                onChange={(e) => setLotQuantity(e.target.value)}
              />
              {exceedsPoCapacity && (
                <span className="block mt-1 text-xs text-rose-700">
                  Quantity exceeds remaining PO capacity ({poCapacity.remaining.toLocaleString()}{" "}
                  KG). Split across multiple lots if needed, but total cannot exceed the PO.
                </span>
              )}
            </label>

            <AcFormSelect
              label="Kiln"
              value={kilnCode}
              loading={mastersLoading}
              onChange={(e) => setKilnCode(e.target.value)}
            >
              {masters.kilns.map((k) => (
                <option key={k.resource_id} value={k.resource_code}>
                  {k.resource_code} — {k.resource_name}
                </option>
              ))}
            </AcFormSelect>
            {noKilns && (
              <p className="text-xs text-amber-700 md:col-span-2">
                No kiln resources found.{" "}
                <Link
                  to="/activated-carbon/masters?tab=plant-resources"
                  className="text-blue-700 underline"
                >
                  Add one in Masters → Plant resources
                </Link>
                , or run the Activated Carbon seed script for your tenant.
              </p>
            )}
          </div>
          <AcSaveBar
            onSave={handleSave}
            saving={saving}
            saveLabel="Charge kiln"
            disabled={
              noPo ||
              exceedsPoCapacity ||
              !productionOrderId ||
              !lotQuantity ||
              (poCapacity?.remaining ?? 0) <= 0
            }
          />
        </WfCardBody>
      </WfCard>

      <WfCard>
        <WfCardHeader
          title="Feed lots"
          subtitle={lotsLoading ? "Refreshing…" : `${lots.length} lot(s)`}
        />
        <WfCardBody>
          {lots.length === 0 ? (
            <p className="text-sm text-slate-600">No lots found.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {lots.map((lot) => (
                <li key={lot.production_lot_id || lot.lot_code} className="font-mono">
                  {lot.lot_code} · {lot.lot_quantity} KG · {lot.status}
                  {lot.production_order_code ? ` · PO ${lot.production_order_code}` : ""}
                </li>
              ))}
            </ul>
          )}
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default KilnFeedPage;
