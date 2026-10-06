import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../auth/AuthContext";
import { formatApiError } from "../../../services/api";
import {
  fetchAcDestoningBagQc,
  fetchAcKilnOutputBagQc,
  saveAcDestoningBagQc
} from "../../../services/activatedCarbonApi";
import AcAlert from "./AcAlert";

const MESH_LABELS = ["+3", "3/4", "4/8", "8/12", "12/30", "-30"];

const FALLBACK_PARAMS = [
  { parameter_code: "deston_copy_from_kiln_bag", parameter_name: "Copy from Kiln Bag", data_type: "text" },
  ...MESH_LABELS.map((label) => ({
    parameter_code: `deston_qc_${label.replace("+", "plus_").replace("-", "minus_").replace("/", "_")}_kg`,
    parameter_name: label,
    data_type: "number",
    unit: "KG"
  })),
  { parameter_code: "deston_qc_cbd", parameter_name: "cbd", data_type: "text" },
  { parameter_code: "deston_qc_ctc", parameter_name: "ctc", data_type: "text" },
  { parameter_code: "deston_qc_destination", parameter_name: "Destination", data_type: "text" },
  { parameter_code: "deston_qc_remarks", parameter_name: "Remarks", data_type: "text" }
];

const DESTINATIONS = [
  "In Stock",
  "Screening",
  "De-Dusting",
  "Crushing",
  "De-Magnetize",
  "Blending",
  "Finished Goods"
];

function isQcSaved(bag) {
  if (bag?.saved_at) return true;
  const qc = bag?.destoning_qc;
  if (qc?.saved_at) return true;
  const values = bag?.values || qc?.values || {};
  return Object.entries(values).some(([key, value]) => {
    if (key === "deston_qc_destination" && String(value) === "In Stock") return false;
    return String(value ?? "").trim() !== "";
  });
}

function paramKey(param) {
  return param.parameter_code || param.parameter_id || param.parameter_name;
}

function matchParam(parameters, testers) {
  return parameters.find((p) => testers.some((fn) => fn(p))) || null;
}

function meshSlug(label) {
  return label.replace("+", "plus_").replace("-", "minus_").replace("/", "_");
}

function resolveField(fields, testers, fallback) {
  return matchParam(fields, testers) || fallback || null;
}

function formatBagTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatWeight(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : "—";
}

function emptyValues(fields) {
  const initial = {};
  for (const param of fields) {
    initial[paramKey(param)] = "";
  }
  return initial;
}

function valuesFromBag(bag, fields) {
  const initial = emptyValues(fields);
  const saved = bag?.values || bag?.destoning_qc?.values || {};
  for (const param of fields) {
    const key = paramKey(param);
    if (saved[key] != null && saved[key] !== "") {
      initial[key] = String(saved[key]);
    }
  }
  if (!initial.deston_qc_destination) {
    initial.deston_qc_destination = "In Stock";
  }
  return initial;
}

function mapKilnValuesToDeston(kilnValues = {}) {
  const mapped = {};
  for (const [key, value] of Object.entries(kilnValues)) {
    if (value == null || value === "") continue;
    if (key.startsWith("kiln_out_")) {
      mapped[`deston_qc_${key.slice("kiln_out_".length)}`] = String(value);
    }
  }
  return mapped;
}

