import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../auth/AuthContext";

import {
  fetchAcMaterialTrace,
  fetchAcMaterialTraceOptions,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import { userCanSeeAcSupplier } from "../utils/acPrivileges";

const LOOKUP_KINDS = [
  { id: "work_order", label: "Work order" },
  { id: "bag", label: "Bag" },
  { id: "inward", label: "Inward" },
  { id: "dispatch", label: "Dispatch" }
];

function classifyCode(value) {
  const text = String(value || "").trim().toUpperCase();
  if (text.startsWith("WO-")) return "work_order";
  if (text.startsWith("ORD-")) return "inward";
  if (text.startsWith("DISP-")) return "dispatch";
  return "bag";
}

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
}

function Tile({ label, value, hint }) {
  return (
    <div className="ac-mgmt-card rounded-lg px-3 py-2">
      <div className="ac-mgmt-label text-[10px] uppercase tracking-wide">{label}</div>
      <div className="ac-mgmt-value text-lg font-bold tabular-nums leading-tight">{value}</div>
      {hint ? <div className="ac-mgmt-muted text-[10px] truncate">{hint}</div> : null}
    </div>
  );
}

export default function AcMaterialTracePanel() {
  const { user } = useAuth();
  const showSupplier = userCanSeeAcSupplier(user?.roles || [], user);
  const [kind, setKind] = useState("work_order");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [monthLabel, setMonthLabel] = useState("");
  const [trace, setTrace] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingOptions(true);
      setError("");
      try {
        const data = await fetchAcMaterialTraceOptions(kind);
        if (cancelled) return;
        setOptions(data?.options || []);
        setMonthLabel(data?.month_label || "");
      } catch (e) {
        if (!cancelled) {
          setOptions([]);
          setError(formatAcApiError(e, "Could not load this month's list"));
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const kindLabel = useMemo(
    () => LOOKUP_KINDS.find((row) => row.id === kind)?.label || "Work order",
    [kind]
  );

  const lookup = async (value, nextKind) => {
    const q = String(value || "").trim();
    if (!q) return;
    if (nextKind) setKind(nextKind);
    setQuery(q);
    setLoading(true);
    setError("");
    try {
      setTrace(await fetchAcMaterialTrace(q));
    } catch (e) {
      setTrace(null);
      setError(formatAcApiError(e, "Could not load trace"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    lookup(query);
  };

  return (
    <div className="space-y-2">
      <form className="ac-mgmt-card rounded-lg p-3 flex flex-wrap gap-2 items-end" onSubmit={handleSubmit}>
        <label className="min-w-[10rem]">
          <div className="ac-mgmt-label text-[10px] uppercase tracking-wide mb-1">Look up by</div>
          <select
            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setQuery("");
              setTrace(null);
            }}
          >
            {LOOKUP_KINDS.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 min-w-[16rem]">
          <div className="ac-mgmt-label text-[10px] uppercase tracking-wide mb-1">
            {kindLabel}
            {monthLabel ? ` · ${monthLabel}` : ""}
          </div>
          <select
            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={query}
            onChange={(e) => lookup(e.target.value)}
            disabled={loadingOptions}
          >
            <option value="">
              {loadingOptions
                ? "Loading this month…"
                : options.length
                  ? `Select ${kindLabel.toLowerCase()}…`
                  : `No ${kindLabel.toLowerCase()} this month`}
            </option>
            {options.map((row) => (
              <option key={row.code} value={row.code}>
                {row.label}
              </option>
            ))}
            {query && !options.some((row) => row.code === query) ? (
              <option value={query}>{query}</option>
            ) : null}
          </select>
        </label>
        <button type="submit" className="wf-btn wf-btn-primary">
          {loading ? "Looking up…" : "Look up"}
        </button>
      </form>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {!trace && !error ? (
        <p className="ac-mgmt-muted text-xs py-4 text-center">
          Choose how to look up, then pick a {kindLabel.toLowerCase()} from this month.
          {showSupplier ? " Supplier is read from the gate receipt." : ""}
        </p>
      ) : null}

      {trace && !trace.found ? (
        <p className="ac-mgmt-muted text-xs py-4 text-center">{trace.message || "No match."}</p>
      ) : null}

      {trace?.found ? (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
            {showSupplier && (trace.suppliers || []).length
              ? (trace.suppliers || []).map((row) => (
                  <Tile
                    key={`${row.supplier_code || row.supplier_name}-${row.inward_codes.join(",")}`}
                    label={row.supplier_name}
                    value={formatKg(row.feed_kg)}
                    hint={(row.inward_codes || []).join(" · ") || row.supplier_code}
                  />
                ))
              : null}
            {showSupplier && !(trace.suppliers || []).length ? (
              <Tile label="Supplier" value="—" hint={trace.message || "No inward linked yet"} />
            ) : null}
          </div>
          {(trace.work_order_codes || []).length ? (
            <p className="text-xs text-slate-700">
              Work orders:{" "}
              {(trace.work_order_codes || []).map((code, index) => (
                <span key={code}>
                  {index > 0 ? " · " : ""}
                  <button
                    type="button"
                    className="font-mono underline"
                    onClick={() => lookup(code, "work_order")}
                  >
                    {code}
                  </button>
                </span>
              ))}
            </p>
          ) : null}
          {trace.message ? <p className="ac-mgmt-muted text-xs">{trace.message}</p> : null}
          <div className="ac-mgmt-card rounded-lg p-3 overflow-x-auto">
            <table className="w-full text-[11px] text-left">
              <thead>
                <tr className="ac-mgmt-muted uppercase tracking-wide">
                  <th className="py-1 pr-2 font-medium">Stage</th>
                  <th className="py-1 pr-2 font-medium">Code</th>
                  <th className="py-1 pr-2 font-medium">Inward</th>
                  <th className="py-1 pr-2 font-medium">Work order</th>
                  <th className="py-1 pr-2 font-medium text-right">Kg</th>
                  <th className="py-1 pr-2 font-medium">Machine</th>
                  <th className="py-1 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {(trace.steps || []).map((step, idx) => {
                  const code = step.bag_code || step.dispatch_code || step.inward_code;
                  return (
                    <tr key={`${step.stage}-${code || idx}-${idx}`} className="border-t border-slate-200">
                      <td className="py-1 pr-2 ac-mgmt-value">{step.stage_label}</td>
                      <td className="py-1 pr-2 font-mono">
                        {code ? (
                          <button
                            type="button"
                            className="underline"
                            onClick={() => lookup(code, classifyCode(code))}
                          >
                            {code}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-1 pr-2 font-mono">
                        {step.inward_code ? (
                          <button
                            type="button"
                            className="underline"
                            onClick={() => lookup(step.inward_code, "inward")}
                          >
                            {step.inward_code}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-1 pr-2 font-mono">
                        {step.work_order_code ? (
                          <button
                            type="button"
                            className="underline"
                            onClick={() => lookup(step.work_order_code, "work_order")}
                          >
                            {step.work_order_code}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-1 pr-2 tabular-nums text-right">{formatKg(step.kg)}</td>
                      <td className="py-1 pr-2 ac-mgmt-muted">{step.machine || "—"}</td>
                      <td className="py-1 ac-mgmt-muted truncate max-w-[16rem]">
                        {[
                          step.grade,
                          step.mesh ? `Mesh ${step.mesh}` : null,
                          step.ctc ? `CTC ${step.ctc}` : null,
                          step.stones ? `Stones ${step.stones}` : null,
                          step.destination,
                          step.note
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
