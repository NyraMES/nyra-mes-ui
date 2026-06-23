import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAppContext } from "../../../context/AppContext";
import {
  createAcMakeToStockOrder,
  fetchAcReleaseEligibleInward,
  formatAcApiError,
  isAcInwardQcPassed
} from "../../../services/activatedCarbonApi";
import useIndustryBasePath from "../../../hooks/useIndustryBasePath";
import useAcPageRefresh from "../hooks/useAcPageRefresh";
import { isAcContextReady } from "../utils/acContextUtils";
import AcAlert from "./AcAlert";
import AcFormSelect from "./AcFormSelect";
import AcSaveBar from "./AcSaveBar";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

/**
 * Release QC-passed inward to make-to-stock — creates PO + planned lot (CREATED) for feasibility.
 */
export default function AcReleaseToProductionPanel({ onReleased }) {
  const { context, loading: contextLoading } = useAppContext();
  const basePath = useIndustryBasePath();
  const { focusTick } = useAcPageRefresh();
  const [inwardOrders, setInwardOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [releaseInwardId, setReleaseInwardId] = useState("");
  const [releaseQty, setReleaseQty] = useState("1000");
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reloadInwardOrders = useCallback(async () => {
    if (!isAcContextReady(context, contextLoading)) {
      setOrdersLoading(false);
      return;
    }
    setOrdersLoading(true);
    try {
      setInwardOrders(await fetchAcReleaseEligibleInward());
    } finally {
      setOrdersLoading(false);
    }
  }, [context, contextLoading, context.tenant_code, context.workspace_code]);

  useEffect(() => {
    if (!isAcContextReady(context, contextLoading)) return;
    reloadInwardOrders().catch((e) =>
      setError(formatAcApiError(e, "Failed to load QC-passed inward orders"))
    );
  }, [
    context,
    contextLoading,
    context.tenant_code,
    context.workspace_code,
    focusTick,
    reloadInwardOrders
  ]);

  const qcPassedInward = inwardOrders.filter(
    (o) => Number(o.available_quantity_kg ?? 0) > 0
  );
  const fullyReleasedCount = inwardOrders.filter(
    (o) => isAcInwardQcPassed(o) && Number(o.available_quantity_kg ?? 0) <= 0
  ).length;

  const selectedInward = qcPassedInward.find(
    (o) => String(o.customer_order_id) === String(releaseInwardId)
  );
  const inwardAvailableKg = Number(selectedInward?.available_quantity_kg ?? 0);
  const releaseQtyNum = Number(releaseQty || 0);
  const exceedsInwardStock =
    selectedInward && releaseQtyNum > 0 && releaseQtyNum > inwardAvailableKg;

  useEffect(() => {
    if (!releaseInwardId || inwardAvailableKg <= 0) return;
    setReleaseQty(String(inwardAvailableKg));
  }, [releaseInwardId, inwardAvailableKg]);

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
      const lotCode = result.production_lot?.lot_code;
      const poCode = result.production_order?.production_order_code;
      setSuccess(
        lotCode && poCode
          ? `PO ${poCode} · lot ${lotCode} created — run the feasibility check below, then charge the kiln.`
          : lotCode
            ? `Lot ${lotCode} created — run the feasibility check below, then charge the kiln.`
            : poCode
              ? `PO ${poCode} ready — run feasibility.`
              : `Production order ready — run feasibility.`
      );
      if (onReleased) {
        await onReleased({ lotCode, result });
      }
      await reloadInwardOrders();
    } catch (e) {
      setError(formatAcApiError(e, "Release to production failed"));
    } finally {
      setReleasing(false);
    }
  };

  const contextReady = isAcContextReady(context, contextLoading);
  const showEmptyHint =
    contextReady && !ordersLoading && qcPassedInward.length === 0;

  return (
    <WfCard className="mb-6">
      <WfCardHeader
        title="Release to production (make-to-stock)"
        subtitle="After raw material QC — creates a planned lot for feasibility before kiln feed."
      />
      <WfCardBody>
        {error && <AcAlert variant="error">{error}</AcAlert>}
        {success && <AcAlert variant="success">{success}</AcAlert>}
        <div className="wf-light-panel rounded-xl p-4 max-w-2xl space-y-4">
          <AcFormSelect
            label="QC-passed inward order"
            value={releaseInwardId}
            onChange={(e) => setReleaseInwardId(e.target.value)}
            disabled={ordersLoading || !contextReady}
          >
            <option value="">
              {ordersLoading || !contextReady ? "Loading inward orders…" : "Select inward…"}
            </option>
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
          {showEmptyHint && (
            <p className="text-xs text-amber-800">
              {fullyReleasedCount > 0 ? (
                <>
                  All QC-passed inward is already released — select the new lot (LOT-AC-*) in the
                  feasibility dropdown below, not the inward order code.
                </>
              ) : (
                <>
                  No QC-passed inward orders. Complete{" "}
                  <Link to={`${basePath}/raw-material-qc`} className="text-blue-700 underline">
                    Raw Material QC
                  </Link>{" "}
                  first.
                </>
              )}
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
              !contextReady ||
              ordersLoading ||
              !releaseInwardId ||
              !releaseQty ||
              inwardAvailableKg <= 0 ||
              exceedsInwardStock
            }
          />
        </div>
      </WfCardBody>
    </WfCard>
  );
}
