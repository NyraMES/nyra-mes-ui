import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "../../../auth/AuthContext";
import { useAppContext } from "../../../context/AppContext";
import { initialsFromUser } from "../../../auth/roles";
import TenantContextBar from "../../../components/TenantContextBar";

const PATH_LABELS = {
  dashboard: "Intelligence Hub",
  "raw-material": "Raw Material",
  "raw-material-inward": "Raw Material",
  "raw-material-qc": "Raw Material",
  "kiln-feed": "Kiln Feed",
  routing: "Lot Routing",
  "routing-builder": "Routing Builder",
  feasibility: "Feasibility Gate",
  execution: "Execution",
  "kiln-parameters": "Kiln Parameters",
  screening: "Screening",
  "quality-testing": "Quality Testing",
  "yield-analysis": "Yield Analysis",
  traceability: "Traceability",
  masters: "Masters",
  dispatch: "Dispatch"
};

function AcTopbar() {
  const location = useLocation();
  const { user, authEnabled, logout } = useAuth();
  const { context: appContext } = useAppContext();
  const initials = initialsFromUser(user);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const segment = location.pathname.replace(/^\/activated-carbon\/?/, "").split("/")[0] || "dashboard";
  const crumb = PATH_LABELS[segment] || "Activated Carbon";

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <TenantContextBar compact className="wf-tenant-context shrink-0" />
          <div className="flex items-center gap-3 min-w-0 border-l border-slate-200 pl-4">
            <span className="text-sm text-slate-500">Workflow Intelligence</span>
            <span className="text-slate-400">/</span>
            <span className="text-sm text-slate-900 font-medium truncate">{crumb}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 wf-pulse" />
            Plant: {appContext.plant_id || appContext.tenant_code || "—"}
            <span className="text-slate-400 mx-1">·</span>
            {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>

          <div
            className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 ring-2 ring-blue-200 flex items-center justify-center text-sm font-bold text-white"
            title={user?.roleLabel || "User"}
          >
            {initials}
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
