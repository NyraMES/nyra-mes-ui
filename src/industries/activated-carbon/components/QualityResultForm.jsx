import AcFormSelect from "./AcFormSelect";
import { AcQcFieldInput } from "./AcQcDynamicFields";

function lotOptionValue(lot) {
  return String(lot.production_lot_id || lot.lot_id || lot.lot_code || "");
}

function QualityResultForm({
  lotId,
  lots = [],
  lotsLoading = false,
  onLotChange,
  values = {},
  onChange,
  fields = [],
  disabled = false,
  hideLotSelect = false
}) {
  const inputFields = fields.filter((f) => f.fieldType !== "textarea");
  const textareaFields = fields.filter((f) => f.fieldType === "textarea");

  return (
    <form className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
      {!hideLotSelect && (
        <AcFormSelect
          label="Production lot"
          className="md:col-span-2"
          value={lotId}
          loading={lotsLoading}
          onChange={(e) => onLotChange?.(e.target.value)}
        >
          {lots.map((lot) => {
            const value = lotOptionValue(lot);
            return (
              <option key={value || lot.lot_code} value={value}>
                {lot.lot_code || value} · {lot.lot_quantity} KG
              </option>
            );
          })}
        </AcFormSelect>
      )}

      {inputFields.map((field) => (
        <AcQcFieldInput
          key={field.key}
          field={field}
          value={values[field.key]}
          tone="light"
          disabled={disabled}
          onChange={onChange}
        />
      ))}

      <AcFormSelect
        label="QC disposition"
        className="md:col-span-2"
        value={values.qc_status || "PASSED"}
        disabled={disabled}
        onChange={(e) => onChange?.("qc_status", e.target.value)}
      >
        <option value="PASSED">Release to in-stock</option>
        <option value="OPEN">Record only — no stock movement</option>
        <option value="HOLD">Hold for review</option>
        <option value="SCRAPPED">Scrap / reject lot</option>
      </AcFormSelect>

      {textareaFields.map((field) => (
        <AcQcFieldInput
          key={field.key}
          field={field}
          value={values[field.key]}
          tone="light"
          disabled={disabled}
          onChange={onChange}
        />
      ))}
    </form>
  );
}

export default QualityResultForm;
