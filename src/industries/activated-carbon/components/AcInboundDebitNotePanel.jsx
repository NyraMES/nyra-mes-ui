import { useState } from "react";

import { useAuth } from "../../../auth/AuthContext";
import { formatAcApiError, raiseAcInwardDebitNote } from "../../../services/activatedCarbonApi";
import { userCanSeeAcSupplier } from "../utils/acPrivileges";
import AcAlert from "./AcAlert";
import AcSaveBar from "./AcSaveBar";

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;
}

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function formatInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₹ ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function AcInboundDebitNotePanel({ selected, onSaved }) {
  const { user } = useAuth();
  const showSupplier = userCanSeeAcSupplier(user?.roles || [], user);
  const note = selected?.debit_note || {};
  const [value, setValue] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!note.eligible && !note.raised) return null;
  const supplierName = note.supplier_name || selected?.supplier_name || "";
  const supplierCode = note.supplier_code || selected?.supplier_code || "";
  const supplierLabel = supplierName || supplierCode;

  const handleSave = async () => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter the debit note value.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await raiseAcInwardDebitNote(selected.customer_order_id, {
        debit_note_value: amount,
        remarks: remarks.trim() || null
      });
      setValue("");
      setRemarks("");
      await onSaved?.(saved);
    } catch (e) {
      setError(formatAcApiError(e, "Could not raise debit note"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wf-light-panel rounded-xl p-4 mb-4 border border-amber-300 bg-amber-50/60">
      <p className="text-sm font-semibold text-amber-950 m-0">Debit note</p>
      {showSupplier && supplierLabel ? (
        <p className="text-sm text-slate-800 mt-1 mb-0">
          Supplier: <span className="font-medium">{supplierName || supplierCode}</span>
          {supplierName && supplierCode ? ` (${supplierCode})` : ""}
        </p>
      ) : null}
      <p className="text-xs text-slate-600 mt-1 mb-3">
        Raise a debit note when our weight is short of the challan weight, or after lab
        when moisture is above the plant limit.
      </p>
      <ul className="text-sm text-slate-800 space-y-1 mb-3">
        {note.weight_short ? (
          <li>
            Weight short: our {formatKg(note.our_weight_kg)} vs challan{" "}
            {formatKg(note.supplier_weight_kg)}
            {note.shortage_kg != null ? ` (−${formatKg(note.shortage_kg)})` : ""}
          </li>
        ) : null}
        {note.moisture_high ? (
          <li>
            Moisture {formatPct(note.moisture_pct)} is above {formatPct(note.moisture_threshold_pct)}
          </li>
        ) : null}
      </ul>
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      {note.raised ? (
        <p className="text-sm text-emerald-800 m-0">
          {note.debit_note_code} raised for {formatInr(note.debit_note_value)}
          {note.remarks ? ` · ${note.remarks}` : ""}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <label className="text-sm block">
              <span className="block mb-1 font-medium text-slate-700">Debit note value (INR)</span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2"
                type="number"
                min="0"
                step="0.01"
                value={value}
                disabled={saving}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <label className="text-sm block">
              <span className="block mb-1 font-medium text-slate-700">Remarks</span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={remarks}
                disabled={saving}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          <AcSaveBar onSave={handleSave} saving={saving} saveLabel="Raise debit note" />
        </>
      )}
    </div>
  );
}
