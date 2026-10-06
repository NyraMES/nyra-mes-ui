import { useAppContext } from "../../../context/AppContext";
import { isDemoReadOnly } from "../../../config/demoMode";

function AcSaveBar({
  onSave,
  saving,
  saveLabel = "Save",
  disabled = false,
  onCancel = null,
  cancelLabel = "Cancel"
}) {
  const { context } = useAppContext();
  const readOnly = isDemoReadOnly(context);

  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        className="wf-btn wf-btn-primary"
        disabled={readOnly || saving || disabled}
        onClick={onSave}
      >
        {saving ? "Saving…" : saveLabel}
      </button>
      {onCancel ? (
        <button
          type="button"
          className="wf-btn wf-btn-ghost"
          disabled={saving}
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
      ) : null}
      {readOnly && (
        <span className="text-xs text-amber-700">Demo is read-only — cannot save.</span>
      )}
    </div>
  );
}

export default AcSaveBar;