export default function AcDestoningQualityPanel({
  parameters = [],
  refreshToken = 0
}) {
  const { user } = useAuth() || {};
  const fields = useMemo(() => {
    const incoming = parameters.length ? parameters : [];
    const byCode = new Map();
    for (const param of [...FALLBACK_PARAMS, ...incoming]) {
      const key = paramKey(param);
      if (key) byCode.set(key, { ...(byCode.get(key) || {}), ...param });
    }
    const ordered = FALLBACK_PARAMS.map((param) => byCode.get(paramKey(param))).filter(Boolean);
    for (const param of incoming) {
      const key = paramKey(param);
      if (key && !ordered.some((row) => paramKey(row) === key)) ordered.push(param);
    }
    return ordered;
  }, [parameters]);

  const meshParams = MESH_LABELS.map((label) =>
    resolveField(
      fields,
      [
        (p) => String(p.parameter_name || "").replace(/\s*\(kg\)/i, "") === label,
        (p) => String(p.parameter_code || "").includes(meshSlug(label))
      ],
      FALLBACK_PARAMS.find((p) => p.parameter_name === label)
    )
  );
  const cbdParam = resolveField(
    fields,
    [(p) => /cbd/i.test(p.parameter_code || p.parameter_name || "")],
    FALLBACK_PARAMS.find((p) => p.parameter_code === "deston_qc_cbd")
  );
  const ctcParam = resolveField(
    fields,
    [(p) => /ctc/i.test(p.parameter_code || p.parameter_name || "")],
    FALLBACK_PARAMS.find((p) => p.parameter_code === "deston_qc_ctc")
  );
  const destParam = resolveField(
    fields,
    [(p) => /destination/i.test(p.parameter_code || p.parameter_name || "")],
    FALLBACK_PARAMS.find((p) => p.parameter_code === "deston_qc_destination")
  );
  const remarksParam = resolveField(
    fields,
    [(p) => /remark/i.test(p.parameter_code || p.parameter_name || "")],
    FALLBACK_PARAMS.find((p) => p.parameter_code === "deston_qc_remarks")
  );
  const copyParam = resolveField(
    fields,
    [(p) => /copy_from|kiln bag/i.test(p.parameter_code || p.parameter_name || "")],
    FALLBACK_PARAMS.find((p) => p.parameter_code === "deston_copy_from_kiln_bag")
  );

  const [bags, setBags] = useState([]);
  const [kilnBags, setKilnBags] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [openBag, setOpenBag] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [savedBag, setSavedBag] = useState("");

  const loadBags = async () => {
    const [rows, kilnRows] = await Promise.all([
      fetchAcDestoningBagQc(),
      fetchAcKilnOutputBagQc()
    ]);
    setBags(rows || []);
    setKilnBags(kilnRows || []);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const bag of rows || []) {
        if (!next[bag.bag_code]) next[bag.bag_code] = valuesFromBag(bag, fields);
      }
      return next;
    });
    if ((rows || []).length && !openBag) setOpenBag(rows[0].bag_code);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadBags()
      .catch((e) => {
        if (!cancelled) setError(formatApiError(e, "Could not load destoning bags"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const setField = (bagCode, param, raw) => {
    if (!param) return;
    setDrafts((prev) => ({
      ...prev,
      [bagCode]: { ...(prev[bagCode] || emptyValues(fields)), [paramKey(param)]: raw }
    }));
    setSavedBag("");
  };

  const copyMetrics = (bag) => {
    const sourceCode = drafts[bag.bag_code]?.[paramKey(copyParam)] || bag.input_bag_codes?.[0] || "";
    const kiln = kilnBags.find((row) => row.bag_code === sourceCode);
    if (!kiln) {
      setError("Select a kiln bag with saved quality metrics first.");
      return;
    }
    setDrafts((prev) => ({
      ...prev,
      [bag.bag_code]: {
        ...(prev[bag.bag_code] || emptyValues(fields)),
        ...mapKilnValuesToDeston(kiln.values || {}),
        [paramKey(copyParam)]: sourceCode
      }
    }));
    setError("");
  };

  const handleCancel = (bag) => {
    setDrafts((prev) => ({ ...prev, [bag.bag_code]: valuesFromBag(bag, fields) }));
    setOpenBag("");
    setError("");
  };

  const handleSave = async (bag) => {
    if (saving || isQcSaved(bag)) return;
    const values = drafts[bag.bag_code] || {};
    const filled = Object.fromEntries(
      Object.entries(values).filter(([, value]) => String(value ?? "").trim() !== "")
    );
    setSaving(bag.bag_code);
    setError("");
    try {
      const saved = await saveAcDestoningBagQc({
        bag_code: bag.bag_code,
        values: filled,
        user_id: user?.username || user?.displayName || user?.email || undefined,
        copy_from_bag_code: filled[paramKey(copyParam)] || undefined
      });
      setBags((prev) =>
        prev.map((row) => (row.bag_code === bag.bag_code ? { ...row, ...saved } : row))
      );
      setDrafts((prev) => ({
        ...prev,
        [bag.bag_code]: { ...emptyValues(fields), deston_qc_destination: "In Stock", ...saved.values }
      }));
      setSavedBag(bag.bag_code);
    } catch (e) {
      setError(formatApiError(e, "Could not save destoning quality"));
    } finally {
      setSaving("");
    }
  };

  const inputClass = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white";

  const renderInput = (bagCode, param, extra = {}) => {
    if (!param) return null;
    const key = paramKey(param);
    const locked = Boolean(extra.readOnly || extra.disabled);
    return (
      <input
        className={`${inputClass}${locked ? " bg-slate-100 text-slate-600" : ""}`}
        style={{ color: "#0f172a" }}
        type={param.data_type === "number" ? "number" : extra.type || "text"}
        step={param.data_type === "number" ? "0.01" : undefined}
        placeholder={String(param.parameter_name || "").replace(/\s*\(kg\)/i, "")}
        value={drafts[bagCode]?.[key] ?? ""}
        onChange={(e) => setField(bagCode, param, e.target.value)}
        {...extra}
      />
    );
  };

  return (
    <div className="wf-light-panel rounded-xl border border-slate-200 p-4 space-y-4" style={{ color: "#0f172a" }}>
      <div className="text-sm font-semibold">Destoning — Bag Quality</div>
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      {savedBag ? (
        <p className="text-xs text-emerald-700">
          Saved {savedBag}. That bag now appears on the destination process loader.
        </p>
      ) : null}
      {loading ? <p className="text-sm text-slate-600">Loading destoning bags…</p> : null}
      {!loading && bags.length === 0 ? (
        <p className="text-sm text-slate-600">
          No DS bags yet. Create a tag on Destoning first — the same fields are shown below.
        </p>
      ) : null}

      {bags.length === 0 && !loading ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
          <p className="text-xs text-slate-500">All fields optional.</p>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-xs font-medium text-slate-600 min-w-[14rem] flex-1">
              Copy from Kiln Bag
              <select className={inputClass} disabled>
                <option>Select kiln bag</option>
              </select>
            </label>
            <button
              type="button"
              disabled
              className="rounded-md border border-slate-300 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400"
            >
              Copy quality metrics
            </button>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {MESH_LABELS.map((label) => (
              <label key={label} className="text-xs font-medium text-slate-600">
                {label}
                <input className={inputClass} disabled placeholder={label} />
              </label>
            ))}
            <label className="text-xs font-medium text-slate-600">
              cbd
              <input className={inputClass} disabled placeholder="cbd" />
            </label>
            <label className="text-xs font-medium text-slate-600">
              ctc
              <input className={inputClass} disabled placeholder="ctc" />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-slate-600 min-w-[10rem]">
              Destination
              <select className={inputClass} disabled>
                {DESTINATIONS.map((row) => (
                  <option key={row} value={row}>
                    {row}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600 flex-1 min-w-[12rem]">
              Remarks
              <input className={inputClass} disabled placeholder="Remarks" />
            </label>
          </div>
        </div>
      ) : null}

      {bags.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-[2rem_1.4fr_1.2fr_0.7fr_0.8fr] gap-2 px-2 pb-2 text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
            <span />
            <span>Bag created time</span>
            <span>DS bag no</span>
            <span>Weight</span>
            <span>Userid</span>
          </div>
          <div className="space-y-2">
            {bags.map((bag) => {
              const open = openBag === bag.bag_code;
              const draft = drafts[bag.bag_code] || {};
              const locked = isQcSaved(bag);
              return (
                <div key={bag.bag_code} className="rounded-lg border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    className="w-full grid grid-cols-[2rem_1.4fr_1.2fr_0.7fr_0.8fr] gap-2 items-center px-2 py-2 text-left"
                    onClick={() => setOpenBag(open ? "" : bag.bag_code)}
                  >
                    <span className="w-6 h-6 rounded-full border border-slate-400 text-slate-700 flex items-center justify-center text-sm">
                      {open ? "−" : "+"}
                    </span>
                    <span className="text-sm">{formatBagTime(bag.created_at)}</span>
                    <span className="text-sm font-mono">{bag.bag_code}</span>
                    <span className="text-sm font-mono">{formatWeight(bag.quantity_kg)}</span>
                    <span className="text-sm">{bag.user_id || "—"}</span>
                  </button>
                  {open ? (
                    <div className="px-3 pb-3 space-y-3">
                      <p className="text-xs text-slate-500">
                        {locked
                          ? "Saved. These values cannot be edited."
                          : "All fields optional."}
                      </p>
                      <div className="flex flex-wrap gap-2 items-end">
                        <label className="text-xs font-medium text-slate-600 min-w-[14rem] flex-1">
                          Copy from Kiln Bag
                          <select
                            className={`${inputClass}${locked ? " bg-slate-100 text-slate-600" : ""}`}
                            value={draft[paramKey(copyParam)] || bag.input_bag_codes?.[0] || ""}
                            onChange={(e) => setField(bag.bag_code, copyParam, e.target.value)}
                            disabled={locked}
                          >
                            <option value="">Select kiln bag</option>
                            {(bag.input_bag_codes?.length ? kilnBags.filter((row) => bag.input_bag_codes.includes(row.bag_code)) : kilnBags).map(
                              (row) => (
                                <option key={row.bag_code} value={row.bag_code}>
                                  {row.bag_code}
                                </option>
                              )
                            )}
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => copyMetrics(bag)}
                          disabled={locked}
                          className="rounded-md border border-slate-300 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 disabled:text-slate-400"
                        >
                          Copy quality metrics
                        </button>
                      </div>
                      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                        {meshParams.map((param) => (
                          <label key={paramKey(param)} className="text-xs font-medium text-slate-600">
                            {String(param.parameter_name || "").replace(/\s*\(kg\)/i, "")}
                            {renderInput(bag.bag_code, param, { disabled: locked, readOnly: locked })}
                          </label>
                        ))}
                        <label className="text-xs font-medium text-slate-600">
                          cbd
                          {renderInput(bag.bag_code, cbdParam, { disabled: locked, readOnly: locked })}
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          ctc
                          {renderInput(bag.bag_code, ctcParam, { disabled: locked, readOnly: locked })}
                        </label>
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="text-xs font-medium text-slate-600 min-w-[12rem]">
                          Next Destination
                          <select
                            className={`${inputClass}${locked ? " bg-slate-100 text-slate-600" : ""}`}
                            value={draft[paramKey(destParam)] || "In Stock"}
                            onChange={(e) => setField(bag.bag_code, destParam, e.target.value)}
                            disabled={locked}
                          >
                            {DESTINATIONS.map((row) => (
                              <option key={row} value={row}>
                                {row}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs font-medium text-slate-600 flex-1 min-w-[12rem]">
                          Remarks
                          {renderInput(bag.bag_code, remarksParam, { disabled: locked, readOnly: locked })}
                        </label>
                        {locked ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                            Saved
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCancel(bag)}
                              className="rounded-full border border-slate-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSave(bag)}
                              disabled={saving === bag.bag_code}
                              className="rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
                            >
                              {saving === bag.bag_code ? "Saving…" : "Save"}
                            </button>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">DS Bag: {bag.bag_code}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
