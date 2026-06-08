function trendDay(point) {
  return point?.day ?? point?.date ?? point?.oee_date ?? "";
}

function trendOee(point) {
  const raw = point?.oee ?? point?.oee_percent ?? point?.average_oee ?? point?.value;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

/** Normalize API trend rows to `{ day, oee }` for Recharts. */
export function normalizeOeeTrendPoints(rawTrend, summaries = []) {
  const points = [];

  if (Array.isArray(rawTrend)) {
    rawTrend.forEach((point) => {
      const day = String(trendDay(point) || "").trim();
      if (!day) return;
      points.push({ day, oee: trendOee(point) });
    });
  }

  if (points.length === 0 && Array.isArray(summaries) && summaries.length > 0) {
    const byDay = new Map();
    summaries.forEach((row) => {
      const day = String(row?.oee_date ?? row?.day ?? "").trim();
      if (!day) return;
      const bucket = byDay.get(day) || [];
      bucket.push(trendOee(row));
      byDay.set(day, bucket);
    });

    byDay.forEach((values, day) => {
      const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
      points.push({ day, oee: Math.round(avg * 100) / 100 });
    });
  }

  points.sort((a, b) => a.day.localeCompare(b.day));
  return points;
}

/** Expand a single-day trend so Recharts can draw a visible line. */
export function expandSingleDayTrend(points) {
  if (points.length !== 1) {
    return { data: points, mode: points.length ? "trend" : "empty", dayCount: points.length };
  }

  const point = points[0];
  const date = new Date(`${point.day}T12:00:00`);
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);

  return {
    mode: "single",
    dayCount: 1,
    singleDay: point.day,
    singleOee: point.oee,
    data: [
      { day: previous.toISOString().slice(0, 10), oee: point.oee },
      { day: point.day, oee: point.oee }
    ]
  };
}
