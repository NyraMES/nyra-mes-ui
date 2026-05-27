/** Standard casting route: each step is a process with defined data to capture. */
export const CASTING_ROUTE_PRESETS = [
  {
    process_code: "MOULDING",
    process_name: "Moulding",
    captureLabels: ["Sand type", "Mould ID", "Moisture %", "Mould hardness"]
  },
  {
    process_code: "MELTING",
    process_name: "Melting",
    captureLabels: ["Furnace temp", "Heat number", "Carbon %", "Silicon %"]
  },
  {
    process_code: "POURING",
    process_name: "Pouring",
    captureLabels: ["Pouring temp", "Ladle ID", "Pouring time"]
  },
  {
    process_code: "FETTLING",
    process_name: "Fettling",
    captureLabels: ["Rework qty", "Scrap qty", "Operator"]
  }
];

export function findProcessByCode(processes, code) {
  const target = String(code || "").toUpperCase();
  return processes.find(
    (p) =>
      String(p.process_code || "").toUpperCase() === target ||
      String(p.process_id || "").toUpperCase().includes(target)
  );
}

export function captureSummary(fields) {
  if (!fields?.length) return "";
  return fields
    .map((f) => f.field_label || f.field_name)
    .filter(Boolean)
    .join(", ");
}
