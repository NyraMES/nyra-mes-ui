import { useEffect, useState } from "react";

import { useAuth } from "../../../auth/AuthContext";
import { formatApiError } from "../../../services/api";
import { fetchAcDestoningBagQc, saveAcDestoningBagQc } from "../../../services/activatedCarbonApi";
import AcAlert from "./AcAlert";

function isQcSaved(bag) {
  if (bag?.saved_at) return true;
  const qc = bag?.destoning_qc;
  if (qc?.saved_at) return true;
  const values = bag?.values || qc?.values || {};
  const stones = String(values.deston_qc_stones || "").trim().toLowerCase();
  return stones === "yes" || stones === "no";
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

function stonesValue(bag) {
  const saved = bag?.values || bag?.destoning_qc?.values || {};
  return String(saved.deston_qc_stones || "").trim().toLowerCase();
}

function remarksValue(bag) {
  const saved = bag?.values || bag?.destoning_qc?.values || {};
  return String(saved.deston_qc_remarks || "");
}

function destinationLabel(stones) {
  return stones === "yes" ? "Destoning" : "Screening";
}

function savedRouteMessage(bagCode, stones) {
  if (stones === "yes") {
    return `Saved ${bagCode}. Stones are present — this bag returns to destoning Load bag.`;
  }
  return `Saved ${bagCode}. No stones — this bag moves to Screening.`;
}

export default function AcDestoningQualityPanel({ refreshToken = 0 } = {}) {
  const { user } = useAuth();
  const [bags, setBags] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [openBag, setOpenBag] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const loadBags = async () => {
    const rows = await fetchAcDestoningBagQc();
    setBags(rows || []);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const bag of rows || []) {
        if (!next[bag.bag_code]) {
          next[bag.bag_code] = {
            deston_qc_stones: stonesValue(bag),
            deston_qc_remarks: remarksValue(bag)
          };
        }
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

  const setField = (bagCode, key, raw) => {
    setDrafts((prev) => ({
      ...prev,
      [bagCode]: { ...(prev[bagCode] || {}), [key]: raw }
    }));
    setSavedMessage("");
  };

  const handleCancel = (bag) => {
    setDrafts((prev) => ({
      ...prev,
      [bag.bag_code]: {
        deston_qc_stones: stonesValue(bag),
        deston_qc_remarks: remarksValue(bag)
      }
    }));
    setOpenBag("");
    setError("");
  };

  const handleSave = async (bag) => {
    if (saving || isQcSaved(bag)) return;
    const draft = drafts[bag.bag_code] || {};
    const stones = String(draft.deston_qc_stones || "").trim().toLowerCase();
    if (stones !== "yes" && stones !== "no") {
      setError("Say whether stones are present.");
      return;
    }
    const values = {
      deston_qc_stones: stones,
      deston_qc_destination: destinationLabel(stones)
    };
    if (String(draft.deston_qc_remarks || "").trim()) {
      values.deston_qc_remarks = String(draft.deston_qc_remarks).trim();
    }
    setSaving(bag.bag_code);
    setError("");
    try {
      const saved = await saveAcDestoningBagQc({
        bag_code: bag.bag_code,
        values,
        user_id: user?.username || user?.displayName || user?.email || undefined
      });
      setBags((prev) =>
        prev.map((row) => (row.bag_code === bag.bag_code ? { ...row, ...saved } : row))
      );
      const savedStones = String(saved?.values?.deston_qc_stones || stones).toLowerCase();
      setDrafts((prev) => ({
        ...prev,
        [bag.bag_code]: {
          deston_qc_stones: savedStones,
          deston_qc_remarks: String(saved?.values?.deston_qc_remarks || values.deston_qc_remarks || "")
        }
      }));
      setSavedMessage(savedRouteMessage(bag.bag_code, savedStones));
    } catch (e) {
      setError(formatApiError(e, "Could not save destoning quality"));
    } finally {
      setSaving("");
    }
  };

  const inputClass = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white";

  return (
    <div className="wf-light-panel rounded-xl border border-slate-200 p-4 space-y-4" style={{ color: "#0f172a" }}>
      <div className="text-sm font-semibold">Destoning — Bag Quality</div>
      <p className="text-xs text-slate-500">
        Check whether stones are still in the bag. If stones are present, the bag goes back to destoning.
        If not, it moves to Screening. In Stock is set later in post-activation.
      </p>
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      {savedMessage ? <p className="text-xs text-emerald-700">{savedMessage}</p> : null}
      {loading ? <p className="text-sm text-slate-600">Loading destoning bags…</p> : null}
      {!loading && bags.length === 0 ? (
        <p className="text-sm text-slate-600">No DS bags yet. Create a tag on Destoning first.</p>
      ) : null}

      {bags.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-[2rem_1.4fr_1.2fr_1fr_0.7fr_0.8fr] gap-2 px-2 pb-2 text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
            <span />
            <span>Bag created time</span>
            <span>DS bag no</span>
            <span>Work order</span>
            <span>Weight</span>
            <span>Userid</span>
          </div>
          <div className="space-y-2">
            {bags.map((bag) => {
              const open = openBag === bag.bag_code;
              const draft = drafts[bag.bag_code] || {};
              const locked = isQcSaved(bag);
              const stones = String(draft.deston_qc_stones || "").toLowerCase();
              return (
                <div key={bag.bag_code} className="rounded-lg border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    className="w-full grid grid-cols-[2rem_1.4fr_1.2fr_1fr_0.7fr_0.8fr] gap-2 items-center px-2 py-2 text-left"
                    onClick={() => setOpenBag(open ? "" : bag.bag_code)}
                  >
                    <span className="w-6 h-6 rounded-full border border-slate-400 text-slate-700 flex items-center justify-center text-sm">
                      {open ? "−" : "+"}
                    </span>
                    <span className="text-sm">{formatBagTime(bag.created_at)}</span>
                    <span className="text-sm font-mono">{bag.bag_code}</span>
                    <span className="text-sm font-mono">
                      {bag.work_order_code || "—"}
                      {bag.work_order_ctc ? ` · CTC ${bag.work_order_ctc}` : ""}
                    </span>
                    <span className="text-sm font-mono">{formatWeight(bag.quantity_kg)}</span>
                    <span className="text-sm">{bag.user_id || "—"}</span>
                  </button>
                  {open ? (
                    <div className="px-3 pb-3 space-y-3">
                      <p className="text-xs text-slate-500">
                        {locked
                          ? stones === "yes"
                            ? "Saved. Stones were present — this bag went back to destoning."
                            : "Saved. No stones — this bag moved to Screening."
                          : "Are stones still in this bag?"}
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="text-xs font-medium text-slate-600 min-w-[16rem]">
                          Stones present?
                          <select
                            className={`${inputClass}${locked ? " bg-slate-100 text-slate-600" : ""}`}
                            value={stones}
                            onChange={(e) => setField(bag.bag_code, "deston_qc_stones", e.target.value)}
                            disabled={locked}
                          >
                            <option value="">Select</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                        <label className="text-xs font-medium text-slate-600 flex-1 min-w-[12rem]">
                          Remarks
                          <input
                            className={`${inputClass}${locked ? " bg-slate-100 text-slate-600" : ""}`}
                            value={draft.deston_qc_remarks || ""}
                            onChange={(e) => setField(bag.bag_code, "deston_qc_remarks", e.target.value)}
                            disabled={locked}
                            readOnly={locked}
                            placeholder="Remarks"
                          />
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
