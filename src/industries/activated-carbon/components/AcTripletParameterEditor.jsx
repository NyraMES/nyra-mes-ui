import { AC_ONTOLOGY_PREDICATE_OPTIONS } from "../constants/defaultAcOntologyConfig";
import {
  AC_OBJECT_DATATYPE_OPTIONS,
  AC_TRIPLET_SUBJECT_TEMPLATES,
  buildTripletPreview,
  suggestPredicateUriFromKey
} from "../constants/processTripletTemplates";

function AcTripletParameterEditor({
  parameters = [],
  onChange,
  processStep = "",
  requireExecutionTriplets = true
}) {
  const updateParameter = (index, field, value) => {
    const next = parameters.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      if (field === "key" && !row.predicate_uri?.startsWith("urn:nyra:has")) {
        updated.predicate_uri = suggestPredicateUriFromKey(value);
      }
      return updated;
    });
    onChange?.(next);
  };

  const addParameter = () => {
    onChange?.([
      ...parameters,
      {
        key: "",
        label: "",
        unit: "",
        default_value: "",
        used_at: "execution",
        mandatory: true,
        ontology_predicate: "captures",
        subject_uri_template: "urn:nyra:ac:lot:{lot_code}",
        object_datatype: "http://www.w3.org/2001/XMLSchema#decimal",
        process_step: processStep
      }
    ]);
  };

  const removeParameter = (index) => {
    onChange?.(parameters.filter((_, i) => i !== index));
  };

  return (
    <div className="ac-triplet-params">
      <div className="ac-triplet-params-header">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">
            Execution capture triplets
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Each row defines a value the operator must enter when this process runs.
            Saved as <strong>Subject → Predicate → Object</strong> in the knowledge graph.
          </p>
        </div>
        <button type="button" className="text-xs text-blue-700 hover:underline" onClick={addParameter}>
          + Add triplet parameter
        </button>
      </div>

      {!parameters.length ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {requireExecutionTriplets
            ? "Add at least one execution triplet — what must be captured when P1 (or this step) runs on the shop floor."
            : "No execution parameters defined."}
        </p>
      ) : null}

      <div className="space-y-3">
        {parameters.map((param, index) => {
          const preview = buildTripletPreview(param);
          return (
            <div key={index} className="ac-triplet-card">
              <div className="ac-triplet-card-title">
                <span>Parameter {index + 1}</span>
                {param.mandatory !== false ? (
                  <span className="ac-triplet-required">Required at execution</span>
                ) : (
                  <span className="ac-triplet-optional">Optional</span>
                )}
                {parameters.length > 0 ? (
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline ml-auto"
                    onClick={() => removeParameter(index)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <div className="ac-triplet-preview">
                <div className="ac-triplet-preview-col">
                  <span className="ac-triplet-preview-label">Subject</span>
                  <code className="ac-triplet-preview-uri">{preview.subject_uri}</code>
                </div>
                <div className="ac-triplet-preview-arrow">→</div>
                <div className="ac-triplet-preview-col">
                  <span className="ac-triplet-preview-label">Predicate</span>
                  <code className="ac-triplet-preview-uri">{preview.predicate_uri}</code>
                </div>
                <div className="ac-triplet-preview-arrow">→</div>
                <div className="ac-triplet-preview-col">
                  <span className="ac-triplet-preview-label">Object (field)</span>
                  <span className="ac-triplet-preview-object">
                    {preview.object_label}
                    <code className="ac-triplet-preview-hint">{preview.object_hint}</code>
                  </span>
                </div>
              </div>

              <div className="ac-triplet-fields">
                <label className="text-xs block">
                  <span className="block mb-1 text-slate-600">Field key *</span>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1 font-mono"
                    value={param.key}
                    onChange={(e) => updateParameter(index, "key", e.target.value)}
                    placeholder="activation_temp_c"
                  />
                </label>
                <label className="text-xs block">
                  <span className="block mb-1 text-slate-600">Display label *</span>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1"
                    value={param.label}
                    onChange={(e) => updateParameter(index, "label", e.target.value)}
                    placeholder="Activation temperature"
                  />
                </label>
                <label className="text-xs block">
                  <span className="block mb-1 text-slate-600">Unit</span>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1"
                    value={param.unit || ""}
                    onChange={(e) => updateParameter(index, "unit", e.target.value)}
                    placeholder="°C"
                  />
                </label>
                <label className="text-xs block">
                  <span className="block mb-1 text-slate-600">Target / default</span>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1"
                    value={param.default_value || ""}
                    onChange={(e) => updateParameter(index, "default_value", e.target.value)}
                  />
                </label>
                <label className="text-xs block">
                  <span className="block mb-1 text-slate-600">Subject URI template *</span>
                  <select
                    className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]"
                    value={param.subject_uri_template || "urn:nyra:ac:lot:{lot_code}"}
                    onChange={(e) => updateParameter(index, "subject_uri_template", e.target.value)}
                  >
                    {AC_TRIPLET_SUBJECT_TEMPLATES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs block">
                  <span className="block mb-1 text-slate-600">Predicate (ontology) *</span>
                  <select
                    className="w-full rounded border border-slate-300 px-2 py-1"
                    value={param.ontology_predicate || ""}
                    onChange={(e) => updateParameter(index, "ontology_predicate", e.target.value)}
                  >
                    {AC_ONTOLOGY_PREDICATE_OPTIONS.filter((o) => o.value).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs block">
                  <span className="block mb-1 text-slate-600">Predicate URI (override)</span>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]"
                    value={param.predicate_uri || suggestPredicateUriFromKey(param.key) || ""}
                    onChange={(e) => updateParameter(index, "predicate_uri", e.target.value)}
                    placeholder="urn:nyra:hasActivationTemp"
                  />
                </label>
                <label className="text-xs block">
                  <span className="block mb-1 text-slate-600">Object datatype</span>
                  <select
                    className="w-full rounded border border-slate-300 px-2 py-1"
                    value={
                      param.object_datatype || "http://www.w3.org/2001/XMLSchema#decimal"
                    }
                    onChange={(e) => updateParameter(index, "object_datatype", e.target.value)}
                  >
                    {AC_OBJECT_DATATYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs block flex items-end gap-2 pb-1">
                  <input
                    type="checkbox"
                    checked={param.mandatory !== false}
                    onChange={(e) => updateParameter(index, "mandatory", e.target.checked)}
                  />
                  <span className="text-slate-600">Mandatory when completing this operation</span>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AcTripletParameterEditor;
