import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { useAppContext } from "../../../context/AppContext";
import {
  createAcRawMaterialQc,
  fetchAcRawMaterialQc,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import AcFormSelect from "../components/AcFormSelect";
import AcAlert from "../components/AcAlert";
import AcSaveBar from "../components/AcSaveBar";
import { isAcContextReady } from "../utils/acContextUtils";
import useAcPageRefresh from "../hooks/useAcPageRefresh";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader, StatusPill } from "../../../workflow/ui";

function isQcComplete(status) {
  const s = String(status || "").toUpperCase();
  return s === "PASS" || s === "FAIL" || s === "QC_PASSED" || s === "QC_FAILED";
}

function qcPillKind(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PASS" || s === "QC_PASSED") return "ok";
  if (s === "FAIL" || s === "QC_FAILED") return "bad";
  if (s === "HOLD") return "warn";
  return "neutral";
}

function RawMaterialQcPage() {
  const { context, loading: contextLoading } = useAppContext();
  const location = useLocation();
  const { focusTick } = useAcPageRefresh();
  const [rows, setRows] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [moisturePct, setMoisturePct] = useState("");
  const [ashPct, setAshPct] = useState("");
  const [foreignMatterPct, setForeignMatterPct] = useState("");
  const [operatorRemarks, setOperatorRemarks] = useState("");
  const [qcStatus, setQcStatus] = useState("PASS");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const pendingOrders = rows.filter((r) => !isQcComplete(r.qc_status));

  useEffect(() => {
    if (!pendingOrders.length) {
      setOrderId("");
      return;
    }
    const ids = pendingOrders.map((r) => String(r.customer_order_id));
    if (!orderId || !ids.includes(String(orderId))) {
      setOrderId(ids[0]);
    }
  }, [pendingOrders, orderId]);

  const reloadRows = useCallback(async () => {
    if (!isAcContextReady(context, contextLoading)) {
      return [];
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchAcRawMaterialQc();
      setRows(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, [context, contextLoading, context.tenant_code, context.workspace_code]);

  useEffect(() => {
    if (!isAcContextReady(context, contextLoading)) {
      return;
    }
    reloadRows().catch((e) => setError(formatAcApiError(e, "Failed to load raw material QC records")));
  }, [
    contextLoading,
    context.loaded,
    context.tenant_code,
    context.workspace_code,
    location.key,
    focusTick,
    reloadRows
  ]);

  const noOrders = !loading && isAcContextReady(context, contextLoading) && pendingOrders.length === 0;
  const noQcHistory = !loading && isAcContextReady(context, contextLoading) && rows.length === 0;
  const pageLoading = loading || !isAcContextReady(context, contextLoading);

  const handleSave = async () => {
    if (!orderId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await createAcRawMaterialQc({
        customer_order_id: orderId,
        moisture_pct: moisturePct ? Number(moisturePct) : undefined,
        ash_pct: ashPct ? Number(ashPct) : undefined,
        foreign_matter_pct: foreignMatterPct ? Number(foreignMatterPct) : undefined,
        operator_remarks: operatorRemarks.trim() || undefined,
        qc_status: qcStatus
      });
      setSuccess(`QC saved for ${saved.order_code} · ${saved.qc_status}`);
      setMoisturePct("");
      setAshPct("");
      setForeignMatterPct("");
      setOperatorRemarks("");
      await reloadRows();
    } catch (e) {
      setError(formatAcApiError(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <SectionHeader
        eyebrow="Inbound quality"
        title="Raw Material QC"
        subtitle="Inspect feedstock at inward — moisture, ash, and foreign matter before kiln feed."
      />

      {error && <AcAlert variant="error">{error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      <WfCard className="mb-6">
        <WfCardHeader
          title="Record QC"
          subtitle="Select an inward order with raw material (e.g. coconut shell)."
        />
        <WfCardBody>
          {pageLoading ? (
            <p className="text-sm text-slate-300">Loading inward orders…</p>
          ) : noOrders ? (
            <p className="text-sm text-slate-300">
              {noQcHistory
                ? "No raw material inward orders yet. Create one under "
                : "All inward orders have completed QC. Create a new one under "}
              <strong>Raw Material Inward</strong> first.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
              <AcFormSelect
                label="Inward order"
                value={orderId}
                emptyMessage="No orders pending QC — all inward orders are already inspected."
                onChange={(e) => setOrderId(e.target.value)}
              >
                {pendingOrders.map((r) => (
                  <option key={r.customer_order_id} value={String(r.customer_order_id)}>
                    {r.order_code} — {r.product_code} ({r.quantity} {r.uom || "KG"})
                    {r.qc_status === "HOLD" ? " · HOLD" : ""}
                  </option>
                ))}
              </AcFormSelect>

              <label className="text-sm block">
                <span className="block mb-1 font-medium text-slate-200">QC result</span>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={qcStatus}
                  onChange={(e) => setQcStatus(e.target.value)}
                >
                  <option value="PASS">Pass</option>
                  <option value="HOLD">Hold</option>
                  <option value="FAIL">Fail</option>
                </select>
              </label>

              <label className="text-sm block">
                <span className="block mb-1 font-medium text-slate-200">Moisture (%)</span>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={moisturePct}
                  onChange={(e) => setMoisturePct(e.target.value)}
                  placeholder="e.g. 8.5"
                />
              </label>

              <label className="text-sm block">
                <span className="block mb-1 font-medium text-slate-200">Ash (%)</span>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={ashPct}
                  onChange={(e) => setAshPct(e.target.value)}
                  placeholder="e.g. 2.1"
                />
              </label>

              <label className="text-sm block">
                <span className="block mb-1 font-medium text-slate-200">Foreign matter (%)</span>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={foreignMatterPct}
                  onChange={(e) => setForeignMatterPct(e.target.value)}
                  placeholder="e.g. 0.5"
                />
              </label>

              <label className="text-sm block md:col-span-2">
                <span className="block mb-1 font-medium text-slate-200">Operator remarks</span>
                <textarea
                  className="w-full rounded border border-slate-300 px-3 py-2 min-h-[72px]"
                  value={operatorRemarks}
                  onChange={(e) => setOperatorRemarks(e.target.value)}
                  placeholder="Visual inspection notes"
                />
              </label>
            </div>
          )}

          {!noOrders && !pageLoading && (
            <AcSaveBar
              onSave={handleSave}
              saving={saving}
              saveLabel="Save QC"
              disabled={!orderId}
            />
          )}

          {pendingOrders.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              {pendingOrders.length} order(s) pending QC.
            </p>
          )}
        </WfCardBody>
      </WfCard>

      <WfCard>
        <WfCardHeader title="QC history" />
        <WfCardBody>
          {pageLoading ? (
            <p className="text-sm text-slate-300">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-300">No records yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-white/10">
                  <th className="py-2">Order</th>
                  <th className="py-2">Material</th>
                  <th className="py-2">Moisture</th>
                  <th className="py-2">Ash</th>
                  <th className="py-2">Foreign</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.customer_order_id} className="border-b border-white/5">
                    <td className="py-2 font-mono">{r.order_code}</td>
                    <td className="py-2">{r.product_code}</td>
                    <td className="py-2">{r.moisture_pct ?? "—"}</td>
                    <td className="py-2">{r.ash_pct ?? "—"}</td>
                    <td className="py-2">{r.foreign_matter_pct ?? "—"}</td>
                    <td className="py-2">
                      <StatusPill kind={qcPillKind(r.qc_status)}>{r.qc_status}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default RawMaterialQcPage;
