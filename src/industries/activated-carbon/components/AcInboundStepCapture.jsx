import { useEffect, useMemo, useState } from "react";

import {
  completeAcInboundExecutionStep,
  createAcInwardBag,
  deleteAcInwardBag,
  feedAcInwardBagToCrusher,
  fetchAcInboundAdmin,
  fetchAcInwardBags,
  formatAcApiError,
  reconcileAcInwardBags
} from "../../../services/activatedCarbonApi";
import {
  AC_CRUSHER_MESH_PCT_FIELDS,
  AC_LAB_INBOUND_PARAMETERS,
  inboundProcessParameters
} from "../constants/processSteps";
import AcAlert from "./AcAlert";
import AcFormSelect from "./AcFormSelect";
import AcSaveBar from "./AcSaveBar";

function numberOrEmpty(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function AcInboundStepCapture({
  selected,
  nextStepMeta,
  materialType,
  onCompleted
}) {
  const code = String(nextStepMeta?.operation_code || "").toUpperCase();
  if (code === "IN-RMS-BAG") {
    return <RmsBagStep selected={selected} nextStepMeta={nextStepMeta} onCompleted={onCompleted} />;
  }
  if (code === "IN-CRUSHER") {
    return (
      <CrusherStep selected={selected} nextStepMeta={nextStepMeta} onCompleted={onCompleted} />
    );
  }
  if (code === "IN-RM-OUT") {
    return (
      <OutwardStep selected={selected} nextStepMeta={nextStepMeta} onCompleted={onCompleted} />
    );
  }
  return (
    <GenericLabStep
      selected={selected}
      nextStepMeta={nextStepMeta}
      materialType={materialType}
      onCompleted={onCompleted}
    />
  );
}

function GenericLabStep({ selected, nextStepMeta, materialType, onCompleted }) {
  const code = String(nextStepMeta?.operation_code || "").toUpperCase();
  const bound = inboundProcessParameters(
    materialType,
    nextStepMeta?.process_step,
    nextStepMeta?.operation_code
  );
  const fields = code === "IN-LAB" ? bound.filter((p) =>
    AC_LAB_INBOUND_PARAMETERS.some((lab) => lab.key === p.key)
  ).concat(
    AC_LAB_INBOUND_PARAMETERS.filter((lab) => !bound.some((p) => p.key === lab.key))
  ) : bound.length ? bound : AC_LAB_INBOUND_PARAMETERS;
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const init = {};
    for (const p of fields) init[p.key] = p.default_value ?? "";
    setValues(init);
  }, [nextStepMeta?.operation_code, fields.length]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const parameters = {};
      for (const p of fields) {
        const raw = values[p.key];
        if (raw === "" || raw == null) continue;
        parameters[p.key] = raw;
      }
      const saved = await completeAcInboundExecutionStep({
        customer_order_id: selected.customer_order_id,
        process_step: nextStepMeta.process_step,
        operation_code: nextStepMeta.operation_code,
        parameters
      });
      onCompleted(saved);
    } catch (e) {
      setError(formatAcApiError(e, "Could not save inbound step"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wf-light-panel rounded-xl p-4 max-w-2xl border border-blue-200">
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {fields.map((p) => (
          <label key={p.key} className="text-sm block">
            <span className="block mb-1 font-medium text-slate-700">
              {p.label}
              {p.unit ? ` (${p.unit})` : ""}
            </span>
            {p.key === "qc_decision" ? (
              <select
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={values[p.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
              >
                <option value="">Select…</option>
                <option value="approve">Approve</option>
                <option value="deny">Deny</option>
              </select>
            ) : (
              <input
                className="w-full rounded border border-slate-300 px-3 py-2"
                type={p.unit === "%" || p.unit === "KG" ? "number" : "text"}
                step={p.unit === "%" ? "0.01" : "any"}
                value={values[p.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
              />
            )}
          </label>
        ))}
      </div>
      <AcSaveBar onSave={handleSave} saving={saving} saveLabel="Save & complete Lab" />
    </div>
  );
}

function RmsBagStep({ selected, nextStepMeta, onCompleted }) {
  const [bags, setBags] = useState([]);
  const [weight, setWeight] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ourKg = numberOrEmpty(selected.our_weight_kg ?? selected.quantity);
  const bagTotal = bags.reduce((sum, b) => sum + numberOrEmpty(b.weight_kg), 0);
  const remaining = Math.round((ourKg - bagTotal) * 1000) / 1000;
  const shortfall = remaining > 0.01;
  const overrun = remaining < -0.01;

  const reloadBags = async () => {
    const rows = await fetchAcInwardBags(selected.order_code);
    setBags(rows.filter((b) => !b.grade));
  };

  useEffect(() => {
    reloadBags().catch((e) => setError(formatAcApiError(e, "Could not load bags")));
  }, [selected.customer_order_id]);

  const addBag = async () => {
    const kg = Number(weight);
    if (!kg || kg <= 0) return;
    setSaving(true);
    setError("");
    try {
      await createAcInwardBag({
        customer_order_id: selected.customer_order_id,
        weight_kg: kg
      });
      setWeight("");
      await reloadBags();
    } catch (e) {
      setError(formatAcApiError(e, "Could not create bag"));
    } finally {
      setSaving(false);
    }
  };

  const removeBag = async (bagId) => {
    setSaving(true);
    setError("");
    try {
      await deleteAcInwardBag(selected.customer_order_id, bagId);
      await reloadBags();
    } catch (e) {
      setError(formatAcApiError(e, "Could not remove bag"));
    } finally {
      setSaving(false);
    }
  };

  const complete = async () => {
    if (overrun) {
      setError("Bag total cannot exceed inward weight.");
      return;
    }
    if (shortfall && !remarks.trim()) {
      setError("Bag total is less than inward weight — enter remarks.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await reconcileAcInwardBags({
        customer_order_id: selected.customer_order_id,
        variance_comment: remarks.trim() || undefined
      });
      const saved = await completeAcInboundExecutionStep({
        customer_order_id: selected.customer_order_id,
        process_step: nextStepMeta.process_step,
        operation_code: nextStepMeta.operation_code,
        parameters: {
          bag_count: bags.length,
          bag_total_kg: bagTotal,
          variance_comment: remarks.trim() || undefined
        }
      });
      onCompleted(saved);
    } catch (e) {
      setError(formatAcApiError(e, "Could not complete RMS inward"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wf-light-panel rounded-xl p-4 max-w-2xl border border-blue-200 space-y-3">
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      <p className="text-sm text-slate-700">
        Bag numbers are created automatically. Our weight is{" "}
        <strong>{ourKg} KG</strong>. Bag total{" "}
        <strong>{bagTotal} KG</strong>. Remaining{" "}
        <strong className={!shortfall && !overrun ? "text-emerald-700" : "text-amber-700"}>
          {remaining} KG
        </strong>
        {shortfall ? " — enter remarks, then Complete RMS inward." : "."}
      </p>
      <div className="flex gap-2 items-end">
        <label className="text-sm flex-1">
          <span className="block mb-1 font-medium text-slate-700">Bag weight (KG)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
        <button type="button" className="wf-btn wf-btn-primary" onClick={addBag} disabled={saving}>
          Add bag
        </button>
      </div>
      <ul className="text-sm space-y-1">
        {bags.map((bag) => (
          <li key={bag.bag_id} className="flex justify-between gap-3">
            <span className="font-mono">
              {bag.bag_code} · {numberOrEmpty(bag.weight_kg)} KG
            </span>
            <button type="button" className="text-red-700 underline" onClick={() => removeBag(bag.bag_id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <label className="text-sm block">
        <span className="block mb-1 font-medium text-slate-700">
          Remarks{shortfall ? " *" : ""}
        </span>
        <textarea
          className="w-full rounded border border-slate-300 px-3 py-2"
          rows={2}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder={
            shortfall
              ? "Required — why bag total is less than our weight"
              : "Optional remarks"
          }
        />
      </label>
      <AcSaveBar
        onSave={complete}
        saving={saving}
        saveLabel="Complete RMS inward"
        disabled={bags.length === 0 || overrun}
      />
    </div>
  );
}

function emptyMeshPct() {
  return Object.fromEntries(AC_CRUSHER_MESH_PCT_FIELDS.map((f) => [f.key, ""]));
}

function CrusherStep({ selected, nextStepMeta, onCompleted }) {
  const [bags, setBags] = useState([]);
  const [rotaries, setRotaries] = useState([]);
  const [rotary, setRotary] = useState("");
  const [dust, setDust] = useState("");
  const [moisture, setMoisture] = useState("");
  const [meshPct, setMeshPct] = useState(emptyMeshPct);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    const [bagRows, admin] = await Promise.all([
      fetchAcInwardBags(selected.order_code),
      fetchAcInboundAdmin().catch(() => ({ rotaries: [] }))
    ]);
    setBags(bagRows.filter((b) => !b.grade));
    setRotaries(admin.rotaries || []);
  };

  useEffect(() => {
    reload().catch((e) => setError(formatAcApiError(e, "Could not load crusher data")));
  }, [selected.customer_order_id]);

  useEffect(() => {
    if (!rotary && rotaries[0]?.name) setRotary(rotaries[0].name);
  }, [rotaries, rotary]);

  const complete = async () => {
    if (!rotary) {
      setError("Select a rotary.");
      return;
    }
    if (dust === "" || moisture === "") {
      setError("Enter moisture (%) and dust (%).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const pending = bags.filter(
        (b) => String(b.status || "").toUpperCase() !== "FED_TO_CRUSHER"
      );
      for (const bag of pending) {
        await feedAcInwardBagToCrusher({
          customer_order_id: selected.customer_order_id,
          bag_id: bag.bag_id
        });
      }
      const saved = await completeAcInboundExecutionStep({
        customer_order_id: selected.customer_order_id,
        process_step: nextStepMeta.process_step,
        operation_code: nextStepMeta.operation_code,
        parameters: {
          rotary,
          dust_pct: dust,
          moisture_pct: moisture,
          dust_generation_pct: dust,
          moisture_after_crush_pct: moisture,
          ...Object.fromEntries(Object.entries(meshPct).filter(([, value]) => value !== ""))
        }
      });
      onCompleted(saved);
    } catch (e) {
      setError(formatAcApiError(e, "Could not save crusher performance"));
      await reload().catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wf-light-panel rounded-xl p-4 max-w-3xl border border-blue-200 space-y-3">
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      <p className="text-sm text-slate-700">
        Enter rotary, mesh shares (%), dust, and moisture.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-sm">
          <span className="block mb-1 font-medium">Inward Number</span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 bg-slate-50"
            value={selected.order_code || ""}
            readOnly
          />
        </label>
        <AcFormSelect label="Rotary *" value={rotary} onChange={(e) => setRotary(e.target.value)}>
          <option value="">Select rotary…</option>
          {rotaries.map((r) => (
            <option key={r.code} value={r.name}>
              {r.name}
            </option>
          ))}
        </AcFormSelect>
        {AC_CRUSHER_MESH_PCT_FIELDS.map((field) => (
          <label key={field.key} className="text-sm">
            <span className="block mb-1 font-medium">{field.label}</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={meshPct[field.key]}
              onChange={(e) =>
                setMeshPct((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
            />
          </label>
        ))}
        <label className="text-sm">
          <span className="block mb-1 font-medium">Moisture</span>
          <input
            type="number"
            step="0.01"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={moisture}
            onChange={(e) => setMoisture(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="block mb-1 font-medium">Dust</span>
          <input
            type="number"
            step="0.01"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={dust}
            onChange={(e) => setDust(e.target.value)}
          />
        </label>
      </div>
      <AcSaveBar
        onSave={complete}
        saving={saving}
        saveLabel="Save crusher performance"
        disabled={!rotary || dust === "" || moisture === ""}
      />
    </div>
  );
}

function OutwardStep({ selected, nextStepMeta, onCompleted }) {
  const [grades, setGrades] = useState([]);
  const [weights, setWeights] = useState({});
  const [bags, setBags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    const [admin, rows] = await Promise.all([
      fetchAcInboundAdmin(),
      fetchAcInwardBags(selected.order_code)
    ]);
    const splits = admin.outward_splits || [];
    setGrades(splits);
    setWeights((prev) => {
      const next = { ...prev };
      for (const row of splits) {
        if (next[row.label] == null) next[row.label] = "";
      }
      return next;
    });
    setBags(rows.filter((b) => Boolean(b.grade)));
  };

  useEffect(() => {
    reload().catch((e) => setError(formatAcApiError(e, "Could not load RM outward")));
  }, [selected.customer_order_id]);

  const addBag = async (gradeLabel) => {
    const kg = Number(weights[gradeLabel]);
    if (!gradeLabel || !kg || kg <= 0) return;
    setSaving(true);
    setError("");
    try {
      await createAcInwardBag({
        customer_order_id: selected.customer_order_id,
        weight_kg: kg,
        grade: gradeLabel,
        label: gradeLabel
      });
      setWeights((prev) => ({ ...prev, [gradeLabel]: "" }));
      await reload();
    } catch (e) {
      setError(formatAcApiError(e, "Could not create outward bag"));
    } finally {
      setSaving(false);
    }
  };

  const removeBag = async (bagId) => {
    setSaving(true);
    setError("");
    try {
      await deleteAcInwardBag(selected.customer_order_id, bagId);
      await reload();
    } catch (e) {
      setError(formatAcApiError(e, "Could not remove bag"));
    } finally {
      setSaving(false);
    }
  };

  const bagsByGrade = (label) => bags.filter((b) => b.grade === label);
  const allGradesHaveBags =
    grades.length > 0 && grades.every((row) => bagsByGrade(row.label).length > 0);

  const complete = async () => {
    if (!allGradesHaveBags) {
      setError("Add a bag for every grade.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const outward_splits = bags.map((bag) => ({
        grade_label: bag.grade,
        quantity_kg: numberOrEmpty(bag.weight_kg),
        bag_code: bag.bag_code
      }));
      const saved = await completeAcInboundExecutionStep({
        customer_order_id: selected.customer_order_id,
        process_step: nextStepMeta.process_step,
        operation_code: nextStepMeta.operation_code,
        parameters: { outward_splits }
      });
      onCompleted(saved);
    } catch (e) {
      setError(formatAcApiError(e, "Could not finish RM outward"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wf-light-panel rounded-xl p-4 max-w-2xl border border-blue-200 space-y-3">
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      <p className="text-sm text-slate-700">
        Every grade is mandatory. Enter weight and add a bag on each line. Bag numbers are assigned
        automatically.
      </p>
      <div className="space-y-3">
        {grades.map((row) => {
          const gradeBags = bagsByGrade(row.label);
          return (
            <div key={row.key} className="rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="text-sm font-medium text-slate-800 flex-1 min-w-[12rem]">
                  {row.label} *
                </div>
                <label className="text-sm min-w-[8rem]">
                  <span className="block mb-1 font-medium text-slate-700">Weight (kg) *</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={weights[row.label] ?? ""}
                    onChange={(e) =>
                      setWeights((prev) => ({ ...prev, [row.label]: e.target.value }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="wf-btn wf-btn-primary"
                  onClick={() => addBag(row.label)}
                  disabled={saving || !(Number(weights[row.label]) > 0)}
                >
                  Add bag
                </button>
              </div>
              <ul className="text-sm space-y-1">
                {gradeBags.map((bag) => (
                  <li key={bag.bag_id} className="flex justify-between gap-3">
                    <span className="font-mono">
                      {bag.bag_code} · {numberOrEmpty(bag.weight_kg)} KG
                    </span>
                    <button
                      type="button"
                      className="text-red-700 underline"
                      onClick={() => removeBag(bag.bag_id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <AcSaveBar
        onSave={complete}
        saving={saving}
        saveLabel="Finish outward"
        disabled={!allGradesHaveBags}
      />
    </div>
  );
}
