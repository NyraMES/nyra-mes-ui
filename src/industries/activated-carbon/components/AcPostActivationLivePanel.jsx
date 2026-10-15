import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { formatApiError } from "../../../services/api";
import {
  createAcPostActivationOutputBag,
  fetchAcMeshGradeMap,
  fetchAcPostActivationState,
  loadAcPostActivationBag,
  unloadAcPostActivationBag
} from "../../../services/activatedCarbonApi";
import { KILN_LIVE_WINDOW_HOURS, parseKilnFeedEvents } from "../utils/acKilnLoaderUtils";
import useBusyGuard from "../hooks/useBusyGuard";
import AcAlert from "./AcAlert";
import AcKilnCumulativeChart from "./AcKilnCumulativeChart";

const LIVE_TICK_MS = 15_000;

const CRUSHING_GRADES = ["2/3", "3/4", "4/6", "6/10", "10/12", "12/14", "-14"];
const EXKLIN_GRADE = "Exklin";
const EXKLIN_ONLY_PROCESSES = new Set(["dedusting", "demagnetisation"]);

function gradesForProcess(processKey, meshGrades = []) {
  if (processKey === "screening_after_destoning") return [];
  if (processKey === "screening") return meshGrades;
  if (processKey === "crushing") return CRUSHING_GRADES;
  if (EXKLIN_ONLY_PROCESSES.has(processKey)) return [EXKLIN_GRADE];
  return [];
}

function formatKg(value) {
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toFixed(2)} kg` : "0.00 kg";
}

function formatKgRange(kg) {
  const n = Number(kg);
  if (!Number.isFinite(n) || n <= 0) return "0 - 0.00 kg";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} - ${n.toFixed(2)} kg`;
}

