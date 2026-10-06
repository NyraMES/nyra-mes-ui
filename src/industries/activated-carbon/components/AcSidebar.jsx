import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import nyraLogo from "../../../assets/nyra-logo.png";
import { useAuth } from "../../../auth/AuthContext";
import { useAppContext } from "../../../context/AppContext";
import { getActivatedCarbonMenu } from "../menu/activatedCarbonMenu";
import { canAccessAcMenuItem, AC_DEMO_BLOCKED_HINT, userIsAcDemoViewer } from "../utils/acMenuAccess";
import {
  userCanAccessAcActivation,
  userCanAccessAcPostActivation,
  userCanAccessAcQuality
} from "../utils/acPrivileges";
import { resolveAcAppContext } from "../utils/acContextUtils";

function executionStage(location) {
  const params = new URLSearchParams(location.search || "");
  return params.get("stage") === "post_activation" ? "post_activation" : "activation";
}

function SidebarLink({
  to,
  label,
  end = false,
  disabled = false,
  indent = false,
  isItemActive
}) {
  const location = useLocation();
  if (disabled) {
    return (
      <span
        className={"wf-nav-link wf-nav-link--disabled" + (indent ? " wf-nav-link--indent" : "")}
        title={AC_DEMO_BLOCKED_HINT}
        aria-disabled="true"
      >
        <span className="wf-nav-link-label">{label}</span>
      </span>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        "wf-nav-link" +
        (indent ? " wf-nav-link--indent" : "") +
        ((isItemActive ? isItemActive(location) : isActive) ? " wf-nav-link--active" : "")
      }
    >
      <span className="wf-nav-link-label">{label}</span>
    </NavLink>
  );
}

const SECTIONS = [
  { id: "overview", label: "Overview", ids: ["dashboard", "kiln-telemetry"] },
  {
    id: "production",
    label: "Production Flow",
    ids: [
      "raw-material",
      "bag-tracing",
      "execution",
      "customer-sales",
      "dispatch",
      "reports"
    ]
  },
  {
    id: "admin",
    label: "Administration",
    ids: ["users"]
  },
  {
    id: "masters",
    label: "Master Data",
    ids: ["masters", "routing-builder"]
  }
];

function AcSidebar() {
  const { context } = useAppContext();
  const { user } = useAuth();
  const roles = user?.roles || [];
  const menuItems = getActivatedCarbonMenu(
    resolveAcAppContext(context).enabled_capabilities
  );
  const byId = Object.fromEntries(menuItems.map((item) => [item.id, item]));
  const [openSections, setOpenSections] = useState({
    overview: true,
    production: true,
    admin: true,
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
          const items = section.ids
            .map((id) => byId[id])
            .filter(Boolean)
            .filter((item) => canAccessAcMenuItem(item.id, roles, user) || userIsAcDemoViewer(roles));
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
                  {items.map((item) => {
                    const blocked = !canAccessAcMenuItem(item.id, roles, user);
                    if (item.id !== "execution") {
                      return (
                        <SidebarLink
                          key={item.id}
                          to={item.to}
                          label={item.label}
                          end={item.end}
                          disabled={blocked}
                        />
                      );
                    }
                    return (
                      <div key={item.id}>
                        <SidebarLink
                          to={`${item.to}?stage=activation`}
                          label={item.label}
                          disabled={blocked}
                          isItemActive={(loc) => String(loc.pathname || "").includes("/execution")}
                        />
                        <div className="wf-nav-submenu">
                          {userCanAccessAcActivation(roles) || userCanAccessAcQuality(roles) ? (
                            <SidebarLink
                              to={`${item.to}?stage=activation`}
                              label="Activation"
                              indent
                              disabled={blocked}
                              isItemActive={(loc) =>
                                String(loc.pathname || "").includes("/execution") &&
                                executionStage(loc) === "activation"
                              }
                            />
                          ) : null}
                          {userCanAccessAcPostActivation(roles) || userCanAccessAcQuality(roles) ? (
                            <SidebarLink
                              to={`${item.to}?stage=post_activation`}
                              label="Post activation"
                              indent
                              disabled={blocked}
                              isItemActive={(loc) =>
                                String(loc.pathname || "").includes("/execution") &&
                                executionStage(loc) === "post_activation"
                              }
                            />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

    </aside>
  );
}

export default AcSidebar;
