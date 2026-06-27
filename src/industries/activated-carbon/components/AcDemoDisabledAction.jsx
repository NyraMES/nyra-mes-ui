import { AC_DEMO_BLOCKED_HINT } from "../utils/acMenuAccess";

/** Non-interactive stand-in for header / panel CTAs in MES_Demo view. */
export default function AcDemoDisabledAction({ children, className = "wf-btn wf-btn-ghost" }) {
  return (
    <span
      className={`${className} wf-btn--disabled`}
      title={AC_DEMO_BLOCKED_HINT}
      aria-disabled="true"
    >
      {children}
    </span>
  );
}
