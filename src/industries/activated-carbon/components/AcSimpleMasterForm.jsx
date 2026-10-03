import AcSaveBar from "./AcSaveBar";

/**
 * Plain-language single-field form for shop-floor admins (minimal typing, large controls).
 */
export default function AcSimpleMasterForm({
  step = 1,
  title,
  helpText,
  fieldLabel,
  placeholder,
  value,
  onChange,
  onSave,
  saving = false,
  saveLabel = "Save",
  disabled = false
}) {
  return (
    <div className="ac-simple-master-form wf-light-panel rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white"
          aria-hidden="true"
        >
          {step}
        </span>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {helpText ? (
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">{helpText}</p>
          ) : null}
        </div>
      </div>

      <label className="block max-w-lg">
        <span className="mb-2 block text-base font-medium text-slate-800">{fieldLabel}</span>
        <input
          type="text"
          className="w-full rounded-lg border-2 border-slate-300 px-4 py-3 text-lg text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled || saving}
          autoComplete="off"
        />
      </label>

      <div className="mt-4">
        <AcSaveBar
          onSave={onSave}
          saving={saving}
          saveLabel={saveLabel}
          disabled={disabled || !String(value || "").trim()}
        />
      </div>
    </div>
  );
}
