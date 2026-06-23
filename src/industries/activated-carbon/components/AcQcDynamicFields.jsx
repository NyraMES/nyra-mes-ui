const LABEL_CLASS = {
  dark: "text-slate-200",
  light: "text-slate-700"
};

/** Renders QC inputs from ontology admin config. */
export function AcQcFieldInput({ field, value, onChange, tone = "dark", disabled = false }) {
  const labelClass = LABEL_CLASS[tone] || LABEL_CLASS.dark;
  const label =
    field.unit && field.fieldType !== "textarea" && field.fieldType !== "text"
      ? `${field.label} (${field.unit})`
      : field.label;

  if (field.fieldType === "textarea") {
    return (
      <label className="text-sm block md:col-span-2">
        <span className={`block mb-1 font-medium ${labelClass}`}>{label}</span>
        <textarea
          className="w-full rounded border border-slate-300 px-3 py-2 min-h-[72px]"
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder || "Notes"}
        />
      </label>
    );
  }

  if (field.fieldType === "text") {
    return (
      <label className="text-sm block">
        <span className={`block mb-1 font-medium ${labelClass}`}>{label}</span>
        <input
          type="text"
          className="w-full rounded border border-slate-300 px-3 py-2"
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
        />
      </label>
    );
  }

  return (
    <label className="text-sm block">
      <span className={`block mb-1 font-medium ${labelClass}`}>{label}</span>
      <input
        type="number"
        step={field.step ?? (field.unit === "%" ? 0.01 : 0.1)}
        min={field.min}
        className="w-full rounded border border-slate-300 px-3 py-2"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.placeholder}
      />
    </label>
  );
}

export function buildQcPayload(formValues, fields) {
  const payload = {};
  for (const field of fields) {
    if (field.fieldType === "textarea" || field.fieldType === "text") {
      const text = String(formValues[field.key] || "").trim();
      if (text) payload[field.key] = text;
      continue;
    }
    const raw = formValues[field.key];
    if (raw === "" || raw == null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) payload[field.key] = n;
    else {
      const text = String(raw).trim();
      if (text) payload[field.key] = text;
    }
  }
  return payload;
}

export function emptyQcForm(fields) {
  return Object.fromEntries(fields.map((f) => [f.key, ""]));
}
