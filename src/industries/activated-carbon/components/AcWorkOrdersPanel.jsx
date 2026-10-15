import { useEffect, useState } from "react";

import { useAuth } from "../../../auth/AuthContext";
import {
  createAcWorkOrder,
  deleteAcWorkOrder,
  fetchAcWorkOrders,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import AcAlert from "./AcAlert";
import AcSaveBar from "./AcSaveBar";
import useAcPersonLabel from "../hooks/useAcPersonLabel";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function formatStamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export default function AcWorkOrdersPanel({ canEdit = false }) {
  const { user } = useAuth();
  const person = useAcPersonLabel();
  const [rows, setRows] = useState([]);
  const [grades, setGrades] = useState([]);
  const [grade, setGrade] = useState("");
  const [ctc, setCtc] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reload = async () => {
    const data = await fetchAcWorkOrders();
    setRows(data?.work_orders || []);
    setGrades(data?.grades || []);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    reload()
      .catch((e) => {
        if (!cancelled) setError(formatAcApiError(e, "Could not load work orders"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    if (!canEdit) return;
    if (!grade.trim() || !ctc.trim() || !quantityKg.trim()) {
      setError("Grade, CTC, and quantity are required.");
      return;
    }
    const ctcNum = Number(ctc);
    const qty = Number(quantityKg);
    if (!Number.isFinite(ctcNum) || ctcNum <= 0) {
      setError("CTC must be a number greater than zero.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Quantity must be a number of KG greater than zero.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const created = await createAcWorkOrder({
        grade: grade.trim(),
        ctc: String(ctcNum),
        quantity_kg: qty,
        user_id: user?.username || user?.email || undefined
      });
      setCtc("");
      setQuantityKg("");
      await reload();
      setSuccess(`Work order ${created.work_order_code} created.`);
    } catch (e) {
      setError(formatAcApiError(e, "Could not create work order"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (workOrderCode) => {
    if (!canEdit || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await deleteAcWorkOrder(workOrderCode);
      await reload();
      setSuccess(`Work order ${workOrderCode} deleted.`);
    } catch (e) {
      setError(formatAcApiError(e, "Could not delete work order"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <WfCard>
        <WfCardHeader
          title="Activation work orders"
          subtitle="Create a work order with the grade, CTC, and KG required. Kiln feed starts from this work order number — not a customer PO."
        />
        <WfCardBody>
          {error ? <AcAlert variant="error">{error}</AcAlert> : null}
          {success ? <AcAlert variant="success">{success}</AcAlert> : null}
          {canEdit ? (
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <label className="text-xs font-medium text-slate-600 min-w-[12rem]">
                Grade
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={grade}
                  onChange={(e) => {
                    setGrade(e.target.value);
                    setError("");
                  }}
                  disabled={saving}
                >
                  <option value="">Select grade</option>
                  {grades.map((row) => (
                    <option key={row} value={row}>
                      {row}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                CTC
                <input
                  type="number"
                  step="0.1"
                  className="mt-1 w-28 rounded border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  value={ctc}
                  onChange={(e) => {
                    setCtc(e.target.value);
                    setError("");
                  }}
                  disabled={saving}
                  placeholder="40.0"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Quantity KG
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-36 rounded border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  value={quantityKg}
                  onChange={(e) => {
                    setQuantityKg(e.target.value);
                    setError("");
                  }}
                  disabled={saving}
                  placeholder="500"
                />
              </label>
              <AcSaveBar onSave={handleSave} saving={saving} saveLabel="Create work order" />
            </div>
          ) : (
            <p className="text-sm text-slate-600 mb-3">View only.</p>
          )}
          {loading ? <p className="text-sm text-slate-600">Loading work orders…</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="text-sm text-slate-600">No work orders yet.</p>
          ) : null}
          {rows.length > 0 ? (
            <table className="w-full text-sm max-w-5xl">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2">Work order</th>
                  <th className="py-2">Grade</th>
                  <th className="py-2">CTC</th>
                  <th className="py-2">Quantity</th>
                  <th className="py-2">Charged</th>
                  <th className="py-2">Fulfilled CTC</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Created</th>
                  {canEdit ? <th className="py-2"> </th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.work_order_code} className="border-b border-slate-100">
                    <td className="py-2 font-mono">{row.work_order_code}</td>
                    <td className="py-2">{row.grade || "—"}</td>
                    <td className="py-2 tabular-nums">{row.ctc || "—"}</td>
                    <td className="py-2 tabular-nums">{Number(row.quantity_kg || 0).toFixed(2)} kg</td>
                    <td className="py-2 tabular-nums">{Number(row.loaded_kg || 0).toFixed(2)} kg</td>
                    <td className="py-2 tabular-nums">{Number(row.fulfilled_kg || 0).toFixed(2)} kg</td>
                    <td className="py-2">{row.status}</td>
                    <td className="py-2 text-xs text-slate-600">
                      {formatStamp(row.created_at)}
                      {row.created_by ? ` · ${person(row.created_by)}` : ""}
                    </td>
                    {canEdit ? (
                      <td className="py-2">
                        {Number(row.loaded_kg || 0) === 0 && Number(row.fulfilled_kg || 0) === 0 ? (
                          <button
                            type="button"
                            className="text-xs text-blue-700 underline disabled:text-slate-400"
                            disabled={saving}
                            onClick={() => handleDelete(row.work_order_code)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </WfCardBody>
      </WfCard>
    </div>
  );
}
