import { useEffect, useMemo, useState } from "react";

import {
  fetchAcInStockBags,
  fetchAcWorkOrders,
  formatAcApiError,
  reassignAcInStockWorkOrder
} from "../../../services/activatedCarbonApi";
import AcAlert from "./AcAlert";
import AcSaveBar from "./AcSaveBar";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString()} KG`;
}

export default function AcInStockWorkOrderPanel({ canEdit = false }) {
  const [bags, setBags] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [bagCode, setBagCode] = useState("");
  const [targetCode, setTargetCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reload = async () => {
    const [stock, orders] = await Promise.all([fetchAcInStockBags(), fetchAcWorkOrders()]);
    setBags(stock || []);
    setWorkOrders(orders?.work_orders || []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        await reload();
      } catch (err) {
        if (!cancelled) setError(formatAcApiError(err, "Could not load in-stock bags"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = bags.find((bag) => bag.bag_code === bagCode) || null;
  const sourceOrder = workOrders.find((row) => row.work_order_code === selected?.work_order_code) || null;
  const sourceGrade = String(sourceOrder?.grade || "").trim();
  const targets = useMemo(() => {
    if (!sourceGrade) return [];
    return workOrders.filter(
      (row) =>
        row.work_order_code !== selected?.work_order_code &&
        String(row.grade || "").trim() === sourceGrade
    );
  }, [workOrders, selected, sourceGrade]);

  const save = async () => {
    if (!bagCode || !targetCode) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await reassignAcInStockWorkOrder({
        bag_code: bagCode,
        work_order_code: targetCode
      });
      setSuccess(
        `${result.bag_code} moved from ${result.previous_work_order_code} to ${result.work_order_code}.`
      );
      setBagCode("");
      setTargetCode("");
      await reload();
    } catch (err) {
      setError(formatAcApiError(err, "Could not move the work order"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <WfCard>
      <WfCardHeader
        title="Stock Reallocation"
        subtitle="Same grade only. The earlier work order stays on the bag for traceability."
      />
      <WfCardBody>
        <div className="wf-light-panel rounded-xl p-4 space-y-4 max-w-2xl">
          {error ? <AcAlert variant="error">{error}</AcAlert> : null}
          {success ? <AcAlert variant="success">{success}</AcAlert> : null}
          {loading ? (
            <p className="text-sm text-slate-600">Loading in-stock bags…</p>
          ) : (
            <>
              <label className="text-sm block">
                <span className="block mb-1 font-medium text-slate-700">In-stock bag</span>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={bagCode}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setBagCode(e.target.value);
                    setTargetCode("");
                  }}
                >
                  <option value="">{bags.length ? "Select a bag…" : "No bags in stock"}</option>
                  {bags.map((bag) => (
                    <option key={bag.bag_code} value={bag.bag_code}>
                      {bag.bag_code} · {bag.work_order_code || "No work order"} · {formatKg(bag.remaining_kg)}
                    </option>
                  ))}
                </select>
              </label>
              {selected ? (
                <p className="text-sm text-slate-700">
                  Current work order {selected.work_order_code || "—"}
                  {sourceGrade ? ` · grade ${sourceGrade}` : ""}.
                </p>
              ) : null}
              <label className="text-sm block">
                <span className="block mb-1 font-medium text-slate-700">Move to</span>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={targetCode}
                  disabled={!canEdit || !selected}
                  onChange={(e) => setTargetCode(e.target.value)}
                >
                  <option value="">
                    {selected
                      ? targets.length
                        ? "Select a work order of the same grade…"
                        : "No other work order with this grade"
                      : "Select a bag first"}
                  </option>
                  {targets.map((row) => (
                    <option key={row.work_order_code} value={row.work_order_code}>
                      {row.work_order_code} · {row.grade} · CTC {row.ctc || "—"}
                    </option>
                  ))}
                </select>
              </label>
              <AcSaveBar
                onSave={save}
                saving={saving}
                saveLabel="Move work order"
                disabled={!canEdit || !bagCode || !targetCode}
              />
            </>
          )}
        </div>
      </WfCardBody>
    </WfCard>
  );
}
