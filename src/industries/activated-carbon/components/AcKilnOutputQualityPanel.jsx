import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../auth/AuthContext";
import { formatApiError } from "../../../services/api";
import { fetchAcKilnOutputBagQc, saveAcKilnOutputBagQc } from "../../../services/activatedCarbonApi";
import AcAlert from "./AcAlert";

const MESH_LABELS = ["+3", "3/4", "4/8", "8/12", "12/30", "-30"];

const FALLBACK_PARAMS = [
  ...MESH_LABELS.map((label) => ({
    parameter_code: `kiln_out_${label.replace("+", "plus_").replace("-", "minus_").replace("/", "_")}_kg`,
    parameter_name: label,
    data_type: "number",
    unit: "KG"
  })),
  { parameter_code: "kiln_out_cbd", parameter_name: "cbd", data_type: "text" },
  { parameter_code: "kiln_out_ctc", parameter_name: "ctc", data_type: "text" },
  { parameter_code: "kiln_out_remarks", parameter_name: "Remarks", data_type: "text" }
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

function formatBagDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function isQcSaved(bag) {
  if (bag?.saved_at) return true;
  const qc = bag?.kiln_output_qc;
  if (qc?.saved_at) return true;
  const values = bag?.values || qc?.values || {};
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
  const saved = bag?.values || bag?.kiln_output_qc?.values || {};
  for (const param of fields) {
    const key = paramKey(param);
    if (saved[key] != null && saved[key] !== "") {
      initial[key] = String(saved[key]);
    }
  }
  return initial;
}

export default function AcKilnOutputQualityPanel({
  parameters = [],
  kilnCode = "",
  lot = null
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
    FALLBACK_PARAMS.find((p) => p.parameter_code === "kiln_out_cbd")
  );
  const ctcParam = resolveField(
    fields,
    [(p) => /ctc/i.test(p.parameter_code || p.parameter_name || "")],
    FALLBACK_PARAMS.find((p) => p.parameter_code === "kiln_out_ctc")
  );
  const remarksParam = resolveField(
    fields,
    [(p) => /remark/i.test(p.parameter_code || p.parameter_name || "")],
    FALLBACK_PARAMS.find((p) => p.parameter_code === "kiln_out_remarks")
  );

  const [bags, setBags] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [openBag, setOpenBag] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [savedBag, setSavedBag] = useState("");

  const loadBags = async () => {
    const rows = await fetchAcKilnOutputBagQc();
    setBags(rows || []);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const bag of rows || []) {
        if (!next[bag.bag_code]) {
          next[bag.bag_code] = valuesFromBag(bag, fields);
        }
      }
      return next;
    });
    if ((rows || []).length && !openBag) {
      setOpenBag(rows[0].bag_code);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadBags()
      .catch((e) => {
        if (!cancelled) setError(formatApiError(e, "Could not load kiln output bags"));
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
    const values = drafts[bag.bag_code] || {};
    const filled = Object.fromEntries(
      Object.entries(values).filter(([, value]) => String(value ?? "").trim() !== "")
    );
    setSaving(bag.bag_code);
    setError("");
    try {
      const saved = await saveAcKilnOutputBagQc({
        bag_code: bag.bag_code,
        kiln_resource_code: bag.kiln_resource_code || kilnCode || undefined,
        values: filled,
        user_id: user?.username || user?.displayName || user?.email || undefined,
        lot_code: lot?.lot_code || lot?.lot_id || bag.lot_code || undefined
      });
      setBags((prev) =>
        prev.map((row) =>
          row.bag_code === bag.bag_code
            ? { ...row, ...saved, user_id: saved.user_id || row.user_id }
            : row
        )
      );
      setDrafts((prev) => ({
        ...prev,
        [bag.bag_code]: { ...emptyValues(fields), ...saved.values }
      }));
      setSavedBag(bag.bag_code);
    } catch (e) {
      setError(formatApiError(e, "Could not save kiln output quality"));
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

  const renderReadOnly = (value) => (
    <div className={`${inputClass} bg-slate-100 text-slate-700`}>{value || "—"}</div>
  );

  const renderFields = (bag, { locked = false, preview = false } = {}) => {
    const bagCode = preview ? "_preview" : bag.bag_code;
    return (
    <div className="px-3 pb-3 space-y-3">
      <p className="text-xs text-slate-500">
        {locked ? "Saved. These values cannot be edited." : "All quality fields optional. Date comes from the bag."}
      </p>
      <div className="grid grid-cols-2 gap-3 max-w-xl">
        <label className="text-xs font-medium text-slate-600">
          Date
          {renderReadOnly(preview ? "—" : formatBagDate(bag?.created_at))}
        </label>
        <label className="text-xs font-medium text-slate-600">
          Bag
          {renderReadOnly(preview ? "—" : bag?.bag_code)}
        </label>
      </div>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {meshParams.map((param) => (
          <label key={paramKey(param)} className="text-xs font-medium text-slate-600">
            {String(param.parameter_name || "").replace(/\s*\(kg\)/i, "")}
            {renderInput(bagCode, param, { disabled: locked, readOnly: locked })}
          </label>
        ))}
        <label className="text-xs font-medium text-slate-600">
          cbd
          {renderInput(bagCode, cbdParam, { disabled: locked, readOnly: locked })}
        </label>
        <label className="text-xs font-medium text-slate-600">
          ctc
          {renderInput(bagCode, ctcParam, { disabled: locked, readOnly: locked })}
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-600 flex-1 min-w-[12rem]">
          Remarks
          {renderInput(bagCode, remarksParam, { disabled: locked, readOnly: locked })}
        </label>
      </div>
    </div>
    );
  };

  return (
    <div className="wf-light-panel rounded-xl border border-slate-200 p-4 space-y-4" style={{ color: "#0f172a" }}>
      <div className="text-sm font-semibold">Kiln output — Bag Quality</div>
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      {savedBag ? (
        <p className="text-xs text-emerald-700">
          Saved on {savedBag}. Values are captured on the kiln output bag subject.
        </p>
      ) : null}
      {loading ? <p className="text-sm text-slate-600">Loading kiln output bags…</p> : null}
      {!loading && bags.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">No kiln output bags yet. Add weight on the Kiln Feed tab first.</p>
          {renderFields(null, { preview: true })}
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
                <div key={bag.bag_code} className="rounded-lg border border-slate-200 bg-slate-50">
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
                    <span className="text-sm font-mono">{formatWeight(bag.quantity_kg)}</span>
                    <span className="text-sm">{bag.user_id || "—"}</span>
                  </button>
                  {open ? (
                    <div>
                      {renderFields(bag, { locked })}
                      <div className="px-3 pb-3 flex flex-wrap items-center gap-3">
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
                        <div className="text-xs text-slate-500">Kiln bag: {bag.bag_code}</div>
                      </div>
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
