import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../auth/AuthContext";
import { formatApiError } from "../../../services/api";
import { fetchAcInwardBags, saveAcKilnFeedBagQc } from "../../../services/activatedCarbonApi";
import { isAcKilnFeedOutwardBag } from "../constants/processSteps";
import AcAlert from "./AcAlert";
import useAcPersonLabel from "../hooks/useAcPersonLabel";

const MESH_LABELS = ["+2", "2/3", "3/6", "6/8", "8/10", "10/12", "12/14", "-14"];

const FALLBACK_PARAMS = [
  { parameter_code: "feed_qc_date", parameter_name: "Date", data_type: "text" },
  { parameter_code: "feed_qc_grade", parameter_name: "Grade", data_type: "text" },
  ...MESH_LABELS.map((label) => ({
    parameter_code: `kfqc_${label.replace("+", "plus_").replace("-", "minus_").replace("/", "_")}_kg`,
    parameter_name: label,
    data_type: "number",
    unit: "KG"
  })),
  { parameter_code: "feed_moisture_pct", parameter_name: "Moisture", data_type: "number", unit: "%" },
  { parameter_code: "feed_dust_pct", parameter_name: "Dust", data_type: "number", unit: "%" },
  { parameter_code: "feed_volatile_pct", parameter_name: "Volatile", data_type: "number", unit: "%" },
  { parameter_code: "kfqc_remarks", parameter_name: "Remarks", data_type: "text" }
];

function paramKey(param) {
  return param.parameter_code || param.parameter_id || param.parameter_name;
}

function matchParam(parameters, testers) {
  return parameters.find((p) => testers.some((fn) => fn(p))) || null;
}

