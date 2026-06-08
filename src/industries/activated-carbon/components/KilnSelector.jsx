import { useState } from "react";

const DEFAULT_KILNS = [
  { id: "KILN-01", label: "Kiln 01 — Rotary" },
  { id: "KILN-02", label: "Kiln 02 — Rotary" },
  { id: "KILN-03", label: "Kiln 03 — SAG" }
];

function KilnSelector({ kilns = DEFAULT_KILNS, value, onChange }) {
  const [internal, setInternal] = useState(kilns[0]?.id || "");

  const selected = value ?? internal;
  const handleChange = (next) => {
    setInternal(next);
    onChange?.(next);
  };

  return (
    <label className="block text-sm">
      <span className="block mb-1 font-medium text-slate-700">Kiln</span>
      <select
        className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
      >
        {kilns.map((k) => (
          <option key={k.id} value={k.id}>
            {k.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default KilnSelector;
