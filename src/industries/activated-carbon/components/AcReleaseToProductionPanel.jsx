import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAppContext } from "../../../context/AppContext";
import {
  acGradeLotSplitsForRelease,
  createAcMakeToStockOrder,
  fetchAcInwardBags,
  fetchAcReleaseEligibleInward,
  formatAcApiError,
  isAcInwardQcPassed
} from "../../../services/activatedCarbonApi";
import { isAcKilnFeedOutwardBag } from "../constants/processSteps";
import useIndustryBasePath from "../../../hooks/useIndustryBasePath";
import useAcPageRefresh from "../hooks/useAcPageRefresh";
import { isAcContextReady } from "../utils/acContextUtils";
import AcAlert from "./AcAlert";
import AcFormSelect from "./AcFormSelect";
import AcSaveBar from "./AcSaveBar";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

/**
 * Release inbound-prep-complete inward. UI stays on the inward order; PO/lot stay in ontology.
 */
export default function AcReleaseToProductionPanel({ onReleased }) {
  const { context, loading: contextLoading } = useAppContext();
  const basePath = useIndustryBasePath();
  const { focusTick } = useAcPageRefresh();
  const [inwardOrders, setInwardOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [releaseInwardId, setReleaseInwardId] = useState("");
  const [releaseQty, setReleaseQty] = useState("");
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [outwardBags, setOutwardBags] = useState([]);
  const qtyFilledFor = useRef("");

  const reloadInwardOrders = useCallback(async () => {
    if (!isAcContextReady(context, contextLoading)) {
      setOrdersLoading(false);
      return;
    }
    setOrdersLoading(true);
    try {
      const inward = await fetchAcReleaseEligibleInward();
      setInwardOrders(inward);
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
  const kilnFeedKg = outwardBags
    .filter(isAcKilnFeedOutwardBag)
    .reduce((sum, bag) => sum + Number(bag.weight_kg || 0), 0);
  const inwardAvailableKg =
    kilnFeedKg > 0 ? kilnFeedKg : Number(selectedInward?.available_quantity_kg ?? 0);
  const releaseQtyNum = Number(releaseQty || 0);

  useEffect(() => {
    if (!releaseInwardId || !selectedInward?.order_code) {
      setOutwardBags([]);
      return undefined;
    }
    let cancelled = false;
    fetchAcInwardBags(selectedInward.order_code)
      .then((rows) => {
        if (!cancelled) setOutwardBags((rows || []).filter((bag) => Boolean(bag.grade)));
      })
      .catch(() => {
        if (!cancelled) setOutwardBags([]);
      });
    return () => {
      cancelled = true;
    };
  }, [releaseInwardId, selectedInward?.order_code]);

  useEffect(() => {
    if (!releaseInwardId) {
      qtyFilledFor.current = "";
      setReleaseQty("");
      return;
    }
    if (inwardAvailableKg <= 0) return;
    const fillKey = `${releaseInwardId}:${inwardAvailableKg}`;
    if (qtyFilledFor.current === fillKey) return;
    qtyFilledFor.current = fillKey;
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
      setSuccess("Released to production. Open Execution to load the kiln.");
      setReleaseInwardId("");
      if (onReleased) {
        await onReleased({ result });
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
        title="Release to production"
        subtitle="Select the inward order. Quantity is the kiln-feed RO bag total."
      />
      <WfCardBody>
        {error && <AcAlert variant="error">{error}</AcAlert>}
        {success && (
          <AcAlert variant="success">
            {success}{" "}
            <Link to={`${basePath}/execution`} className="text-blue-800 underline font-medium">
              Open Execution →
            </Link>
          </AcAlert>
        )}
        <div className="wf-light-panel rounded-xl p-4 max-w-xl space-y-4">
          <AcFormSelect
            label="Inward order"
            value={releaseInwardId}
            onChange={(e) => setReleaseInwardId(e.target.value)}
            disabled={ordersLoading || !contextReady}
          >
            <option value="">
              {ordersLoading || !contextReady ? "Loading inward orders…" : "Select inward…"}
            </option>
            {qcPassedInward.map((o) => (
              <option key={o.customer_order_id} value={String(o.customer_order_id)}>
                {o.order_code}
                {o.raw_product_code ? ` · ${o.raw_product_code}` : ""}
                {o.supplier_name ? ` · ${o.supplier_name}` : ""}
              </option>
            ))}
          </AcFormSelect>
          {showEmptyHint && (
            <p className="text-xs text-amber-800">
              {fullyReleasedCount > 0 ? (
                <>
                  All ready inward is already released — open{" "}
                  <Link to={`${basePath}/execution`} className="text-blue-700 underline">
                    Execution
                  </Link>
                  .
                </>
              ) : (
                <>
                  No inward ready for release. Complete{" "}
                  <Link to={`${basePath}/raw-material?tab=prep`} className="text-blue-700 underline">
                    inbound prep
                  </Link>{" "}
                  first.
                </>
              )}
            </p>
          )}
          <p className="text-sm text-slate-700">
            Quantity{" "}
            <span className="font-mono font-semibold text-slate-900">
              {selectedInward ? `${inwardAvailableKg || "—"} KG` : "—"}
            </span>
          </p>
          <AcSaveBar
            onSave={handleReleaseToProduction}
            saving={releasing}
            saveLabel="Release to production"
            disabled={
              !contextReady ||
              ordersLoading ||
              !releaseInwardId ||
              !releaseQty ||
              inwardAvailableKg <= 0
            }
          />
        </div>
      </WfCardBody>
    </WfCard>
  );
}
