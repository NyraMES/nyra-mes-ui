import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import nyraLogo from "../assets/nyra-logo.png";
import { MES_NAV_SECTIONS, isNavSectionActive } from "../config/mesNavigation";
import { useAuth } from "../auth/AuthContext";
import { initialsFromUser } from "../auth/roles";

import "../styles/AppLayout.css";


function IconHome() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5z" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="nav-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg className="nav-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}


function Sidebar() {
  const location = useLocation();
  const { user, authEnabled, logout } = useAuth();
  const displayName = user?.displayName || "User";
  const roleLabel = user?.roleLabel || "User";
  const initials = initialsFromUser(user);

  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(
      MES_NAV_SECTIONS.map((s) => [s.id, isNavSectionActive(s, location.pathname)])
    )
  );

  const toggleSection = (id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className="sidebar">
      <Link to="/" className="sidebar-brand" title="Back to landing">
        <img src={nyraLogo} alt="Nyra Services" className="sidebar-logo" />
      </Link>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard" end className="nav-item">
          <IconHome />
          <span className="nav-label">Dashboard</span>
        </NavLink>

        <NavLink to="/workflow" className="nav-item">
          <IconChart />
          <span className="nav-label">Workflow Intelligence</span>
        </NavLink>

        {MES_NAV_SECTIONS.map((section) => {
          const open = openSections[section.id];
          const active = isNavSectionActive(section, location.pathname);
          return (
            <div key={section.id}>
              <button
                type="button"
                className={"nav-item nav-button" + (active ? " active-parent" : "")}
                onClick={() => toggleSection(section.id)}
              >
                <span className="nav-label">{section.label}</span>
                {open ? <ChevronDown /> : <ChevronRight />}
              </button>
              {open && (
                <div className="nav-submenu">
                  {section.items.map((item) => (
                    <NavLink key={item.to} to={item.to} className="nav-subitem">
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{displayName}</div>
          <div className="sidebar-user-role">{roleLabel}</div>
        </div>
        {authEnabled ? (
          <button type="button" className="nav-item" onClick={() => logout()} title="Sign out">
            Sign out
          </button>
        ) : (
          <ChevronDown />
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
