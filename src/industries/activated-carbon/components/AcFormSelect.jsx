import { Children } from "react";

function AcFormSelect({
  label,
  value,
  onChange,
  loading = false,
  emptyMessage = "No options — run seed or check API connection",
  children,
  className = "",
  disabled = false
}) {
  const optionCount = Children.count(children);
  const empty = !loading && optionCount === 0;

  return (
    <label className={`text-sm block ${className}`}>
      {label && (
        <span className="block mb-1 font-medium text-slate-700">{label}</span>
      )}
      <select
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
        value={empty ? "" : value}
        disabled={disabled || loading || empty}
        onChange={onChange}
      >
        {loading ? (
          <option value="">Loading…</option>
        ) : empty ? (
          <option value="">No options available</option>
        ) : (
          children
        )}
      </select>
      {empty && (
        <span className="mt-1 block text-xs text-amber-700">{emptyMessage}</span>
      )}
    </label>
  );
}

export default AcFormSelect;
