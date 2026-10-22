import { useEffect, useMemo, useRef, useState } from "react";

import {
  completeAcInboundExecutionStep,
  createAcInwardBag,
  deleteAcInwardBag,
  feedAcInwardBagToCrusher,
  fetchAcInboundAdmin,
  fetchAcInwardBags,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import AcGenerateRmsBagsPanel from "./AcGenerateRmsBagsPanel";
import AcRmsBagList from "./AcRmsBagList";
import AcWeightSummaryTable from "./AcWeightSummaryTable";
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

function orderLabCaptureFields(list) {
  const rank = new Map(AC_LAB_INBOUND_PARAMETERS.map((p, index) => [p.key, index]));
  return [...list].sort((a, b) => {
    const left = rank.has(a.key) ? rank.get(a.key) : 1000;
    const right = rank.has(b.key) ? rank.get(b.key) : 1000;
    return left - right;
  });
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
  const fields = orderLabCaptureFields(
    (code === "IN-LAB"
      ? bound
          .filter((p) => AC_LAB_INBOUND_PARAMETERS.some((lab) => lab.key === p.key) && p.key !== "ad_value")
          .concat(
            AC_LAB_INBOUND_PARAMETERS.filter((lab) => !bound.some((p) => p.key === lab.key))
          )
      : bound.length
        ? bound
        : AC_LAB_INBOUND_PARAMETERS
    ).filter((p) => p.key !== "ad_value")
  );
  const measureFields = fields.filter((p) => p.key !== "qc_decision" && p.key !== "qc_remarks");
  const decisionFields = fields.filter((p) => p.key === "qc_decision" || p.key === "qc_remarks");
  const [values, setValues] = useState({});
  const [bags, setBags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);

  useEffect(() => {
    const init = {};
    for (const p of fields) init[p.key] = p.default_value ?? "";
    setValues(init);
  }, [nextStepMeta?.operation_code, fields.length]);

  useEffect(() => {
    if (code !== "IN-LAB" || !selected?.order_code) return undefined;
    let cancelled = false;
    fetchAcInwardBags(selected.order_code)
      .then((rows) => {
        if (!cancelled) setBags((rows || []).filter((b) => !b.grade));
      })
      .catch(() => {
        if (!cancelled) setBags([]);
      });
    return () => {
      cancelled = true;
    };
  }, [code, selected?.order_code]);

  const handleSave = async () => {
    if (savingRef.current) return;
    const decision = String(values.qc_decision || "").toLowerCase();
    const remarks = String(values.qc_remarks || "").trim();
    if (code === "IN-LAB" && !decision) {
      setError("Select approve or deny.");
      return;
    }
    if (code === "IN-LAB" && decision === "deny" && !remarks) {
      setError("Enter remarks for deny. This inward will stop and will not continue to screening.");
      return;
    }
    savingRef.current = true;
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
      await onCompleted(saved);
    } catch (e) {
      const msg = formatAcApiError(e, "Could not save inbound step");
      if (/already recorded/i.test(msg)) {
        await onCompleted({
          customer_order_id: selected.customer_order_id,
          order_code: selected.order_code
        });
        return;
      }
      setError(msg);
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="wf-light-panel rounded-xl p-4 max-w-2xl border border-blue-200">
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      {code === "IN-LAB" ? (
        <div className="mb-3">
          <AcRmsBagList bags={bags} title={`Bags on ${selected.order_code}`} />
        </div>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {measureFields.map((p) => (
          <label key={p.key} className="text-sm block">
            <span className="block mb-1 font-medium text-slate-700">
              {p.label}
              {p.unit ? ` (${p.unit})` : ""}
            </span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              type={p.unit === "%" || p.unit === "KG" ? "number" : "text"}
              min={p.unit === "%" ? "0" : undefined}
              max={p.unit === "%" ? "100" : undefined}
              step={p.unit === "%" ? "0.01" : "any"}
              value={values[p.key] ?? ""}
              disabled={saving}
              onChange={(e) => setValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 mb-3">
        {decisionFields.map((p) => (
          <label key={p.key} className="text-sm block">
            <span className="block mb-1 font-medium text-slate-700">
              {p.label}
              {p.unit ? ` (${p.unit})` : ""}
            </span>
            {p.key === "qc_decision" ? (
              <select
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={values[p.key] ?? ""}
                disabled={saving}
                onChange={(e) => setValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
              >
                <option value="">Select…</option>
                <option value="approve">Approve</option>
                <option value="deny">Deny</option>
              </select>
            ) : (
              <textarea
                className="w-full rounded border border-slate-300 px-3 py-2"
                rows={3}
                value={values[p.key] ?? ""}
                disabled={saving}
                onChange={(e) => setValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
                placeholder={
                  String(values.qc_decision || "").toLowerCase() === "deny"
                    ? "Required — why this inward is denied"
                    : "Optional remarks"
                }
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
            : "Save & move to Screening"
        }
      />
    </div>
  );
}

function isSourceBag(bag) {
  return !bag.grade && String(bag.bag_kind || "source_25") !== "repack_500";
}

function isRepackBag(bag) {
  return String(bag.bag_kind || "") === "repack_500";
}

function LabBagStep({ selected, nextStepMeta, materialType, onCompleted }) {
  const bound = inboundProcessParameters(
    materialType,
    nextStepMeta?.process_step,
    nextStepMeta?.operation_code
  );
  const fields = orderLabCaptureFields(
    AC_LAB_INBOUND_PARAMETERS.filter((lab) => lab.key !== "ad_value").concat(
      bound.filter(
        (p) =>
          !AC_LAB_INBOUND_PARAMETERS.some((lab) => lab.key === p.key) && p.key !== "ad_value"
      )
    )
  );
  const [bags, setBags] = useState([]);
  const [bagCode, setBagCode] = useState("");
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    const rows = await fetchAcInwardBags(selected.order_code);
    const next = rows.filter(isRepackBag);
    setBags(next);
    const pending = next.find((b) => !b.lab_qc);
    setBagCode((prev) => prev || pending?.bag_code || next[0]?.bag_code || "");
  };

  useEffect(() => {
    reload().catch((e) => setError(formatAcApiError(e, "Could not load 500 kg bags")));
  }, [selected.customer_order_id]);

  useEffect(() => {
    const init = {};
    for (const p of fields) init[p.key] = p.default_value ?? "";
    setValues(init);
  }, [bagCode, fields.length]);

  const pending = bags.filter((b) => !b.lab_qc);
  const handleSave = async () => {
    const decision = String(values.qc_decision || "").toLowerCase();
    const remarks = String(values.qc_remarks || "").trim();
    if (!bagCode) {
      setError("Select a 500 kg bag.");
      return;
    }
    if (!decision) {
      setError("Select approve or deny.");
      return;
    }
    if (decision === "deny" && !remarks) {
      setError("Enter remarks for deny. Only this 500 kg bag is stopped.");
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const parameters = { bag_code: bagCode };
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
      const remaining = pending.filter((b) => b.bag_code !== bagCode);
      if (remaining.length) {
        await reload();
        setBagCode(remaining[0].bag_code);
        setSaving(false);
        return;
      }
      onCompleted(saved);
    } catch (e) {
      setError(formatAcApiError(e, "Could not save lab"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wf-light-panel rounded-xl p-4 max-w-2xl border border-blue-200">
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      <p className="text-sm text-slate-700 mb-3">
        Sample each 500 kg bag. Deny stops that bag only. {pending.length} bag(s) still need lab.
      </p>
      <label className="text-sm block mb-3">
        <span className="block mb-1 font-medium text-slate-700">500 kg bag</span>
        <select
          className="w-full rounded border border-slate-300 px-3 py-2"
          value={bagCode}
          onChange={(e) => setBagCode(e.target.value)}
        >
          <option value="">Select bag…</option>
          {bags.map((bag) => (
            <option key={bag.bag_code} value={bag.bag_code}>
              {bag.bag_code}
              {bag.lab_qc ? " — done" : ""}
            </option>
          ))}
        </select>
      </label>
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
              />
            ) : (
              <input
                className="w-full rounded border border-slate-300 px-3 py-2"
                type="number"
                step="0.01"
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
          pending.length > 1 ? "Save this bag" : decisionSaveLabel(values.qc_decision)
        }
      />
    </div>
  );
}

function decisionSaveLabel(decision) {
  return String(decision || "").toLowerCase() === "deny" ? "Deny this bag" : "Save & complete Lab";
}

function RmsBagStep({ selected, nextStepMeta, onCompleted }) {
  return (
    <div className="wf-light-panel rounded-xl p-4 max-w-2xl border border-blue-200">
      <AcGenerateRmsBagsPanel
        customerOrderId={selected.customer_order_id}
        orderCode={selected.order_code}
        ourWeightKg={selected.our_weight_kg ?? selected.quantity}
        processStep={nextStepMeta?.process_step || "PACKING"}
        operationCode={nextStepMeta?.operation_code || "IN-RMS-BAG"}
        onProceedToLab={onCompleted}
      />
    </div>
  );
}

function RepackStep({ selected, nextStepMeta, onCompleted }) {
  const [source, setSource] = useState([]);
  const [repack, setRepack] = useState([]);
  const [picked, setPicked] = useState([]);
  const [weight, setWeight] = useState("500");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    const rows = await fetchAcInwardBags(selected.order_code);
    setSource(rows.filter(isSourceBag));
    setRepack(rows.filter(isRepackBag));
  };

  useEffect(() => {
    reload().catch((e) => setError(formatAcApiError(e, "Could not load bags")));
  }, [selected.customer_order_id]);

  const addBag = async () => {
    const kg = Number(weight);
    if (!kg || kg <= 0 || !picked.length) {
      setError("Select 25 kg bags and enter 500 kg weight.");
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await createAcInwardBag({
        customer_order_id: selected.customer_order_id,
        weight_kg: kg,
        bag_kind: "repack_500",
        parent_bag_codes: picked
      });
      setPicked([]);
      setWeight("500");
      await reload();
    } catch (e) {
      setError(formatAcApiError(e, "Could not create 500 kg bag"));
    } finally {
      setSaving(false);
    }
  };

  const complete = async () => {
    if (!repack.length) {
      setError("Create at least one 500 kg bag.");
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await completeAcInboundExecutionStep({
        customer_order_id: selected.customer_order_id,
        process_step: nextStepMeta.process_step,
        operation_code: nextStepMeta.operation_code,
        parameters: { bag_count: repack.length }
      });
      onCompleted(saved);
    } catch (e) {
      setError(formatAcApiError(e, "Could not complete repack"));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (code) => {
    setPicked((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  return (
    <div className="wf-light-panel rounded-xl p-4 max-w-2xl border border-blue-200 space-y-3">
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      <p className="text-sm text-slate-700">
        Repack 25 kg source bags into 500 kg bags. Each 500 kg bag is sampled in Lab.
      </p>
      <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
        {source.map((bag) => (
          <li key={bag.bag_id}>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={picked.includes(bag.bag_code)}
                onChange={() => toggle(bag.bag_code)}
              />
              <span className="font-mono">
                {bag.bag_code} · {numberOrEmpty(bag.weight_kg)} KG
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 items-end">
        <label className="text-sm flex-1">
          <span className="block mb-1 font-medium">500 kg bag weight</span>
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
          Create 500 kg bag
        </button>
      </div>
      <ul className="text-sm space-y-1">
        {repack.map((bag) => (
          <li key={bag.bag_id} className="font-mono">
            {bag.bag_code} · {numberOrEmpty(bag.weight_kg)} KG
            {bag.parent_bag_codes?.length ? ` ← ${bag.parent_bag_codes.join(", ")}` : ""}
          </li>
        ))}
      </ul>
      {repack.length > 0 ? (
        <AcSaveBar onSave={complete} saving={saving} saveLabel="Complete repack" />
      ) : null}
    </div>
  );
}

function DryingStep({ selected, nextStepMeta, onCompleted }) {
  const [driedKg, setDriedKg] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const complete = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await completeAcInboundExecutionStep({
        customer_order_id: selected.customer_order_id,
        process_step: nextStepMeta.process_step,
        operation_code: nextStepMeta.operation_code,
        parameters: { dried_kg: driedKg || undefined }
      });
      onCompleted(saved);
    } catch (e) {
      setError(formatAcApiError(e, "Could not save drying"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wf-light-panel rounded-xl p-4 max-w-2xl border border-blue-200 space-y-3">
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      <p className="text-sm text-slate-700">
        Moisture is above 20%. Dry and rebag before kiln feed. If this step is shown in error,
        save without weight only when moisture is already at or below the threshold.
      </p>
      <label className="text-sm block">
        <span className="block mb-1 font-medium">Dried weight (KG)</span>
        <input
          type="number"
          min="0.01"
          step="0.01"
          className="w-full rounded border border-slate-300 px-3 py-2"
          value={driedKg}
          onChange={(e) => setDriedKg(e.target.value)}
        />
      </label>
      <AcSaveBar onSave={complete} saving={saving} saveLabel="Complete drying" />
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
      setError(formatAcApiError(e, "Could not save RMS Screen"));
      await reload().catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wf-light-panel rounded-xl p-4 max-w-3xl border border-blue-200 space-y-3">
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      <p className="text-sm text-slate-700">
        RMS Screen — load the 500 kg bags. No quality check after this step. Release is next.
      </p>
      {bags.length ? (
        <ul className="text-sm space-y-1">
          {bags.map((bag) => (
            <li key={bag.bag_id} className="font-mono">
              {bag.bag_code} · {numberOrEmpty(bag.weight_kg)} KG
              {String(bag.status || "").toUpperCase() === "FED_TO_CRUSHER" ? " · loaded" : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-amber-800">No 500 kg bags on this inward.</p>
      )}
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
        saveLabel="Complete RMS Screen"
        disabled={!rotary}
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
  const savingRef = useRef(false);
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
    const outward = rows.filter(
      (b) => Boolean(b.grade) && String(b.bag_kind || "").toLowerCase() !== "rms_500"
    );
    setRotaries(admin.rotaries || []);
    setBags(outward);
    setRotary((current) => current || outward.map(bagRotaryName).find(Boolean) || "");
    return outward;
  };

  useEffect(() => {
    reload().catch((e) => setError(formatAcApiError(e, "Could not load GRN")));
  }, [selected.customer_order_id]);

  const addBag = async (gradeLabel) => {
    const key = `${rotary}||${gradeLabel}`;
    const kg = Number(weights[key]);
    if (!rotary || !gradeLabel || !kg || kg <= 0) return;
    if (ourKg > 0 && bagTotal + kg > ourKg + 0.001) {
      setError(
        remaining <= 0.001
          ? `No KG remaining — the bags already total ${bagTotal} KG of ${ourKg} KG inward.`
          : `Only ${remaining} KG remaining of ${ourKg} KG inward. Enter ${remaining} KG or less.`
      );
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
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
      savingRef.current = false;
      setSaving(false);
    }
  };

  const removeBag = async (bagId) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await deleteAcInwardBag(selected.customer_order_id, bagId);
      await reload();
    } catch (e) {
      setError(formatAcApiError(e, "Could not remove bag"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const bagsFor = (rotaryName, gradeLabel) =>
    bags.filter(
      (b) => bagRotaryName(b) === rotaryName && bagGradeName(b) === gradeLabel
    );

  const complete = async () => {
    if (!bags.length) {
      setError("Enter at least one GRN bag.");
      return;
    }
    if (ourKg > 0 && bagTotal > ourKg + 0.001) {
      setError(`GRN total ${bagTotal} KG cannot exceed inward weight ${ourKg} KG.`);
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
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
      await onCompleted(saved);
    } catch (e) {
      setError(formatAcApiError(e, "Could not finish GRN"));
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="wf-light-panel rounded-xl p-4 max-w-2xl border border-blue-200 space-y-3">
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      <p className="text-sm text-slate-700">
        GRN — choose Rotary A or Rotary B and add at least one bag. A grade, Unburnt, or
        Stones is enough. The total stays within the inward weight.
      </p>
      <AcWeightSummaryTable
        ourKg={ourKg}
        bagTotal={bagTotal}
        pendingKg={Math.max(0, remaining)}
      />
      {remaining <= 0.001 && bags.length > 0 ? (
        <p className="text-sm text-slate-600 m-0">
          The inward weight is fully used.
        </p>
      ) : null}
      {bags.length ? (
        <ul className="text-sm space-y-1">
          {bags.map((bag) => (
            <li key={bag.bag_id || bag.bag_code} className="flex justify-between gap-3">
              <span className="font-mono">
                {bag.bag_code} · {bagGradeName(bag)} · {numberOrEmpty(bag.weight_kg)} KG · {bagRotaryName(bag)}
              </span>
              <button
                type="button"
                className="text-red-700 underline"
                onClick={() => removeBag(bag.bag_id)}
                disabled={saving}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
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
                  {row.label}
                  {rotary ? <span className="font-normal text-slate-500"> · {rotary}</span> : null}
                </div>
                <label className="text-sm min-w-[8rem]">
                  <span className="block mb-1 font-medium text-slate-700">
                    Weight (kg)
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={weights[key] ?? ""}
                    placeholder={remaining > 0 ? String(remaining) : "0 remaining"}
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
                  disabled={!rotary || saving || !(Number(weights[key]) > 0)}
                >
                  Add bag
                </button>
              </div>
              {gradeBags.length ? (
                <p className="text-xs text-slate-500 m-0">
                  {gradeBags.length} bag{gradeBags.length === 1 ? "" : "s"} on this rotary. Use Remove in the list above to change the weight.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-600">
        {bags.length
          ? `${bags.length} bag${bags.length === 1 ? "" : "s"} entered.`
          : "Enter at least one bag."}
      </p>
      <AcSaveBar
        onSave={complete}
        saving={saving}
        saveLabel="GRN complete"
        disabled={overrun}
      />
    </div>
  );
}
