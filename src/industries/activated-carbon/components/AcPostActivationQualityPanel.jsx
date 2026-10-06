import { useEffect, useState } from "react";

import { useAuth } from "../../../auth/AuthContext";
import { formatApiError } from "../../../services/api";
import {
  fetchAcPostActivationQuality,
  saveAcPostActivationQuality
} from "../../../services/activatedCarbonApi";
import AcAlert from "./AcAlert";

const MESH_FIELDS = [
  { key: "post_qc_plus_3_kg", label: "+3" },
  { key: "post_qc_3x4_kg", label: "3x4" },
  { key: "post_qc_4x8_kg", label: "4x8" },
  { key: "post_qc_8x12_kg", label: "8x12" },
  { key: "post_qc_12x30_kg", label: "12x30" },
  { key: "post_qc_minus_30_kg", label: "-30" },
  { key: "post_qc_mbd", label: "MBD" },
  { key: "post_qc_cbd", label: "CBD" },
  { key: "post_qc_ctc", label: "CTC" }
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

function emptyValues() {
  const values = { post_qc_remarks: "", post_qc_destination: "In Stock" };
  for (const field of MESH_FIELDS) values[field.key] = "";
  return values;
}

function valuesFromBag(bag) {
  const next = emptyValues();
  const saved = bag?.values || {};
  for (const key of Object.keys(next)) {
    if (saved[key] != null && saved[key] !== "") next[key] = String(saved[key]);
  }
  if (!next.post_qc_destination) next.post_qc_destination = "In Stock";
  return next;
}

function isQcSaved(bag) {
  return Boolean(bag?.saved_at);
}

function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export default function AcPostActivationQualityPanel() {
  const { user } = useAuth() || {};
  const [sections, setSections] = useState([]);
  const [openProcess, setOpenProcess] = useState("screening");
  const [openBag, setOpenBag] = useState("");
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [savedBag, setSavedBag] = useState("");

  const load = async () => {
    const data = await fetchAcPostActivationQuality();
    const rows = data?.sections || [];
    setSections(rows);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const section of rows) {
        for (const bag of section.bags || []) {
          const id = `${section.process}:${bag.bag_code}`;
          if (!next[id]) next[id] = valuesFromBag(bag);
        }
      }
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .catch((e) => {
        if (!cancelled) setError(formatApiError(e, "Could not load quality bags"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveBag = async (process, bag) => {
    if (saving) return;
    const id = `${process}:${bag.bag_code}`;
    setSaving(id);
    setError("");
    try {
      const saved = await saveAcPostActivationQuality({
        process,
        bag_code: bag.bag_code,
        values: drafts[id] || emptyValues(),
        user_id: user?.sub || user?.username || undefined
      });
      setSavedBag(saved.bag_code);
      await load();
    } catch (e) {
      setError(formatApiError(e, "Could not save quality"));
    } finally {
      setSaving("");
    }
  };

  return (
    <section
      className="wf-light-panel rounded-xl border border-slate-200 bg-white p-4 space-y-3"
      style={{ color: "#0f172a", background: "#ffffff" }}
    >
      <div className="text-sm font-semibold">Quality</div>
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      {savedBag ? (
        <p className="text-xs text-emerald-700">
          Saved {savedBag}. That bag now appears on the destination process loader.
        </p>
      ) : null}
      {loading ? <p className="text-sm text-slate-500">Loading quality bags…</p> : null}

      <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
        {sections.map((section) => {
          const open = openProcess === section.process;
          return (
            <div key={section.process} className="bg-white">
              <button
                type="button"
                onClick={() => setOpenProcess(open ? "" : section.process)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold">{section.process_label}</span>
                <span className="text-xs text-slate-500">
                  {section.bags.length} {open ? "▴" : "▾"}
                </span>
              </button>
              {open ? (
                <div className="px-4 pb-4">
                  {section.bags.length === 0 ? (
                    <p className="text-sm text-slate-500">No output bags yet for this process.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-slate-500">
                            <th className="py-2 pr-3 font-medium">Bag No</th>
                            <th className="py-2 pr-3 font-medium">Weight (kg)</th>
                            <th className="py-2 pr-3 font-medium">Grade</th>
                            <th className="py-2 font-medium">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.bags.map((bag) => {
                            const id = `${section.process}:${bag.bag_code}`;
                            const expanded = openBag === id;
                            const locked = isQcSaved(bag);
                            const draft = drafts[id] || valuesFromBag(bag);
                            return (
                              <tr key={bag.bag_code} className="border-t border-slate-100 align-top">
                                <td colSpan={4} className="py-2">
                                  <button
                                    type="button"
                                    onClick={() => setOpenBag(expanded ? "" : id)}
                                    className="w-full grid grid-cols-4 gap-3 text-left px-1"
                                  >
                                    <span className="font-mono font-semibold">
                                      {expanded ? "▾ " : "▸ "}
                                      {bag.bag_code}
                                    </span>
                                    <span className="tabular-nums">{Number(bag.quantity_kg || 0).toFixed(2)}</span>
                                    <span>{bag.grade || "—"}</span>
                                    <span className="text-slate-500">{formatWhen(bag.created_at)}</span>
                                  </button>
                                  {expanded ? (
                                    <div className="mt-3 rounded-lg border border-slate-200 p-3 space-y-3 bg-slate-50">
                                      <p className="text-[11px] text-slate-500">
                                        Enter quality metrics and choose next destination
                                      </p>
                                      <div className="grid grid-cols-3 md:grid-cols-9 gap-2">
                                        {MESH_FIELDS.map((field) => (
                                          <label key={field.key} className="block">
                                            <span className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                                              {field.label}
                                            </span>
                                            <input
                                              type="text"
                                              disabled={locked || Boolean(saving)}
                                              value={draft[field.key] || ""}
                                              onChange={(e) =>
                                                setDrafts((prev) => ({
                                                  ...prev,
                                                  [id]: { ...draft, [field.key]: e.target.value }
                                                }))
                                              }
                                              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
                                            />
                                          </label>
                                        ))}
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <label className="md:col-span-2 block">
                                          <span className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                                            Remarks
                                          </span>
                                          <input
                                            type="text"
                                            disabled={locked || Boolean(saving)}
                                            value={draft.post_qc_remarks || ""}
                                            onChange={(e) =>
                                              setDrafts((prev) => ({
                                                ...prev,
                                                [id]: { ...draft, post_qc_remarks: e.target.value }
                                              }))
                                            }
                                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
                                          />
                                        </label>
                                        <label className="block">
                                          <span className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                                            Next Destination
                                          </span>
                                          <select
                                            disabled={locked || Boolean(saving)}
                                            value={draft.post_qc_destination || "In Stock"}
                                            onChange={(e) =>
                                              setDrafts((prev) => ({
                                                ...prev,
                                                [id]: { ...draft, post_qc_destination: e.target.value }
                                              }))
                                            }
                                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
                                          >
                                            {DESTINATIONS.map((option) => (
                                              <option key={option} value={option}>
                                                {option}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      </div>
                                      <div className="flex justify-end">
                                        <button
                                          type="button"
                                          disabled={locked || saving === id}
                                          onClick={() => saveBag(section.process, bag)}
                                          className="rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
                                        >
                                          {locked ? "Saved" : saving === id ? "Saving…" : "SAVE"}
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
