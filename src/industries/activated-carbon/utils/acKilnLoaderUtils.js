const DEFAULT_RESIDENCE_MIN = 60;

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
      kilnLots.find(
        (row) =>
          (row.kiln_resource_code === kiln.resource_code ||
            row.resource_code === kiln.resource_code) &&
          String(row.status || "").toUpperCase() === "IN_PROGRESS"
      );

    const lotLine = lotLines.find((row) => row.lot_code === activeCode);
    const inwardCode =
      lotLine?.order_code ||
      lot?.inward_order_code ||
      lot?.order_code ||
      lot?.customer_order_code ||
      null;

    const loadedAt =
      parseTime(lot?.charged_at) ||
      parseTime(lot?.started_at) ||
      parseTime(lot?.created_at) ||
      parseTime(kiln.last_reading_at);

    const residenceMinutes = Number(lot?.residence_time_min) || residenceMin;
    const totalHours = residenceMinutes / 60;
    const elapsedHours = loadedAt ? (Date.now() - loadedAt.getTime()) / 3_600_000 : 0;
    const lastReadingAt = parseTime(kiln.last_reading_at);
    const progress = totalHours > 0 ? Math.min(1, Math.max(0, elapsedHours / totalHours)) : 0;
    const pendingHours = Math.max(0, totalHours - elapsedHours);
    const kg = Number(kiln.active_lot_kg ?? lot?.lot_quantity ?? 0);
    const kilnStatus = (kiln.status || "IDLE").toUpperCase();
    const hasLoad = Boolean(activeCode || lot?.lot_code) || (kg > 0 && kilnStatus === "RUNNING");

    return {
      resourceCode: kiln.resource_code,
      resourceName: kiln.resource_name || kiln.resource_code,
      status: kilnStatus,
      inwardCode: shortInward(inwardCode),
      inwardFull: inwardCode,
      lotCode: activeCode || lot?.lot_code || null,
      kg: Number.isFinite(kg) ? kg : 0,
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
