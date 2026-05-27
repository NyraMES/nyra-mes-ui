import { useEffect, useMemo, useState } from "react";

import MesCard from "../components/mes/MesCard";
import MesPageHeader from "../components/mes/MesPageHeader";
import { formatApiError } from "../services/api";
import { createPart, fetchParts, uniquePartTypes } from "../utils/mesApi";

const emptyForm = () => ({
  part_id: "",
  part_name: "",
  part_type: "",
  unit_of_measure: "NOS"
});

function PartMaster() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyForm());

  const loadParts = async () => {
    setLoading(true);
    setError("");
    try {
      setParts(await fetchParts());
    } catch (e) {
      setError(formatApiError(e, "Could not load parts"));
      setParts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParts();
  }, []);

  const partTypes = useMemo(() => uniquePartTypes(parts), [parts]);

  const clearForm = () => {
    setForm(emptyForm());
    setError("");
    setSuccess("");
  };

  const savePart = async () => {
    if (!form.part_id.trim() || !form.part_name.trim()) {
      setError("Part ID and name are required.");
      return;
    }
    if (!form.part_type.trim()) {
      setError("Part type is required.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await createPart({
        part_id: form.part_id.trim(),
        part_name: form.part_name.trim(),
        part_type: form.part_type.trim(),
        unit_of_measure: form.unit_of_measure.trim() || "NOS"
      });
      setSuccess("Part created successfully.");
      clearForm();
      await loadParts();
    } catch (e) {
      setError(formatApiError(e, "Failed to create part"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl">
      <MesPageHeader
        eyebrow="Ontology · Part Master"
        title="Part Master"
        subtitle="Create parts before defining routings. Parts are loaded from the API and used in Route Entry."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <MesCard title="Add Part" subtitle="Register a new part for routing" className="lg:col-span-2">
          <div className="space-y-4">
            <Field label="Part ID">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                value={form.part_id}
                onChange={(e) => setForm((f) => ({ ...f, part_id: e.target.value }))}
                placeholder="PART-001"
              />
            </Field>
            <Field label="Part Name">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.part_name}
                onChange={(e) => setForm((f) => ({ ...f, part_name: e.target.value }))}
              />
            </Field>
            <Field label="Part Type">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                list="part-type-options"
                value={form.part_type}
                onChange={(e) => setForm((f) => ({ ...f, part_type: e.target.value }))}
                placeholder="e.g. casting, machined"
              />
              <datalist id="part-type-options">
                {partTypes.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
            <Field label="Unit of Measure">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.unit_of_measure}
                onChange={(e) => setForm((f) => ({ ...f, unit_of_measure: e.target.value }))}
              />
            </Field>

            {error && <Alert tone="error">{error}</Alert>}
            {success && <Alert tone="success">{success}</Alert>}

            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-[#08264a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#103a6b] disabled:opacity-50"
                disabled={submitting}
                onClick={savePart}
              >
                {submitting ? "Saving…" : "Add Part"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={clearForm}
              >
                Clear
              </button>
            </div>
          </div>
        </MesCard>

        <MesCard
          title="Part List"
          subtitle={loading ? "Loading…" : `${parts.length} part(s)`}
          className="lg:col-span-3"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Part ID</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">UOM</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.part_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-3 font-mono text-[#08264a]">{p.part_id}</td>
                    <td className="px-3 py-3 font-medium">{p.part_name}</td>
                    <td className="px-3 py-3">{p.part_type || "—"}</td>
                    <td className="px-3 py-3">{p.unit_of_measure || "—"}</td>
                  </tr>
                ))}
                {!loading && parts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                      No parts yet. Add the first part above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </MesCard>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function Alert({ tone, children }) {
  const cls =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm whitespace-pre-line ${cls}`}>
      {children}
    </div>
  );
}

export default PartMaster;
