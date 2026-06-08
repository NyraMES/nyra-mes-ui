import { useEffect, useState } from "react";

import {
  createAcDispatch,
  fetchAcCustomers,
  fetchAcDispatches,
  fetchAcKilnFeedLots,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import AcFormSelect from "../components/AcFormSelect";
import AcSaveBar from "../components/AcSaveBar";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function DispatchPage() {
  const [customers, setCustomers] = useState([]);
  const [lots, setLots] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [lotCode, setLotCode] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [dispatchQty, setDispatchQty] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const [c, l, d] = await Promise.all([
      fetchAcCustomers(),
      fetchAcKilnFeedLots(),
      fetchAcDispatches()
    ]);
    setCustomers(c || []);
    setLots(l || []);
    setDispatches(d || []);
    if (c?.[0]?.customer_code) setCustomerId((prev) => prev || c[0].customer_code);
    if (l?.[0]?.lot_code) setLotCode((prev) => prev || l[0].lot_code);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        await reload();
      } catch (e) {
        setError(formatAcApiError(e, "Failed to load dispatch data"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const lot = lots.find((l) => l.lot_code === lotCode);
    if (lot?.lot_quantity != null && !dispatchQty) {
      setDispatchQty(String(lot.lot_quantity));
    }
  }, [lotCode, lots, dispatchQty]);

  const selectedLot = lots.find((l) => l.lot_code === lotCode);

  const handleSave = async () => {
    if (!customerId || !lotCode) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const row = await createAcDispatch({
        customer_id: customerId,
        vehicle_number: vehicleNumber || undefined,
        transporter_name: transporterName || undefined,
        dispatch_status: "Ready",
        lines: [
          {
            lot_id: lotCode,
            part_id: selectedLot?.product_code || "AC-GRAN-8x30",
            dispatch_quantity: dispatchQty || selectedLot?.lot_quantity || 1
          }
        ]
      });
      setSuccess(`Dispatch ${row.dispatch_id} recorded`);
      setVehicleNumber("");
      setTransporterName("");
      await reload();
    } catch (e) {
      setError(formatAcApiError(e, "Dispatch failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <SectionHeader
        eyebrow="Outbound"
        title="Dispatch"
        subtitle="Release finished carbon lots to customers after quality clearance."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
          {success}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-600 mb-4">Loading dispatch data…</p>
      ) : null}

      <WfCard className="mb-6">
        <WfCardHeader title="New dispatch" subtitle="Dispatch ID from sequence." />
        <WfCardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <AcFormSelect
              label="Customer"
              value={customerId}
              loading={loading}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_code}>
                  {c.customer_code} — {c.customer_name}
                </option>
              ))}
            </AcFormSelect>

            <AcFormSelect
              label="Production lot"
              value={lotCode}
              loading={loading}
              onChange={(e) => setLotCode(e.target.value)}
            >
              {lots.map((lot) => (
                <option key={lot.production_lot_id || lot.lot_code} value={lot.lot_code}>
                  {lot.lot_code} · {lot.lot_quantity} KG
                </option>
              ))}
            </AcFormSelect>

            <label className="text-sm">
              <span className="block mb-1 font-medium text-slate-700">Dispatch qty (KG)</span>
              <input
                type="number"
                min="1"
                className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                value={dispatchQty}
                onChange={(e) => setDispatchQty(e.target.value)}
              />
            </label>

            <label className="text-sm">
              <span className="block mb-1 font-medium text-slate-700">Vehicle number</span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
              />
            </label>

            <label className="text-sm md:col-span-2">
              <span className="block mb-1 font-medium text-slate-700">Transporter</span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
              />
            </label>
          </div>
          {!loading && customers.length === 0 && (
            <p className="text-xs text-amber-800 mt-2">
              No customers — add one under Masters or run the demo seed script.
            </p>
          )}
          {!loading && lots.length === 0 && (
            <p className="text-xs text-amber-800 mt-2">
              No lots — create kiln feed lots first.
            </p>
          )}
          <AcSaveBar
            onSave={handleSave}
            saving={saving}
            saveLabel="Create dispatch"
            disabled={loading || !customerId || !lotCode}
          />
        </WfCardBody>
      </WfCard>

      <WfCard>
        <WfCardHeader title="Dispatch history" />
        <WfCardBody>
          {dispatches.length === 0 ? (
            <p className="text-sm text-slate-600">No dispatches yet.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {dispatches.map((d) => (
                <li key={d.dispatch_id} className="font-mono text-slate-800">
                  {d.dispatch_id} · {d.dispatch_status || "Ready"}
                  {d.vehicle_number ? ` · ${d.vehicle_number}` : ""}
                </li>
              ))}
            </ul>
          )}
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default DispatchPage;
