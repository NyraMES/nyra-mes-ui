import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAppContext } from "../../../context/AppContext";
import { AC_CAPABILITIES } from "../menu/activatedCarbonMenu";
import { resolveAcAppContext } from "../utils/acContextUtils";
import { SectionHeader } from "../../../workflow/ui";
import RawMaterialInwardPage from "./RawMaterialInwardPage";
import RawMaterialQcPage from "./RawMaterialQcPage";
import AcReleaseToProductionPanel from "../components/AcReleaseToProductionPanel";

import "../styles/acMasters.css";

const TABS = [
  { id: "inward", label: "Raw Material Inward", hint: "Supplier receipt" },
  { id: "qc", label: "Raw Material QC", hint: "Inspect feedstock", capability: AC_CAPABILITIES.RAW_MATERIAL_QC },
  { id: "release", label: "Release to Production", hint: "Start a production lot" }
];

function RawMaterialPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { context } = useAppContext();
  const caps = new Set(resolveAcAppContext(context).enabled_capabilities || []);

  const visibleTabs = useMemo(
    () => TABS.filter((t) => !t.capability || caps.has(t.capability)),
    [caps]
  );

  const initialTab =
    new URLSearchParams(location.search).get("tab") || visibleTabs[0]?.id || "inward";
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    const next = new URLSearchParams(location.search).get("tab");
    if (next && visibleTabs.some((t) => t.id === next)) {
      setTab(next);
    }
  }, [location.search, visibleTabs]);

  const selectTab = (id) => {
    setTab(id);
    navigate({ pathname: location.pathname, search: `?tab=${id}` }, { replace: true });
  };

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === tab)) {
      const fallback = visibleTabs[0]?.id || "inward";
      setTab(fallback);
      navigate({ pathname: location.pathname, search: `?tab=${fallback}` }, { replace: true });
    }
  }, [tab, visibleTabs, navigate, location.pathname]);

  return (
    <div className="max-w-6xl">
      <SectionHeader
        eyebrow="Inbound"
        title="Raw Material"
        subtitle="Record supplier receipts, run QC, then release approved material to production before the feasibility gate."
      />

      <div className="ac-masters-tabs flex flex-wrap gap-2 mb-6 border-b border-white/15">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px text-left ${
              tab === t.id ? "ac-masters-tab--active" : ""
            }`}
            onClick={() => selectTab(t.id)}
            title={t.hint}
          >
            <span className="block">{t.label}</span>
            <span className="block text-[10px] font-normal opacity-70">{t.hint}</span>
          </button>
        ))}
      </div>

      {tab === "inward" && <RawMaterialInwardPage embedded />}
      {tab === "qc" && visibleTabs.some((t) => t.id === "qc") && <RawMaterialQcPage embedded />}
      {tab === "release" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            After QC passes, release quantity from an inward receipt to create a production lot.
            Then open <strong>Feasibility Gate</strong> to validate kiln and routing before kiln
            feed.
          </p>
          <AcReleaseToProductionPanel />
        </div>
      )}
    </div>
  );
}

export default RawMaterialPage;
