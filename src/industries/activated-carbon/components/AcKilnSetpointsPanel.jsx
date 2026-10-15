import { useEffect, useState } from "react";

import {
  fetchAcKilnSetpoints,
  formatAcApiError,
  saveAcKilnSetpoints
} from "../../../services/activatedCarbonApi";
import { formatKilnParameters, isScrapKilnParameter } from "../constants/kilnParameters";
import { kilnDesignedMonthlyKg } from "../utils/acKilnLoaderUtils";
import useAcPersonLabel from "../hooks/useAcPersonLabel";
import AcAlert from "./AcAlert";
import AcSaveBar from "./AcSaveBar";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
}

export default function AcKilnSetpointsPanel({ canEdit = false }) {
  const person = useAcPersonLabel();
  const [definitions, setDefinitions] = useState([]);
  const [rows, setRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [referenceMin, setReferenceMin] = useState(60);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const applyPlan = (plan) => {
    setReferenceMin(Number(plan?.reference_residence_min) || 60);
    setDefinitions((plan?.definitions || []).filter((row) => !isScrapKilnParameter(row)));
    setHistory(plan?.history || []);
    setRows(
      (plan?.kilns || []).map((row) => ({
        resource_code: row.resource_code,
        resource_name: row.resource_name,
        monthly_capacity_kg: row.monthly_capacity_kg,
        updated_by: row.updated_by || "",
        parameters: { ...(row.parameters || {}) }
      }))
    );
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchAcKilnSetpoints()
      .then((plan) => {
        if (!cancelled) applyPlan(plan);
      })
      .catch((e) => {
        if (!cancelled) setError(formatAcApiError(e, "Could not load kiln parameters"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setParam = (code, key, value) => {
    setRows((prev) =>
      prev.map((row) =>
        row.resource_code === code
          ? { ...row, parameters: { ...row.parameters, [key]: value } }
          : row
      )
    );
  };

  const handleSave = async () => {
    if (!canEdit || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await saveAcKilnSetpoints({
        kilns: rows.map((row) => ({
          resource_code: row.resource_code,
          parameters: Object.fromEntries(
            definitions.map((def) => {
              const raw = row.parameters?.[def.key];
              if (raw === "" || raw == null) return [def.key, null];
              const number = Number(raw);
              return [def.key, Number.isFinite(number) ? number : null];
            })
          )
        }))
      });
      applyPlan(saved);
      setSuccess("Kiln parameters saved. They stay until you change them.");
    } catch (e) {
      setError(formatAcApiError(e, "Could not save kiln parameters"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <WfCard>
      <WfCardHeader
        title="Kiln parameters"
        subtitle="Standing setpoints for each kiln. Residence time sets the kiln cycle and this month’s designed output. These values are not reset each day."
      />
      <WfCardBody>
        {error ? <AcAlert variant="error">{error}</AcAlert> : null}
        {success ? <AcAlert variant="success">{success}</AcAlert> : null}
        {loading ? <p className="text-sm text-slate-600">Loading kilns…</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="text-sm text-slate-600">
            No kilns yet. Ask nyraservices to register them under Masters — Machines & kilns.
          </p>
        ) : null}
        {!loading && rows.length > 0
          ? rows.map((row) => {
              const residence = Number(row.parameters?.residence_time_min);
              const designed = kilnDesignedMonthlyKg(
                row.monthly_capacity_kg,
                residence,
                Number(row.monthly_capacity_kg) || 15000
              );
              return (
                <div key={row.resource_code} className="mb-6 max-w-4xl">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <div>
                      <div className="font-medium text-slate-900">{row.resource_name}</div>
                      <div className="font-mono text-xs text-slate-500">{row.resource_code}</div>
                    </div>
                    <p className="text-xs text-slate-600">
                      Masters capacity {formatKg(row.monthly_capacity_kg)} at {referenceMin} min → designed{" "}
                      {formatKg(designed)}
                      {row.updated_by ? ` · set by ${person(row.updated_by)}` : ""}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {definitions.map((def) => (
                      <label key={def.key} className="text-sm text-slate-700">
                        <span className="block mb-1">{def.label}</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="w-full rounded border border-slate-300 px-3 py-2 tabular-nums"
                          value={row.parameters?.[def.key] ?? ""}
                          disabled={!canEdit || saving}
                          onChange={(e) => setParam(row.resource_code, def.key, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })
          : null}
        <p className="text-xs text-slate-500 mt-1 max-w-3xl">
          Designed output = monthly capacity × ({referenceMin} ÷ residence minutes). A shorter residence raises
          the kiln target on Machine utilization. Leave a field blank to clear it.
        </p>
        {canEdit && rows.length > 0 ? (
          <AcSaveBar onSave={handleSave} saving={saving} saveLabel="Save kiln parameters" />
        ) : null}
        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold text-slate-800 mb-2">Change log</p>
          {history.length === 0 ? (
            <p className="text-xs text-slate-500 m-0">No parameter changes saved yet.</p>
          ) : (
            <ul className="space-y-2 m-0 p-0 list-none">
              {history.slice(0, 20).map((row, index) => (
                <li key={`${row.kiln_resource_code}-${row.at || index}`} className="text-xs text-slate-700">
                  <span className="font-mono">{row.kiln_resource_code}</span>
                  {row.at ? ` · ${new Date(row.at).toLocaleString()}` : ""}
                  {row.by ? ` · ${person(row.by)}` : ""}
                  <span className="block text-slate-600">{formatKilnParameters(row.parameters) || "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </WfCardBody>
    </WfCard>
  );
}
