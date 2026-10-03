import { useEffect, useState } from "react";

import {
  fetchAcInboundAdmin,
  formatAcApiError,
  saveAcInboundAdmin
} from "../../../services/activatedCarbonApi";
import AcAlert from "./AcAlert";
import AcSaveBar from "./AcSaveBar";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function emptyRotary() {
  return { code: "", name: "" };
}

function emptySplit() {
  return { key: "", label: "" };
}

export default function AcInboundAdminPanel() {
  const [rotaries, setRotaries] = useState([emptyRotary()]);
  const [splits, setSplits] = useState([emptySplit()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAcInboundAdmin();
        if (cancelled) return;
        setRotaries(data.rotaries?.length ? data.rotaries.map((r) => ({ ...r })) : [emptyRotary()]);
        setSplits(
          data.outward_splits?.length ? data.outward_splits.map((s) => ({ ...s })) : [emptySplit()]
        );
      } catch (e) {
        if (!cancelled) setError(formatAcApiError(e, "Could not load inbound settings"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await saveAcInboundAdmin({
        rotaries: rotaries.filter((r) => r.name.trim()),
        outward_splits: splits.filter((s) => s.label.trim())
      });
      setRotaries(saved.rotaries);
      setSplits(saved.outward_splits);
      setSuccess("Inbound settings saved — crusher rotary list and RM outward splits updated.");
    } catch (e) {
      setError(formatAcApiError(e, "Could not save inbound settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      {success ? <AcAlert variant="success">{success}</AcAlert> : null}
      <WfCard>
        <WfCardHeader
          title="Rotary inventory"
          subtitle="Engineers pick a rotary on crusher performance. Seeded for GR Carbons — change per customer."
        />
        <WfCardBody>
          {loading ? (
            <p className="text-sm text-slate-600">Loading…</p>
          ) : (
            <div className="space-y-2 max-w-xl">
              {rotaries.map((row, index) => (
                <div key={`rotary-${index}`} className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Code (ROTARY_A)"
                    value={row.code}
                    onChange={(e) =>
                      setRotaries((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, code: e.target.value } : r))
                      )
                    }
                  />
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Name (Rotary A)"
                    value={row.name}
                    onChange={(e) =>
                      setRotaries((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, name: e.target.value } : r))
                      )
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                className="text-sm text-blue-700 underline"
                onClick={() => setRotaries((prev) => [...prev, emptyRotary()])}
              >
                Add rotary
              </button>
            </div>
          )}
        </WfCardBody>
      </WfCard>
      <WfCard>
        <WfCardHeader
          title="RM outward splits"
          subtitle="Grade / bag lines on Raw Material outward. GR Carbons default: -20 and Grade per rotary, Stones, Unburnt."
        />
        <WfCardBody>
          {loading ? null : (
            <div className="space-y-2 max-w-xl">
              {splits.map((row, index) => (
                <div key={`split-${index}`} className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Key"
                    value={row.key}
                    onChange={(e) =>
                      setSplits((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, key: e.target.value } : s))
                      )
                    }
                  />
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Label shown on RM outward"
                    value={row.label}
                    onChange={(e) =>
                      setSplits((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, label: e.target.value } : s))
                      )
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                className="text-sm text-blue-700 underline"
                onClick={() => setSplits((prev) => [...prev, emptySplit()])}
              >
                Add split line
              </button>
            </div>
          )}
          <AcSaveBar onSave={handleSave} saving={saving} saveLabel="Save inbound settings" />
        </WfCardBody>
      </WfCard>
    </div>
  );
}
