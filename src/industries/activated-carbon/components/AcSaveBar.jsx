import { useAppContext } from "../../../context/AppContext";
import { isDemoReadOnly } from "../../../config/demoMode";

function AcSaveBar({ onSave, saving, saveLabel = "Save", disabled = false }) {
  const { context } = useAppContext();
  const readOnly = isDemoReadOnly(context);

  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        className="wf-btn-primary px-4 py-2 text-sm rounded-md disabled:opacity-50"
        disabled={readOnly || saving || disabled}
        onClick={onSave}
      >
        {saving ? "Saving…" : saveLabel}
      </button>
      {readOnly && (
        <span className="text-xs text-amber-700">Demo is read-only — cannot save.</span>
      )}
    </div>
  );
}

export default AcSaveBar;
