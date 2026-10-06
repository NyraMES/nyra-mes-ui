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
  AC_RM_OUTWARD_GRADES,
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
    if (saving) return;
    const decision = String(values.qc_decision || "").toLowerCase();
    const remarks = String(values.qc_remarks || "").trim();
    if (code === "IN-LAB" && !decision) {
      setError("Select approve or deny.");
      return;
    }
    if (code === "IN-LAB" && decision === "deny" && !remarks) {
      setError("Enter remarks for deny. This inward will stop and will not continue to RMS or other steps.");
      return;
    }
    if (saving) return;
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
            ) : p.key === "qc_remarks" ? (
              <textarea
                className="w-full rounded border border-slate-300 px-3 py-2"
                rows={3}
                value={values[p.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
                placeholder={
                  String(values.qc_decision || "").toLowerCase() === "deny"
                    ? "Required — why this inward is denied"
                    : "Optional remarks"
                }
              />
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
      <AcSaveBar
        onSave={handleSave}
        saving={saving}
        saveLabel={
          String(values.qc_decision || "").toLowerCase() === "deny"
            ? "Deny and stop this inward"
            : "Save & complete Lab"
        }
      />
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
    if (saving) return;
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
    if (saving) return;
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
    if (saving) return;
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
        {shortfall ? " — enter remarks, then Load to Crusher." : "."}
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
      {bags.length > 0 ? (
        <AcSaveBar
          onSave={complete}
          saving={saving}
          saveLabel="Load to Crusher"
          disabled={overrun}
        />
      ) : null}
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
    if (saving) return;
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

function bagRotaryName(bag) {
  return String(bag?.rotary || "").trim();
}

function bagGradeName(bag) {
  return String(bag?.grade || "").trim();
}

function OutwardStep({ selected, nextStepMeta, onCompleted }) {
  const [rotaries, setRotaries] = useState([]);
  const [rotary, setRotary] = useState("");
  const [weights, setWeights] = useState({});
  const [bags, setBags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ourKg = numberOrEmpty(
    selected.our_weight_kg ?? selected.inward_quantity_kg ?? selected.quantity
  );
  const bagTotal = bags.reduce((sum, bag) => sum + numberOrEmpty(bag.weight_kg), 0);
  const remaining = Math.round((ourKg - bagTotal) * 1000) / 1000;
  const overrun = remaining < -0.001;

  const reload = async () => {
    const [admin, rows] = await Promise.all([
      fetchAcInboundAdmin(),
      fetchAcInwardBags(selected.order_code)
    ]);
    setRotaries(admin.rotaries || []);
    setBags(rows.filter((b) => Boolean(b.grade)));
  };

  useEffect(() => {
    reload().catch((e) => setError(formatAcApiError(e, "Could not load RMS outward")));
  }, [selected.customer_order_id]);

  useEffect(() => {
    if (!rotary && rotaries[0]?.name) setRotary(rotaries[0].name);
  }, [rotaries, rotary]);

  const addBag = async (gradeLabel) => {
    const key = `${rotary}||${gradeLabel}`;
    const kg = Number(weights[key]);
    if (!rotary || !gradeLabel || !kg || kg <= 0) return;
    if (ourKg > 0 && bagTotal + kg > ourKg + 0.001) {
      setError(
        `RMS outward total cannot exceed inward weight ${ourKg} KG. ${remaining} KG remaining.`
      );
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await createAcInwardBag({
        customer_order_id: selected.customer_order_id,
        weight_kg: kg,
        grade: gradeLabel,
        rotary,
        label: `${gradeLabel} · ${rotary}`
      });
      setWeights((prev) => ({ ...prev, [key]: "" }));
      await reload();
    } catch (e) {
      setError(formatAcApiError(e, "Could not create outward bag"));
    } finally {
      setSaving(false);
    }
  };

  const removeBag = async (bagId) => {
    if (saving) return;
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

  const bagsFor = (rotaryName, gradeLabel) =>
    bags.filter(
      (b) => bagRotaryName(b) === rotaryName && bagGradeName(b) === gradeLabel
    );

  const rotaryReady = (rotaryName) => {
    if (!rotaryName) return false;
    const hasValue = AC_RM_OUTWARD_GRADES.filter(
      (grade) => grade.key !== "unburnt" && grade.key !== "stones"
    ).some((grade) => bagsFor(rotaryName, grade.label).length > 0);
    const hasUnburnt = bagsFor(rotaryName, "Unburnt").length > 0;
    const hasStones = bagsFor(rotaryName, "Stones").length > 0;
    return hasValue && hasUnburnt && hasStones;
  };
  const oneRotaryReady = rotaries.some((row) => rotaryReady(row.name));

  const complete = async () => {
    if (!oneRotaryReady) {
      setError(
        "Choose Rotary A or Rotary B and add a grade value plus Stones and Unburnt on that rotary."
      );
      return;
    }
    if (ourKg > 0 && bagTotal > ourKg + 0.001) {
      setError(`RMS outward total ${bagTotal} KG cannot exceed inward weight ${ourKg} KG.`);
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const outward_splits = bags.map((bag) => ({
        grade_label: bagGradeName(bag),
        rotary: bagRotaryName(bag),
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
      setError(formatAcApiError(e, "Could not finish RMS outward"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wf-light-panel rounded-xl p-4 max-w-2xl border border-blue-200 space-y-3">
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      <p className="text-sm text-slate-700">
        RMS outward bags are crusher output, ready for Release to Production. Choose Rotary A or
        Rotary B. That rotary needs a grade value plus Stones and Unburnt. The other rotary is not
        required. Total RO kg cannot exceed inward weight.
      </p>
      <p className={`text-sm ${overrun ? "text-red-700" : "text-slate-700"}`}>
        Inward{" "}
        <span className="font-mono font-medium">{ourKg || "—"}</span> KG · RO bags{" "}
        <span className="font-mono font-medium">{bagTotal}</span> KG · remaining{" "}
        <span className="font-mono font-semibold">{remaining}</span> KG
      </p>
      <AcFormSelect label="Rotary *" value={rotary} onChange={(e) => setRotary(e.target.value)}>
        <option value="">Select rotary…</option>
        {rotaries.map((row) => (
          <option key={row.code} value={row.name}>
            {row.name}
          </option>
        ))}
      </AcFormSelect>
      <div className="space-y-3">
        {AC_RM_OUTWARD_GRADES.map((row) => {
          const key = `${rotary}||${row.label}`;
          const gradeBags = rotary ? bagsFor(rotary, row.label) : [];
          return (
            <div key={row.key} className="rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="text-sm font-medium text-slate-800 flex-1 min-w-[12rem]">
                  {row.label} *
                  {rotary ? <span className="font-normal text-slate-500"> · {rotary}</span> : null}
                </div>
                <label className="text-sm min-w-[8rem]">
                  <span className="block mb-1 font-medium text-slate-700">Weight (kg) *</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={weights[key] ?? ""}
                    onChange={(e) =>
                      setWeights((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    disabled={!rotary}
                  />
                </label>
                <button
                  type="button"
                  className="wf-btn wf-btn-primary"
                  onClick={() => addBag(row.label)}
                  disabled={
                    !rotary ||
                    saving ||
                    !(Number(weights[key]) > 0) ||
                    (ourKg > 0 && bagTotal + Number(weights[key] || 0) > ourKg + 0.001)
                  }
                >
                  Add bag
                </button>
              </div>
              <ul className="text-sm space-y-1">
                {gradeBags.map((bag) => (
                  <li key={bag.bag_id} className="flex justify-between gap-3">
                    <span className="font-mono">
                      {bag.bag_code} · {numberOrEmpty(bag.weight_kg)} KG · {bagRotaryName(bag)}
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
      <p className="text-xs text-slate-600">
        {rotaries
          .map((row) => `${row.name}: ${rotaryReady(row.name) ? "ready" : "needs grade + Stones + Unburnt"}`)
          .join(" · ")}
      </p>
      <AcSaveBar
        onSave={complete}
        saving={saving}
        saveLabel="Release to Production"
        disabled={!oneRotaryReady || overrun}
      />
    </div>
  );
}
