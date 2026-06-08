import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

import nyraLogo from "../../../assets/nyra-logo.png";
import { useAppContext } from "../../../context/AppContext";
import { getActivatedCarbonMenu } from "../menu/activatedCarbonMenu";

function SidebarLink({ to, label, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        "wf-nav-link" + (isActive ? " wf-nav-link--active" : "")
      }
    >
      <span className="wf-nav-link-label">{label}</span>
    </NavLink>
  );
}

const SECTIONS = [
  { id: "overview", label: "Overview", ids: ["dashboard"] },
  {
    id: "production",
    label: "Production Flow",
    ids: [
      "raw-material",
      "raw-material-qc",
      "kiln-feed",
      "feasibility",
      "routing",
      "execution",
      "kiln-parameters",
      "quality-testing",
      "customer-sales",
      "dispatch",
      "yield",
      "traceability"
    ]
  },
  {
    id: "masters",
    label: "Master Data & Admin",
    ids: ["masters", "routing-builder"]
  }
];

function AcSidebar() {
  const { context } = useAppContext();
  const menuItems = getActivatedCarbonMenu(context.enabled_capabilities);
  const byId = Object.fromEntries(menuItems.map((item) => [item.id, item]));
  const [openSections, setOpenSections] = useState({
    overview: true,
    production: true,
    masters: true
  });

  const templateLabel =
    context.industry_template_name ||
    context.template_display_name ||
    "Activated Carbon";

  return (
    <aside className="wf-sidebar">
      <Link to="/" className="wf-sidebar-brand">
        <img src={nyraLogo} alt="Nyra" className="wf-sidebar-logo" />
        <div className="wf-sidebar-brand-text">
          <span className="wf-sidebar-title">Nyra MES</span>
          <span className="wf-sidebar-subtitle">{templateLabel}</span>
        </div>
      </Link>

      <nav className="wf-sidebar-nav" aria-label="Activated Carbon navigation">
        {SECTIONS.map((section) => {
          const items = section.ids.map((id) => byId[id]).filter(Boolean);
          if (!items.length) return null;
          const isOpen = openSections[section.id];
          return (
            <div key={section.id} className="wf-nav-section wf-nav-section--active">
              <button
                type="button"
                className="wf-nav-section-toggle"
                onClick={() =>
                  setOpenSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))
                }
                aria-expanded={isOpen}
              >
                <span>{section.label}</span>
                <span className="wf-nav-section-chevron" aria-hidden>
                  {isOpen ? "▾" : "▸"}
                </span>
              </button>
              {isOpen && (
                <div className="wf-nav-section-links">
                  {items.map((item) => (
                    <SidebarLink
                      key={item.id}
                      to={item.to}
                      label={item.label}
                      end={item.end}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="wf-sidebar-footer">
        <div className="wf-sidebar-footer-line">
          <span className="wf-sidebar-footer-label">Tenant</span>
          <span className="wf-sidebar-footer-value">{context.tenant_name || "—"}</span>
        </div>
        <div className="wf-sidebar-footer-line">
          <span className="wf-sidebar-footer-label">Workspace</span>
          <span className="wf-sidebar-footer-value">
            {context.workspace_name || context.workspace_code || "—"}
          </span>
        </div>
      </div>
    </aside>
  );
}

export default AcSidebar;
