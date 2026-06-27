import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";

function paramKey(param) {
  return param.parameter_code || param.parameter_id || param.parameter_name;
}

function validateAcParameters(parameters, values, allowEmpty = false) {
  const errors = {};
  for (const param of parameters) {
    const key = paramKey(param);
    const label = param.parameter_name || param.parameter_code || key;
    const raw = values[key];

    if (param.mandatory && !allowEmpty) {
      if (param.data_type === "boolean") {
        if (raw !== true && raw !== false) {
          errors[key] = `${label} is required.`;
        }
      } else if (raw === "" || raw === null || raw === undefined) {
        errors[key] = `${label} is required.`;
      }
    }

    if (param.data_type === "number" && raw !== "" && raw !== null && raw !== undefined) {
      const num = Number(raw);
      if (Number.isNaN(num)) {
        errors[key] = `${label} must be a number.`;
      } else {
        if (param.min_value != null && num < Number(param.min_value)) {
          errors[key] = `${label} must be ≥ ${param.min_value}.`;
        }
        if (param.max_value != null && num > Number(param.max_value)) {
          errors[key] = `${label} must be ≤ ${param.max_value}.`;
        }
      }
    }
  }
  return errors;
}

const AcExecutionParameterCapture = forwardRef(function AcExecutionParameterCapture(
  {
    parameters = [],
    readOnly = false,
    allowEmpty = false,
    seedValues = null,
    title = "Capture parameters",
    subtitle = "Enter actual values for each parameter defined in Routing Builder.",
    emptyHint = null
  },
  ref
) {
  const [values, setValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  const sortedParams = useMemo(
    () =>
      [...parameters].sort(
        (a, b) => (a.display_order ?? a.parameter_seq ?? 0) - (b.display_order ?? b.parameter_seq ?? 0)
      ),
    [parameters]
  );

  useEffect(() => {
    const initial = {};
    for (const param of sortedParams) {
      const key = paramKey(param);
      if (seedValues && seedValues[key] !== undefined && seedValues[key] !== "") {
        initial[key] = seedValues[key];
      } else {
        initial[key] =
          param.default_value != null && param.default_value !== ""
            ? param.default_value
            : param.data_type === "boolean"
              ? false
              : "";
      }
    }
    setValues(initial);
    setFieldErrors({});
  }, [sortedParams, seedValues]);

  const setValue = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const runValidation = () => {
    const errors = validateAcParameters(sortedParams, values, allowEmpty);
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  useImperativeHandle(ref, () => ({
    hasTemplates: sortedParams.length > 0,
    loading: false,
    validate: runValidation,
    submit: async () => runValidation(),
    getValues: () => values
  }));

  if (!sortedParams.length) {
    if (emptyHint === null) {
      return (
        <div className="text-xs text-slate-200 py-1">
          No capture parameters defined for this operation.
          <span className="block mt-1 text-slate-300">
            Add them in Routing Builder for this step, then return here.
          </span>
        </div>
      );
    }
    if (emptyHint === false) {
      return null;
    }
    return (
      <div className="text-xs text-slate-400 py-1">{emptyHint}</div>
    );
  }

  return (
    <div className="space-y-4">
      {readOnly && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Start this operation to enter values. Parameters below will be required on complete.
        </div>
      )}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-white font-semibold">{title}</div>
        <div className="text-xs text-slate-200 mt-1">{subtitle}</div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 space-y-3">
        {sortedParams.map((param) => {
          const key = paramKey(param);
          const err = fieldErrors[key];
          const label = param.parameter_name || param.parameter_code;
          const inputClass = err
            ? "wf-input border-red-400/60 bg-red-500/10 text-slate-900"
            : "wf-input text-slate-900 bg-white";

          if (param.data_type === "boolean") {
            return (
              <div key={key}>
                <label className="flex items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={!!values[key]}
                    disabled={readOnly}
                    onChange={(e) => setValue(key, e.target.checked)}
                  />
                  {label}
                  {param.mandatory ? <span className="text-red-300">*</span> : null}
                </label>
                {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
              </div>
            );
          }

          return (
            <div key={key}>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white">
                {label}
                {param.unit ? (
                  <span className="normal-case text-slate-300 ml-1">({param.unit})</span>
                ) : null}
                {param.mandatory ? <span className="text-red-300 ml-1">*</span> : null}
              </label>
              <input
                type={param.data_type === "number" ? "number" : "text"}
                className={inputClass}
                value={values[key] ?? ""}
                disabled={readOnly}
                onChange={(e) => setValue(key, e.target.value)}
              />
              {param.data_type === "number" &&
                (param.min_value != null || param.max_value != null) && (
                  <p className="mt-1 text-xs text-slate-300">
                    Range: {param.min_value ?? "—"} to {param.max_value ?? "—"}
                  </p>
                )}
              {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default AcExecutionParameterCapture;
