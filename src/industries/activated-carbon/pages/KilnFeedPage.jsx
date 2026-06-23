import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAppContext } from "../../../context/AppContext";
import useAcPageRefresh from "../hooks/useAcPageRefresh";
import {
  createAcKilnFeedLot,
  fetchAcKilnChargeLots,
  fetchAcKilnFeedLots,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import AcCreatedIdsDialog from "../components/AcCreatedIdsDialog";
import AcAlert from "../components/AcAlert";
import AcFormSelect from "../components/AcFormSelect";
import AcSaveBar from "../components/AcSaveBar";
import useAcMasters from "../hooks/useAcMasters";
import { isValidUuid } from "../utils/acProductUtils";
import { isAcContextReady } from "../utils/acContextUtils";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function KilnFeedPage() {
  const { context, loading: contextLoading } = useAppContext();
  const location = useLocation();
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

  const kilns = masters.kilns || [];

  const reloadLots = async () => {
    setLotsLoading(true);
    try {
      const [allLots, readyLots] = await Promise.all([
        fetchAcKilnFeedLots(),
        fetchAcKilnChargeLots()
      ]);
      setLots(allLots || []);
      setChargeableLots(readyLots || []);
    } finally {
      setLotsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAcContextReady(context, contextLoading)) return;
    reloadLots().catch((e) => setError(formatAcApiError(e, "Failed to load lots")));
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
        `Lot ${lot.lot_code} charged to ${kilnCode}. Continue to Lot Routing to generate work orders.`
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

  const noKilns = ready && kilns.length === 0;
  const noChargeable = ready && !lotsLoading && chargeableLots.length === 0;

  return (
    <div className="max-w-5xl">
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
        subtitle="Charge the activation kiln after Feasibility Gate passes for the lot."
      />

      {(mastersError || error) && <AcAlert variant="error">{mastersError || error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      {noChargeable && (
        <AcAlert variant="warn">
          No lots ready for kiln feed yet. After release, run{" "}
          <Link to="/activated-carbon/feasibility" className="underline font-medium">
            Feasibility Gate
          </Link>{" "}
          for the new lot (LOT-AC-* · your inward order), then return here to charge the kiln.
        </AcAlert>
      )}

      <WfCard className="mb-6">
        <WfCardHeader
          title="Charge kiln"
          subtitle="Select a feasibility-approved lot and assign the activation kiln."
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
                    {inward} · {lot.lot_quantity} KG · feasibility OK
                  </option>
                );
              })}
            </AcFormSelect>

            {selectedLot && (
              <p className="text-xs text-slate-600 md:col-span-2">
                Lot {selectedLot.lot_code || selectedLot.lot_id} · {selectedLot.lot_quantity} KG ·
                status {selectedLot.status || "CREATED"}
              </p>
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
                  to="/activated-carbon/masters?tab=plant-resources"
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
        </WfCardBody>
      </WfCard>

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
