function numberOrEmpty(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function AcRmsBagList({
  bags = [],
  title = "RMS bags",
  onRemove = null,
  removing = false
}) {
  const rows = (bags || []).filter((b) => !b.grade);
  if (!rows.length) return null;
  const total = rows.reduce((sum, bag) => sum + numberOrEmpty(bag.weight_kg), 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm font-medium text-slate-800 mb-2">
        {title}{" "}
        <span className="font-normal text-slate-500">
          · {rows.length} bag(s) · {total} KG
        </span>
      </p>
      <ul className="text-sm space-y-1">
        {rows.map((bag) => (
          <li
            key={bag.bag_id || bag.bag_code}
            className="font-mono text-slate-800 flex items-center justify-between gap-3"
          >
            <span>
              {bag.bag_code} · {numberOrEmpty(bag.weight_kg)} KG
            </span>
            {onRemove ? (
              <button
                type="button"
                className="text-xs text-slate-600 underline disabled:opacity-50"
                disabled={removing}
                onClick={() => onRemove(bag)}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
