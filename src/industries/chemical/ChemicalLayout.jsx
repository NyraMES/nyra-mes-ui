import { useEffect } from "react";
import { Outlet } from "react-router-dom";

import DemoWatermark from "../../components/DemoWatermark";
import ContextLoadWarning from "../../components/ContextLoadWarning";
import { useAppContext } from "../../context/AppContext";
import { getIndustrySelection, mergeIndustrySelectionFallback } from "../../config/industrySelection";
import { applyTenantHeaders } from "../../services/appContextApi";
import api from "../../services/api";
import ChemSidebar from "./components/ChemSidebar";
import ChemTopbar from "./components/ChemTopbar";

export default function ChemicalLayout() {
  const { context } = useAppContext();

  useEffect(() => {
    const selection = getIndustrySelection("chemical");
    if (!selection) return;
    const merged = mergeIndustrySelectionFallback(
      {
        ...context,
        tenant_code: context.tenant_code || selection.tenant_code,
        workspace_code: context.workspace_code ?? selection.workspace_code
      },
      "chemical"
    );
    applyTenantHeaders(api, merged);
  }, [context.tenant_code, context.workspace_code, context.loaded]);

  return (
    <div className="wf-shell wf-ac-shell flex w-full min-h-screen">
      <DemoWatermark />
      <ChemSidebar />
      <div className="wf-content-column wf-ac-content-column">
        <ContextLoadWarning />
        <ChemTopbar />
        <main className="p-6 flex-1 wf-page-frame wf-ac-page-frame overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
