import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import { useWorkflow } from "./WorkflowContext";
import { useAuth } from "../auth/AuthContext";
import { useAppContext } from "../context/AppContext";
import { initialsFromUser } from "../auth/roles";
import TenantContextBar from "../components/TenantContextBar";


function WorkflowTopbar() {
  const location = useLocation();
  const { context: workflowContext, reset } = useWorkflow();
  const { user, authEnabled, logout } = useAuth();
  const { context: appContext } = useAppContext();
  const initials = initialsFromUser(user);

  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const breadcrumbs = buildBreadcrumbs(location.pathname);

  const hasContext =
    workflowContext.orderId ||
    workflowContext.lotId ||
    workflowContext.productionOrderId;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <TenantContextBar compact className="wf-tenant-context shrink-0" />
          <div className="flex items-center gap-3 min-w-0 border-l border-slate-200 pl-4">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-3 text-sm">
              {i > 0 && <span className="text-slate-600">/</span>}
              <span
                className={
                  i === breadcrumbs.length - 1
                    ? "text-slate-900 font-medium"
                    : "text-slate-500"
                }
              >
                {b}
              </span>
            </span>
          ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasContext && (
            <>
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 wf-pulse" />
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Workflow</span>
                {workflowContext.customerName && <Crumb v={workflowContext.customerName} />}
                {workflowContext.orderId && <Crumb v={workflowContext.orderId} />}
                {workflowContext.productionOrderId && (
                  <Crumb v={workflowContext.productionOrderId} />
                )}
                {workflowContext.lotId && <Crumb v={workflowContext.lotId} />}
              </div>
              <button
                type="button"
                onClick={reset}
                className="text-xs px-2 py-1.5 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
                title="Reset workflow context"
              >
                Reset
              </button>
            </>
          )}

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 wf-pulse" />
            Plant: {appContext.plant_id || "—"}
            <span className="text-slate-600 mx-1">·</span>
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

function Crumb({ v }) {
  return (
    <span className="text-slate-700 font-mono">
      <span className="text-slate-600 mx-1">→</span>
      {v}
    </span>
  );
}

function buildBreadcrumbs(pathname) {
  if (pathname === "/workflow") return ["Workflow Intelligence"];
  const parts = pathname.replace(/^\//, "").split("/");
  const map = {
    workflow: "Workflow",
    "customer-order": "Customer Order",
    "production-order": "Production Order",
    "lot-split": "Lot Split",
    routing: "Routing Flow",
    feasibility: "Feasibility",
    scheduling: "Scheduling Board",
    execution: "Execution",
    inspection: "Inspection & NCR",
    dispatch: "Dispatch Gate",
    traceability: "Traceability",
    oee: "OEE Intelligence",
    ontology: "Domain Graph",
    kg: "KG Triples",
    routings: "Routings",
    masters: "Master Data",
    customers: "Customers",
    parts: "Parts"
  };
  return parts.map((p) => map[p] || p);
}

export default WorkflowTopbar;
