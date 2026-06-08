import { useMemo, useState } from "react";

import { AC_STANDARD_OPERATIONS } from "../constants/defaultRawMaterialTypes";
import AcSaveBar from "./AcSaveBar";

const EMPTY_PARAMETER = {
  key: "",
  label: "",
  unit: "",
  default_value: "",
  used_at: "feasibility"
};

function emptyForm() {
  return {
    product_name: "",
    finished_product_name: "",
    operations: AC_STANDARD_OPERATIONS.map((op) => ({ ...op })),
    process_parameters: [{ ...EMPTY_PARAMETER }]
  };
}

function RawMaterialTypeEditor({ onSave, saving }) {
  const [form, setForm] = useState(emptyForm);
  const [validation, setValidation] = useState("");

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateOperation = (index, field, value) => {
    setForm((prev) => {
      const operations = [...prev.operations];
      operations[index] = { ...operations[index], [field]: value };
      return { ...prev, operations };
    });
  };

  const updateParameter = (index, field, value) => {
    setForm((prev) => {
      const process_parameters = [...prev.process_parameters];
      process_parameters[index] = { ...process_parameters[index], [field]: value };
      return { ...prev, process_parameters };
    });
  };

  const addParameter = () => {
    setForm((prev) => ({
      ...prev,
      process_parameters: [...prev.process_parameters, { ...EMPTY_PARAMETER }]
    }));
  };

  const removeParameter = (index) => {
    setForm((prev) => ({
      ...prev,
      process_parameters: prev.process_parameters.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    setValidation("");
    if (!form.product_name.trim()) {
      setValidation("Display name is required.");
      return;
    }
    const ops = form.operations.filter((op) => op.operation_code?.trim());
    if (!ops.length) {
      setValidation("At least one routing operation is required.");
      return;
    }

    const payload = {
      product_name: form.product_name.trim(),
      finished_product_name:
        form.finished_product_name.trim() || form.product_name.trim(),
      operations: ops.map((op, i) => ({
        ...op,
        operation_sequence: Number(op.operation_sequence) || i + 1
      })),
      process_parameters: form.process_parameters
        .filter((p) => p.key.trim() && p.label.trim())
        .map((p) => ({
          key: p.key.trim(),
          label: p.label.trim(),
          unit: p.unit.trim() || undefined,
          default_value: p.default_value.trim() || undefined,
          used_at: p.used_at || "feasibility"
        }))
    };

    try {
      await onSave?.(payload);
      setForm(emptyForm());
    } catch {
      // Parent shows the error — keep form data for retry.
    }
  };

  const paramCount = useMemo(
    () => form.process_parameters.filter((p) => p.key.trim()).length,
    [form.process_parameters]
  );

  return (
    <div className="wf-light-panel rounded-xl p-4 md:p-5 space-y-6">
      {validation && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {validation}
        </p>
      )}

      <p className="text-xs text-slate-500 max-w-2xl">
        Raw material, finished product, and routing codes are assigned automatically when you
        save — they appear in a confirmation popup (RAW-AC-*, FG-AC-*, RT-AC-*).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <label className="text-sm block">
          <span className="block mb-1 font-medium text-slate-700">Raw material name</span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={form.product_name}
            onChange={(e) => updateField("product_name", e.target.value)}
            placeholder="e.g. Coconut Shell"
          />
        </label>
        <label className="text-sm block">
          <span className="block mb-1 font-medium text-slate-700">
            Finished product name{" "}
            <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={form.finished_product_name}
            onChange={(e) => updateField("finished_product_name", e.target.value)}
            placeholder="Defaults to raw material name"
          />
        </label>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-800 mb-2">
          Fixed manufacturing routing
        </h4>
        <p className="text-xs text-slate-500 mb-3">
          Standard process steps for this feedstock — applied automatically at kiln feed and
          routing.
        </p>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b bg-slate-50">
                <th className="py-2 px-3 w-14">Seq</th>
                <th className="py-2 px-3">Operation</th>
                <th className="py-2 px-3">Process step</th>
              </tr>
            </thead>
            <tbody>
              {form.operations.map((op, index) => (
                <tr key={op.operation_code || index} className="border-b border-slate-100">
                  <td className="py-1 px-3">
                    <input
                      type="number"
                      min="1"
                      className="w-12 rounded border border-slate-300 px-1 py-1 text-center"
                      value={op.operation_sequence}
                      onChange={(e) => updateOperation(index, "operation_sequence", e.target.value)}
                    />
                  </td>
                  <td className="py-1 px-3">
                    <input
                      className="w-full min-w-[140px] rounded border border-slate-300 px-2 py-1"
                      value={op.operation_name}
                      onChange={(e) => updateOperation(index, "operation_name", e.target.value)}
                    />
                    <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                      {op.operation_code}
                    </span>
                  </td>
                  <td className="py-1 px-3">
                    <input
                      className="w-full min-w-[80px] rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                      value={op.process_step}
                      onChange={(e) => updateOperation(index, "process_step", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Process parameters</h4>
            <p className="text-xs text-slate-500">
              Parameters checked at feasibility (kiln availability + targets) and captured at
              execution ({paramCount} defined).
            </p>
          </div>
          <button
            type="button"
            className="text-xs text-blue-700 hover:underline shrink-0"
            onClick={addParameter}
          >
            + Add parameter
          </button>
        </div>
        <div className="space-y-2">
          {form.process_parameters.map((param, index) => (
            <div
              key={index}
              className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border border-slate-100 rounded-lg p-3 bg-slate-50/50"
            >
              <label className="text-xs block md:col-span-1">
                <span className="block mb-1 text-slate-600">Key</span>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1 font-mono"
                  value={param.key}
                  onChange={(e) => updateParameter(index, "key", e.target.value)}
                  placeholder="target_iodine"
                />
              </label>
              <label className="text-xs block md:col-span-2">
                <span className="block mb-1 text-slate-600">Label</span>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1"
                  value={param.label}
                  onChange={(e) => updateParameter(index, "label", e.target.value)}
                />
              </label>
              <label className="text-xs block">
                <span className="block mb-1 text-slate-600">Unit</span>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1"
                  value={param.unit}
                  onChange={(e) => updateParameter(index, "unit", e.target.value)}
                />
              </label>
              <label className="text-xs block">
                <span className="block mb-1 text-slate-600">Default</span>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1"
                  value={param.default_value}
                  onChange={(e) => updateParameter(index, "default_value", e.target.value)}
                />
              </label>
              <div className="flex gap-2 items-end">
                <label className="text-xs block flex-1">
                  <span className="block mb-1 text-slate-600">Used at</span>
                  <select
                    className="w-full rounded border border-slate-300 px-2 py-1"
                    value={param.used_at}
                    onChange={(e) => updateParameter(index, "used_at", e.target.value)}
                  >
                    <option value="feasibility">Feasibility</option>
                    <option value="execution">Execution</option>
                    <option value="both">Both</option>
                  </select>
                </label>
                {form.process_parameters.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-red-600 pb-1"
                    onClick={() => removeParameter(index)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AcSaveBar onSave={handleSave} saving={saving} saveLabel="Save raw material type" />
    </div>
  );
}

export default RawMaterialTypeEditor;
