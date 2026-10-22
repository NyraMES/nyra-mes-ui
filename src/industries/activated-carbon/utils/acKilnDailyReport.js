function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dayKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function inRange(value, from, to) {
  const key = dayKey(value);
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatAvg(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

function readingTemp(readings) {
  const values = ["t1", "t2", "t3"].map((key) => num(readings?.[key])).filter((value) => value != null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function ctcOfBag(bag) {
  const values = bag?.values || bag?.kiln_output_qc?.values || {};
  for (const [key, value] of Object.entries(values)) {
    if (/ctc/i.test(key)) {
      const parsed = num(value);
      if (parsed != null) return parsed;
    }
  }
  return null;
}

function bucketFor(buckets, day, kiln) {
  const key = `${day}|${kiln}`;
  if (!buckets.has(key)) {
    buckets.set(key, { day, kiln, temps: [], ctcs: [], feed: 0, output: 0 });
  }
  return buckets.get(key);
}

/**
 * One row per kiln per day: average of T1–T3, average measured CTC, and
 * yield (output kg ÷ feed kg × 100) for loads and output bags on that day.
 */
export function buildKilnDailyAverages(data, filters = {}) {
  const buckets = new Map();
  for (const row of data?.readings || []) {
    const at = row.slot_start || row.recorded_at;
    if (!inRange(at, filters.from, filters.to)) continue;
    const temp = readingTemp(row.readings);
    if (temp == null) continue;
    bucketFor(buckets, dayKey(at), row.kiln_resource_code || "Kiln").temps.push(temp);
  }
  for (const bag of data?.kilnBags || []) {
    const created = bag.created_at || bag.saved_at;
    if (inRange(created, filters.from, filters.to)) {
      const kiln = bag.kiln_resource_code || bag.kiln_name || "Kiln";
      bucketFor(buckets, dayKey(created), kiln).output += num(bag.quantity_kg) || 0;
    }
    const checked = bag.saved_at || bag.created_at;
    const ctc = ctcOfBag(bag);
    if (ctc != null && inRange(checked, filters.from, filters.to)) {
      const kiln = bag.kiln_resource_code || bag.kiln_name || "Kiln";
      bucketFor(buckets, dayKey(checked), kiln).ctcs.push(ctc);
    }
  }
  for (const lot of data?.lots || []) {
    const events = lot.kiln_feed_events || lot.metadata?.kiln_feed_events || [];
    for (const event of events) {
      const at = event.loaded_at || event.loadedAt;
      if (!inRange(at, filters.from, filters.to)) continue;
      const kiln = event.kiln_resource_code || event.kilnCode || lot.kiln_resource_code || "Kiln";
      bucketFor(buckets, dayKey(at), kiln).feed += num(event.kg ?? event.quantity_kg) || 0;
    }
  }
  const search = String(filters.search || "").trim().toLowerCase();
  return Array.from(buckets.values())
    .filter((row) => !search || `${row.day} ${row.kiln}`.toLowerCase().includes(search))
    .sort((a, b) => a.day.localeCompare(b.day) || String(a.kiln).localeCompare(String(b.kiln)))
    .map((row) => ({
      day: row.day,
      kiln: row.kiln,
      avg_temp: formatAvg(average(row.temps)),
      avg_ctc: formatAvg(average(row.ctcs)),
      yield_avg: row.feed > 0 ? formatAvg((row.output / row.feed) * 100) : "—"
    }));
}
