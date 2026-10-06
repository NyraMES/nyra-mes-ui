import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { formatApiError } from "../../../services/api";
import {
  createAcDestoningOutputBag,
  fetchAcDestoningState,
  loadAcDestoningBag,
  unloadAcDestoningBag
} from "../../../services/activatedCarbonApi";
import { KILN_LIVE_WINDOW_HOURS, parseKilnFeedEvents } from "../utils/acKilnLoaderUtils";
import useBusyGuard from "../hooks/useBusyGuard";
import AcAlert from "./AcAlert";
import AcKilnCumulativeChart from "./AcKilnCumulativeChart";

const LIVE_TICK_MS = 15_000;

function formatKg(value) {
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toFixed(2)} kg` : "0.00 kg";
}

function formatKgRange(kg) {
  const n = Number(kg);
  if (!Number.isFinite(n) || n <= 0) return "0 - 0.00 kg";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} - ${n.toFixed(2)} kg`;
}

function availableBags(kilns = []) {
  const seen = new Set();
  const rows = [];
  for (const group of kilns) {
    for (const bag of group.bags || []) {
      if (!bag.bag_code || seen.has(bag.bag_code)) continue;
      seen.add(bag.bag_code);
      rows.push({ ...bag, source_name: group.kiln_name });
    }
  }
  return rows;
}

