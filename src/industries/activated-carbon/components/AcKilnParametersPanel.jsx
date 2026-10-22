import { useEffect, useMemo, useState } from "react";

import {
  approveAcKilnReading,
  createAcKilnParameters,
  fetchAcKilnReadingBoard,
  fetchAcKilnSetpoints,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import { useAuth } from "../../../auth/AuthContext";
import AcAlert from "./AcAlert";
import useAcMasters from "../hooks/useAcMasters";
import useBusyGuard from "../hooks/useBusyGuard";
import { formatKilnParameters } from "../constants/kilnParameters";
import { userIsAcAdmin, userIsAcManager, userIsNyraServices } from "../utils/acPrivileges";

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

function readingSummary(readings = {}, fields = []) {
  const labels = Object.fromEntries(fields.map((row) => [row.key, row]));
  return Object.entries(readings)
    .filter(([, value]) => value !== "" && value != null)
    .map(([key, value]) => {
      const def = labels[key];
      return `${def?.label || key}: ${value}${def?.unit ? ` ${def.unit}` : ""}`;
    })
    .join(" · ");
}

function emptyValues(fields) {
  return Object.fromEntries(fields.map((row) => [row.key, ""]));
}

function ReadingFields({ fields, values, onChange, disabled }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {fields.map((def) => (
        <label key={def.key} className="block text-sm">
          <span className="block mb-1 text-slate-700">
            {def.label}
            {def.unit ? <span className="text-slate-500 text-xs ml-1">({def.unit})</span> : null}
          </span>
          <input
            type="number"
            step="any"
            min="0"
            max={def.unit === "%" ? "100" : undefined}
            value={values[def.key] ?? ""}
            disabled={disabled}
            onChange={(e) => onChange(def.key, e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
          />
        </label>
      ))}
    </div>
  );
}

export default function AcKilnParametersPanel() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  const canApprove = userIsAcManager(roles) || userIsAcAdmin(roles) || userIsNyraServices(user);
  const { masters, loading: mastersLoading, ready } = useAcMasters();
  const [kilnCode, setKilnCode] = useState("");
  const [board, setBoard] = useState(null);
  const [values, setValues] = useState({});
  const [lateValues, setLateValues] = useState({});
  const [currentSettings, setCurrentSettings] = useState(null);
  const [error, setError] = useState("");
  const { busy: saving, run } = useBusyGuard();

  const kilns = useMemo(
    () => [...(masters.kilns || [])].sort((a, b) => kilnLetter(a).localeCompare(kilnLetter(b))),
    [masters.kilns]
  );
  const fields = board?.fields || [];

  useEffect(() => {
    if (!kilnCode && kilns[0]) setKilnCode(kilns[0].resource_code);
  }, [kilns, kilnCode]);

  const reload = () => {
    if (!kilnCode) return Promise.resolve();
    return fetchAcKilnReadingBoard(kilnCode)
      .then((data) => {
        setBoard(data);
        setValues(emptyValues(data?.fields || []));
      })
      .catch((err) => {
        setBoard(null);
        setError(formatAcApiError(err, "Could not load kiln readings"));
      });
  };

  useEffect(() => {
    reload();
    fetchAcKilnSetpoints()
      .then((plan) => setCurrentSettings(plan))
      .catch(() => setCurrentSettings(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kilnCode]);

  const saveReading = (slotStart) =>
    run(async () => {
      const source = slotStart ? lateValues[slotStart] || {} : values;
      const payload = { kiln_resource_code: kilnCode };
      if (slotStart) payload.slot_start = slotStart;
      for (const def of fields) {
        const raw = source[def.key];
        if (raw === "" || raw == null) continue;
        payload[def.key] = Number(raw);
      }
      if (!kilnCode) {
        setError("Select a kiln.");
        return;
      }
      setError("");
      await createAcKilnParameters(payload);
      if (slotStart) {
        setLateValues((prev) => ({ ...prev, [slotStart]: emptyValues(fields) }));
      }
      await reload();
    }).catch((e) => {
      setError(formatAcApiError(e, "Could not save kiln reading"));
    });

  const approveSlot = (slotStart) =>
    run(async () => {
      setError("");
      const data = await approveAcKilnReading({
        kiln_resource_code: kilnCode,
        slot_start: slotStart
      });
      setBoard(data);
    }).catch((e) => {
      setError(formatAcApiError(e, "Could not approve the reading"));
    });

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

      <p className="text-sm text-slate-700 m-0">
        Enter T1, T2, T3, Main Damper (MD %), Boiler Damper (BD %), Induced Draft (ID %), and Boiler
        Pressure every 30 minutes. A missed interval stays locked until a plant manager approves it.
      </p>

      {error ? <AcAlert variant="error">{error}</AcAlert> : null}

      {(() => {
        const kiln = (currentSettings?.kilns || []).find((row) => row.resource_code === kilnCode);
        const text = formatKilnParameters(kiln?.parameters);
        if (!text) return null;
        return (
          <p className="text-sm text-slate-700 m-0">
            Standing settings{kiln?.updated_at ? ` (${formatStamp(kiln.updated_at)})` : ""}: {text}
          </p>
        );
      })()}

      <div className="rounded-md border border-slate-200 bg-white px-3 py-3 space-y-3">
        <p className="text-sm font-semibold m-0">
          This interval{board?.current_label ? `: ${board.current_label}` : ""}
        </p>
        <ReadingFields
          fields={fields}
          values={values}
          disabled={saving}
          onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
        />
        <button
          type="button"
          onClick={() => saveReading(null)}
          disabled={saving || !kilnCode}
          className="rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
        >
          {saving ? "Saving…" : "Save reading"}
        </button>
      </div>

      {(board?.locked_slots || []).length ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3 space-y-3">
          <p className="text-sm font-semibold m-0">Missed intervals</p>
          {board.locked_slots.map((slot) => (
            <div key={slot.slot_start} className="rounded-md border border-amber-200 bg-white px-3 py-2 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{slot.label}</span>
                {slot.status === "locked" && canApprove ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-blue-700 underline"
                    disabled={saving}
                    onClick={() => approveSlot(slot.slot_start)}
                  >
                    Approve
                  </button>
                ) : null}
                {slot.status === "locked" && !canApprove ? (
                  <span className="text-xs text-amber-800">Locked until a plant manager approves it</span>
                ) : null}
              </div>
              {slot.status === "approved" ? (
                <>
                  <ReadingFields
                    fields={fields}
                    values={lateValues[slot.slot_start] || {}}
                    disabled={saving}
                    onChange={(key, value) =>
                      setLateValues((prev) => ({
                        ...prev,
                        [slot.slot_start]: { ...(prev[slot.slot_start] || {}), [key]: value }
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => saveReading(slot.slot_start)}
                    disabled={saving}
                    className="rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
                  >
                    Save approved reading
                  </button>
                </>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
        <p className="text-sm font-semibold mb-2">Saved readings</p>
        {(board?.readings || []).length === 0 ? (
          <p className="text-xs text-slate-500 m-0">No readings yet.</p>
        ) : (
          <ul className="space-y-2 m-0 p-0 list-none">
            {board.readings.slice(0, 12).map((row) => (
              <li key={row.reading_id} className="rounded-md border border-slate-200 px-3 py-2 text-xs">
                <div className="font-semibold">
                  {formatStamp(row.slot_start || row.recorded_at)}
                  {row.late ? " · late" : ""}
                </div>
                <div className="text-slate-600 mt-1">{readingSummary(row.readings, fields) || "—"}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
