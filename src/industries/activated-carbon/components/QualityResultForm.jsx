import AcFormSelect from "./AcFormSelect";

function QualityResultForm({
  lotId,
  lots = [],
  lotsLoading = false,
  onLotChange,
  values = {},
  onChange,
  disabled = false
}) {
  const set = (field) => (e) => onChange?.(field, e.target.value);

  return (
    <form className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
      <AcFormSelect
        label="Production lot"
        className="md:col-span-2"
        value={lotId}
        loading={lotsLoading}
        onChange={(e) => onLotChange?.(e.target.value)}
      >
        {lots.map((lot) => {
          const value = String(lot.production_lot_id || lot.lot_id || lot.lot_code || "");
          return (
            <option key={value || lot.lot_code} value={value}>
              {lot.lot_code || value} · {lot.lot_quantity} KG
            </option>
          );
        })}
      </AcFormSelect>
      <label className="text-sm">
        <span className="block mb-1 font-medium text-slate-700">Iodine number</span>
        <input
          type="number"
          className="w-full rounded border border-slate-300 px-3 py-2"
          placeholder="mg/g"
          value={values.iodine_mg_g || ""}
          disabled={disabled}
          onChange={set("iodine_mg_g")}
        />
      </label>
      <label className="text-sm">
        <span className="block mb-1 font-medium text-slate-700">Ash (%)</span>
        <input
          type="number"
          step="0.01"
          className="w-full rounded border border-slate-300 px-3 py-2"
          value={values.ash_pct || ""}
          disabled={disabled}
          onChange={set("ash_pct")}
        />
      </label>
      <label className="text-sm">
        <span className="block mb-1 font-medium text-slate-700">Moisture (%)</span>
        <input
          type="number"
          step="0.01"
          className="w-full rounded border border-slate-300 px-3 py-2"
          value={values.moisture_pct || ""}
          disabled={disabled}
          onChange={set("moisture_pct")}
        />
      </label>
      <label className="text-sm">
        <span className="block mb-1 font-medium text-slate-700">Bulk density</span>
        <input
          type="text"
          className="w-full rounded border border-slate-300 px-3 py-2"
          placeholder="g/cm³"
          value={values.bulk_density || ""}
          disabled={disabled}
          onChange={set("bulk_density")}
        />
      </label>
      <AcFormSelect
        label="QC result"
        className="md:col-span-2"
        value={values.qc_status || "PASSED"}
        disabled={disabled}
        onChange={(e) => onChange?.("qc_status", e.target.value)}
      >
        <option value="PASSED">Passed — add to finished-goods stock</option>
        <option value="OPEN">Open — record only (no stock)</option>
        <option value="FAIL">Failed — hold lot</option>
      </AcFormSelect>
      <label className="text-sm md:col-span-2">
        <span className="block mb-1 font-medium text-slate-700">Remarks</span>
        <textarea
          rows={3}
          className="w-full rounded border border-slate-300 px-3 py-2"
          placeholder="Optional notes"
          value={values.remarks || ""}
          disabled={disabled}
          onChange={set("remarks")}
        />
      </label>
    </form>
  );
}

export default QualityResultForm;
