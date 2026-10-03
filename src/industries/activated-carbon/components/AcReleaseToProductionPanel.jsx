import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAppContext } from "../../../context/AppContext";
import {
  acGradeLotSplitsForRelease,
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
 * Release inbound-prep-complete inward to make-to-stock — creates PO + planned lot for feasibility.
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
  const [releasedLotCode, setReleasedLotCode] = useState("");

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

  const gradeLotSplits = selectedInward
    ? acGradeLotSplitsForRelease(selectedInward, releaseQtyNum)
    : null;

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
      const payload = {
        inward_order_id: releaseInwardId,
        quantity: releaseQty,
        uom: "KG"
      };
      const splits = acGradeLotSplitsForRelease(selectedInward, releaseQtyNum);
      if (splits?.length) {
        payload.lot_splits = splits;
      }
      const result = await createAcMakeToStockOrder(payload);
      const lots = result.production_lots?.length
        ? result.production_lots
        : result.production_lot
          ? [result.production_lot]
          : [];
      const lotCode = lots[0]?.lot_code;
      const poCode = result.production_order?.production_order_code;
      if (lotCode) setReleasedLotCode(lotCode);
      const lotSummary =
        lots.length > 1
          ? `${lots.length} lots (${lots.map((l) => l.lot_code).join(", ")})`
          : lotCode
            ? `lot ${lotCode}`
            : null;
      setSuccess(
        lotSummary && poCode
          ? `PO ${poCode} · ${lotSummary} created — open Feasibility Gate to run checks, then charge the kiln.`
          : lotSummary
            ? `${lotSummary} created — open Feasibility Gate to run checks, then charge the kiln.`
            : poCode
              ? `PO ${poCode} ready — open Feasibility Gate.`
              : `Production order ready — open Feasibility Gate.`
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
        subtitle="After inbound prep — creates a planned lot for feasibility before kiln feed."
      />
      <WfCardBody>
        {error && <AcAlert variant="error">{error}</AcAlert>}
        {success && (
          <AcAlert variant="success">
            {success}
            {releasedLotCode ? (
              <>
                {" "}
                <Link
                  to={`${basePath}/feasibility?lot=${encodeURIComponent(releasedLotCode)}`}
                  className="text-blue-800 underline font-medium"
                >
                  Open Feasibility Gate for {releasedLotCode} →
                </Link>
              </>
            ) : null}
          </AcAlert>
        )}
        <div className="wf-light-panel rounded-xl p-4 max-w-2xl space-y-4">
          <AcFormSelect
            label="Ready inward order"
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
                  All ready inward is already released — open{" "}
                  <Link to={`${basePath}/feasibility`} className="text-blue-700 underline">
                    Feasibility Gate
                  </Link>{" "}
                  and select the new lot (LOT-AC-*), not the inward order code.
                </>
              ) : (
                <>
                  No inward ready for release. Complete{" "}
                  <Link to={`${basePath}/raw-material?tab=prep`} className="text-blue-700 underline">
                    inbound prep
                  </Link>{" "}
                  (Lab → RMS bags → crusher → RM outward) first.
                </>
              )}
            </p>
          )}
          {selectedInward && (
            <div className="space-y-3">
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
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-700 space-y-2">
                <p className="font-semibold text-slate-800">
                  Saved inbound process outputs (order metadata — no re-entry)
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  <li>
                    Initial QC:{" "}
                    <span className="font-mono">
                      {selectedInward.initial_qc_status || "—"}
                    </span>
                  </li>
                  <li>
                    Bags:{" "}
                    <span className="font-mono">{selectedInward.bag_count ?? 0}</span>
                  </li>
                  <li>
                    Crusher:{" "}
                    <span className="font-mono">
                      {selectedInward.crusher_complete ? "COMPLETE" : "pending"}
                    </span>
                  </li>
                  <li>
                    Grade separation:{" "}
                    <span className="font-mono">
                      {selectedInward.separation_complete ? "COMPLETE" : "pending"}
                    </span>
                  </li>
                  {selectedInward.scrap_total_kg != null ? (
                    <li>
                      Scrap total:{" "}
                      <span className="font-mono">{selectedInward.scrap_total_kg} KG</span>
                    </li>
                  ) : null}
                  {selectedInward.remaining_kg != null ? (
                    <li>
                      Remaining after scrap:{" "}
                      <span className="font-mono">{selectedInward.remaining_kg} KG</span>
                    </li>
                  ) : null}
                </ul>
                {selectedInward.crusher_grades?.length > 0 ? (
                  <ul className="space-y-0.5 font-mono text-[11px]">
                    {selectedInward.crusher_grades.map((g) => (
                      <li key={g.grade_label || g.parameter_key}>
                        {g.grade_label}: {g.quantity_kg} KG
                      </li>
                    ))}
                  </ul>
                ) : null}
                {gradeLotSplits?.length ? (
                  <p className="text-emerald-800">
                    Release will create{" "}
                    <strong>{gradeLotSplits.length}</strong> production lots (one per bag grade).
                  </p>
                ) : selectedInward.separation_complete ? (
                  <p className="text-amber-800">
                    Grade splits exist but release quantity must match the grade total for multi-lot
                    creation.
                  </p>
                ) : null}
              </div>
            </div>
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
