/** Masters monthly capacity is the designed output at this residence. */
export const KILN_REFERENCE_RESIDENCE_MIN = 60;

const DEFAULT_RESIDENCE_MIN = KILN_REFERENCE_RESIDENCE_MIN;

export function kilnDesignedMonthlyKg(monthlyCapacityKg, residenceMin, fallback = 15000) {
  const base = Number(monthlyCapacityKg);
  const capacity = Number.isFinite(base) && base > 0 ? base : fallback;
  const residence = Number(residenceMin);
  if (!Number.isFinite(residence) || residence <= 0) return capacity;
  return Math.max(1, Math.round((capacity * KILN_REFERENCE_RESIDENCE_MIN) / residence));
}

function parseTime(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function shortInward(code) {
  if (!code || code === "—") return "—";
  const s = String(code);
  return s.length > 14 ? `${s.slice(0, 12)}…` : s;
}

/**
 * Build kiln loader rows for dashboard cards — inward lot, load time, hours pending.
 */
export function buildAcKilnLoaderRows({
  kilns = [],
  kilnLots = [],
  lotLines = [],
  residenceMin = DEFAULT_RESIDENCE_MIN
} = {}) {
  return kilns.map((kiln) => {
    const activeCode = kiln.active_lot_code;
    const lot =
      kilnLots.find((row) => row.lot_code === activeCode) ||
      kilnLots.find((row) => {
        const meta = row.metadata || row.metadata_ || {};
        const assigned = meta.kiln_resource_code || row.kiln_resource_code || row.resource_code;
        return (
          assigned === kiln.resource_code &&
          String(row.status || "").toUpperCase() === "IN_PROGRESS"
        );
      });

    const lotMeta = lot?.metadata || lot?.metadata_ || {};
    const lotLine = lotLines.find((row) => row.lot_code === (activeCode || lot?.lot_code));
    const inwardCode =
      lotLine?.order_code ||
      lot?.inward_order_code ||
      lot?.order_code ||
      lot?.customer_order_code ||
      null;

    const loadedAt =
      parseTime(lotMeta.charged_at) ||
      parseTime(lot?.charged_at) ||
      parseTime(lot?.started_at) ||
      parseTime(lot?.created_at) ||
      parseTime(kiln.last_reading_at);

    const residenceMinutes =
      Number(kiln?.residence_time_min) || Number(lot?.residence_time_min) || residenceMin;
    const totalHours = residenceMinutes / 60;
    const elapsedHours = loadedAt ? (Date.now() - loadedAt.getTime()) / 3_600_000 : 0;
    const lastReadingAt = parseTime(kiln.last_reading_at);
    const progress = totalHours > 0 ? Math.min(1, Math.max(0, elapsedHours / totalHours)) : 0;
    const pendingHours = Math.max(0, totalHours - elapsedHours);
    const feedEvents = parseKilnFeedEvents([
      ...(kiln.feed_events || []),
      ...((lotMeta.kiln_feed_events || lot?.kiln_feed_events || []))
    ]).filter((ev) => !ev.kilnCode || ev.kilnCode === kiln.resource_code);
    const kg = Number(
      kiln.loaded_kg ??
        kiln.active_lot_kg ??
        (feedEvents.length ? feedEvents.reduce((sum, ev) => sum + ev.kg, 0) : lot?.lot_quantity) ??
        0
    );
    const lotInProgress = String(lot?.status || "").toUpperCase() === "IN_PROGRESS";
    const kilnStatus =
      lotInProgress && (kiln.status || "IDLE").toUpperCase() === "IDLE"
        ? "RUNNING"
        : (kiln.status || "IDLE").toUpperCase();
    const hasLoad = Boolean(activeCode || lot?.lot_code) || (kg > 0 && kilnStatus === "RUNNING") || lotInProgress;

    return {
      resourceCode: kiln.resource_code,
      resourceName: kiln.resource_name || kiln.resource_code,
      status: kilnStatus,
      inwardCode: shortInward(inwardCode),
      inwardFull: inwardCode,
      lotCode: activeCode || lot?.lot_code || null,
      kg: Number.isFinite(kg) ? kg : 0,
      feedEvents,
      loadedAt,
      lastReadingAt,
      elapsedHours,
      totalHours,
      pendingHours,
      progress,
      isActive: hasLoad && kilnStatus !== "IDLE",
      cycleStatus: resolveCycleStatus({
        kilnStatus,
        pendingHours,
        progress,
        hasLoad
      })
    };
  });
}

function resolveCycleStatus({ kilnStatus, pendingHours, progress, hasLoad }) {
  if (!hasLoad) {
    return { text: "—", tone: "neutral" };
  }
  if (kilnStatus === "COOLING") {
    return { text: "Cooling down", tone: "warn" };
  }
  if (kilnStatus === "RUNNING") {
    if (pendingHours > 0) {
      return {
        text: pendingHours < 1 ? `${Math.ceil(pendingHours * 60)} min left` : `${pendingHours.toFixed(1)} h left`,
        tone: "active"
      };
    }
    if (progress >= 1) {
      return { text: "Past cycle target — still in kiln", tone: "warn" };
    }
    return { text: "Activating", tone: "active" };
  }
  return { text: "Loaded — awaiting start", tone: "neutral" };
}

/** Kiln output has covered the work order quantity, so it leaves the kiln dropdown. */
export function kilnOutputDone(row) {
  if (String(row?.status || "").toUpperCase() === "FULFILLED") return true;
  const qty = Number(row?.quantity_kg || 0);
  const output = Number(row?.output_kg || 0);
  return qty > 0 && output >= qty - 0.001;
}

/** Bag codes already charged to a kiln. They are not offered for another load. */
export function loadedKilnBagCodes(lots = [], extraEvents = []) {
  const codes = new Set();
  const take = (row) => {
    const code = String(row?.bag_code || row?.bagCode || "").trim();
    if (code) codes.add(code);
  };
  for (const lot of lots || []) {
    const meta = lot?.metadata || lot?.metadata_ || {};
    const events = [
      ...(Array.isArray(lot?.kiln_feed_events) ? lot.kiln_feed_events : []),
      ...(Array.isArray(meta.kiln_feed_events) ? meta.kiln_feed_events : [])
    ];
    events.forEach(take);
  }
  (extraEvents || []).forEach(take);
  return codes;
}

export function parseKilnFeedEvents(raw = []) {
  const seen = new Set();
  const events = [];
  for (const row of raw || []) {
    if (!row || typeof row !== "object") continue;
    const loadedAt = parseTime(row.loaded_at || row.loadedAt);
    const kg = Number(row.kg ?? row.quantity_kg ?? 0);
    const lotCode = row.lot_code || row.lotCode || null;
    const key = `${lotCode || ""}|${row.bag_code || row.bagCode || ""}|${loadedAt?.toISOString() || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({
      lotCode,
      inwardCode:
        row.order_code ||
        row.inward_order_code ||
        row.inwardCode ||
        row.source_inward_order_code ||
        null,
      bagCode: row.bag_code || row.bagCode || null,
      kg: Number.isFinite(kg) ? kg : 0,
      loadedAt,
      kilnCode: row.kiln_resource_code || row.kilnCode || null
    });
  }
  return events
    .filter((ev) => ev.loadedAt && ev.kg >= 0)
    .sort((a, b) => a.loadedAt.getTime() - b.loadedAt.getTime());
}

function inferredLotFeedEvent(lot) {
  const meta = lot?.metadata || lot?.metadata_ || {};
  const loadedAt = meta.charged_at || lot?.charged_at;
  const assigned = meta.kiln_resource_code || lot?.kiln_resource_code;
  const live = String(meta.kiln_live_status || "").toUpperCase();
  const inKiln = live === "IN_KILN" || String(lot?.status || "").toUpperCase() === "IN_PROGRESS";
  if (!loadedAt && !inKiln) return null;
  const kg = Number(lot?.kiln_loaded_kg ?? meta.kiln_loaded_kg ?? lot?.lot_quantity ?? 0);
  return {
    lot_code: lot.lot_code || lot.lot_id,
    order_code: lot.order_code || meta.source_inward_order_code || null,
    bag_code: lot.crusher_bag_code || meta.crusher_bag_code || null,
    kg: Number.isFinite(kg) && kg > 0 ? kg : 0,
    loaded_at: loadedAt || lot?.updated_at || lot?.created_at || new Date().toISOString(),
    kiln_resource_code: assigned || null
  };
}

export function collectKilnFeedEvents({ kilnCode, kilnStatus = [], lots = [], extra = [] } = {}) {
  const statusRow = (kilnStatus || []).find((row) => row.resource_code === kilnCode);
  const fromLots = (lots || []).flatMap((lot) => {
    const meta = lot.metadata || lot.metadata_ || {};
    const assigned = meta.kiln_resource_code || lot.kiln_resource_code;
    let events = meta.kiln_feed_events || lot.kiln_feed_events || [];
    if (!Array.isArray(events) || events.length === 0) {
      const inferred = inferredLotFeedEvent(lot);
      events = inferred ? [inferred] : [];
    }
    if (assigned && kilnCode && assigned !== kilnCode && !events.length) return [];
    return events.filter((ev) => {
      const code = ev.kiln_resource_code || ev.kilnCode || assigned;
      return !kilnCode || !code || code === kilnCode;
    });
  });
  return parseKilnFeedEvents([...(statusRow?.feed_events || []), ...fromLots, ...extra]);
}

export const KILN_LIVE_WINDOW_HOURS = 6;

/** Step series + stems for the last `windowHours` (default 6h). Earlier loads stay in the baseline kg. */
export function buildCumulativeKilnSeries(
  events,
  nowMs = Date.now(),
  windowHours = KILN_LIVE_WINDOW_HOURS
) {
  const evs = parseKilnFeedEvents(events);
  const spanH = Math.max(windowHours || KILN_LIVE_WINDOW_HOURS, 1);
  const tEnd = nowMs;
  const tStart = nowMs - spanH * 3_600_000;
  const totalKg = evs.reduce((sum, ev) => sum + (Number(ev.kg) || 0), 0);

  if (!evs.length) {
    return {
      series: [
        { hour: 0, kg: 0 },
        { hour: spanH, kg: 0 }
      ],
      stems: [],
      cumulativeKg: 0,
      spanH,
      windowStartMs: tStart
    };
  }

  let cum = 0;
  const series = [{ hour: 0, kg: 0 }];
  const stems = [];
  for (const ev of evs) {
    const hour = Number(Math.max(0, Math.min(spanH, (ev.loadedAt.getTime() - tStart) / 3_600_000)).toFixed(4));
    series.push({ hour, kg: cum });
    cum += ev.kg;
    const clock = formatLoaderTime(ev.loadedAt);
    series.push({
      hour,
      kg: cum,
      lotCode: ev.lotCode,
      inwardCode: ev.inwardCode,
      bagCode: ev.bagCode,
      clock
    });
    stems.push({
      hour,
      kg: cum,
      incrementKg: ev.kg,
      lotCode: ev.lotCode,
      inwardCode: ev.inwardCode,
      bagCode: ev.bagCode,
      clock,
      loadedAt: ev.loadedAt
    });
  }
  series.push({ hour: spanH, kg: cum });
  return { series, stems, cumulativeKg: totalKg, spanH, windowStartMs: tStart };
}

export function formatLoaderTime(date) {
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** Line chart points — kg in kiln vs hours since load (updates with live tick). */
export function buildKilnLoadChartSeries(row, nowMs = Date.now()) {
  if (row.feedEvents?.length) {
    return buildCumulativeKilnSeries(row.feedEvents, nowMs, KILN_LIVE_WINDOW_HOURS).series;
  }
  const totalH = Math.max(row.totalHours || 1, 0.5);
  const kg = Number(row.kg) || 0;

  if (!row.isActive || !row.loadedAt) {
    return [
      { hour: 0, kg: 0 },
      { hour: totalH, kg: 0 }
    ];
  }

  const elapsedH = Math.max(0, (nowMs - row.loadedAt.getTime()) / 3_600_000);
  const spanH = Math.max(totalH, elapsedH);
  const steps = Math.min(20, Math.max(4, Math.ceil(elapsedH * 8) || 4));
  const points = [];

  for (let i = 0; i <= steps; i++) {
    const h = steps > 0 ? (elapsedH / steps) * i : 0;
    points.push({ hour: Number(h.toFixed(2)), kg });
  }

  if (elapsedH < totalH) {
    points.push({ hour: Number(totalH.toFixed(2)), kg });
  } else if (points[points.length - 1]?.hour < spanH) {
    points.push({ hour: Number(spanH.toFixed(2)), kg });
  }

  if (points.length <= 2) return points;

  const first = points[0];
  const last = points[points.length - 1];
  const midIdx = Math.floor(points.length / 2);
  const mid = points[midIdx];
  if (mid.hour === first.hour || mid.hour === last.hour) {
    return [first, last];
  }
  return [first, mid, last];
}

/** Lots released but not yet charged — shown on an idle kiln card. */
export function pendingKilnChargeLots(lotLines = []) {
  return (lotLines || [])
    .filter((row) => {
      const status = String(row.status || "").toUpperCase();
      return status && !["IN_PROGRESS", "COMPLETED", "STOCKED", "DISPATCHED", "CLOSED", "CANCELLED"].includes(status);
    })
    .map((row) => ({
      lotCode: row.lot_code,
      inwardCode: row.order_code || null,
      kg: Number(row.lot_quantity) || 0,
      feasibilityOk: true
    }));
}

export function formatPendingHours(hours, kilnStatus = "RUNNING") {
  if (!Number.isFinite(hours) || hours <= 0) {
    if ((kilnStatus || "").toUpperCase() === "RUNNING") {
      return "Past cycle target";
    }
    return "Cycle complete";
  }
  if (hours < 1) return `${Math.ceil(hours * 60)} min left`;
  return `${hours.toFixed(1)} h left`;
}
