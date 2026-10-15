import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppContext } from "../../../context/AppContext";
import useAcPageRefresh from "../hooks/useAcPageRefresh";
import {
  bagMatchesWorkOrder,
  createAcDispatchFromOrder,
  fetchAcDispatches,
  fetchAcInStockBags,
  fetchAcWorkOrders,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import { isAcContextReady } from "../utils/acContextUtils";
import AcAlert from "../components/AcAlert";
import AcFormSelect from "../components/AcFormSelect";
import AcSaveBar from "../components/AcSaveBar";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

const SOURCE_LABELS = {
  destoning: "Destoning",
  screening: "Screening",
  crushing: "Crushing",
  dedusting: "De-dusting",
  demagnetisation: "De-magnetisation",
  blending: "Blending",
  fg_qc: "In Stock"
};

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString()} KG`;
}

function sourceLabel(source) {
  return SOURCE_LABELS[source] || source || "In Stock";
}

function StockSummary({ bags, loading, workOrderCode = "" }) {
  const [openSource, setOpenSource] = useState("");

  const groups = useMemo(() => {
    const bySource = new Map();
    for (const bag of bags) {
      const key = bag.source || "in_stock";
      const current = bySource.get(key) || { source: key, bags: [], kg: 0 };
      current.bags.push(bag);
      current.kg += Number(bag.remaining_kg || 0);
      bySource.set(key, current);
    }
    return Array.from(bySource.values()).sort((a, b) =>
      sourceLabel(a.source).localeCompare(sourceLabel(b.source))
    );
  }, [bags]);

  const totalKg = bags.reduce((sum, bag) => sum + Number(bag.remaining_kg || 0), 0);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading stock…</p>;
  }
  if (!bags.length) {
    return (
      <p className="text-sm text-slate-600">
        No bags in stock{workOrderCode ? ` for ${workOrderCode}` : ""} yet. Set destination to
        In Stock on a post-activation quality step.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Available stock{workOrderCode ? ` · ${workOrderCode}` : ""}
          </p>
          <p className="text-lg font-semibold text-slate-900 tabular-nums">{formatKg(totalKg)}</p>
        </div>
        <p className="text-sm text-slate-600">{bags.length} bag{bags.length === 1 ? "" : "s"}</p>
      </div>
      <p className="text-xs text-slate-500">Click a process to see bag numbers and quantity.</p>
      <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
        {groups.map((group) => {
          const open = openSource === group.source;
          return (
            <div key={group.source}>
              <button
                type="button"
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50"
                onClick={() => setOpenSource(open ? "" : group.source)}
                aria-expanded={open}
              >
                <span className="font-medium text-slate-900">{sourceLabel(group.source)}</span>
                <span className="text-sm text-slate-700 tabular-nums">
                  {formatKg(group.kg)} · {group.bags.length} bag{group.bags.length === 1 ? "" : "s"}{" "}
                  <span className="text-slate-400">{open ? "▾" : "▸"}</span>
                </span>
              </button>
              {open ? (
                <table className="w-full text-sm border-t border-slate-100">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-4 py-2 font-semibold">Bag</th>
                      <th className="px-4 py-2 font-semibold">Work order</th>
                      <th className="px-4 py-2 font-semibold">Grade</th>
                      <th className="px-4 py-2 font-semibold text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.bags.map((bag) => (
                      <tr key={bag.bag_code} className="border-t border-slate-50 text-slate-900">
                        <td className="px-4 py-2 font-mono">{bag.bag_code}</td>
                        <td className="px-4 py-2 font-mono">{bag.work_order_code || "—"}</td>
                        <td className="px-4 py-2">{bag.grade || "In Stock"}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">
                          {formatKg(bag.remaining_kg)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DispatchPage() {
  const { context, loading: contextLoading } = useAppContext();
  const { focusTick } = useAcPageRefresh();

  const [workOrders, setWorkOrders] = useState([]);
  const [inStockBags, setInStockBags] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [workOrderCode, setWorkOrderCode] = useState("");
  const [selectedBags, setSelectedBags] = useState([]);
  const [dispatchQty, setDispatchQty] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transporterName, setTransporterName] = useState("");

  const reload = useCallback(async () => {
    const [bags, history, woData] = await Promise.all([
      fetchAcInStockBags(),
      fetchAcDispatches(),
      fetchAcWorkOrders()
    ]);
    setInStockBags(bags || []);
    setDispatches(history || []);
    setWorkOrders(woData?.work_orders || []);
  }, []);

  useEffect(() => {
    if (!isAcContextReady(context, contextLoading)) return;
    setLoading(true);
    setError("");
    reload()
      .catch((e) => setError(formatAcApiError(e, "Failed to load dispatch data")))
      .finally(() => setLoading(false));
  }, [context, contextLoading, context.tenant_code, context.workspace_code, focusTick, reload]);

  const selectedWorkOrder = useMemo(
    () => workOrders.find((row) => row.work_order_code === workOrderCode) || null,
    [workOrders, workOrderCode]
  );

  const eligibleBags = useMemo(() => {
    if (!workOrderCode) return [];
    return inStockBags.filter((bag) => bagMatchesWorkOrder(bag, workOrderCode));
  }, [inStockBags, workOrderCode]);

  const workOrderStockKg = eligibleBags.reduce((sum, bag) => sum + Number(bag.remaining_kg || 0), 0);
  const selectedBagRows = eligibleBags.filter((bag) => selectedBags.includes(bag.bag_code));
  const selectedKg = selectedBagRows.reduce((sum, bag) => sum + Number(bag.remaining_kg || 0), 0);
  const allSelected = eligibleBags.length > 0 && selectedBagRows.length === eligibleBags.length;
  const dispatchedKg = Number(selectedWorkOrder?.dispatched_kg || 0);
  const pendingKg = selectedWorkOrder
    ? Number(selectedWorkOrder.pending_kg ?? selectedWorkOrder.quantity_kg ?? 0)
    : 0;
  const shipCapKg = Math.min(selectedKg, pendingKg);

  useEffect(() => {
    if (!workOrderCode) {
      setSelectedBags([]);
      setDispatchQty("");
      return;
    }
    const codes = eligibleBags.map((bag) => bag.bag_code).filter(Boolean);
    const kg = eligibleBags.reduce((sum, bag) => sum + Number(bag.remaining_kg || 0), 0);
    const cap = Math.min(kg, pendingKg);
    setSelectedBags(codes);
    setDispatchQty(cap > 0 ? String(cap) : "");
  }, [workOrderCode, eligibleBags, pendingKg]);

  const applySelection = (codes) => {
    const rows = eligibleBags.filter((bag) => codes.includes(bag.bag_code));
    const kg = rows.reduce((sum, bag) => sum + Number(bag.remaining_kg || 0), 0);
    const cap = Math.min(kg, pendingKg);
    setSelectedBags(codes);
    setDispatchQty(cap > 0 ? String(cap) : "");
  };

  const canDispatch =
    Boolean(workOrderCode) &&
    pendingKg > 0 &&
    selectedBagRows.length > 0 &&
    Number(dispatchQty) > 0 &&
    Number(dispatchQty) <= shipCapKg + 0.001;

  const handleSave = async () => {
    if (!workOrderCode || !dispatchQty) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await createAcDispatchFromOrder({
        work_order_code: workOrderCode,
        quantity_kg: dispatchQty,
        bag_codes: selectedBags,
        vehicle_number: vehicleNumber || undefined,
        transporter_name: transporterName || undefined
      });
      setSuccess(
        `Dispatch ${result.dispatch_id} · ${formatKg(result.quantity_kg)} shipped against ${result.work_order_code || workOrderCode}.` +
          ` Pending to dispatch ${formatKg(result.remaining_on_order_kg)}.`
      );
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
    <div className="max-w-6xl space-y-6">
      <SectionHeader
        eyebrow="Outbound"
        title="Dispatch"
        subtitle="Ship from post-activation In Stock bags by work order number."
      />

      {error && <AcAlert variant="error">{error}</AcAlert>}
      {success && <AcAlert variant="success">{success}</AcAlert>}

      {!loading && workOrders.length === 0 ? (
        <AcAlert variant="warning">
          No work orders yet. Create a work order in Admin, then move bags to In Stock.
        </AcAlert>
      ) : null}

      <WfCard>
        <WfCardHeader title="Ship from stock" subtitle="Select the bags, then confirm the quantity." />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 space-y-4">
            <AcFormSelect
              label="Work order number"
              value={workOrderCode}
              loading={loading}
              onChange={(e) => {
                setWorkOrderCode(e.target.value);
                setSelectedBags([]);
                setDispatchQty("");
              }}
            >
              <option value="">Select work order…</option>
              {workOrders.map((row) => (
                <option key={row.work_order_code} value={row.work_order_code}>
                  {row.work_order_code} · {row.grade || "—"} · CTC {row.ctc || "—"} ·{" "}
                  {Number(row.pending_kg ?? row.quantity_kg ?? 0).toLocaleString()} KG pending
                </option>
              ))}
            </AcFormSelect>

            {selectedWorkOrder ? (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Work order</p>
                  <p className="font-mono font-medium">{selectedWorkOrder.work_order_code}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Grade / CTC</p>
                  <p className="font-medium">
                    {selectedWorkOrder.grade || "—"}
                    {selectedWorkOrder.ctc ? ` · CTC ${selectedWorkOrder.ctc}` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Work-order qty</p>
                  <p className="font-mono">{formatKg(selectedWorkOrder.quantity_kg)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Dispatched</p>
                  <p className="font-mono font-semibold text-slate-900">{formatKg(dispatchedKg)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Pending to dispatch</p>
                  <p className="font-mono font-semibold text-blue-800">{formatKg(pendingKg)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">In stock for this WO</p>
                  <p className="font-mono">{formatKg(workOrderStockKg)}</p>
                </div>
                <div className="md:col-span-2">
                  {pendingKg <= 0 ? (
                    <p className="text-emerald-800 font-medium">
                      This work order is fully dispatched.
                    </p>
                  ) : workOrderStockKg > 0 ? (
                    <p className="text-emerald-800 font-medium">
                      {eligibleBags.length} bag{eligibleBags.length === 1 ? "" : "s"} ready to ship.
                    </p>
                  ) : (
                    <p className="text-amber-900">
                      No In Stock bags for this work order yet. Set Quality destination to In Stock
                      first.
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {workOrderCode && eligibleBags.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white">
                <label className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium text-slate-900">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        applySelection(
                          allSelected ? [] : eligibleBags.map((bag) => bag.bag_code).filter(Boolean)
                        )
                      }
                    />
                    Select all
                  </span>
                  <span className="font-mono text-slate-700">{formatKg(selectedKg)} selected</span>
                </label>
                <ul className="divide-y divide-slate-100">
                  {eligibleBags.map((bag) => (
                    <li key={bag.bag_code}>
                      <label className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-slate-900">
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedBags.includes(bag.bag_code)}
                            onChange={() => {
                              const next = selectedBags.includes(bag.bag_code)
                                ? selectedBags.filter((code) => code !== bag.bag_code)
                                : [...selectedBags, bag.bag_code];
                              applySelection(next);
                            }}
                          />
                          <span className="font-mono truncate">{bag.bag_code}</span>
                          <span className="text-slate-500">{sourceLabel(bag.source)}</span>
                        </span>
                        <span className="font-mono shrink-0">{formatKg(bag.remaining_kg)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <label className="text-sm">
                <span className="block mb-1 font-medium text-slate-700">Dispatch qty</span>
                <input
                  type="number"
                  min="1"
                  max={shipCapKg || undefined}
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

              <label className="text-sm">
                <span className="block mb-1 font-medium text-slate-700">Transporter</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                />
              </label>
            </div>

            <AcSaveBar
              onSave={handleSave}
              saving={saving}
              saveLabel="Confirm dispatch"
              disabled={loading || !workOrderCode || !canDispatch}
            />
          </div>
        </WfCardBody>
      </WfCard>

      <WfCard>
        <WfCardHeader
          title="Available stock"
          subtitle="In Stock bags from post-activation, grouped by process. Select a work order to filter."
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4">
            <StockSummary
              bags={workOrderCode ? eligibleBags : inStockBags}
              loading={loading}
              workOrderCode={workOrderCode}
            />
          </div>
        </WfCardBody>
      </WfCard>

      <WfCard>
        <WfCardHeader title="Dispatch history" />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4">
            {dispatches.length === 0 ? (
              <p className="text-sm text-slate-600">No dispatches yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-2 font-semibold">Dispatch ID</th>
                    <th className="py-2 font-semibold">Work order</th>
                    <th className="py-2 font-semibold">Quantity</th>
                    <th className="py-2 font-semibold">Status</th>
                    <th className="py-2 font-semibold">Vehicle</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatches.map((d) => (
                    <tr key={d.dispatch_id} className="border-b border-slate-100 text-slate-900">
                      <td className="py-2 font-mono">{d.dispatch_id}</td>
                      <td className="py-2 font-mono">{d.work_order_code || "—"}</td>
                      <td className="py-2 font-mono">{formatKg(d.quantity_kg)}</td>
                      <td className="py-2">{d.dispatch_status || "Shipped"}</td>
                      <td className="py-2">{d.vehicle_number || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default DispatchPage;
