import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import DemoWatermark from "../../components/DemoWatermark";
import ContextLoadWarning from "../../components/ContextLoadWarning";
import AskNyraPanel from "../../workflow/AskNyraPanel";
import { WorkflowProvider } from "../../workflow/WorkflowContext";
import { useAppContext } from "../../context/AppContext";
import { getIndustrySelection, mergeIndustrySelectionFallback } from "../../config/industrySelection";
import { applyTenantHeaders } from "../../services/appContextApi";
import api from "../../services/api";
import { AC_ASK_NYRA_SUGGESTIONS } from "./constants/askNyraSuggestions";
import AcSidebar from "./components/AcSidebar";
import AcTopbar from "./components/AcTopbar";
import AcMenuRouteGuard from "./components/AcMenuRouteGuard";
import "./styles/acMasters.css";
import { useAuth } from "../../auth/AuthContext";
import { userIsAcDemoViewer } from "./utils/acMenuAccess";

function ActivatedCarbonLayout() {
  const { context } = useAppContext();
  const { user } = useAuth();
  const hideAskNyra = userIsAcDemoViewer(user?.roles || []);
  const [askOpen, setAskOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const selection = getIndustrySelection("activated-carbon");
    if (!selection) return;
    const merged = mergeIndustrySelectionFallback(
      {
        ...context,
        tenant_code: context.tenant_code || selection.tenant_code,
        workspace_code: context.workspace_code ?? selection.workspace_code
      },
      "activated-carbon"
    );
    applyTenantHeaders(api, merged);
  }, [context.tenant_code, context.workspace_code, context.loaded]);

  return (
    <WorkflowProvider>
      <div className="wf-shell wf-ac-shell flex w-full min-h-screen">
        <DemoWatermark />
        <AcSidebar mobileOpen={navOpen} />
        {navOpen ? (
          <button
            type="button"
            className="wf-ac-sidebar-backdrop"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
          />
        ) : null}
        <div className="wf-content-column wf-ac-content-column">
          <ContextLoadWarning />
          <AcTopbar onOpenMenu={() => setNavOpen(true)} />
          <main className="p-3 sm:p-6 flex-1 wf-page-frame wf-ac-page-frame overflow-y-auto">
            <AcMenuRouteGuard>
              <Outlet />
            </AcMenuRouteGuard>
          </main>
        </div>

        {!hideAskNyra && (
          <>
            <button
              type="button"
              className="wf-ask-fab"
              onClick={() => setAskOpen((v) => !v)}
              title="Ask Nyra"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2 4 6v6c0 4.5 3.5 8.5 8 9 4.5-.5 8-4.5 8-9V6z" />
                <path d="M9 12h6M9 9h6M9 15h4" />
              </svg>
            </button>

            {askOpen && (
              <AskNyraPanel
                onClose={() => setAskOpen(false)}
                suggestions={AC_ASK_NYRA_SUGGESTIONS}
              />
            )}
          </>
        )}
      </div>
    </WorkflowProvider>
  );
}

export default ActivatedCarbonLayout;
