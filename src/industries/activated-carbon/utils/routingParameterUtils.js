import { buildTripletPreview, normalizeTripletParameter, resolvePredicateUri } from "../constants/processTripletTemplates";

function isDestonQualityParam(param) {
  const key = String(param?.key || param?.parameter_code || "").toLowerCase();
  const bound = String(param?.operation_code || "").toUpperCase();
  return (
    bound === "OP-DESTON-QC" ||
    key.startsWith("deston_qc") ||
    key === "deston_copy_from_kiln_bag"
  );
}

function isDestonQualityOp(op) {
  const code = String(op?.operation_code || "").toUpperCase();
  const name = String(op?.operation_name || "").toLowerCase();
  return (
    (code.includes("DESTON") && (code.includes("QC") || code.includes("QUALITY"))) ||
    (name.includes("deston") && (name.includes("quality") || name.includes("qc")))
  );
}

export function attachParametersToOperations(operations = [], processParameters = []) {
  const sorted = sortOperationsBySequence(operations);

  return sorted.map((op) => {
    const step = (op.process_step || "").toUpperCase();
    const opCode = String(op.operation_code || "").toUpperCase();
    const destonQuality = isDestonQualityOp(op);
    const stepParams = (processParameters || [])
      .filter((p) => {
        const bound = String(p.operation_code || "").toUpperCase();
        if (destonQuality && isDestonQualityParam(p)) return true;
        if (opCode && bound) return bound === opCode;
        if (opCode && !bound) return false;
        return p.process_step && String(p.process_step).toUpperCase() === step;
      })
      .map((p) => normalizeTripletParameter({ ...p, process_step: step, operation_code: op.operation_code }));
    const inline = (op.parameters || []).map((p) =>
      normalizeTripletParameter({ ...p, process_step: step })
    );
    const merged = [...stepParams];
    for (const p of inline) {
      if (!merged.some((m) => m.key === p.key)) merged.push(p);
    }
    return { ...op, parameters: merged };
  });
}

export function flattenOperationParameters(operations = [], globalParameters = []) {
  const out = [];
  const seen = new Set();

  for (const op of operations) {
    const step = (op.process_step || "").trim().toUpperCase();
    for (const raw of op.parameters || []) {
      if (!raw.key?.trim()) continue;
      const opCode = (op.operation_code || raw.operation_code || "").trim();
      const key = `${opCode}:${step}:${raw.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        normalizeTripletParameter({
          ...raw,
          process_step: step,
          operation_code: opCode || undefined
        })
      );
    }
  }

  for (const raw of globalParameters || []) {
    if (!raw.key?.trim() || raw.process_step) continue;
    const key = `global:${raw.key}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalizeTripletParameter(raw));
  }

  return out;
}

export { buildTripletPreview, resolvePredicateUri };

/** Preserve array order; only refresh operation_sequence (1-based). */
export function resequenceOperations(ops) {
  return [...ops].map((op, index) => ({ ...op, operation_sequence: index + 1 }));
}

/** Load from API — sort by stored sequence, then renumber. */
export function sortOperationsBySequence(ops) {
  return resequenceOperations(
    [...ops].sort(
      (a, b) => (Number(a.operation_sequence) || 0) - (Number(b.operation_sequence) || 0)
    )
  );
}

export function reorderOperations(operations, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return operations;
  const ops = [...operations];
  if (fromIndex >= ops.length || toIndex >= ops.length) return resequenceOperations(ops);
  const [moved] = ops.splice(fromIndex, 1);
  ops.splice(toIndex, 0, moved);
  return resequenceOperations(ops);
}

export function executionTripletCount(op) {
  return (op.parameters || []).filter((p) => (p.used_at || "execution") !== "feasibility").length;
}
