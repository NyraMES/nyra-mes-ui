import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../../auth/AuthContext";
import { useAppContext } from "../../../context/AppContext";
import { AC_CAPABILITIES } from "../menu/activatedCarbonMenu";
import { resolveAcAppContext } from "../utils/acContextUtils";
import { acRawMaterialTabsForRoles } from "../utils/acPrivileges";
import { SectionHeader } from "../../../workflow/ui";
import RawMaterialInwardPage from "./RawMaterialInwardPage";
import RawMaterialInboundPrepPage from "./RawMaterialInboundPrepPage";
import AcReleaseToProductionPanel from "../components/AcReleaseToProductionPanel";
import AcSectionReportsPanel from "../components/AcSectionReportsPanel";

import "../styles/acMasters.css";

const TABS = [
  { id: "inward", label: "1 · Gate receipt", hint: "DC and weight" },
  { id: "prep", label: "2 · Inbound prep", hint: "Bag generation · Lab · GRN" },
  { id: "release", label: "3 · Release to production", hint: "Release inward order" },
  { id: "reports", label: "4 · Reports", hint: "Summary · details · Excel" }
];

function RawMaterialPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { context } = useAppContext();
  const caps = new Set(resolveAcAppContext(context).enabled_capabilities || []);
  const allowedTabs = useMemo(
    () => new Set(acRawMaterialTabsForRoles(user?.roles || [], user)),
    [user]
  );

  const visibleTabs = useMemo(
    () => TABS.filter((t) => allowedTabs.has(t.id) && (!t.capability || caps.has(t.capability))),
    [allowedTabs, caps]
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
        subtitle="Gate receipt, then Inbound prep. The RMS engineer generates bags there. Lab and GRN follow, then Release to production."
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

      {tab === "inward" && (
        <RawMaterialInwardPage embedded />
      )}
      {tab === "prep" && (
        <RawMaterialInboundPrepPage
          onReadyForRelease={() => {
            selectTab("release");
          }}
        />
      )}
      {tab === "release" && <AcReleaseToProductionPanel />}
      {tab === "reports" && <AcSectionReportsPanel section="raw_material" />}
    </div>
  );
}

export default RawMaterialPage;
