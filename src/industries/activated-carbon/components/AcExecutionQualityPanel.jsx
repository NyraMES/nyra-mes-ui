import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";

import QualityResultForm from "./QualityResultForm";
import { buildQcPayload, emptyQcForm } from "./AcQcDynamicFields";
import useAcOntologyConfig from "../hooks/useAcOntologyConfig";
import { getEnabledQualityParameters } from "../utils/acOntologyConfigStore";

/**
 * Finished-goods quality capture embedded in the QC execution step.
 */
const AcExecutionQualityPanel = forwardRef(function AcExecutionQualityPanel(
  { lot, readOnly = false },
  ref
) {
  const { config: ontologyConfig, loading: configLoading } = useAcOntologyConfig();
  const qualityFields = useMemo(
    () => getEnabledQualityParameters(ontologyConfig),
    [ontologyConfig]
  );
  const [values, setValues] = useState({});

  useEffect(() => {
    setValues((prev) => ({
      ...emptyQcForm(qualityFields),
      qc_status: prev.qc_status || "PASSED",
      ...prev
    }));
  }, [qualityFields]);

  useImperativeHandle(
    ref,
    () => ({
      validate() {
        if (readOnly) return true;
        return Boolean(values.qc_status);
      },
      getPayload() {
        const production_lot_id = lot?.production_lot_id || lot?.lot_id;
        return {
          production_lot_id,
          status: values.qc_status || "PASSED",
          ...buildQcPayload(values, qualityFields)
        };
      }
    }),
    [readOnly, values, qualityFields, lot]
  );

  const lotId = String(lot?.production_lot_id || lot?.lot_id || lot?.lot_code || "");

  return (
    <div className="rounded-xl border border-cyan-400/20 bg-slate-900/50 p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold text-slate-100">Quality testing</div>
        <div className="text-xs text-slate-400 mt-0.5">
          Record finished-goods test results — parameters from Masters → Ontology & UI.
        </div>
      </div>
      {configLoading ? (
        <p className="text-xs text-slate-500">Loading quality parameters…</p>
      ) : (
        <QualityResultForm
          lotId={lotId}
          lots={lot ? [lot] : []}
          lotsLoading={false}
          hideLotSelect
          disabled={readOnly}
          values={values}
          fields={qualityFields}
          onChange={(field, val) => setValues((prev) => ({ ...prev, [field]: val }))}
        />
      )}
    </div>
  );
});

export default AcExecutionQualityPanel;
