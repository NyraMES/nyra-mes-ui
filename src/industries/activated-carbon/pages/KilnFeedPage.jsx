import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAppContext } from "../../../context/AppContext";
import useAcPageRefresh from "../hooks/useAcPageRefresh";
import {
  createAcKilnFeedLot,
  fetchAcDashboard,
  fetchAcKilnChargeLots,
  fetchAcKilnFeedLots,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import AcCreatedIdsDialog from "../components/AcCreatedIdsDialog";
import AcAlert from "../components/AcAlert";
import AcFormSelect from "../components/AcFormSelect";
import AcKilnFeedLiveTrack from "../components/AcKilnFeedLiveTrack";
import AcSaveBar from "../components/AcSaveBar";
import useAcMasters from "../hooks/useAcMasters";
import { isValidUuid } from "../utils/acProductUtils";
import AcActivationProductionFlow from "../components/AcActivationProductionFlow";
import useIndustryBasePath from "../../../hooks/useIndustryBasePath";
import { isAcContextReady } from "../utils/acContextUtils";
import { isAcKilnFeedOutwardBag } from "../constants/processSteps";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

const LIVE_REFRESH_MS = 15_000;

function KilnFeedPage() {
  const { context, loading: contextLoading } = useAppContext();
  const location = useLocation();
  const basePath = useIndustryBasePath();
  const { focusTick } = useAcPageRefresh();
  const { masters, loading: mastersLoading, error: mastersError, reload: reloadMasters, ready } =
    useAcMasters();
  const [lots, setLots] = useState([]);
  const [chargeableLots, setChargeableLots] = useState([]);
  const [lotsLoading, setLotsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [idsDialog, setIdsDialog] = useState({ open: false, items: [] });

  const [productionLotId, setProductionLotId] = useState("");
  const [kilnCode, setKilnCode] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const chargeFormRef = useRef(null);

  const kilns = masters.kilns || [];

  const reloadLots = async () => {
    setLotsLoading(true);
    setLiveLoading(true);
    try {
      const [allLots, readyLots, board] = await Promise.all([
        fetchAcKilnFeedLots(),
        fetchAcKilnChargeLots(),
        fetchAcDashboard().catch(() => null)
      ]);
      setLots(allLots || []);
      setChargeableLots(readyLots || []);
      if (board) setDashboard(board);
    } finally {
      setLotsLoading(false);
      setLiveLoading(false);
    }
  };

  useEffect(() => {
    if (!isAcContextReady(context, contextLoading)) return;
    reloadLots().catch((e) => setError(formatAcApiError(e, "Failed to load lots")));
    const timer = setInterval(() => {
      reloadLots().catch(() => {});
    }, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [context, contextLoading, context.tenant_code, context.workspace_code, location.key, focusTick]);

  useEffect(() => {
    if (!ready) return;
    if (!kilnCode && kilns[0]) {
      setKilnCode(kilns[0].resource_code);
    }
  }, [ready, kilns, kilnCode]);

  useEffect(() => {
    if (!productionLotId && chargeableLots[0]) {
      const id = chargeableLots[0].production_lot_id || chargeableLots[0].lot_id;
      if (id) setProductionLotId(String(id));
    }
  }, [chargeableLots, productionLotId]);

  const selectedLot = chargeableLots.find(
    (l) =>
      String(l.production_lot_id) === String(productionLotId) ||
      String(l.lot_id) === String(productionLotId)
  );

  const handleSave = async () => {
    if (!productionLotId || !kilnCode) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const lotPayload = {
        kiln_resource_code: kilnCode,
        status: "IN_PROGRESS"
      };
      if (isValidUuid(productionLotId)) {
        lotPayload.production_lot_id = productionLotId;
      } else {
        lotPayload.lot_code = selectedLot?.lot_code || selectedLot?.lot_id || productionLotId;
      }
      const lot = await createAcKilnFeedLot(lotPayload);
      setSuccess(
        `Lot ${lot.lot_code} charged to ${kilnCode}. Open Lot Routing to generate work orders.`
      );
      setIdsDialog({
        open: true,
        items: [
          { label: "Production lot", value: lot.lot_code },
          { label: "Feed quantity", value: `${lot.lot_quantity} KG` },
          { label: "Kiln", value: kilnCode || "—" },
          { label: "Status", value: lot.status || "IN_PROGRESS" }
        ]
      });
      await reloadLots();
      await reloadMasters();
    } catch (e) {
      setError(formatAcApiError(e, "Kiln charge failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleLiveLoad = (row) => {
    if (row?.resourceCode) setKilnCode(row.resourceCode);
    chargeFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const noKilns = ready && kilns.length === 0;
  const noChargeable = ready && !lotsLoading && chargeableLots.length === 0;

  return (
    <div className="max-w-5xl">
      <AcActivationProductionFlow activeStepId="kiln_feed" lotCode={selectedLot?.lot_code || null} />

      <AcCreatedIdsDialog
        open={idsDialog.open}
        title="Kiln charged"
        subtitle="Lot is in progress on the activation kiln."
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
        subtitle="Live load on each kiln — charge a released lot and watch the cycle."
      />

      <div className="mb-6">
        <AcKilnFeedLiveTrack
          dashboard={dashboard}
          kilnLots={lots}
          selectedKilnCode={kilnCode}
          onLoad={handleLiveLoad}
          loading={liveLoading}
        />
      </div>

      {(mastersError || error) && <AcAlert variant="error">{mastersError || error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      {noChargeable && (
        <AcAlert variant="warn">
          No lots ready for kiln feed yet. Release inward on{" "}
          <Link to={`${basePath}/raw-material?tab=release`} className="underline font-medium">
            Raw Material → Release
          </Link>{" "}
          to create a lot (LOT-AC-*), then charge the kiln here.
        </AcAlert>
      )}

      <div ref={chargeFormRef}>
      <WfCard className="mb-6">
        <WfCardHeader
          title="Charge kiln"
          subtitle="Select a released lot and assign the activation kiln."
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <AcFormSelect
              label="Production lot"
              className="md:col-span-2"
              value={productionLotId}
              loading={lotsLoading}
              onChange={(e) => setProductionLotId(e.target.value)}
            >
              <option value="">Select lot…</option>
              {chargeableLots.map((lot) => {
                const id = lot.production_lot_id || lot.lot_id;
                const code = lot.lot_code || lot.lot_id;
                const inward = lot.order_code ? ` · ${lot.order_code}` : "";
                return (
                  <option key={id} value={String(id)}>
                    {code}
                    {inward}
                    {lot.crusher_bag_code ? ` · ${lot.crusher_bag_code}` : ""}
                    {lot.crusher_grade ? ` · ${lot.crusher_grade}` : ""} · {lot.lot_quantity} KG
                  </option>
                );
              })}
            </AcFormSelect>

            {selectedLot && (
              <div className="text-xs text-slate-600 md:col-span-2 space-y-1">
                <p>
                  Lot {selectedLot.lot_code || selectedLot.lot_id} · {selectedLot.lot_quantity} KG ·
                  status {selectedLot.status || "CREATED"}
                </p>
                {(selectedLot.crusher_outward_bags || []).filter(isAcKilnFeedOutwardBag).length ? (
                  <div>
                    <p className="font-medium text-slate-800">Kiln input — RO bags (rotary grades only)</p>
                    <ul className="font-mono">
                      {selectedLot.crusher_outward_bags.filter(isAcKilnFeedOutwardBag).map((bag, idx) => (
                        <li key={`${bag.bag_code || "bag"}-${idx}`}>
                          {bag.bag_code || "—"}
                          {bag.rotary ? ` · ${bag.rotary}` : ""}
                          {" · "}
                          {bag.grade_label || selectedLot.crusher_grade || "—"} · {bag.quantity_kg} KG
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : selectedLot.crusher_bag_code ? (
                  <p className="font-mono">
                    Bag {selectedLot.crusher_bag_code}
                    {selectedLot.crusher_grade ? ` · ${selectedLot.crusher_grade}` : ""}
                  </p>
                ) : (
                  <p>No crusher outward bags on this lot yet — complete crusher outward before release.</p>
                )}
              </div>
            )}

            <AcFormSelect
              label="Kiln"
              value={kilnCode}
              loading={mastersLoading}
              onChange={(e) => setKilnCode(e.target.value)}
            >
              {kilns.map((k) => (
                <option key={k.resource_id} value={k.resource_code}>
                  {k.resource_code} — {k.resource_name}
                </option>
              ))}
            </AcFormSelect>
            {noKilns && (
              <p className="text-xs text-amber-700 md:col-span-2">
                No kiln resources found.{" "}
                <Link
                  to={`${basePath}/masters?tab=plant-resources`}
                  className="text-blue-700 underline"
                >
                  Add one in Masters → Plant resources
                </Link>
                .
              </p>
            )}
          </div>
          <AcSaveBar
            onSave={handleSave}
            saving={saving}
            saveLabel="Charge kiln"
            disabled={!productionLotId || !kilnCode || noChargeable}
          />
          {selectedLot?.lot_code ? (
            <p className="text-xs text-slate-600 mt-4">
              Next:{" "}
              <Link to={`${basePath}/routing`} className="text-blue-700 underline">
                Lot Routing
              </Link>{" "}
              →{" "}
              <Link to={`${basePath}/execution`} className="text-blue-700 underline">
                Execution
              </Link>
            </p>
          ) : null}
        </WfCardBody>
      </WfCard>
      </div>

      <WfCard>
        <WfCardHeader
          title="All production lots"
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
