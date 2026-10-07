import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import {
  createAcKilnFeedLot,
  fetchAcDashboard,
  fetchAcKilnFeedLots,
  fetchAcOpenLots,
  formatAcApiError,
  generateAcRoute
} from "../../../services/activatedCarbonApi";
import AcAlert from "./AcAlert";
import AcKilnCumulativeChart from "./AcKilnCumulativeChart";
import AcKilnOutputPanel from "./AcKilnOutputPanel";
import useAcMasters from "../hooks/useAcMasters";
import useBusyGuard from "../hooks/useBusyGuard";
import { isValidUuid } from "../utils/acProductUtils";
import {
  collectKilnFeedEvents,
  formatLoaderTime,
  KILN_LIVE_WINDOW_HOURS
} from "../utils/acKilnLoaderUtils";
import { isAcKilnFeedOutwardBag } from "../constants/processSteps";

function lotBagRows(lot) {
  const meta = lot?.metadata || lot?.metadata_ || {};
  const top = Array.isArray(lot?.crusher_outward_bags) ? lot.crusher_outward_bags : [];
  const nested = Array.isArray(meta.crusher_outward_bags) ? meta.crusher_outward_bags : [];
  return top.length ? top : nested;
}

function kilnFeedBags(lot) {
  return lotBagRows(lot).filter(isAcKilnFeedOutwardBag);
}

const LIVE_TICK_MS = 15_000;

function lotMeta(lot) {
  return lot?.metadata || lot?.metadata_ || {};
}

function lotCodeOf(lot) {
  return lot?.lot_code || lot?.lot_id || "";
}

function lotEventsFor(events, lotCode) {
  return (events || []).filter((ev) => ev.lotCode === lotCode);
}

function isLotFullyLoaded(lot, kilnEvents = []) {
  const meta = lotMeta(lot);
  const status = String(lot?.status || "").toUpperCase();
  const charged = Boolean(meta.charged_at || lot?.charged_at || meta.kiln_live_status === "IN_KILN");
  const code = lotCodeOf(lot);
  const events = lotEventsFor(kilnEvents, code);
  const bags = kilnFeedBags(lot);
  if (status === "CREATED" && !charged && events.length === 0) return false;
  const loadedKg =
    Number(lot?.kiln_loaded_kg ?? meta.kiln_loaded_kg) ||
    events.reduce((sum, ev) => sum + (Number(ev.kg) || 0), 0);
  const qty = Number(lot?.lot_quantity) || 0;
  if (bags.length) {
    const fed = new Set(events.map((ev) => ev.bagCode).filter(Boolean));
    return bags.every((bag) => !bag.bag_code || fed.has(bag.bag_code));
  }
  if (events.length > 0) return qty <= 0 || loadedKg >= qty - 0.001;
  return charged;
}

function kilnPlantLetter(kiln, index = 0) {
  const name = String(kiln?.resource_name || "");
  const code = String(kiln?.resource_code || "");
  const blob = `${name} ${code}`.toUpperCase();
  const named = blob.match(/\bK(?:ILN|LIN)?[-_\s]*([A-C])\b/);
  if (named) return named[1];
  const digits = code.toUpperCase().match(/(\d+)$/) || name.match(/(\d+)\s*$/);
  const n = Number(digits?.[1]);
  if (n >= 1 && n <= 26) return String.fromCharCode(64 + n);
  return String.fromCharCode(65 + index);
}

function kilnOptionLabel(kiln, index) {
  return `Kiln ${kilnPlantLetter(kiln, index)}`;
}

