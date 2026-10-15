export function isScrapKilnParameter(definition) {
  const blob = `${definition?.key || ""} ${definition?.label || ""}`;
  return /scrap/i.test(blob);
}

export function formatKilnParameters(parameters) {
  if (!parameters || typeof parameters !== "object") return "";
  const labels = Object.fromEntries(
    AC_KILN_PARAMETER_DEFINITIONS.map((row) => [row.key, row.label])
  );
  return Object.entries(parameters)
    .filter(([key, value]) => value != null && value !== "" && !/scrap/i.test(key))
    .map(([key, value]) => `${labels[key] || key}: ${value}`)
    .join(" · ");
}

/** Fallback kiln parameter catalog when API is unreachable. */
export const AC_KILN_PARAMETER_DEFINITIONS = [
  { key: "zone1_temp_c", label: "Zone 1 Temp (°C)", unit: "°C" },
  { key: "zone2_temp_c", label: "Zone 2 Temp (°C)", unit: "°C" },
  { key: "steam_flow_kg_h", label: "Steam Flow (kg/h)", unit: "kg/h" },
  { key: "residence_time_min", label: "Residence Time (min)", unit: "min" },
  { key: "o2_pct", label: "O₂ (%)", unit: "%" },
  { key: "kiln_temp_c", label: "Kiln Temp (°C)", unit: "°C" },
  { key: "pressure_bar", label: "Pressure (bar)", unit: "bar" }
];
