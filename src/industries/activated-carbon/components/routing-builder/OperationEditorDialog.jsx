import { useEffect, useState } from "react";

function OperationEditorDialog({ open, title, initial, onClose, onSave }) {
  const [operation_code, setOperationCode] = useState("");
  const [operation_name, setOperationName] = useState("");
  const [operation_seq, setOperationSeq] = useState("");
  const [requires_machine, setRequiresMachine] = useState(false);
  const [requires_labor, setRequiresLabor] = useState(true);
  const [requires_tools, setRequiresTools] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOperationCode(initial?.operation_code || "");
    setOperationName(initial?.operation_name || "");
    setOperationSeq(String(initial?.operation_seq ?? ""));
    setRequiresMachine(Boolean(initial?.requires_machine));
    setRequiresLabor(initial?.requires_labor != null ? Boolean(initial.requires_labor) : true);
    setRequiresTools(Boolean(initial?.requires_tools));
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      operation_code: operation_code.trim(),
      operation_name: operation_name.trim(),
      operation_seq: Number(operation_seq),
      requires_machine,
      requires_labor,
      requires_tools
    });
  };

  return (
    <div className="ac-rb-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ac-rb-dialog ac-rb-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ac-rb-op-editor-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="ac-rb-op-editor-title" className="ac-rb-dialog-title">
          {title}
        </h3>
        <form className="ac-rb-form ac-rb-form--grid" onSubmit={handleSubmit}>
          <label className="ac-rb-field">
            <span>Sequence</span>
            <input
              type="number"
              min="1"
              step="1"
              value={operation_seq}
              onChange={(e) => setOperationSeq(e.target.value)}
              required
            />
          </label>
          <label className="ac-rb-field">
            <span>Operation code</span>
            <input
              type="text"
              value={operation_code}
              onChange={(e) => setOperationCode(e.target.value)}
              placeholder="POST_SCREENING_INSPECTION"
              required
            />
          </label>
          <label className="ac-rb-field ac-rb-field--span2">
            <span>Operation name</span>
            <input
              type="text"
              value={operation_name}
              onChange={(e) => setOperationName(e.target.value)}
              placeholder="Post Screening Inspection"
              required
            />
          </label>

          <div className="ac-rb-field ac-rb-field--span2 ac-rb-exec-flags">
            <span className="ac-rb-exec-flags-title">At shop-floor execution</span>
            <p className="ac-rb-exec-flags-hint">
              Choose what the operator must confirm when starting this step. QC and gate steps
              ignore these flags.
            </p>
            <label className="ac-rb-field ac-rb-field--checkbox">
              <input
                type="checkbox"
                checked={requires_machine}
                onChange={(e) => setRequiresMachine(e.target.checked)}
              />
              <span>Requires machine</span>
            </label>
            <label className="ac-rb-field ac-rb-field--checkbox">
              <input
                type="checkbox"
                checked={requires_labor}
                onChange={(e) => setRequiresLabor(e.target.checked)}
              />
              <span>Requires labor pool (crew)</span>
            </label>
            <label className="ac-rb-field ac-rb-field--checkbox">
              <input
                type="checkbox"
                checked={requires_tools}
                onChange={(e) => setRequiresTools(e.target.checked)}
              />
              <span>Requires tools</span>
            </label>
          </div>

          <div className="ac-rb-dialog-actions ac-rb-dialog-actions--full">
            <button type="button" className="ac-rb-btn ac-rb-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ac-rb-btn ac-rb-btn--primary">
              Save operation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OperationEditorDialog;