function formatKgRange(kg) {
  const n = Number(kg);
  if (!Number.isFinite(n) || n <= 0) return "0 - 0.00 kg";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} - ${n.toFixed(2)} kg`;
}

function lotDetailParts(lot) {
  const meta = lotMeta(lot);
  const bags = kilnFeedBags(lot);
  return {
    code: lotCodeOf(lot),
    inward: lot?.order_code || meta.source_inward_order_code || null,
    qty: Number(lot?.lot_quantity) || 0,
    grade: lot?.crusher_grade || meta.crusher_grade || null,
    bags
  };
}

function bagWeight(bag) {
  const n = Number(bag?.quantity_kg ?? bag?.weight_kg);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function remainingBagsFor(lot, kilnEvents = []) {
  const fed = new Set(lotEventsFor(kilnEvents, lotCodeOf(lot)).map((ev) => ev.bagCode).filter(Boolean));
  return kilnFeedBags(lot).filter((bag) => {
    const code = bag.bag_code || bag.bagCode;
    return code && !fed.has(code);
  });
}

function groupPendingByInward(pendingLots, kilnEvents = []) {
  const groups = new Map();
  for (const lot of pendingLots) {
    const detail = lotDetailParts(lot);
    const inward = detail.inward || detail.code;
    const bags = remainingBagsFor(lot, kilnEvents).map((bag) => ({ ...bag, lot }));
    const qty = bags.length
      ? bags.reduce((sum, bag) => sum + bagWeight(bag), 0)
      : detail.qty;
    const current = groups.get(inward) || { inward, qty: 0, bags: [] };
    current.qty += qty;
    current.bags.push(...bags);
    groups.set(inward, current);
  }
  return Array.from(groups.values()).filter((row) => row.qty > 0 || row.bags.length > 0);
}

/**
 * Kiln-centric live feed — Load lists unloaded lots; selecting one adds it to the 6h graph.
 */
export default function AcExecutionKilnFeedPanel({
  lot,
  lots = [],
  onCharged,
  onSelectLot,
  showChart = true
}) {
  const { masters, loading: mastersLoading, ready } = useAcMasters();
  const [kilnCode, setKilnCode] = useState("");
  const { busy: saving, run } = useBusyGuard();
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [localEvents, setLocalEvents] = useState([]);
  const [kilnStatus, setKilnStatus] = useState([]);
  const [kilnLots, setKilnLots] = useState([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [picking, setPicking] = useState(false);
  const [expandedInward, setExpandedInward] = useState("");
  const [selectedBagKey, setSelectedBagKey] = useState("");

  const kilns = [...(masters.kilns || [])].sort((a, b) =>
    kilnPlantLetter(a).localeCompare(kilnPlantLetter(b))
  );

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), LIVE_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!kilnCode && kilns[0]) setKilnCode(kilns[0].resource_code);
  }, [kilns, kilnCode]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchAcDashboard().catch(() => null),
      fetchAcKilnFeedLots().catch(() => []),
      fetchAcOpenLots().catch(() => [])
    ]).then(([dash, feedRows, openRows]) => {
      if (cancelled) return;
      setKilnStatus(dash?.kilns || []);
      const byCode = new Map();
      for (const row of [...(feedRows || []), ...(openRows || []), ...(lots || []), lot].filter(Boolean)) {
        const code = lotCodeOf(row);
        if (!code) continue;
        const prev = byCode.get(code);
        const merged = { ...prev, ...row };
        const prevBags = lotBagRows(prev);
        const nextBags = lotBagRows(merged);
        if (!nextBags.length && prevBags.length) {
          merged.crusher_outward_bags = prevBags;
        }
        byCode.set(code, merged);
      }
      setKilnLots(Array.from(byCode.values()));
    });
    return () => {
      cancelled = true;
    };
  }, [refreshTick, lots, lot]);

  const events = useMemo(
    () =>
      collectKilnFeedEvents({
        kilnCode,
        kilnStatus,
        lots: kilnLots,
        extra: localEvents
      }),
    [kilnCode, kilnStatus, kilnLots, localEvents]
  );

  const loadedLotDetails = useMemo(() => {
    const byLot = new Map();
    for (const ev of events) {
      if (!ev.lotCode) continue;
      const cur = byLot.get(ev.lotCode) || { lotCode: ev.lotCode, kg: 0, events: [] };
      cur.kg += Number(ev.kg) || 0;
      cur.events.push(ev);
      byLot.set(ev.lotCode, cur);
    }
    return Array.from(byLot.values()).map((row) => {
      const lotRow = kilnLots.find((l) => lotCodeOf(l) === row.lotCode);
      const detail = lotRow ? lotDetailParts(lotRow) : { code: row.lotCode, qty: row.kg };
      const first = row.events[0];
      const last = row.events[row.events.length - 1];
      return {
        ...row,
        inward: detail.inward,
        grade: detail.grade,
        qty: detail.qty,
        firstAt: first?.loadedAt,
        lastAt: last?.loadedAt,
        bags: row.events.map((ev) => ev.bagCode).filter(Boolean)
      };
    });
  }, [events, kilnLots]);

  const pendingLots = useMemo(
    () =>
      kilnLots.filter((row) => {
        const status = String(row.status || "").toUpperCase();
        if (["COMPLETED", "STOCKED", "DISPATCHED", "CLOSED", "CANCELLED"].includes(status)) {
          return false;
        }
        if (!kilnFeedBags(row).length && status === "CREATED") {
          return lotBagRows(row).length === 0;
        }
        return !isLotFullyLoaded(row, events);
      }),
    [kilnLots, events]
  );

  const cumulativeKg = events.reduce((sum, ev) => sum + (Number(ev.kg) || 0), 0);
  const selectedIndex = Math.max(
    0,
    kilns.findIndex((k) => k.resource_code === kilnCode)
  );
  const kilnTitle = `${kilnOptionLabel(kilns[selectedIndex] || { resource_name: "Kiln A" }, selectedIndex)} — Loader`;
  const pendingInwards = useMemo(
    () => groupPendingByInward(pendingLots, events),
    [pendingLots, events]
  );

  const handleLoadBag = (picked, bag) => {
    const code = lotCodeOf(picked);
    const lotId = picked.production_lot_id || picked.lot_id;
    const bagCode = bag?.bag_code || bag?.bagCode;
    if (!code || !kilnCode || !bagCode) return;
    return run(async () => {
    setError("");
    try {
      const payload = {
        kiln_resource_code: kilnCode,
        status: "IN_PROGRESS",
        bag_code: bagCode
      };
      if (isValidUuid(lotId)) payload.production_lot_id = lotId;
      else payload.lot_code = code;
      const bagKg = bagWeight(bag);
      if (bagKg > 0) payload.quantity_kg = bagKg;
      const firstFeed = !events.some((ev) => (ev.lot_code || "") === code);
      const charged = await createAcKilnFeedLot(payload);
      const chargedEvents = charged?.kiln_feed_events || charged?.metadata?.kiln_feed_events || [];
      const latest = chargedEvents[chargedEvents.length - 1];
      const fallbackEvent = {
        lot_code: code,
        order_code: picked.order_code || lotMeta(picked).source_inward_order_code || null,
        bag_code: bagCode,
        kg: Number(latest?.kg ?? bagKg ?? picked.lot_quantity ?? 0),
        loaded_at: latest?.loaded_at || charged?.charged_at || new Date().toISOString(),
        kiln_resource_code: kilnCode
      };
      setLocalEvents((prev) => [...prev, latest || fallbackEvent]);
      setKilnLots((prev) => {
        const next = { ...picked, ...charged, lot_code: code, lot_id: code };
        const without = (prev || []).filter((row) => lotCodeOf(row) !== code);
        return [...without, next];
      });
      setSelectedBagKey("");
      if (firstFeed) {
        generateAcRoute(code).catch(() => null);
      }
      if (lotCodeOf(lot) !== code) {
        onSelectLot?.(code);
      }
      onCharged?.({
        ...picked,
        ...charged,
        lot_id: code,
        lot_code: code,
        status: charged?.status || "IN_PROGRESS",
        charged_at: charged?.charged_at || charged?.metadata?.charged_at,
        kiln_resource_code: kilnCode,
        kiln_feed_events: chargedEvents,
        metadata: {
          ...lotMeta(picked),
          ...(charged?.metadata || {}),
          kiln_resource_code: kilnCode,
          kiln_live_status: "IN_KILN",
          kiln_feed_events: chargedEvents
        }
      });
    } catch (e) {
      setError(formatAcApiError(e, "Kiln load failed"));
    }
    });
  };

  return (
    <section className="wf-light-panel rounded-xl border border-slate-200 bg-white p-4 space-y-4" style={{ color: "#0f172a", background: "#ffffff" }}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium" htmlFor="ac-kiln-load-select" style={{ color: "#0f172a" }}>
          Kiln Load / Unload
        </label>
        <select
          id="ac-kiln-load-select"
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm min-w-[8rem]"
          style={{ color: "#0f172a", background: "#fff" }}
            value={kilnCode}
          disabled={mastersLoading || saving}
          onChange={(e) => {
            setKilnCode(e.target.value);
            setPicking(false);
          }}
        >
          {kilns.map((k, index) => (
            <option key={k.resource_id || k.resource_code} value={k.resource_code}>
              {kilnOptionLabel(k, index)}
              </option>
            ))}
        </select>
        {ready && kilns.length === 0 ? (
          <p className="text-xs" style={{ color: "#b45309" }}>
            No kilns.{" "}
            <Link to="/activated-carbon/masters?tab=plant-resources" className="underline">
              Add in Masters
            </Link>
          </p>
        ) : null}
      </div>

      {error && <AcAlert variant="error">{error}</AcAlert>}

      <article className="rounded-lg border border-slate-200 bg-white" style={{ color: "#0f172a" }}>
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
          <div>
            <h3 className="text-base font-semibold" style={{ color: "#0f172a" }}>
              {kilnTitle}
            </h3>
            <p className="text-sm tabular-nums mt-1" style={{ color: "#475569" }}>
              {formatKgRange(cumulativeKg)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPicking(true)}
            disabled={saving || !kilnCode}
            className="shrink-0 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
          >
            {saving ? "Loading…" : "Load bags"}
          </button>
        </div>

        {showChart ? (
          <div className="px-4 pb-3">
            <AcKilnCumulativeChart events={events} nowMs={nowMs} windowHours={KILN_LIVE_WINDOW_HOURS} />
          </div>
        ) : null}

        <AcKilnOutputPanel
          kilnCode={kilnCode}
          kilnTitle={kilnOptionLabel(kilns[selectedIndex] || { resource_name: "Kiln A" }, selectedIndex)}
          lotCode={loadedLotDetails[loadedLotDetails.length - 1]?.lotCode || lotCodeOf(lot) || null}
        />
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
                  boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
                  border: "1px solid #e2e8f0"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Load bag</div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                      Expand an inward, then double-click one bag to load on {kilnTitle.replace(" — Loader", "")}.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPicking(false);
                      setExpandedInward("");
                      setSelectedBagKey("");
                    }}
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
                {pendingInwards.length === 0 ? (
                  <div style={{ fontSize: 14, color: "#475569" }}>All open inward bags are already in a kiln.</div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 360, overflowY: "auto" }}>
                    {pendingInwards.map((group) => {
                      const open = expandedInward === group.inward;
                      return (
                        <li key={group.inward} style={{ marginBottom: 8 }}>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              setExpandedInward((prev) => (prev === group.inward ? "" : group.inward))
                            }
                            style={{
                              width: "100%",
                              textAlign: "left",
                              borderRadius: 10,
                              border: "1px solid #cbd5e1",
                              background: open ? "#f8fafc" : "#ffffff",
                              color: "#0f172a",
                              padding: "10px 12px",
                              cursor: saving ? "wait" : "pointer"
                            }}
                          >
                            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "ui-monospace, Menlo, monospace" }}>
                              {group.inward}
                            </div>
                            <div style={{ fontSize: 12, color: "#334155", marginTop: 2 }}>
                              {group.qty ? `${group.qty} KG` : "—"}
                              {group.bags.length ? ` · ${group.bags.length} bag${group.bags.length === 1 ? "" : "s"}` : ""}
                            </div>
                          </button>
                          {open ? (
                            <ul style={{ listStyle: "none", padding: "8px 0 0 0", margin: 0 }}>
                              {group.bags.length ? (
                                group.bags.map((bag) => {
                                  const bagCode = bag.bag_code || bag.bagCode;
                                  const key = `${group.inward}::${bagCode}`;
                                  const selected = selectedBagKey === key;
                                  return (
                                    <li key={key} style={{ marginBottom: 6 }}>
        <button
          type="button"
                                        disabled={saving}
                                        onClick={() => setSelectedBagKey(key)}
                                        onDoubleClick={() => handleLoadBag(bag.lot, bag)}
                                        style={{
                                          width: "100%",
                                          textAlign: "left",
                                          borderRadius: 8,
                                          border: selected ? "1px solid #2563eb" : "1px solid #e2e8f0",
                                          background: selected ? "#eff6ff" : "#ffffff",
                                          color: "#0f172a",
                                          padding: "8px 10px",
                                          cursor: saving ? "wait" : "pointer",
                                          fontFamily: "ui-monospace, Menlo, monospace",
                                          fontSize: 12
                                        }}
                                      >
                                        {bagCode}
                                        {bag.rotary ? ` · ${bag.rotary}` : ""}
                                        {bag.grade_label || bag.grade ? ` · ${bag.grade_label || bag.grade}` : ""}
                                        {bagWeight(bag) ? ` · ${bagWeight(bag)} KG` : ""}
                                        <span style={{ display: "block", color: "#64748b", fontSize: 11, marginTop: 2 }}>
                                          Double-click to load
                                        </span>
        </button>
                                    </li>
                                  );
                                })
                              ) : (
                                <li style={{ fontSize: 12, color: "#64748b", padding: "6px 10px" }}>
                                  No rotary bags left on this inward.
                                </li>
                              )}
                            </ul>
                          ) : null}
                        </li>
                      );
                    })}
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
