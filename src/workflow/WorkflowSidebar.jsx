import { useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";

import nyraLogo from "../assets/nyra-logo.png";
import {
  WF_SIDEBAR_SECTIONS,
  defaultOpenSections,
  isNavSectionActive,
  filterSidebarSections,
} from "../config/mesNavigation";
import { isDemoReadOnly } from "../config/demoMode";
import { useAppContext } from "../context/AppContext";


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


function WorkflowSidebar() {
  const location = useLocation();
  const { context, loading } = useAppContext();
  const [openSections, setOpenSections] = useState(defaultOpenSections);

  const toggleSection = (id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const tenantLabel = context.tenant_name || "—";
  const templateLabel =
    context.industry_template_name ||
    context.template_display_name ||
    context.template_name ||
    "Industry Template";

  const navSections = filterSidebarSections(WF_SIDEBAR_SECTIONS, context);
  const readOnly = isDemoReadOnly(context);

  return (
    <aside className="wf-sidebar">
      <Link to="/" className="wf-sidebar-brand">
        <img src={nyraLogo} alt="Nyra" className="wf-sidebar-logo" />
        <div className="wf-sidebar-brand-text">
          <span className="wf-sidebar-title">Nyra MES</span>
          <span className="wf-sidebar-subtitle">Multi-tenant Core</span>
        </div>
      </Link>

      <nav className="wf-sidebar-nav" aria-label="Workflow navigation">
        {navSections.map((section) => {
          const isOpen = openSections[section.id];
          const isActive = isNavSectionActive(section, location.pathname);

          return (
            <div
              key={section.id}
              className={
                "wf-nav-section" + (isActive ? " wf-nav-section--active" : "")
              }
            >
              <button
                type="button"
                className="wf-nav-section-toggle"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isOpen}
              >
                <span>{section.label}</span>
                <span className="wf-nav-section-chevron" aria-hidden>
                  {isOpen ? "▾" : "▸"}
                </span>
              </button>

              {isOpen && (
                <div className="wf-nav-section-items">
                  {section.items.map((item) => (
                    <SidebarLink
                      key={item.to}
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
        <div className="wf-sidebar-status">
          <span className="wf-sidebar-status-dot" />
          <span className="wf-sidebar-status-title">nyra_mes_core</span>
        </div>
        <dl className="wf-sidebar-meta">
          <div>
            <dt>Tenant</dt>
            <dd>{loading ? "…" : tenantLabel}</dd>
          </div>
          <div>
            <dt>Template</dt>
            <dd>{loading ? "…" : templateLabel}</dd>
          </div>
        </dl>
        {context.fromFallback && !loading && (
          <p className="wf-sidebar-offline">Context offline</p>
        )}
        {readOnly && (
          <p className="wf-sidebar-demo-note">Demo mode — view only</p>
        )}
      </div>
    </aside>
  );
}

export default WorkflowSidebar;
