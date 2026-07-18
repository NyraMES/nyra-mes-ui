import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "../../../auth/AuthContext";
import { initialsFromUser } from "../../../auth/roles";
import TenantContextBar from "../../../components/TenantContextBar";

const PATH_LABELS = {
  dashboard: "Intelligence Hub",
  "raw-material-receipt": "Raw Material Receipt",
  "reactor-parameters": "Reactor Parameters",
  "batch-qc": "Batch QC",
  "batch-analytics": "Batch Analytics",
  traceability: "Traceability"
};

export default function ChemTopbar() {
  const location = useLocation();
  const { user, authEnabled, logout } = useAuth();
  const initials = initialsFromUser(user);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const segment =
    location.pathname.replace(/^\/chemical\/?/, "").split("/")[0] || "dashboard";
  const crumb = PATH_LABELS[segment] || "Chemical Processing";

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <TenantContextBar compact className="wf-tenant-context shrink-0" />
          <div className="flex items-center gap-3 min-w-0 border-l border-slate-200 pl-4">
            <span className="text-sm text-slate-500">Workflow Intelligence</span>
            <span className="text-slate-400">/</span>
            <span className="text-sm font-medium text-slate-800 truncate">{crumb}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs text-slate-500 hidden sm:inline">
            {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {authEnabled && user ? (
            <div className="flex items-center gap-2">
              <span
                className="w-8 h-8 rounded-full bg-teal-700 text-white text-xs font-semibold flex items-center justify-center"
                title={user.email || user.username}
              >
                {initials}
              </span>
              <button
                type="button"
                className="text-xs text-slate-600 hover:text-slate-900"
                onClick={() => logout()}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
