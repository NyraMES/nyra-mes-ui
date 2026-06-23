/** Standard AC process steps for routing nodes. */
export const AC_PROCESS_STEP_OPTIONS = [
  { value: "PYROLYSIS", label: "Pyrolysis / Carbonization" },
  { value: "ACTIVATION", label: "Steam Activation" },
  { value: "DRYING", label: "Drying" },
  { value: "GRINDING", label: "Grinding / Milling" },
  { value: "SCREENING", label: "Screening & Classification" },
  { value: "QC", label: "Quality Testing" },
  { value: "PACKING", label: "Packing" }
];

export function defaultOperationForStep(processStep, sequence) {
  const opt = AC_PROCESS_STEP_OPTIONS.find((o) => o.value === processStep);
  const code = `OP-${processStep}`;
  return {
    operation_sequence: sequence,
    operation_name: opt?.label || processStep,
    operation_code: code,
    process_step: processStep
  };
}

export function nextOperationSequence(operations) {
  if (!operations?.length) return 1;
  return Math.max(...operations.map((o) => Number(o.operation_sequence) || 0)) + 1;
}

export function suggestOperationCode(processStep, sequence) {
  return `OP-${(processStep || "STEP").toUpperCase().replace(/\s+/g, "-")}`;
}
