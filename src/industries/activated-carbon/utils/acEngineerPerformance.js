/** Week view of saved checks. Same kilograms as User performance on the reports. */

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function performanceDayKey(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function currentWeekDays(now = new Date()) {
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    return performanceDayKey(date);
  });
}

export function currentWeekLabel(now = new Date()) {
  const days = currentWeekDays(now);
  const formatDay = (key) => {
    const [year, month, date] = String(key).split("-").map(Number);
    return new Date(year, (month || 1) - 1, date || 1).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };
  return `${formatDay(days[0])} – ${formatDay(days[6])}`;
}

export function weekdayLabel(day) {
  const [year, month, date] = String(day).split("-").map(Number);
  const parsed = new Date(year, (month || 1) - 1, date || 1);
  if (Number.isNaN(parsed.getTime())) return day;
  return `${WEEKDAY[parsed.getDay()]} ${parsed.getDate()}`;
}

function roundKg(value) {
  return Math.round(Number(value) * 10) / 10;
}

function kgOf(row) {
  const kg = Number(row?.quantity_kg ?? row?.weight_kg ?? 0);
  return Number.isFinite(kg) && kg > 0 ? kg : 0;
}

function makerOf(row) {
  return String(row?.created_by || "").trim().toLowerCase();
}

function saverOf(row) {
  return String(row?.user_id || "").trim().toLowerCase();
}

function pushCheck(rows, { actor, kg, at, bag, process, area }) {
  if (!at || !actor || kg <= 0) return;
  rows.push({
    actor,
    kg,
    at,
    day: performanceDayKey(at),
    bag: bag || "",
    process,
    area
  });
}

export function collectEngineerChecks({
  kilnBags = [],
  destonQc = [],
  qualitySections = [],
  postOutputs = []
} = {}) {
  const rows = [];
  for (const row of kilnBags) {
    const kg = kgOf(row);
    pushCheck(rows, {
      actor: makerOf(row),
      kg,
      at: row?.created_at || "",
      bag: row.bag_code,
      process: "Kiln output",
      area: "activation"
    });
    pushCheck(rows, {
      actor: saverOf(row),
      kg,
      at: row?.saved_at || "",
      bag: row.bag_code,
      process: "Kiln output quality",
      area: "quality"
    });
  }
  for (const row of destonQc) {
    const kg = kgOf(row);
    pushCheck(rows, {
      actor: makerOf(row),
      kg,
      at: row?.created_at || "",
      bag: row.bag_code,
      process: "Destoning",
      area: "activation"
    });
    pushCheck(rows, {
      actor: saverOf(row),
      kg,
      at: row?.saved_at || "",
      bag: row.bag_code,
      process: "Destoning quality",
      area: "quality"
    });
  }
  for (const section of qualitySections) {
    const process = `${section.process_label || section.process || "Post-activation"} quality`;
    for (const row of section.bags || []) {
      pushCheck(rows, {
        actor: saverOf(row),
        kg: kgOf(row),
        at: row?.saved_at || "",
        bag: row.bag_code,
        process,
        area: "quality"
      });
    }
  }
  for (const row of postOutputs) {
    pushCheck(rows, {
      actor: makerOf(row),
      kg: kgOf(row),
      at: row?.created_at || "",
      bag: row.bag_code,
      process: row.process_label || row.process || "Post-activation",
      area: "post"
    });
  }
  return rows;
}

/** Gate receipts and RMS bags for the role lines. Actor is the plant total for that work. */
export function collectReceiptChecks(orders = [], { area = "rms", mode = "our_weight" } = {}) {
  const rows = [];
  for (const order of orders) {
    const kg =
      mode === "bags"
        ? Number(order?.rms_bag_weight_kg || 0)
        : Number(order?.our_weight_kg ?? order?.inward_quantity_kg ?? 0);
    const at =
      mode === "bags"
        ? order?.rms_inward_at || order?.created_at || order?.order_date || ""
        : order?.created_at || order?.order_date || "";
    pushCheck(rows, {
      actor: "__plant__",
      kg: Number.isFinite(kg) ? kg : 0,
      at,
      bag: order?.order_code || "",
      process: mode === "bags" ? "RMS bags" : area === "entry" ? "Gate receipt" : "Raw material",
      area
    });
  }
  return rows;
}

function sumByActor(rows) {
  const by = new Map();
  for (const row of rows) {
    const current = by.get(row.actor) || { actor: row.actor, kg: 0, count: 0 };
    current.kg += row.kg;
    current.count += 1;
    by.set(row.actor, current);
  }
  return [...by.values()].sort((a, b) => b.kg - a.kg || b.count - a.count || a.actor.localeCompare(b.actor));
}

/**
 * Line points for the signed-in person and the week's top performer.
 * Future days stay empty. The top performer is the expected line.
 */
export function buildEngineerWeek(checks, identityIds, { now = new Date() } = {}) {
  const ids = new Set(
    [...(identityIds || [])].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
  );
  const days = currentWeekDays(now);
  const today = performanceDayKey(now);
  const week = new Set(days);
  const inWeek = (checks || [])
    .filter((row) => week.has(row.day))
    .map((row) => ({ ...row, actor: ids.has(row.actor) ? "__you__" : row.actor }));
  const totals = sumByActor(inWeek);
  const mine = totals.find((row) => row.actor === "__you__") || { kg: 0, count: 0 };
  const top = totals[0] || null;
  const youAreTop = top?.actor === "__you__";
  const expectedActor = youAreTop ? "" : top?.actor || "";

  const kgOn = (actor, day) =>
    inWeek.reduce((sum, row) => (row.actor === actor && row.day === day ? sum + row.kg : sum), 0);

  const series = days.map((day) => {
    const future = day > today;
    return {
      day,
      label: weekdayLabel(day),
      you: future ? null : roundKg(kgOn("__you__", day)),
      expected: future || !expectedActor ? null : roundKg(kgOn(expectedActor, day))
    };
  });

  return {
    days,
    today,
    series,
    yourWeekKg: roundKg(mine.kg),
    yourWeekCount: mine.count,
    topActor: youAreTop ? "" : top?.actor || "",
    topWeekKg: roundKg(top?.kg || 0),
    youAreTop,
    expectedActor
  };
}

/** One line per area, each against the top performer in that same work. */
export function buildAreaWeeks(checks, identityIds, areaIds, options) {
  const ids = areaIds?.length ? areaIds : ["activation"];
  const weeks = {};
  for (const id of ids) {
    weeks[id] = buildEngineerWeek(
      (checks || []).filter((row) => row.area === id),
      identityIds,
      options
    );
  }
  const base = weeks[ids[0]];
  const series = base.days.map((day) => {
    const point = { day, label: weekdayLabel(day) };
    for (const id of ids) {
      const row = weeks[id].series.find((item) => item.day === day);
      point[id] = row?.you ?? null;
      point[`${id}Expected`] = row?.expected ?? null;
    }
    return point;
  });
  return { days: base.days, today: base.today, series, weeks };
}

export function checksOnDay(checks, identityIds, day) {
  const ids = new Set(
    [...(identityIds || [])].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
  );
  return (checks || [])
    .filter((row) => row.day === day && ids.has(row.actor))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}
