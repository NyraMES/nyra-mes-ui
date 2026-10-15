import { useRef, useState } from "react";

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
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const blocked = readOnly || saving || disabled || busy;

  const handleSaveClick = async () => {
    if (lock.current || blocked) return;
    lock.current = true;
    setBusy(true);
    try {
      await Promise.resolve(onSave?.());
    } catch {
      // Caller surfaces the error.
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        className="wf-btn wf-btn-primary"
        disabled={blocked}
        onClick={handleSaveClick}
        onDoubleClick={(e) => e.preventDefault()}
      >
        {saving || busy ? "Saving…" : saveLabel}
      </button>
      {onCancel ? (
        <button
          type="button"
          className="wf-btn wf-btn-ghost"
          disabled={saving || busy}
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
