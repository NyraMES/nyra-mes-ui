function ParameterReadingGrid({ definitions = [], readings, values = {}, onChange }) {
  const rows =
    definitions.length > 0
      ? definitions.map((d) => ({
          key: d.key,
          parameter: d.label,
          unit: d.unit
        }))
      : readings || [
          { key: "zone1_temp_c", parameter: "Zone 1 Temp (°C)" },
          { key: "zone2_temp_c", parameter: "Zone 2 Temp (°C)" },
          { key: "steam_flow_kg_h", parameter: "Steam Flow (kg/h)" },
          { key: "residence_time_min", parameter: "Residence Time (min)" },
          { key: "o2_pct", parameter: "O₂ (%)" }
        ];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-600">
            <th className="py-2 pr-4 font-medium">Parameter</th>
            <th className="py-2 font-medium">Reading</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const fieldKey = row.key || row.parameter;
            return (
              <tr key={fieldKey} className="border-b border-slate-100">
                <td className="py-2 pr-4 text-slate-800">
                  {row.parameter}
                  {row.unit ? (
                    <span className="text-slate-500 text-xs ml-1">({row.unit})</span>
                  ) : null}
                </td>
                <td className="py-2">
                  <input
                    type="text"
                    className="w-full max-w-xs rounded border border-slate-300 px-2 py-1"
                    placeholder="Enter value"
                    value={values[fieldKey] ?? row.value ?? ""}
                    onChange={(e) => onChange?.(fieldKey, e.target.value)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ParameterReadingGrid;
