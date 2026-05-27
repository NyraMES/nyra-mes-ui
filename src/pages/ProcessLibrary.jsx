import { useEffect, useMemo, useState } from "react";

import MesCard from "../components/mes/MesCard";
import MesPageHeader from "../components/mes/MesPageHeader";
import api, { formatApiError } from "../services/api";
import {
  fetchProcesses,
  isProcessActive,
  processKey,
  uniqueProcessTypes
} from "../utils/mesApi";

const emptyForm = () => ({
  process_code: "",
  process_name: "",
  process_type: "",
  description: "",
  is_active: true
});

function ProcessLibrary() {
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const loadProcesses = async () => {
    setLoading(true);
    setError("");
    try {
      setProcesses(await fetchProcesses());
    } catch (e) {
      setError(formatApiError(e, "Could not load processes"));
      setProcesses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProcesses();
  }, []);

  const processTypes = useMemo(
    () => uniqueProcessTypes(processes),
    [processes]
  );

  const filteredProcesses = useMemo(() => {
    if (!typeFilter) return processes;
    return processes.filter((p) => p.process_type === typeFilter);
  }, [processes, typeFilter]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const startEdit = (process) => {
    setEditingId(processKey(process));
    setForm({
      process_code: process.process_code || "",
      process_name: process.process_name || "",
      process_type: process.process_type || "",
      description: process.description || "",
      is_active: isProcessActive(process)
    });
    setError("");
    setSuccess("");
  };

  const saveProcess = async () => {
    if (!form.process_code.trim() || !form.process_name.trim()) {
      setError("Process code and name are required.");
      return;
    }
    if (!form.process_type.trim()) {
      setError("Process type is required.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    const payload = {
      process_code: form.process_code.trim(),
      process_name: form.process_name.trim(),
      process_type: form.process_type.trim(),
      description: form.description.trim() || null,
      is_active: !!form.is_active
    };

    try {
      if (editingId) {
        await api.put(`/processes/${editingId}`, payload);
        setSuccess("Process updated.");
      } else {
        await api.post("/processes", payload);
        setSuccess("Process created.");
      }
      resetForm();
      await loadProcesses();
    } catch (e) {
      setError(formatApiError(e, editingId ? "Failed to update process" : "Failed to create process"));
    } finally {
      setSubmitting(false);
    }
  };

  const deactivateProcess = async (process) => {
    const id = processKey(process);
    if (!id) return;
    if (!window.confirm(`Deactivate process ${process.process_code || id}?`)) return;

    setError("");
    setSuccess("");
    try {
      await api.put(`/processes/${id}`, {
        process_code: process.process_code,
        process_name: process.process_name,
        process_type: process.process_type,
        description: process.description,
        is_active: false
      });
      setSuccess(`Process ${process.process_code || id} deactivated.`);
      if (editingId === id) resetForm();
      await loadProcesses();
    } catch (e) {
      setError(formatApiError(e, "Failed to deactivate process"));
    }
  };

  return (
    <div className="max-w-6xl">
      <MesPageHeader
        eyebrow="Ontology · Reusable Processes"
        title="Process Library"
        subtitle="Master data for reusable manufacturing processes. All processes are loaded from the API — seeded and user-created records are editable here."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <MesCard
          title={editingId ? "Edit Process" : "Add Process"}
          subtitle={
            editingId
              ? `Updating ${editingId}`
              : "Create a new reusable process for route operations"
          }
          className="lg:col-span-2"
        >
          <div className="space-y-4">
            <Field label="Process Code">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                value={form.process_code}
                disabled={!!editingId}
                onChange={(e) => setForm((f) => ({ ...f, process_code: e.target.value }))}
                placeholder="e.g. MELT-01"
              />
            </Field>
            <Field label="Process Name">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.process_name}
                onChange={(e) => setForm((f) => ({ ...f, process_name: e.target.value }))}
                placeholder="e.g. Induction Melting"
              />
            </Field>
            <Field label="Process Type">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                list="process-type-options"
                value={form.process_type}
                onChange={(e) => setForm((f) => ({ ...f, process_type: e.target.value }))}
                placeholder="Type from library or enter new"
              />
              <datalist id="process-type-options">
                {processTypes.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
            <Field label="Description">
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[88px]"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Active
            </label>

            {error && <Alert tone="error">{error}</Alert>}
            {success && <Alert tone="success">{success}</Alert>}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="rounded-lg bg-[#08264a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#103a6b] disabled:opacity-50"
                disabled={submitting}
                onClick={saveProcess}
              >
                {submitting ? "Saving…" : editingId ? "Update Process" : "Add Process"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={resetForm}
              >
                {editingId ? "Cancel Edit" : "Clear"}
              </button>
            </div>
          </div>
        </MesCard>

        <MesCard
          title="Process Catalogue"
          subtitle={
            loading
              ? "Loading…"
              : `${filteredProcesses.length} of ${processes.length} process(es)`
          }
          className="lg:col-span-3"
        >
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Filter by process_type
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-w-[200px]"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All types</option>
                {processTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcesses.map((p) => {
                  const id = processKey(p);
                  const active = isProcessActive(p);
                  return (
                    <tr key={id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-3 font-mono text-[#08264a]">{p.process_code || id}</td>
                      <td className="px-3 py-3 font-medium text-slate-900">{p.process_name}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                          {p.process_type || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            active
                              ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                              : "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                          }
                        >
                          {active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600 max-w-xs truncate">
                        {p.description || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="text-xs font-medium text-[#08264a] hover:underline"
                            onClick={() => startEdit(p)}
                          >
                            Edit
                          </button>
                          {active && (
                            <button
                              type="button"
                              className="text-xs font-medium text-red-600 hover:underline"
                              onClick={() => deactivateProcess(p)}
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && filteredProcesses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      No processes match this filter.
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

export default ProcessLibrary;
