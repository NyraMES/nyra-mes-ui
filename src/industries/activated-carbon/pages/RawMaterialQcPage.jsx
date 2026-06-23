import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import {
  AcQcFieldInput,
  buildQcPayload,
  emptyQcForm
} from "../components/AcQcDynamicFields";
import useAcOntologyConfig from "../hooks/useAcOntologyConfig";
import { getEnabledQcParameters } from "../utils/acOntologyConfigStore";
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

function formatCellValue(row, field) {
  const v = row[field.key];
  if (v == null || v === "") return "—";
  if (field.fieldType === "textarea") return String(v).slice(0, 40);
  if (field.unit === "kg") return `${v} kg`;
  if (field.unit === "%") return `${v}%`;
  return String(v);
}

function RawMaterialQcPage() {
  const { context, loading: contextLoading } = useAppContext();
  const location = useLocation();
  const { focusTick } = useAcPageRefresh();
  const { config: ontologyConfig, loading: configLoading } = useAcOntologyConfig();

  const qcFields = useMemo(
    () => getEnabledQcParameters(ontologyConfig).filter((f) => f.key !== "operator_remarks"),
    [ontologyConfig]
  );
  const remarksField = useMemo(
    () => getEnabledQcParameters(ontologyConfig).find((f) => f.key === "operator_remarks"),
    [ontologyConfig]
  );
  const historyFields = useMemo(
    () => getEnabledQcParameters(ontologyConfig).filter((f) => f.fieldType !== "textarea"),
    [ontologyConfig]
  );

  const [rows, setRows] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [formValues, setFormValues] = useState({});
  const [qcStatus, setQcStatus] = useState("PASS");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const allInputFields = useMemo(
    () => [...qcFields, ...(remarksField ? [remarksField] : [])],
    [qcFields, remarksField]
  );

  useEffect(() => {
    setFormValues((prev) => ({ ...emptyQcForm(allInputFields), ...prev }));
  }, [allInputFields]);

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
  const pageLoading = loading || configLoading || !isAcContextReady(context, contextLoading);

  const setField = (key, value) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!orderId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await createAcRawMaterialQc({
        customer_order_id: orderId,
        qc_status: qcStatus,
        ...buildQcPayload(formValues, allInputFields)
      });
      setSuccess(`QC saved for ${saved.order_code} · ${saved.qc_status}`);
      setFormValues(emptyQcForm(allInputFields));
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
        subtitle="Inspect feedstock at inward — fields configured in Masters → Ontology & UI (triplet-linked)."
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

              {qcFields.map((field) => (
                <AcQcFieldInput
                  key={field.key}
                  field={field}
                  value={formValues[field.key]}
                  onChange={setField}
                />
              ))}

              {remarksField ? (
                <AcQcFieldInput
                  field={remarksField}
                  value={formValues[remarksField.key]}
                  onChange={setField}
                />
              ) : null}
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
              {pendingOrders.length} order(s) pending QC.{" "}
              <Link to="/activated-carbon/masters?tab=ontology-ui" className="text-cyan-400 underline">
                Configure QC fields
              </Link>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="py-2 pr-2">Order</th>
                    <th className="py-2 pr-2">Material</th>
                    {historyFields.map((field) => (
                      <th key={field.key} className="py-2 pr-2">
                        {field.label}
                      </th>
                    ))}
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.customer_order_id} className="border-b border-white/5">
                      <td className="py-2 font-mono">{r.order_code}</td>
                      <td className="py-2">{r.product_code}</td>
                      {historyFields.map((field) => (
                        <td key={field.key} className="py-2">
                          {formatCellValue(r, field)}
                        </td>
                      ))}
                      <td className="py-2">
                        <StatusPill kind={qcPillKind(r.qc_status)}>{r.qc_status}</StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default RawMaterialQcPage;
