import { Link } from "react-router-dom";

import useIndustryBasePath from "../../../hooks/useIndustryBasePath";
import { AC_ACTIVATION_FLOW_STEPS } from "../constants/acActivationFlowConstants";

/**
 * Shop-floor path after Raw Material release — Execution (kiln feed first).
 * Triplet ontology stages lot-scoped URIs from kiln feed onward.
 */
export default function AcActivationProductionFlow({
  activeStepId = "execution",
  lotCode = null,
  className = ""
}) {
  const basePath = useIndustryBasePath();
  const lotQuery = lotCode ? `?lot=${encodeURIComponent(lotCode)}` : "";

  return (
    <nav
      className={`wf-light-panel rounded-xl border border-slate-200/80 px-3 py-3 ${className}`}
      aria-label="Activation production flow"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
        After raw material release
      </p>
      <ol className="flex flex-wrap items-stretch gap-1">
        {AC_ACTIVATION_FLOW_STEPS.map((step, index) => {
          const href = `${basePath}${step.pathSuffix}${lotQuery}`;
          const isActive = step.id === activeStepId;
          return (
            <li key={step.id} className="flex items-center min-w-0">
              <Link
                to={href}
                className={`rounded-lg px-2.5 py-2 text-left transition-colors min-w-[4.5rem] ${
                  isActive
                    ? "bg-cyan-600/15 border border-cyan-500/40 text-slate-900"
                    : "border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                title={step.hint}
              >
                <span className="block text-[11px] font-semibold leading-tight">{step.label}</span>
                <span className="block text-[9px] opacity-70 mt-0.5 leading-tight">{step.hint}</span>
              </Link>
              {index < AC_ACTIVATION_FLOW_STEPS.length - 1 ? (
                <span className="text-slate-300 px-0.5 select-none" aria-hidden>
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
        Use <span className="font-mono">LOT-AC-*</span> on Execution — not the inward order code.
        Kiln feed is first; routing is created automatically after Load.
      </p>
    </nav>
  );
}
