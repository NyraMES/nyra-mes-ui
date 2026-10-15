export default function AcActivationFlow() {
  const steps = ["Kiln Feed", "Kiln Output", "Destoning"];
  return (
    <div className="rounded-xl px-4 py-4 text-white" style={{ background: "#0c3f78" }}>
      <p className="text-[11px] uppercase tracking-widest text-blue-100 m-0 mb-3">Activation process flow</p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        {steps.map((label, index) => (
          <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
            <div className="rounded-xl border border-sky-300/70 bg-sky-900/40 px-4 py-3 text-center font-semibold min-w-[8.5rem]">
              {label}
            </div>
            {index < steps.length - 1 ? (
              <span className="text-sky-200 text-lg sm:text-xl" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="text-xs text-blue-100 mt-3 mb-0">Kiln parameters — current settings, change log, and the settings on each output bag.</p>
    </div>
  );
}