export default function AcDestoningPanel({ lot = null }) {
  const [state, setState] = useState(null);
  const [outputKg, setOutputKg] = useState("");
  const [editKg, setEditKg] = useState({});
  const [picking, setPicking] = useState(false);
  const { busy: saving, run: runBusy } = useBusyGuard();
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const applyState = (next) => {
    setState(next);
  };

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), LIVE_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAcDestoningState()
      .then((row) => {
        if (!cancelled) applyState(row);
      })
      .catch((e) => {
        if (!cancelled) setError(formatApiError(e, "Could not load destoning"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = (fn) =>
    runBusy(async () => {
      setError("");
      try {
        applyState(await fn());
        return true;
      } catch (e) {
        setError(formatApiError(e, "Destoning update failed"));
        return false;
      }
    });

  const available = useMemo(() => availableBags(state?.kilns || []), [state]);
  const loaded = state?.loaded || [];
  const loadedKg = Number(state?.loaded_kg || 0);
  const capacity = state?.loader_capacity || 6;
  const outputBags = state?.output_bags || [];
  const outputKgTotal = outputBags.reduce((sum, bag) => sum + (Number(bag.quantity_kg) || 0), 0);
  const canCreate = Number(outputKg) > 0 && !saving;

  const events = useMemo(() => {
    const raw = (state?.load_events || []).map((row) => ({
      lot_code: row.lot_code,
      bag_code: row.bag_code,
      kg: row.kg,
      loaded_at: row.loaded_at,
      kiln_resource_code: row.kiln_resource_code
    }));
    return parseKilnFeedEvents(raw);
  }, [state]);

  const cumulativeKg = events.reduce((sum, ev) => sum + (Number(ev.kg) || 0), 0);

  const handleLoadBag = async (bag) => {
    await run(() => loadAcDestoningBag(bag.bag_code));
  };

  const saveOutput = (payload) =>
    run(() =>
      createAcDestoningOutputBag({
        ...payload,
        lot_code: lot?.lot_code || lot?.lot_id || undefined
      })
    );

  return (
    <section className="wf-light-panel rounded-xl border border-slate-200 bg-white p-4 space-y-4" style={{ color: "#0f172a", background: "#ffffff" }}>
      <div className="text-sm font-medium">Destoner Load / Unload</div>

      {error ? <AcAlert variant="error">{error}</AcAlert> : null}

      <article className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
          <div>
            <h3 className="text-base font-semibold">De-Stoner — Loader</h3>
            <p className="text-sm tabular-nums mt-1" style={{ color: "#475569" }}>
              {formatKgRange(cumulativeKg || loadedKg)}
              {` · ${loaded.length}/${capacity} on loader`}
            </p>
            {loaded.length >= capacity ? (
              <p className="text-xs mt-1" style={{ color: "#b45309" }}>
                Loader is full. Unload a bag or add destoner output to free a slot.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setPicking(true)}
            disabled={saving || loaded.length >= capacity}
            className="shrink-0 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
          >
            {saving ? "Loading…" : "Load bag"}
          </button>
        </div>

        <div className="px-4 pb-3">
          <AcKilnCumulativeChart events={events} nowMs={nowMs} windowHours={KILN_LIVE_WINDOW_HOURS} />
        </div>

        {loaded.length > 0 ? (
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {loaded.map((bag) => (
              <span
                key={bag.bag_code}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs"
              >
                <span className="font-mono">{bag.bag_code}</span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => run(() => unloadAcDestoningBag(bag.bag_code))}
                  className="text-slate-500 hover:text-slate-800"
                >
                  Unload
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-4">
          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
              <p className="text-sm font-semibold mb-2">De-stoner output</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={outputKg}
                  onChange={(e) => setOutputKg(e.target.value)}
                  placeholder="Weight (kg)"
                  disabled={saving}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                />
                <button
                  type="button"
                  disabled={!canCreate}
                  onClick={() =>
                    saveOutput({ quantity_kg: Number(outputKg) }).then((ok) => {
                      if (ok) setOutputKg("");
                    })
                  }
                  className="rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
                >
                  {saving ? "Adding…" : "Add"}
                </button>
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
              <p className="text-sm font-semibold mb-2">Counters — output</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-slate-200 px-3 py-1">
                  No. of bags: {outputBags.length}
                </span>
                <span className="rounded-full bg-blue-600 text-white px-3 py-1">
                  Weight: {outputKgTotal.toFixed(2)} kg
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
            <p className="text-sm font-semibold mb-2">List of outputs</p>
            {outputBags.length === 0 ? (
              <p className="text-xs text-slate-500">
                Add a weight to create a DS bag. Loading kiln bags is optional.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1 pr-2 font-medium">Label</th>
                      <th className="py-1 pr-2 font-medium">Weight (kg)</th>
                      <th className="py-1 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {outputBags
                      .slice()
                      .reverse()
                      .map((bag) => {
                        const draft = editKg[bag.bag_code];
                        const value = draft == null ? String(bag.quantity_kg ?? "") : draft;
                        const qty = Number(value);
                        const dirty = Number(bag.quantity_kg) !== qty;
                        return (
                          <tr key={bag.bag_code} className="border-t border-slate-100">
                            <td className="py-1.5 pr-2">
                              <span className="inline-flex rounded-full border border-slate-200 px-2 py-0.5 font-mono">
                                {bag.bag_code}
                              </span>
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={value}
                                onChange={(e) =>
                                  setEditKg((prev) => ({ ...prev, [bag.bag_code]: e.target.value }))
                                }
                                className="w-24 rounded-md border border-slate-300 px-2 py-1 tabular-nums"
                              />
                            </td>
                            <td className="py-1.5">
                              <button
                                type="button"
                                disabled={saving || !dirty || !(qty > 0)}
                                onClick={() =>
                                  saveOutput({
                                    bag_code: bag.bag_code,
                                    quantity_kg: qty
                                  }).then((ok) => {
                                    if (ok) {
                                      setEditKg((prev) => {
                                        const next = { ...prev };
                                        delete next[bag.bag_code];
                                        return next;
                                      });
                                    }
                                  })
                                }
                                className="text-blue-700 hover:text-blue-900 disabled:text-slate-400"
                              >
                                Update
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </article>

      {picking
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              onClick={() => !saving && setPicking(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 400,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                background: "rgba(2, 6, 23, 0.82)"
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  maxWidth: 520,
                  borderRadius: 16,
                  padding: 20,
                  background: "#ffffff",
                  color: "#0f172a",
                  boxShadow: "0 24px 48px rgba(0, 0, 0, 0.35)",
                  border: "1px solid #e2e8f0"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>Bags not destoned</div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                      Select a kiln output bag to load on the de-stoner.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPicking(false)}
                    style={{
                      color: "#1d4ed8",
                      background: "transparent",
                      border: 0,
                      textDecoration: "underline",
                      fontSize: 14,
                      cursor: "pointer"
                    }}
                  >
                    Close
                  </button>
                </div>
                {available.length === 0 ? (
                  <div style={{ fontSize: 14, color: "#475569" }}>
                    All kiln output bags have already crossed destoning.
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 320, overflowY: "auto" }}>
                    {available.map((bag) => (
                      <li key={bag.bag_code} style={{ marginBottom: 8 }}>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleLoadBag(bag)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            borderRadius: 10,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            color: "#0f172a",
                            padding: "10px 12px",
                            cursor: saving ? "wait" : "pointer"
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              fontFamily: "ui-monospace, Menlo, monospace"
                            }}
                          >
                            {bag.bag_code}
                          </div>
                          <div style={{ fontSize: 12, color: "#334155", marginTop: 2 }}>
                            {formatKg(bag.quantity_kg)}
                            {bag.source_name ? ` · ${bag.source_name} output` : ""}
                            {bag.order_code || lot?.order_code
                              ? ` · ${bag.order_code || lot.order_code}`
                              : ""}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
