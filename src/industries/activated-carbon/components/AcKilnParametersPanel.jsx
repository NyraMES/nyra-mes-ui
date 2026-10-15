import { useEffect, useMemo, useState } from "react";

import {
  createAcKilnParameters,
  fetchAcKilnParameters,
  fetchAcKilnSetpoints,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import AcAlert from "./AcAlert";
import useAcMasters from "../hooks/useAcMasters";
import useBusyGuard from "../hooks/useBusyGuard";
import { AC_KILN_PARAMETER_DEFINITIONS, formatKilnParameters, isScrapKilnParameter } from "../constants/kilnParameters";

function kilnLetter(kiln, index = 0) {
  const blob = `${kiln?.resource_name || ""} ${kiln?.resource_code || ""}`.toUpperCase();
  const named = blob.match(/\bK(?:ILN|LIN)?[-_\s]*([A-C])\b/);
  if (named) return named[1];
  return String.fromCharCode(65 + index);
}

function formatStamp(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString();
}

function readingSummary(readings = {}) {
  return Object.entries(readings)
    .filter(([, value]) => value !== "" && value != null)
    .map(([key, value]) => {
      const def = AC_KILN_PARAMETER_DEFINITIONS.find((row) => row.key === key);
      return `${def?.label || key}: ${value}${def?.unit ? ` ${def.unit}` : ""}`;
    })
    .join(" · ");
}

export default function AcKilnParametersPanel() {
  const { masters, loading: mastersLoading, ready } = useAcMasters();
  const [kilnCode, setKilnCode] = useState("");
  const [values, setValues] = useState({});
  const [rows, setRows] = useState([]);
  const [currentSettings, setCurrentSettings] = useState(null);
  const [error, setError] = useState("");
  const { busy: saving, run } = useBusyGuard();

  const kilns = useMemo(
    () => [...(masters.kilns || [])].sort((a, b) => kilnLetter(a).localeCompare(kilnLetter(b))),
    [masters.kilns]
  );
  const definitions = (
    masters.kiln_parameter_definitions?.length > 0
      ? masters.kiln_parameter_definitions
      : AC_KILN_PARAMETER_DEFINITIONS
  ).filter((row) => !isScrapKilnParameter(row));

  useEffect(() => {
    if (!kilnCode && kilns[0]) setKilnCode(kilns[0].resource_code);
  }, [kilns, kilnCode]);

  const reload = () =>
    fetchAcKilnParameters()
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));

  useEffect(() => {
    reload();
    fetchAcKilnSetpoints()
      .then((plan) => setCurrentSettings(plan))
      .catch(() => setCurrentSettings(null));
  }, []);

  const handleAdd = () =>
    run(async () => {
      const payload = { kiln_resource_code: kilnCode };
      let filled = 0;
      for (const def of definitions) {
        const raw = values[def.key];
        if (raw === "" || raw == null) continue;
        payload[def.key] = Number(raw);
        filled += 1;
      }
      if (!kilnCode) {
        setError("Select a kiln.");
        return;
      }
      if (!filled) {
        setError("Enter at least one reading.");
        return;
      }
      setError("");
      await createAcKilnParameters(payload);
      setValues({});
      await reload();
    }).catch((e) => {
      setError(formatAcApiError(e, "Could not save kiln reading"));
    });

  const visibleRows = kilnCode
    ? rows.filter((row) => !row.kiln_resource_code || row.kiln_resource_code === kilnCode)
    : rows;

  return (
    <section
      className="wf-light-panel rounded-xl border border-slate-200 bg-white p-4 space-y-4"
      style={{ color: "#0f172a", background: "#ffffff" }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium" htmlFor="ac-kiln-param-select">
          Kiln
        </label>
        <select
          id="ac-kiln-param-select"
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm min-w-[8rem]"
          value={kilnCode}
          disabled={mastersLoading || saving}
          onChange={(e) => setKilnCode(e.target.value)}
        >
          {kilns.map((kiln, index) => (
            <option key={kiln.resource_id || kiln.resource_code} value={kiln.resource_code}>
              Kiln {kilnLetter(kiln, index)}
            </option>
          ))}
        </select>
        {ready && kilns.length === 0 ? (
          <p className="text-xs" style={{ color: "#b45309" }}>
            No kilns. Add a kiln in Masters.
          </p>
        ) : null}
      </div>

      {error ? <AcAlert variant="error">{error}</AcAlert> : null}

      {(() => {
        const kiln = (currentSettings?.kilns || []).find((row) => row.resource_code === kilnCode);
        const text = formatKilnParameters(kiln?.parameters);
        if (!text) return null;
        return (
          <p className="text-sm text-slate-700 m-0">
            Current settings{kiln?.updated_at ? ` (${formatStamp(kiln.updated_at)})` : ""}: {text}
          </p>
        );
      })()}

      <div className="rounded-md border border-slate-200 bg-white px-3 py-3 space-y-3">
        <p className="text-sm font-semibold m-0">Kiln readings</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {definitions.map((def) => (
            <label key={def.key} className="block text-sm">
              <span className="block mb-1 text-slate-700">
                {def.label}
                {def.unit ? <span className="text-slate-500 text-xs ml-1">({def.unit})</span> : null}
              </span>
              <input
                type="number"
                step="any"
                value={values[def.key] ?? ""}
                disabled={saving}
                onChange={(e) => setValues((prev) => ({ ...prev, [def.key]: e.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving || !kilnCode}
          className="rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
        <p className="text-sm font-semibold mb-2">Recent readings</p>
        {visibleRows.length === 0 ? (
          <p className="text-xs text-slate-500 m-0">No readings yet. Enter values and click Add.</p>
        ) : (
          <ul className="space-y-2 m-0 p-0 list-none">
            {visibleRows.slice(0, 12).map((row) => (
              <li
                key={row.reading_id}
                className="rounded-md border border-slate-200 px-3 py-2 text-xs"
              >
                <div className="font-semibold">{formatStamp(row.recorded_at)}</div>
                <div className="text-slate-600 mt-1">{readingSummary(row.readings) || "—"}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
