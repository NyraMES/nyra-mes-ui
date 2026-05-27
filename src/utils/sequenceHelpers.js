/** Next sequence value: max existing + step (default 10). */
export function nextSequence(items, key, step = 10) {
  const max = items.reduce(
    (m, item) => Math.max(m, Number(item[key]) || 0),
    0
  );
  return max + step;
}

/** Return duplicate sequence values, if any. */
export function findDuplicateSequences(items, key) {
  const seen = new Map();
  const duplicates = new Set();
  for (const item of items) {
    const seq = Number(item[key]);
    if (Number.isNaN(seq)) continue;
    if (seen.has(seq)) duplicates.add(seq);
    else seen.set(seq, true);
  }
  return [...duplicates];
}

export function sortBySequence(items, key) {
  return [...items].sort(
    (a, b) => (Number(a[key]) || 0) - (Number(b[key]) || 0)
  );
}

export function newLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
