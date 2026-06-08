const SAMPLE_TRACE = [
  { stage: "Raw Material", ref: "RM-LOT-1042", detail: "Coconut shell — 12 MT" },
  { stage: "Kiln Feed", ref: "CHARGE-88", detail: "Kiln 01 — 4.2 MT" },
  { stage: "Activation", ref: "BATCH-AC-441", detail: "Cycle complete" },
  { stage: "Screening", ref: "SCR-441-A", detail: "8×30 mesh — 3.1 MT" },
  { stage: "Quality", ref: "QC-441", detail: "Iodine 980 mg/g — Pass" }
];

function BatchTraceabilityView({ trace = SAMPLE_TRACE }) {
  return (
    <ol className="relative border-l border-slate-200 ml-3 space-y-6">
      {trace.map((step) => (
        <li key={step.ref} className="ml-6">
          <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-[#08264a]" />
          <div className="text-xs uppercase tracking-wider text-slate-500">
            {step.stage}
          </div>
          <div className="font-mono text-sm font-medium text-slate-900">
            {step.ref}
          </div>
          <div className="text-sm text-slate-600">{step.detail}</div>
        </li>
      ))}
    </ol>
  );
}

export default BatchTraceabilityView;
