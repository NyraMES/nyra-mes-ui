import { useEffect, useState } from "react";

const DATA_TYPES = ["number", "string", "boolean", "text"];

function ParameterEditorDialog({ open, title, initial, onClose, onSave }) {
  const [form, setForm] = useState({
    parameter_code: "",
    parameter_name: "",
    data_type: "number",
    unit: "",
    min_value: "",
    max_value: "",
    mandatory: false
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      parameter_code: initial?.parameter_code || "",
      parameter_name: initial?.parameter_name || "",
      data_type: initial?.data_type || "number",
      unit: initial?.unit || "",
      min_value: initial?.min_value ?? "",
      max_value: initial?.max_value ?? "",
      mandatory: Boolean(initial?.mandatory)
    });
  }, [open, initial]);

  if (!open) return null;

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...initial,
      parameter_code: form.parameter_code.trim(),
      parameter_name: form.parameter_name.trim(),
      data_type: form.data_type,
      unit: form.unit.trim(),
      min_value: form.min_value === "" ? null : Number(form.min_value),
      max_value: form.max_value === "" ? null : Number(form.max_value),
      mandatory: form.mandatory
    });
  };

  return (
    <div className="ac-rb-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ac-rb-dialog ac-rb-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ac-rb-param-editor-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="ac-rb-param-editor-title" className="ac-rb-dialog-title">
          {title}
        </h3>
        <form className="ac-rb-form ac-rb-form--grid" onSubmit={handleSubmit}>
          <label className="ac-rb-field">
            <span>Parameter code</span>
            <input
              type="text"
              value={form.parameter_code}
              onChange={(e) => setField("parameter_code", e.target.value)}
              required
            />
          </label>
          <label className="ac-rb-field">
            <span>Parameter name</span>
            <input
              type="text"
              value={form.parameter_name}
              onChange={(e) => setField("parameter_name", e.target.value)}
              required
            />
          </label>
          <label className="ac-rb-field">
            <span>Data type</span>
            <select
              value={form.data_type}
              onChange={(e) => setField("data_type", e.target.value)}
            >
              {DATA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="ac-rb-field">
            <span>Unit</span>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => setField("unit", e.target.value)}
              placeholder="%"
            />
          </label>
          <label className="ac-rb-field">
            <span>Min value</span>
            <input
              type="number"
              step="any"
              value={form.min_value}
              onChange={(e) => setField("min_value", e.target.value)}
            />
          </label>
          <label className="ac-rb-field">
            <span>Max value</span>
            <input
              type="number"
              step="any"
              value={form.max_value}
              onChange={(e) => setField("max_value", e.target.value)}
            />
          </label>
          <label className="ac-rb-field ac-rb-field--checkbox">
            <input
              type="checkbox"
              checked={form.mandatory}
              onChange={(e) => setField("mandatory", e.target.checked)}
            />
            <span>Mandatory</span>
          </label>
          <div className="ac-rb-dialog-actions ac-rb-dialog-actions--full">
            <button type="button" className="ac-rb-btn ac-rb-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ac-rb-btn ac-rb-btn--primary">
              Save parameter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ParameterEditorDialog;
