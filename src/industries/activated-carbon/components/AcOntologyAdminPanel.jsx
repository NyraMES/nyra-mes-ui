import { useState } from "react";
import { Link } from "react-router-dom";

import { AC_ONTOLOGY_TRACE_STEPS, AC_TRIPLET_PREDICATES } from "../constants/acTripletOntology";
import { AC_ONTOLOGY_PREDICATE_OPTIONS } from "../constants/defaultAcOntologyConfig";
import useAcOntologyConfig from "../hooks/useAcOntologyConfig";
import AcAlert from "./AcAlert";
import AcIsa95OntologyDrilldown from "./AcIsa95OntologyDrilldown";
import AcSaveBar from "./AcSaveBar";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function moveItem(list, index, direction) {
  const next = [...list];
  const target = index + direction;
  if (target < 0 || target >= next.length) return list;
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((row, idx) => ({ ...row, sortOrder: idx + 1 }));
}

export default function AcOntologyAdminPanel() {
  const { config, loading, saving, error, save, setConfig } = useAcOntologyConfig();
  const [success, setSuccess] = useState("");

  const updateQc = (index, patch) => {
    setConfig((prev) => ({
      ...prev,
      qcParameters: prev.qcParameters.map((row, idx) => (idx === index ? { ...row, ...patch } : row))
    }));
  };

  const updateQuality = (index, patch) => {
    setConfig((prev) => ({
      ...prev,
      qualityParameters: prev.qualityParameters.map((row, idx) =>
        idx === index ? { ...row, ...patch } : row
      )
    }));
  };

  const updatePanel = (index, patch) => {
    setConfig((prev) => ({
      ...prev,
      dashboardPanels: prev.dashboardPanels.map((row, idx) => (idx === index ? { ...row, ...patch } : row))
    }));
  };

  const handleSave = async () => {
    setSuccess("");
    const ok = await save(config);
    setSuccess(ok ? "Ontology & UI configuration saved." : "Saved to browser storage (API pending).");
  };

  if (loading) {
    return <p className="text-sm text-slate-600">Loading ontology configuration…</p>;
  }

  return (
    <div className="space-y-6">
      {error ? <AcAlert variant="error">{error}</AcAlert> : null}
      {success ? <AcAlert variant="success">{success}</AcAlert> : null}

      <WfCard className="mb-6">
        <WfCardHeader
          title="Triplet ontology"
          subtitle="QC field values stage KG triples on save (testedBy, captures, hasStonesKg, etc.)"
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 text-sm text-slate-600 space-y-2">
          <p>
            Each enabled QC parameter can bind to a predicate URI. The API adapter stages triples in{" "}
            <code className="font-mono text-xs bg-slate-100 px-1 rounded">kg.triple_store_staging</code>.
          </p>
          <p>
            Preview staged triples on the{" "}
            <Link to="/workflow/kg" className="text-blue-700 underline">
              KG Triples
            </Link>{" "}
            page after recording QC.
          </p>
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer text-slate-600">Registered predicate URIs</summary>
            <ul className="mt-2 space-y-1 font-mono">
              {Object.entries(AC_TRIPLET_PREDICATES).map(([key, uri]) => (
                <li key={key}>
                  {key}: {uri}
                </li>
              ))}
            </ul>
          </details>
          </div>
        </WfCardBody>
      </WfCard>

      <WfCard className="mb-6">
        <WfCardHeader
          title="Raw material QC parameters"
          subtitle="Controls fields on Raw Material QC and impurity chart series on the dashboard"
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-2">On</th>
                  <th className="py-2 pr-2">Key</th>
                  <th className="py-2 pr-2">Label</th>
                  <th className="py-2 pr-2">Unit</th>
                  <th className="py-2 pr-2">Ontology predicate</th>
                  <th className="py-2 pr-2">Chart series</th>
                  <th className="py-2">Order</th>
                </tr>
              </thead>
              <tbody>
                {config.qcParameters.map((row, index) => (
                  <tr key={row.key} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={row.enabled !== false}
                        onChange={(e) => updateQc(index, { enabled: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs text-slate-700">{row.key}</td>
                    <td className="py-2 pr-2">
                      <input
                        className="w-full min-w-[120px] rounded border border-slate-300 px-2 py-1 text-slate-900"
                        value={row.label || ""}
                        onChange={(e) => updateQc(index, { label: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-slate-900"
                        value={row.unit || ""}
                        onChange={(e) => updateQc(index, { unit: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        className="w-full min-w-[180px] rounded border border-slate-300 px-2 py-1 text-slate-900 text-xs"
                        value={row.ontologyPredicate || ""}
                        onChange={(e) =>
                          updateQc(index, { ontologyPredicate: e.target.value || null })
                        }
                      >
                        {AC_ONTOLOGY_PREDICATE_OPTIONS.map((opt) => (
                          <option key={opt.value || "none"} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        className="w-full min-w-[80px] rounded border border-slate-300 px-2 py-1 text-slate-900 text-xs"
                        value={row.chartSeries || ""}
                        onChange={(e) => updateQc(index, { chartSeries: e.target.value || null })}
                        placeholder="e.g. Stones"
                        disabled={row.fieldType === "textarea"}
                      />
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      <button
                        type="button"
                        className="text-xs text-slate-600 hover:text-slate-900 px-1"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            qcParameters: moveItem(prev.qcParameters, index, -1)
                          }))
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="text-xs text-slate-600 hover:text-slate-900 px-1"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            qcParameters: moveItem(prev.qcParameters, index, 1)
                          }))
                        }
                      >
                        ↓
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WfCardBody>
      </WfCard>

      <WfCard className="mb-6">
        <WfCardHeader
          title="Quality testing parameters"
          subtitle="Controls fields on Finished Product Quality Testing (triplet-linked on save)"
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-2">On</th>
                  <th className="py-2 pr-2">Key</th>
                  <th className="py-2 pr-2">Label</th>
                  <th className="py-2 pr-2">Unit</th>
                  <th className="py-2 pr-2">Ontology predicate</th>
                  <th className="py-2">Order</th>
                </tr>
              </thead>
              <tbody>
                {(config.qualityParameters || []).map((row, index) => (
                  <tr key={row.key} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={row.enabled !== false}
                        onChange={(e) => updateQuality(index, { enabled: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs text-slate-700">{row.key}</td>
                    <td className="py-2 pr-2">
                      <input
                        className="w-full min-w-[120px] rounded border border-slate-300 px-2 py-1 text-slate-900"
                        value={row.label || ""}
                        onChange={(e) => updateQuality(index, { label: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-slate-900"
                        value={row.unit || ""}
                        onChange={(e) => updateQuality(index, { unit: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        className="w-full min-w-[180px] rounded border border-slate-300 px-2 py-1 text-slate-900 text-xs"
                        value={row.ontologyPredicate || ""}
                        onChange={(e) =>
                          updateQuality(index, { ontologyPredicate: e.target.value || null })
                        }
                      >
                        {AC_ONTOLOGY_PREDICATE_OPTIONS.map((opt) => (
                          <option key={opt.value || "none"} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      <button
                        type="button"
                        className="text-xs text-slate-600 hover:text-slate-900 px-1"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            qualityParameters: moveItem(prev.qualityParameters, index, -1)
                          }))
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="text-xs text-slate-600 hover:text-slate-900 px-1"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            qualityParameters: moveItem(prev.qualityParameters, index, 1)
                          }))
                        }
                      >
                        ↓
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WfCardBody>
      </WfCard>

      <WfCard className="mb-6">
        <WfCardHeader
          title="Dashboard panels"
          subtitle="Show or hide sections on the Operational Intelligence Hub"
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 space-y-2">
            {config.dashboardPanels.map((panel, index) => (
              <div
                key={panel.id}
                className="flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={panel.enabled !== false}
                  onChange={(e) => updatePanel(index, { enabled: e.target.checked })}
                />
                <span className="font-medium text-slate-800 min-w-[180px]">{panel.label}</span>
                <span className="font-mono text-xs text-slate-500">{panel.id}</span>
                <label className="text-xs text-slate-600 flex items-center gap-1 ml-auto">
                  Width
                  <select
                    className="rounded border border-slate-300 px-2 py-0.5 text-slate-900"
                    value={panel.colSpan ?? 12}
                    onChange={(e) => updatePanel(index, { colSpan: Number(e.target.value) })}
                  >
                    <option value={12}>Full (12)</option>
                    <option value={8}>Wide (8)</option>
                    <option value={6}>Half (6)</option>
                    <option value={4}>Sidebar (4)</option>
                    <option value={3}>Narrow (3)</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="text-xs text-slate-600 hover:text-slate-900"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      dashboardPanels: moveItem(prev.dashboardPanels, index, -1)
                    }))
                  }
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="text-xs text-slate-600 hover:text-slate-900"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      dashboardPanels: moveItem(prev.dashboardPanels, index, 1)
                    }))
                  }
                >
                  ↓
                </button>
              </div>
            ))}
          </div>
        </WfCardBody>
      </WfCard>

      <WfCard className="mb-6">
        <WfCardHeader
          title="ISA-95 trace chain"
          subtitle="Shop-floor screens that stage KG triples via the API adapter (aligned with testbed material flow)"
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3">Screen</th>
                  <th className="py-2 pr-3">Predicates</th>
                  <th className="py-2">API</th>
                </tr>
              </thead>
              <tbody>
                {AC_ONTOLOGY_TRACE_STEPS.map((step) => (
                  <tr key={step.screen} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-800">{step.screen}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-600">
                      {step.predicates.join(", ")}
                    </td>
                    <td className="py-2 font-mono text-xs text-slate-500">{step.api}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WfCardBody>
      </WfCard>

      <AcIsa95OntologyDrilldown />

      <AcSaveBar onSave={handleSave} saving={saving} saveLabel="Save ontology & UI config" />
    </div>
  );
}