function waitingBagDetail(bag) {
  return [
    formatKg(bag.quantity_kg),
    bag.mesh ? `Mesh ${bag.mesh}` : "",
    bag.grade || "",
    bag.work_order_code || "",
    bag.work_order_ctc ? `CTC ${bag.work_order_ctc}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function AcPostActivationLivePanel({ processKey, lot = null, canRun = true }) {
  const [state, setState] = useState(null);
  const [outputKg, setOutputKg] = useState("");
  const [grade, setGrade] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [picking, setPicking] = useState(false);
  const [meshConfigs, setMeshConfigs] = useState([]);
  const [selectedMesh, setSelectedMesh] = useState("");
  const { busy: saving, run: runBusy } = useBusyGuard();
  const [creatingId, setCreatingId] = useState("");
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isScreening = processKey === "screening";
  const isGradeBoard = isScreening || processKey === "crushing";
  const isExklinOnly = EXKLIN_ONLY_PROCESSES.has(processKey);
  const meshGrades = useMemo(() => {
    if (!isScreening || !selectedMesh) return [];
    const cfg = meshConfigs.find((row) => String(row.code || "").toUpperCase() === selectedMesh.toUpperCase());
    return Array.isArray(cfg?.grades) ? cfg.grades : [];
  }, [isScreening, meshConfigs, selectedMesh]);
  const gradeOptions = gradesForProcess(processKey, meshGrades);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), LIVE_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const refreshState = () =>
    fetchAcPostActivationState(processKey).then((row) => {
      setState(row);
      if (row?.selected_mesh) setSelectedMesh(row.selected_mesh);
      return row;
    });

  useEffect(() => {
    if (!processKey) return undefined;
    setDrafts([]);
    setSelectedMesh("");
    setGrade(EXKLIN_ONLY_PROCESSES.has(processKey) ? EXKLIN_GRADE : "");
    setOutputKg("");
    let cancelled = false;
    refreshState().catch((e) => {
      if (!cancelled) setError(formatApiError(e, "Could not load post-activation"));
    });
    return () => {
      cancelled = true;
    };
  }, [processKey]);

  useEffect(() => {
    if (!picking || !processKey) return undefined;
    let cancelled = false;
    refreshState().catch((e) => {
      if (!cancelled) setError(formatApiError(e, "Could not load post-activation"));
    });
    return () => {
      cancelled = true;
    };
  }, [picking, processKey]);

  useEffect(() => {
    if (!isScreening) return undefined;
    let cancelled = false;
    fetchAcMeshGradeMap()
      .then((data) => {
        if (!cancelled) setMeshConfigs(data?.configurations || []);
      })
      .catch(() => {
        if (!cancelled) setMeshConfigs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isScreening]);

  const run = (fn) =>
    runBusy(async () => {
      setError("");
      try {
        setState(await fn());
        return true;
      } catch (e) {
        setError(formatApiError(e, "Post-activation update failed"));
        return false;
      }
    });

  const label = state?.process_label || "Post activation";
  const available = state?.available || [];
  const loaded = state?.loaded || [];
  const loadedKg = Number(state?.loaded_kg || 0);
  const remainingKg = Number(state?.remaining_kg ?? Math.max(0, loadedKg - Number(state?.output_kg || 0)));
  const workOrderCode = state?.work_order_code || loaded.find((row) => row.work_order_code)?.work_order_code || "";
  const workOrderCtc =
    state?.work_order_ctc || loaded.find((row) => row.work_order_ctc)?.work_order_ctc || "";
  const capacity = state?.loader_capacity || 6;
  const outputBags = state?.output_bags || [];
  const outputKgTotal = outputBags.reduce((sum, bag) => sum + (Number(bag.quantity_kg) || 0), 0);
  const gradeOptional = processKey === "screening_after_destoning";
  const canCreate =
    loaded.length > 0 &&
    Number(outputKg) > 0 &&
    Number(outputKg) <= remainingKg + 0.001 &&
    (gradeOptional || grade.trim()) &&
    !saving;

  const events = useMemo(() => {
    const raw = (state?.load_events || []).map((row) => ({
      lot_code: row.lot_code,
      bag_code: row.bag_code,
      kg: row.kg,
      loaded_at: row.loaded_at
    }));
    return parseKilnFeedEvents(raw);
  }, [state]);

  const cumulativeKg = events.reduce((sum, ev) => sum + (Number(ev.kg) || 0), 0);

  const meshLocked = isScreening && loaded.length > 0 && Boolean(selectedMesh);

  const handleLoadBag = async (bag) => {
    if (!canRun) return;
    if (isScreening && !selectedMesh) {
      setError("Choose a mesh before loading a bag.");
      return;
    }
    await run(() => loadAcPostActivationBag(processKey, bag.bag_code, isScreening ? selectedMesh : undefined));
  };

  const loadedChips = loaded.length > 0 ? (
    <div className="mb-3 flex flex-wrap gap-2">
      {loaded.map((bag) => (
        <span
          key={bag.bag_code}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs"
        >
          <span className="font-mono">{bag.bag_code}</span>
          <span className="text-slate-500">{waitingBagDetail(bag)}</span>
          <button
            type="button"
            disabled={saving}
            onClick={() => run(() => unloadAcPostActivationBag(processKey, bag.bag_code))}
            className="text-slate-500 hover:text-slate-800"
          >
            Unload
          </button>
        </span>
      ))}
    </div>
  ) : null;

  const addDraft = (nextGrade) => {
    setDrafts((prev) => [
      ...prev,
      { id: `${nextGrade}-${Date.now()}-${prev.length}`, grade: nextGrade, kg: "" }
    ]);
  };

  const createTag = async (draft) => {
    if (!canRun) return;
    const kg = Number(draft.kg);
    if (!draft.grade || !(kg > 0) || saving) return;
    if (isScreening && !selectedMesh) {
      setError("Choose a mesh configuration, then enter the grade for that mesh.");
      return;
    }
    if (kg > remainingKg + 0.001) {
      setError(`Output cannot exceed loaded. Remaining: ${remainingKg.toFixed(2)} kg.`);
      return;
    }
    setCreatingId(draft.id);
    const ok = await run(() =>
      createAcPostActivationOutputBag(processKey, {
        quantity_kg: kg,
        grade: draft.grade,
        mesh: isScreening ? selectedMesh : undefined,
        lot_code: lot?.lot_code || lot?.lot_id || undefined
      })
    );
    setCreatingId("");
    if (ok) {
      setDrafts((prev) => prev.filter((row) => row.id !== draft.id));
    }
  };

  if (isGradeBoard) {
    return (
      <section
        className="wf-light-panel rounded-xl border border-slate-200 bg-white p-4 space-y-4"
        style={{ color: "#0f172a", background: "#ffffff" }}
      >
        <div className="text-sm font-semibold">{label} — Machine</div>
        {error ? <AcAlert variant="error">{error}</AcAlert> : null}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col min-h-[28rem]">
            {isScreening ? (
              <label className="block mb-3">
                <span className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                  Mesh
                </span>
                <select
                  value={selectedMesh}
                  disabled={meshLocked || saving}
                  onChange={(e) => {
                    setSelectedMesh(e.target.value);
                    setDrafts([]);
                  }}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
                >
                  <option value="">Choose mesh</option>
                  {meshConfigs.map((row) => (
                    <option key={row.code} value={row.code}>
                      Mesh {row.code}
                      {Array.isArray(row.grades) && row.grades.length ? ` · ${row.grades.join(", ")}` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {meshLocked
                    ? "Mesh stays until the loader is empty."
                    : "Choose a mesh before loading a bag."}
                </p>
              </label>
            ) : null}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold">{label} Loader</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Loaded: {loaded.length} bags / {loadedKg.toFixed(1)} kg
                </p>
                {workOrderCode ? (
                  <p className="text-xs text-slate-600 mt-1">
                    {workOrderCode}
                    {workOrderCtc ? ` · CTC ${workOrderCtc}` : ""}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setPicking(true)}
                disabled={!canRun || saving || loaded.length >= capacity || (isScreening && !selectedMesh)}
                className="shrink-0 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
              >
                {saving ? "Loading…" : "Load bag"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3 text-xs">
              <span className="rounded-full border border-slate-200 px-3 py-1">In: {loadedKg.toFixed(2)} kg</span>
              <span className="rounded-full border border-slate-200 px-3 py-1">Out: {outputKgTotal.toFixed(2)} kg</span>
              <span className="rounded-full bg-blue-600 text-white px-3 py-1">
                Remaining: {remainingKg.toFixed(2)} kg
              </span>
            </div>
            {loadedChips}
            <div className="mb-3">
              <AcKilnCumulativeChart events={events} nowMs={nowMs} windowHours={KILN_LIVE_WINDOW_HOURS} />
            </div>
            <div className="mt-auto">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Output Grade Settings</p>
                <button
                  type="button"
                  onClick={() => setDrafts([])}
                  className="text-[11px] font-bold uppercase tracking-wide text-slate-500"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {isScreening && !selectedMesh ? (
                  <p className="text-sm text-slate-500">Choose a mesh to see its grades.</p>
                ) : (
                  gradeOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => addDraft(option)}
                      disabled={isScreening && !selectedMesh}
                      className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold hover:bg-blue-50 hover:border-blue-400 disabled:opacity-50"
                    >
                      {option}
                    </button>
                  ))
                )}
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col min-h-[28rem]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold">Machine Output</h3>
              <span className="text-xs text-slate-500">Σ {outputKgTotal.toFixed(1)} kg</span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Output Grades</p>
            <div className="space-y-2 mb-4">
              {drafts.length === 0 ? (
                <p className="text-sm text-slate-500">Select a grade from the loader to add a row.</p>
              ) : (
                drafts.map((draft) => (
                  <div key={draft.id} className="flex items-center gap-2">
                    <span className="min-w-[4.5rem] rounded-md border border-slate-200 px-2 py-1.5 text-sm font-semibold">
                      {draft.grade}
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={draft.kg}
                      onChange={(e) =>
                        setDrafts((prev) =>
                          prev.map((row) => (row.id === draft.id ? { ...row, kg: e.target.value } : row))
                        )
                      }
                      placeholder="wt"
                      className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <span className="text-xs text-slate-500">kg</span>
                    <button
                      type="button"
                      disabled={
                        saving ||
                        loaded.length === 0 ||
                        !(Number(draft.kg) > 0) ||
                        Number(draft.kg) > remainingKg + 0.001 ||
                        (isScreening && !selectedMesh)
                      }
                      onClick={() => createTag(draft)}
                      className="rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-3 py-1.5"
                    >
                      {creatingId === draft.id ? "…" : "Tag"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrafts((prev) => prev.filter((row) => row.id !== draft.id))}
                      className="text-slate-400 hover:text-slate-700 text-sm"
                      aria-label="Remove row"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Today</p>
            <div className="flex-1 overflow-y-auto space-y-2">
              {outputBags.length === 0 ? (
                <p className="text-sm text-slate-500">Tags saved today appear here.</p>
              ) : (
                outputBags
                  .slice()
                  .reverse()
                  .map((bag) => (
                    <div
                      key={bag.bag_code}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-semibold truncate">{bag.bag_code}</div>
                        <div className="text-xs text-slate-500">
                          {Number(bag.quantity_kg).toFixed(1)} kg
                          {bag.mesh ? ` · Mesh ${bag.mesh}` : ""}
                          {bag.grade ? ` · ${bag.grade}` : ""}
                          {bag.work_order_code ? ` · ${bag.work_order_code}` : ""}
                          {bag.work_order_ctc ? ` · CTC ${bag.work_order_ctc}` : ""}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </article>
        </div>

        {picking
          ? createPortal(
              <div
                role="dialog"
                aria-modal="true"
                onClick={() => !saving && setPicking(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 400,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                  background: "rgba(2, 6, 23, 0.82)"
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    maxWidth: 520,
                    borderRadius: 16,
                    padding: 20,
                    background: "#ffffff",
                    color: "#0f172a",
                    boxShadow: "0 24px 48px rgba(0, 0, 0, 0.35)",
                    border: "1px solid #e2e8f0"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>Load bag</div>
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                        Bags that can be loaded on {label}
                        {isScreening && selectedMesh ? ` · Mesh ${selectedMesh}` : ""}.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPicking(false)}
                      style={{
                        color: "#1d4ed8",
                        background: "transparent",
                        border: 0,
                        textDecoration: "underline",
                        fontSize: 14,
                        cursor: "pointer"
                      }}
                    >
                      Close
                    </button>
                  </div>
                  {loaded.length > 0 ? (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>On the loader</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {loaded.map((bag) => (
                          <span
                            key={bag.bag_code}
                            style={{
                              border: "1px solid #cbd5e1",
                              borderRadius: 999,
                              padding: "4px 10px",
                              fontSize: 12,
                              fontFamily: "ui-monospace, Menlo, monospace"
                            }}
                          >
                            {bag.bag_code}
                            {bag.quantity_kg != null ? ` · ${formatKg(bag.quantity_kg)}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {available.length === 0 ? (
                    <div style={{ fontSize: 14, color: "#475569" }}>
                      No bags are waiting for {label}. In Quality, set Next Destination to {label}.
                    </div>
                  ) : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 320, overflowY: "auto" }}>
                      {available.map((bag) => (
                        <li key={bag.bag_code} style={{ marginBottom: 8 }}>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleLoadBag(bag)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              borderRadius: 10,
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              color: "#0f172a",
                              padding: "10px 12px",
                              cursor: saving ? "wait" : "pointer"
                            }}
                          >
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                fontFamily: "ui-monospace, Menlo, monospace"
                              }}
                            >
                              {bag.bag_code}
                            </div>
                            <div style={{ fontSize: 12, color: "#334155", marginTop: 2 }}>
                              {formatKg(bag.quantity_kg)}
                              {bag.work_order_code ? ` · ${bag.work_order_code}` : ""}
                              {bag.work_order_ctc ? ` · CTC ${bag.work_order_ctc}` : ""}
                              {bag.grade ? ` · ${bag.grade}` : ""}
                              {bag.order_code || lot?.order_code
                                ? ` · ${bag.order_code || lot.order_code}`
                                : ""}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>,
              document.body
            )
          : null}
      </section>
    );
  }

  return (
    <section
      className="wf-light-panel rounded-xl border border-slate-200 bg-white p-4 space-y-4"
      style={{ color: "#0f172a", background: "#ffffff" }}
    >
      <div className="text-sm font-medium">{label} Load / Unload</div>

      {error ? <AcAlert variant="error">{error}</AcAlert> : null}

      <article className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
          <div>
            <h3 className="text-base font-semibold">{label} — Loader</h3>
            <p className="text-sm tabular-nums mt-1" style={{ color: "#475569" }}>
              {formatKgRange(cumulativeKg || loadedKg)}
            </p>
            {workOrderCode ? (
              <p className="text-xs text-slate-600 mt-1">
                {workOrderCode}
                {workOrderCtc ? ` · CTC ${workOrderCtc}` : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setPicking(true)}
            disabled={saving || loaded.length >= capacity}
            className="shrink-0 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
          >
            {saving ? "Loading…" : "Load bag"}
          </button>
        </div>

        <div className="px-4 pb-3">
          <AcKilnCumulativeChart events={events} nowMs={nowMs} windowHours={KILN_LIVE_WINDOW_HOURS} />
        </div>

        {loadedChips ? <div className="px-4 pb-3">{loadedChips}</div> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-4">
          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
              <p className="text-sm font-semibold mb-2">{label} output</p>
              <div className="flex flex-col gap-2">
                {isExklinOnly ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold">
                    Grade: {EXKLIN_GRADE}
                  </p>
                ) : (
                  <input
                    type="text"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder={
                      processKey === "screening_after_destoning"
                        ? "Ungraded until GR mesh mapping"
                        : "Grade"
                    }
                    disabled={saving}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                )}
                <p className="text-xs text-slate-500">Remaining: {remainingKg.toFixed(2)} kg</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={outputKg}
                    onChange={(e) => setOutputKg(e.target.value)}
                    placeholder="Weight (kg)"
                    disabled={saving}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                  <button
                    type="button"
                    disabled={!canCreate}
                    onClick={() =>
                      run(() =>
                        createAcPostActivationOutputBag(processKey, {
                          quantity_kg: Number(outputKg),
                          grade: isExklinOnly
                            ? EXKLIN_GRADE
                            : grade.trim() || (processKey === "screening_after_destoning" ? "Ungraded" : ""),
                          lot_code: lot?.lot_code || lot?.lot_id || undefined
                        })
                      ).then((ok) => {
                        if (ok) {
                          setOutputKg("");
                          if (!isExklinOnly) setGrade("");
                        }
                      })
                    }
                    className="rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2"
                  >
                    {saving ? "Adding…" : "Add"}
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
              <p className="text-sm font-semibold mb-2">Counters — output</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-slate-200 px-3 py-1">
                  No. of bags: {outputBags.length}
                </span>
                <span className="rounded-full bg-blue-600 text-white px-3 py-1">
                  Weight: {outputKgTotal.toFixed(2)} kg
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
            <p className="text-sm font-semibold mb-2">Today</p>
            {outputBags.length === 0 ? (
              <p className="text-xs text-slate-500">Tags saved today appear here.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1 pr-2 font-medium">Label</th>
                      <th className="py-1 pr-2 font-medium">Work order</th>
                      <th className="py-1 pr-2 font-medium">Grade</th>
                      <th className="py-1 font-medium">Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outputBags
                      .slice()
                      .reverse()
                      .map((bag) => (
                        <tr key={bag.bag_code} className="border-t border-slate-100">
                          <td className="py-1.5 pr-2">
                            <span className="inline-flex rounded-full border border-slate-200 px-2 py-0.5 font-mono">
                              {bag.bag_code}
                            </span>
                          </td>
                          <td className="py-1.5 pr-2 font-mono">
                            {bag.work_order_code || "—"}
                            {bag.work_order_ctc ? ` · CTC ${bag.work_order_ctc}` : ""}
                          </td>
                          <td className="py-1.5 pr-2">{bag.grade || "—"}</td>
                          <td className="py-1.5 tabular-nums">{Number(bag.quantity_kg).toFixed(2)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </article>

      {picking
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              onClick={() => !saving && setPicking(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 400,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                background: "rgba(2, 6, 23, 0.82)"
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  maxWidth: 520,
                  borderRadius: 16,
                  padding: 20,
                  background: "#ffffff",
                  color: "#0f172a",
                  boxShadow: "0 24px 48px rgba(0, 0, 0, 0.35)",
                  border: "1px solid #e2e8f0"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>Load bag</div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                      Bags that can be loaded on {label}.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPicking(false)}
                    style={{
                      color: "#1d4ed8",
                      background: "transparent",
                      border: 0,
                      textDecoration: "underline",
                      fontSize: 14,
                      cursor: "pointer"
                    }}
                  >
                    Close
                  </button>
                </div>
                {loaded.length > 0 ? (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>On the loader</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {loaded.map((bag) => (
                        <span
                          key={bag.bag_code}
                          style={{
                            border: "1px solid #cbd5e1",
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 12,
                            fontFamily: "ui-monospace, Menlo, monospace"
                          }}
                        >
                          {bag.bag_code}
                          {bag.quantity_kg != null ? ` · ${formatKg(bag.quantity_kg)}` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {available.length === 0 ? (
                  <div style={{ fontSize: 14, color: "#475569" }}>
                    No bags are waiting for {label}. In Quality, set Next Destination to {label}.
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 320, overflowY: "auto" }}>
                    {available.map((bag) => (
                      <li key={bag.bag_code} style={{ marginBottom: 8 }}>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleLoadBag(bag)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            borderRadius: 10,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            color: "#0f172a",
                            padding: "10px 12px",
                            cursor: saving ? "wait" : "pointer"
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              fontFamily: "ui-monospace, Menlo, monospace"
                            }}
                          >
                            {bag.bag_code}
                          </div>
                          <div style={{ fontSize: 12, color: "#334155", marginTop: 2 }}>
                            {formatKg(bag.quantity_kg)}
                            {bag.work_order_code ? ` · ${bag.work_order_code}` : ""}
                            {bag.work_order_ctc ? ` · CTC ${bag.work_order_ctc}` : ""}
                            {bag.grade ? ` · ${bag.grade}` : ""}
                            {bag.order_code || lot?.order_code
                              ? ` · ${bag.order_code || lot.order_code}`
                              : ""}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
