import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import {
  createAcKilnFeedLot,
  fetchAcDashboard,
  fetchAcKilnFeedLots,
  fetchAcOpenLots,
  fetchAcWorkOrders,
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
  filterKilnFeedDayRows,
  KILN_LIVE_WINDOW_HOURS,
  loadedKilnBagCodes,
  parseKilnFeedEvents,
  plantDayKey
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
  const bags = kilnFeedBags(lot).length ? kilnFeedBags(lot) : lotBagRows(lot).filter(isAcKilnFeedOutwardBag);
  return bags.filter((bag) => {
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
  const [workOrders, setWorkOrders] = useState([]);
  const [workOrderCode, setWorkOrderCode] = useState("");
  const [kilnBalance, setKilnBalance] = useState({ loadedKg: 0, outputKg: 0, remainingKg: 0 });
  const [serverFeed, setServerFeed] = useState([]);
  const [feedCtc, setFeedCtc] = useState("");
  const [feedFrom, setFeedFrom] = useState(() => plantDayKey(new Date()));
  const [feedTo, setFeedTo] = useState(() => plantDayKey(new Date()));

  const kilns = [...(masters.kilns || [])].sort((a, b) =>
    kilnPlantLetter(a).localeCompare(kilnPlantLetter(b))
  );

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), LIVE_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchAcDashboard().catch(() => null),
      fetchAcKilnFeedLots().catch(() => []),
      fetchAcOpenLots().catch(() => []),
      fetchAcWorkOrders()
    ]).then(([dash, feedRows, openRows, woData]) => {
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
      setWorkOrders(woData?.work_orders || []);
    }).catch((e) => {
      if (!cancelled) setError(formatAcApiError(e, "Could not load kiln feed"));
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

  const selectedWorkOrder = useMemo(
    () => workOrders.find((row) => row.work_order_code === workOrderCode) || null,
    [workOrders, workOrderCode]
  );

  useEffect(() => {
    if (workOrderCode && !selectedWorkOrder) setWorkOrderCode("");
  }, [workOrderCode, selectedWorkOrder]);

  useEffect(() => {
    if (!selectedWorkOrder) return;
    if (!kilnCode && kilns[0]?.resource_code) {
      setKilnCode(kilns[0].resource_code);
    }
  }, [selectedWorkOrder, kilns, kilnCode]);

  useEffect(() => {
    setKilnBalance({ loadedKg: 0, outputKg: 0, remainingKg: 0 });
    setServerFeed([]);
  }, [kilnCode]);

  const pendingLots = useMemo(
    () =>
      kilnLots.filter((row) => {
        const status = String(row.status || "").toUpperCase();
        if (["COMPLETED", "STOCKED", "DISPATCHED", "CLOSED", "CANCELLED"].includes(status)) {
          return false;
        }
        if (remainingBagsFor(row, events).length) return true;
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
  const pendingInwards = useMemo(() => {
    if (!selectedWorkOrder) return [];
    return groupPendingByInward(pendingLots, events);
  }, [pendingLots, events, selectedWorkOrder]);
  const loadedBagCodes = useMemo(
    () => loadedKilnBagCodes(kilnLots, [...serverFeed, ...localEvents, ...events]),
    [kilnLots, serverFeed, localEvents, events]
  );
  const pendingBags = useMemo(
    () =>
      pendingInwards
        .flatMap((group) =>
          group.bags.map((bag) => ({
            ...bag,
            inward: group.inward,
            bagCode: bag.bag_code || bag.bagCode
          }))
        )
        .filter((bag) => bag.bagCode && !loadedBagCodes.has(String(bag.bagCode))),
    [pendingInwards, loadedBagCodes]
  );
  const loadedBags = useMemo(
    () => parseKilnFeedEvents([...serverFeed, ...events]).filter((ev) => ev.bagCode),
    [serverFeed, events]
  );
  const ctcByWorkOrder = useMemo(() => {
    const map = {};
    for (const row of workOrders) {
      if (row?.work_order_code && row.ctc != null && String(row.ctc).trim()) {
        map[row.work_order_code] = String(row.ctc).trim();
      }
    }
    return map;
  }, [workOrders]);
  const ctcOptions = useMemo(() => {
    const values = new Set(Object.values(ctcByWorkOrder));
    return Array.from(values).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  }, [ctcByWorkOrder]);
  const dayFeedRows = useMemo(() => {
    const raw = [];
    for (const kiln of kilnStatus || []) {
      for (const ev of kiln.feed_events || []) {
        raw.push({ ...ev, kiln_resource_code: ev.kiln_resource_code || kiln.resource_code });
      }
    }
    for (const row of kilnLots || []) {
      const meta = lotMeta(row);
      const stored = meta.kiln_feed_events || row.kiln_feed_events || [];
      if (Array.isArray(stored)) raw.push(...stored);
    }
    raw.push(...localEvents);
    const parsed = parseKilnFeedEvents(raw).filter((ev) => !kilnCode || !ev.kilnCode || ev.kilnCode === kilnCode);
    return filterKilnFeedDayRows(parsed, {
      ctc: feedCtc,
      from: feedFrom,
      to: feedTo,
      ctcByWorkOrder
    }).slice().reverse();
  }, [kilnStatus, kilnLots, localEvents, kilnCode, feedCtc, feedFrom, feedTo, ctcByWorkOrder]);

  const handleLoadBag = (picked, bag) => {
    const code = lotCodeOf(picked);
    const lotId = picked.production_lot_id || picked.lot_id;
    const bagCode = bag?.bag_code || bag?.bagCode;
    if (!code || !kilnCode || !bagCode || !workOrderCode) return;
    return run(async () => {
    setError("");
    try {
      const payload = {
        kiln_resource_code: kilnCode,
        status: "IN_PROGRESS",
        bag_code: bagCode,
        work_order_code: workOrderCode
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
      setRefreshTick((n) => n + 1);
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
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium" htmlFor="ac-wo-select" style={{ color: "#0f172a" }}>
          Work order number
          <select
            id="ac-wo-select"
            className="mt-1 block rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm min-w-[16rem]"
            style={{ color: "#0f172a", background: "#fff" }}
            value={workOrderCode}
            disabled={saving}
            onChange={(e) => {
              setWorkOrderCode(e.target.value);
              setPicking(false);
            }}
          >
            <option value="">Select work order</option>
            {workOrders.map((row) => (
              <option key={row.work_order_code} value={row.work_order_code}>
                {row.work_order_code} · {row.grade} · CTC {row.ctc} · {Number(row.quantity_kg || 0)} kg
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium" htmlFor="ac-kiln-load-select" style={{ color: "#0f172a" }}>
          Kiln
          <select
            id="ac-kiln-load-select"
            className="mt-1 block rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm min-w-[8rem]"
            style={{ color: "#0f172a", background: "#fff" }}
            value={kilnCode}
            disabled={saving || !selectedWorkOrder}
            onChange={(e) => {
              setKilnCode(e.target.value);
              setPicking(false);
            }}
          >
            <option value="">Select kiln</option>
            {kilns.map((k, index) => (
              <option key={k.resource_id || k.resource_code} value={k.resource_code}>
                {kilnOptionLabel(k, index)}
              </option>
            ))}
          </select>
        </label>
        {workOrders.length === 0 ? (
          <p className="text-xs" style={{ color: "#b45309" }}>
            No work orders.{" "}
            <Link to="/activated-carbon/admin?tab=work-orders" className="underline">
              Create in Admin
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
              {kilnBalance.loadedKg > 0 || kilnBalance.outputKg > 0
                ? `In ${kilnBalance.loadedKg.toFixed(2)} kg · Out ${kilnBalance.outputKg.toFixed(2)} kg · Still in kiln ${kilnBalance.remainingKg.toFixed(2)} kg`
                : formatKgRange(cumulativeKg)}
              {pendingInwards.some((row) => row.bags.length)
                ? ` · ${pendingInwards.reduce((sum, row) => sum + row.bags.length, 0)} bags ready to load`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPicking(true)}
            disabled={saving || !kilnCode || !workOrderCode}
            className="shrink-0 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
          >
            {saving ? "Loading…" : "Load bag"}
          </button>
        </div>

        {loadedBags.length > 0 ? (
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {loadedBags.map((ev) => (
              <span
                key={`${ev.bagCode}-${ev.loadedAt || ""}-${ev.kg}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs"
              >
                <span className="font-mono">{ev.bagCode}</span>
                <span style={{ color: "#475569" }}>
                  {Number(ev.kg) > 0 ? `${Number(ev.kg).toFixed(2)} kg` : ""}
                </span>
              </span>
            ))}
          </div>
        ) : null}

        {showChart ? (
          <div className="px-4 pb-3">
            <AcKilnCumulativeChart events={events} nowMs={nowMs} windowHours={KILN_LIVE_WINDOW_HOURS} />
          </div>
        ) : null}

        <AcKilnOutputPanel
          kilnCode={kilnCode}
          kilnTitle={kilnOptionLabel(kilns[selectedIndex] || { resource_name: "Kiln A" }, selectedIndex)}
          lotCode={loadedLotDetails[loadedLotDetails.length - 1]?.lotCode || lotCodeOf(lot) || null}
          refreshToken={refreshTick}
          liveTick={nowMs}
          onBalance={setKilnBalance}
          onFeed={setServerFeed}
        />
      </article>

      <article className="rounded-lg border border-slate-200 bg-white px-4 py-3" style={{ color: "#0f172a" }}>
        <h3 className="text-base font-semibold">Kiln feed for the day</h3>
        <p className="text-xs mt-1 mb-3" style={{ color: "#475569" }}>
          Bags loaded{kilnCode ? ` on ${kilnTitle.replace(" — Loader", "")}` : ""}. Choose CTC and the dates to see that period.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <label className="text-sm">
            <span className="block mb-1 font-medium">CTC</span>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 bg-white"
              value={feedCtc}
              onChange={(e) => setFeedCtc(e.target.value)}
            >
              <option value="">All CTC</option>
              {ctcOptions.map((ctc) => (
                <option key={ctc} value={ctc}>
                  {ctc}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium">From</span>
            <input
              type="date"
              className="w-full rounded border border-slate-300 px-3 py-2 bg-white"
              value={feedFrom}
              onChange={(e) => {
                setFeedFrom(e.target.value);
                e.target.blur();
              }}
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium">To</span>
            <input
              type="date"
              className="w-full rounded border border-slate-300 px-3 py-2 bg-white"
              value={feedTo}
              onChange={(e) => {
                setFeedTo(e.target.value);
                e.target.blur();
              }}
            />
          </label>
        </div>
        {dayFeedRows.length === 0 ? (
          <p className="text-sm text-slate-500">No kiln feed in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 pr-2 font-medium">Loaded</th>
                  <th className="py-1 pr-2 font-medium">Bag</th>
                  <th className="py-1 pr-2 font-medium">Work order</th>
                  <th className="py-1 pr-2 font-medium">CTC</th>
                  <th className="py-1 pr-2 font-medium">Kiln</th>
                  <th className="py-1 font-medium">Weight (kg)</th>
                </tr>
              </thead>
              <tbody>
                {dayFeedRows.map((ev) => {
                  const kilnIndex = kilns.findIndex((k) => k.resource_code === ev.kilnCode);
                  const kilnLabel = kilnIndex >= 0 ? kilnOptionLabel(kilns[kilnIndex], kilnIndex) : ev.kilnCode || "—";
                  return (
                    <tr key={`${ev.bagCode}-${ev.loadedAt?.toISOString() || ""}-${ev.kg}`} className="border-t border-slate-100">
                      <td className="py-1.5 pr-2">{ev.loadedAt ? ev.loadedAt.toLocaleString() : "—"}</td>
                      <td className="py-1.5 pr-2 font-mono">{ev.bagCode || "—"}</td>
                      <td className="py-1.5 pr-2 font-mono">{ev.workOrderCode || "—"}</td>
                      <td className="py-1.5 pr-2">{ctcByWorkOrder[ev.workOrderCode] || "—"}</td>
                      <td className="py-1.5 pr-2">{kilnLabel}</td>
                      <td className="py-1.5 tabular-nums">{Number(ev.kg || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
                      {selectedWorkOrder
                        ? `Work order ${selectedWorkOrder.work_order_code}. Bags that can be loaded on this kiln.`
                        : "Select a work order number first."}
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
                {loadedBags.length > 0 ? (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>On this kiln</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {loadedBags.map((ev) => (
                        <span
                          key={`${ev.bagCode}-${ev.loadedAt || ""}-${ev.kg}`}
                          style={{
                            border: "1px solid #cbd5e1",
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 12,
                            fontFamily: "ui-monospace, Menlo, monospace"
                          }}
                        >
                          {ev.bagCode}
                          {Number(ev.kg) > 0 ? ` · ${Number(ev.kg).toFixed(2)} kg` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {pendingBags.length === 0 ? (
                  <div style={{ fontSize: 14, color: "#475569" }}>
                    {!workOrderCode
                      ? "Select a work order number first. Create one in Admin with grade, CTC, and quantity."
                      : "No released RO bags are left to load. After Release to production, they appear here. Unburnt and Stones stay off the kiln."}
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 360, overflowY: "auto" }}>
                    {pendingBags.map((bag) => (
                      <li key={`${bag.inward}::${bag.bagCode}`} style={{ marginBottom: 8 }}>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleLoadBag(bag.lot, bag)}
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
                          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "ui-monospace, Menlo, monospace" }}>
                            {bag.bagCode}
                          </div>
                          <div style={{ fontSize: 12, color: "#334155", marginTop: 2 }}>
                            {bagWeight(bag) ? `${bagWeight(bag)} kg` : ""}
                            {bag.inward ? ` · ${bag.inward}` : ""}
                            {bag.rotary ? ` · ${bag.rotary}` : ""}
                            {bag.grade_label || bag.grade ? ` · ${bag.grade_label || bag.grade}` : ""}
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
