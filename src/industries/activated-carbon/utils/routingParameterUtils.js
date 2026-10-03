import { buildTripletPreview, normalizeTripletParameter, resolvePredicateUri } from "../constants/processTripletTemplates";

export function attachParametersToOperations(operations = [], processParameters = []) {
  const sorted = sortOperationsBySequence(operations);

  return sorted.map((op) => {
    const step = (op.process_step || "").toUpperCase();
    const opCode = String(op.operation_code || "").toUpperCase();
    const stepParams = (processParameters || [])
      .filter((p) => {
        const bound = String(p.operation_code || "").toUpperCase();
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
