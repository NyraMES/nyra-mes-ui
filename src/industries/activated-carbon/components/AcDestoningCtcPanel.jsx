import { useEffect, useState } from "react";

import {
  fetchAcDestonerDailyCtc,
  formatAcApiError,
  saveAcDestonerDailyCtc
} from "../../../services/activatedCarbonApi";
import AcAlert from "./AcAlert";
import AcSaveBar from "./AcSaveBar";
import useAcPersonLabel from "../hooks/useAcPersonLabel";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

export default function AcDestoningCtcPanel({ canEdit = false }) {
  const person = useAcPersonLabel();
  const [rows, setRows] = useState([]);
  const [assignmentDate, setAssignmentDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const mapRows = (plan) =>
    (plan?.destoners || []).map((row) => ({
      resource_code: row.resource_code,
      resource_name: row.resource_name,
      assigned_ctc: row.assigned_ctc || "",
      assigned_date: row.assigned_date || "",
      assigned_by: row.assigned_by || ""
    }));

  const reload = async () => {
    const plan = await fetchAcDestonerDailyCtc();
    setAssignmentDate(plan?.assignment_date || "");
    setRows(mapRows(plan));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    reload()
      .catch((e) => {
        if (!cancelled) setError(formatAcApiError(e, "Could not load destoning CTC"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    if (!canEdit || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await saveAcDestonerDailyCtc({
        assignment_date: assignmentDate || undefined,
        destoners: rows.map((row) => ({
          resource_code: row.resource_code,
          assigned_ctc: String(row.assigned_ctc || "").trim() || null
        }))
      });
      setAssignmentDate(saved?.assignment_date || assignmentDate);
      setRows(mapRows(saved || { destoners: rows }));
      setSuccess("Today's destoning CTC saved. Load bag uses this CTC.");
    } catch (e) {
      setError(formatAcApiError(e, "Could not save destoning CTC"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <WfCard>
      <WfCardHeader
        title="Daily destoning CTC"
        subtitle={`Set the CTC each destoner will run today${
          assignmentDate ? ` — ${assignmentDate}` : ""
        }. Bags pick up CTC at kiln output quality check.`}
      />
      <WfCardBody>
        {error ? <AcAlert variant="error">{error}</AcAlert> : null}
        {success ? <AcAlert variant="success">{success}</AcAlert> : null}
        {loading ? <p className="text-sm text-slate-600">Loading destoners…</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="text-sm text-slate-600">
            No destoning machines yet. Ask nyraservices to register them under Masters — Machines &
            kilns.
          </p>
        ) : null}
        {!loading && rows.length > 0 ? (
          <table className="w-full text-sm max-w-3xl">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2">Destoner</th>
                <th className="py-2">Today&apos;s CTC</th>
                <th className="py-2">Set by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.resource_code} className="border-b border-slate-100">
                  <td className="py-2">
                    <div className="font-medium text-slate-900">{row.resource_name}</div>
                    <div className="font-mono text-xs text-slate-500">{row.resource_code}</div>
                  </td>
                  <td className="py-2">
                    <input
                      type="number"
                      step="0.1"
                      className="w-28 rounded border border-slate-300 px-3 py-2 tabular-nums"
                      value={row.assigned_ctc}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((item) =>
                            item.resource_code === row.resource_code
                              ? { ...item, assigned_ctc: e.target.value }
                              : item
                          )
                        )
                      }
                      disabled={!canEdit || saving}
                      placeholder="e.g. 45.0"
                    />
                  </td>
                  <td className="py-2 text-slate-600 text-xs">{person(row.assigned_by) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <p className="text-xs text-slate-500 mt-3 max-w-2xl">
          This assignment is for today only. Destoning load matches CTC.
        </p>
        {canEdit && rows.length > 0 ? (
          <AcSaveBar onSave={handleSave} saving={saving} saveLabel="Save today's CTC" />
        ) : null}
      </WfCardBody>
    </WfCard>
  );
}