function meshSlug(label) {
  return label.replace("+", "plus_").replace("-", "minus_").replace("/", "_");
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

function formatBagDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function isQcSaved(bag) {
  const qc = bag?.kiln_feed_qc;
  if (!qc || typeof qc !== "object") return false;
  if (qc.saved_at) return true;
  const values = qc.values || {};
  return Object.values(values).some((value) => String(value ?? "").trim() !== "");
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
  const saved = bag?.kiln_feed_qc?.values || {};
  for (const param of fields) {
    const key = paramKey(param);
    if (saved[key] != null && saved[key] !== "") {
      initial[key] = String(saved[key]);
    }
  }
  if (!initial.feed_qc_grade && bag?.grade) {
    initial.feed_qc_grade = bag.grade;
  }
  if (!initial.feed_qc_date && bag?.created_at) {
    initial.feed_qc_date = formatBagDate(bag.created_at);
  }
  return initial;
}

function resolveField(fields, testers, fallback) {
  return matchParam(fields, testers) || fallback || null;
}

export default function AcKilnFeedQualityPanel({
  parameters = [],
  lot = null
}) {
  const { user } = useAuth() || {};
  const person = useAcPersonLabel();
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
  const dateParam = resolveField(fields, [
    (p) => /date/i.test(p.parameter_code || ""),
    (p) => /date/i.test(p.parameter_name || "")
  ]);
  const gradeParam = resolveField(fields, [
    (p) => /grade/i.test(p.parameter_code || ""),
    (p) => /grade/i.test(p.parameter_name || "")
  ]);
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
  const moistureParam = resolveField(
    fields,
    [(p) => /moisture/i.test(p.parameter_code || p.parameter_name || "")],
    FALLBACK_PARAMS.find((p) => p.parameter_code === "feed_moisture_pct")
  );
  const dustParam = resolveField(
    fields,
    [(p) => /dust/i.test(p.parameter_code || p.parameter_name || "")],
    FALLBACK_PARAMS.find((p) => p.parameter_code === "feed_dust_pct")
  );
  const volatileParam = resolveField(
    fields,
    [(p) => /volatile/i.test(p.parameter_code || p.parameter_name || "")],
    FALLBACK_PARAMS.find((p) => p.parameter_code === "feed_volatile_pct")
  );
  const remarksParam = resolveField(
    fields,
    [(p) => /remark/i.test(p.parameter_code || p.parameter_name || "")],
    FALLBACK_PARAMS.find((p) => p.parameter_code === "kfqc_remarks")
  );

  const [bags, setBags] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [openBag, setOpenBag] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [savedBag, setSavedBag] = useState("");

  const loadBags = async () => {
    const rows = await fetchAcInwardBags();
    const outward = (rows || []).filter((bag) => Boolean(bag.grade) && isAcKilnFeedOutwardBag(bag));
    setBags(outward);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const bag of outward) {
        if (!next[bag.bag_code]) {
          next[bag.bag_code] = valuesFromBag(bag, fields);
        }
      }
      return next;
    });
    if (outward.length && !openBag) {
      setOpenBag(outward[0].bag_code);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadBags()
      .catch((e) => {
        if (!cancelled) setError(formatApiError(e, "Could not load GRN bags"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = (bagCode, param, raw) => {
    if (!param) return;
    setDrafts((prev) => ({
      ...prev,
      [bagCode]: { ...(prev[bagCode] || emptyValues(fields)), [paramKey(param)]: raw }
    }));
    setSavedBag("");
  };

  const handleCancel = (bag) => {
    setDrafts((prev) => ({
      ...prev,
      [bag.bag_code]: valuesFromBag(bag, fields)
    }));
    setOpenBag("");
    setError("");
  };

  const handleSave = async (bag) => {
    if (saving || isQcSaved(bag)) return;
    const values = { ...(drafts[bag.bag_code] || {}) };
    if (dateParam) values[paramKey(dateParam)] = formatBagDate(bag.created_at);
    if (gradeParam) values[paramKey(gradeParam)] = bag.grade || values[paramKey(gradeParam)] || "";
    const filled = Object.fromEntries(
      Object.entries(values).filter(([, value]) => String(value ?? "").trim() !== "")
    );
    setSaving(bag.bag_code);
    setError("");
    try {
      const saved = await saveAcKilnFeedBagQc({
        bag_code: bag.bag_code,
        customer_order_id: bag.customer_order_id,
        values: filled,
        user_id: user?.username || user?.displayName || user?.email || undefined,
        lot_code: lot?.lot_code || lot?.lot_id || undefined
      });
      setBags((prev) =>
        prev.map((row) =>
          row.bag_code === bag.bag_code
            ? {
                ...row,
                kiln_feed_qc: { values: saved.values, user_id: saved.user_id, saved_at: saved.saved_at },
                created_by: saved.user_id || row.created_by
              }
            : row
        )
      );
      setDrafts((prev) => ({
        ...prev,
        [bag.bag_code]: { ...emptyValues(fields), ...saved.values }
      }));
      setSavedBag(bag.bag_code);
    } catch (e) {
      setError(formatApiError(e, "Could not save kiln feed quality"));
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
        placeholder={param.parameter_name}
        value={drafts[bagCode]?.[key] ?? ""}
        onChange={(e) => setField(bagCode, param, e.target.value)}
        {...extra}
      />
    );
  };

  const renderReadOnly = (value) => (
    <div className={`${inputClass} bg-slate-100 text-slate-700`}>
      {value || "—"}
    </div>
  );

  return (
    <div className="wf-light-panel rounded-xl border border-slate-200 p-4 space-y-4" style={{ color: "#0f172a" }}>
      <div className="text-sm font-semibold">Kiln feed — Bag Quality</div>
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      {savedBag ? (
        <p className="text-xs text-emerald-700">
          Saved on {savedBag}. Values are captured on the GRN bag.
        </p>
      ) : null}
      {loading ? <p className="text-sm text-slate-600">Loading GRN bags…</p> : null}
      {!loading && bags.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">No GRN bags yet. Finish GRN on Raw Material first.</p>
          <p className="text-xs text-slate-500">Fields to enter (optional):</p>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {meshParams.map((param) => (
              <label key={paramKey(param)} className="text-xs font-medium text-slate-600">
                {String(param.parameter_name || "").replace(/\s*\(kg\)/i, "")}
                {renderInput("_preview", param)}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-xl">
            <label className="text-xs font-medium text-slate-600">
              Moisture
              {renderInput("_preview", moistureParam)}
            </label>
            <label className="text-xs font-medium text-slate-600">
              Dust
              {renderInput("_preview", dustParam)}
            </label>
            <label className="text-xs font-medium text-slate-600">
              Volatile
              {renderInput("_preview", volatileParam)}
            </label>
          </div>
        </div>
      ) : null}

      {bags.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-[2rem_1.4fr_1.2fr_0.7fr_0.8fr] gap-2 px-2 pb-2 text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
            <span />
            <span>Bag created time</span>
            <span>Bag no</span>
            <span>Weight</span>
            <span>Userid</span>
          </div>
          <div className="space-y-2">
            {bags.map((bag) => {
              const open = openBag === bag.bag_code;
              const locked = isQcSaved(bag);
              return (
                <div key={bag.bag_id || bag.bag_code} className="rounded-lg border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    className="w-full grid grid-cols-[2rem_1.4fr_1.2fr_0.7fr_0.8fr] gap-2 items-center px-2 py-2 text-left"
                    onClick={() => setOpenBag(open ? "" : bag.bag_code)}
                  >
                    <span
                      className="w-6 h-6 rounded-full border border-slate-400 text-slate-700 flex items-center justify-center text-sm"
                      aria-hidden
                    >
                      {open ? "−" : "+"}
                    </span>
                    <span className="text-sm">{formatBagTime(bag.created_at)}</span>
                    <span className="text-sm font-mono">{bag.bag_code}</span>
                    <span className="text-sm font-mono">{formatWeight(bag.weight_kg)}</span>
                    <span className="text-sm">
                      {person(bag.created_by || bag.kiln_feed_qc?.user_id) || "—"}
                    </span>
                  </button>

                  {open ? (
                    <div className="px-3 pb-3 space-y-3">
                      <p className="text-xs text-slate-500">
                        {locked
                          ? "Saved. These values cannot be edited."
                          : "All quality fields optional. Date and grade come from the bag."}
                      </p>
                      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                        {meshParams.map((param) => (
                          <label key={paramKey(param)} className="text-xs font-medium text-slate-600">
                            {String(param.parameter_name || "").replace(/\s*\(kg\)/i, "")}
                            {renderInput(bag.bag_code, param, { disabled: locked, readOnly: locked })}
                          </label>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-3 max-w-xl">
                        <label className="text-xs font-medium text-slate-600">
                          Moisture
                          {renderInput(bag.bag_code, moistureParam, { disabled: locked, readOnly: locked })}
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Dust
                          {renderInput(bag.bag_code, dustParam, { disabled: locked, readOnly: locked })}
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Volatile
                          {renderInput(bag.bag_code, volatileParam, { disabled: locked, readOnly: locked })}
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-3 max-w-xl">
                        <label className="text-xs font-medium text-slate-600">
                          Date
                          {renderReadOnly(formatBagDate(bag.created_at))}
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Grade
                          {renderReadOnly(bag.grade)}
                        </label>
                      </div>

                      <div className="flex flex-wrap items-end gap-3">
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
                      <div className="text-xs text-slate-500">GRN bag: {bag.bag_code}</div>
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
