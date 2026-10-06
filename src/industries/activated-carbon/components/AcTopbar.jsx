import { useLocation } from "react-router-dom";

import { useAuth } from "../../../auth/AuthContext";
import { useAppContext } from "../../../context/AppContext";
import TenantContextBar from "../../../components/TenantContextBar";
import grCarbonsLogo from "../../../assets/tenants/gr-carbons-logo.svg";

const PATH_LABELS = {
  dashboard: "Dashboard",
  "raw-material": "Raw Material",
  "raw-material-inward": "Raw Material",
  "raw-material-qc": "Raw Material",
  "kiln-feed": "Execution",
  routing: "Execution",
  "routing-builder": "Routing Builder",
  feasibility: "Feasibility Gate",
  execution: "Execution",
  "kiln-parameters": "Execution",
  screening: "Execution",
  "quality-testing": "Execution",
  "yield-analysis": "Intelligence Hub",
  traceability: "Intelligence Hub",
  masters: "Masters",
  users: "Users",
  dispatch: "Dispatch"
};

function AcTopbar() {
  const location = useLocation();
  const { user, authEnabled, logout } = useAuth();
  const { context: appContext } = useAppContext();

  const segment = location.pathname.replace(/^\/activated-carbon\/?/, "").split("/")[0] || "dashboard";
  const crumb = PATH_LABELS[segment] || "Activated Carbon";
  const tenantCode = String(appContext.tenant_code || "").toUpperCase();
  const showGrCarbonsLogo = tenantCode === "GR_CARBONS";
  const userId = user?.username || user?.email || user?.displayName || "—";

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="relative px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {showGrCarbonsLogo ? (
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm text-slate-500">Workflow Intelligence</span>
              <span className="text-slate-400">/</span>
              <span className="text-sm text-slate-900 font-medium truncate">{crumb}</span>
            </div>
          ) : (
            <>
              <TenantContextBar compact className="wf-tenant-context shrink-0" />
              <div className="flex items-center gap-3 min-w-0 border-l border-slate-200 pl-4">
                <span className="text-sm text-slate-500">Workflow Intelligence</span>
                <span className="text-slate-400">/</span>
                <span className="text-sm text-slate-900 font-medium truncate">{crumb}</span>
              </div>
            </>
          )}
        </div>

        {showGrCarbonsLogo ? (
          <img
            src={grCarbonsLogo}
            alt="GR Carbons"
            className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-auto object-contain pointer-events-none"
          />
        ) : null}

        <div className="flex items-center gap-2 shrink-0">
          <div
            className="max-w-[14rem] truncate text-sm font-medium text-slate-800"
            title={userId}
          >
            {userId}
          </div>
          {authEnabled && (
            <button
              type="button"
              onClick={() => logout()}
              className="text-xs px-2 py-1.5 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default AcTopbar;
