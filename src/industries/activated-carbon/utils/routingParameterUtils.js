import { buildTripletPreview, normalizeTripletParameter, resolvePredicateUri } from "../constants/processTripletTemplates";

export function attachParametersToOperations(operations = [], processParameters = []) {
  const sorted = [...operations].sort(
    (a, b) => (Number(a.operation_sequence) || 0) - (Number(b.operation_sequence) || 0)
  );

  return sorted.map((op) => {
    const step = (op.process_step || "").toUpperCase();
    const stepParams = (processParameters || [])
      .filter((p) => p.process_step && String(p.process_step).toUpperCase() === step)
      .map((p) => normalizeTripletParameter({ ...p, process_step: step }));
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
      const key = `${step}:${raw.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(normalizeTripletParameter({ ...raw, process_step: step }));
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

export function resequenceOperations(ops) {
  return [...ops]
    .sort((a, b) => (Number(a.operation_sequence) || 0) - (Number(b.operation_sequence) || 0))
    .map((op, index) => ({ ...op, operation_sequence: index + 1 }));
}

export function reorderOperations(operations, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return operations;
  const ops = resequenceOperations(operations);
  if (fromIndex >= ops.length || toIndex >= ops.length) return ops;
  const [moved] = ops.splice(fromIndex, 1);
  ops.splice(toIndex, 0, moved);
  return resequenceOperations(ops);
}

export function executionTripletCount(op) {
  return (op.parameters || []).filter((p) => (p.used_at || "execution") !== "feasibility").length;
}
