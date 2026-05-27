import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import nyraLogo from "../assets/nyra-logo.png";

import { useAuth } from "../auth/AuthContext";
import { initialsFromUser } from "../auth/roles";

import "../styles/AppLayout.css";


function IconFlow() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="6" height="6" rx="1" />
      <rect x="15" y="4" width="6" height="6" rx="1" />
      <rect x="9" y="14" width="6" height="6" rx="1" />
      <path d="M9 7h6M6 10v4h6M18 10v4h-6" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5z" />
    </svg>
  );
}

function IconDatabase() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
      <path d="M8 12h8M8 16h6" />
    </svg>
  );
}

function IconFactory() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21V10l5 3V10l5 3V6l8 5v10z" />
      <path d="M9 17h2M14 17h2" />
    </svg>
  );
}

function IconShieldCheck() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 6v6c0 4.5 3.5 8.5 8 9 4.5-.5 8-4.5 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconWrench() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z" />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7h11v10H2zM13 10h5l3 3v4h-8z" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
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

function IconSettings() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.6l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
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
  const mastersActive = location.pathname.startsWith("/masters");

  const [mastersOpen, setMastersOpen] = useState(mastersActive);

  const blockNav = (event) => {
    event.preventDefault();
  };

  return (
    <aside className="sidebar">
      <Link to="/" className="sidebar-brand" title="Back to landing">
        <img
          src={nyraLogo}
          alt="Nyra Services"
          className="sidebar-logo"
        />
      </Link>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard" end className="nav-item">
          <IconHome />
          <span className="nav-label">Dashboard</span>
        </NavLink>

        <NavLink to="/process-library" className="nav-item">
          <IconDatabase />
          <span className="nav-label">Process Library</span>
        </NavLink>

        <NavLink to="/part-master" className="nav-item">
          <IconFactory />
          <span className="nav-label">Part Master</span>
        </NavLink>

        <NavLink to="/route-entry" className="nav-item">
          <IconFlow />
          <span className="nav-label">Route Entry</span>
        </NavLink>

        <NavLink to="/work-order-data-capture" className="nav-item">
          <IconClipboard />
          <span className="nav-label">Work Order Data Capture</span>
        </NavLink>

        <NavLink to="/workflow" className="nav-item">
          <IconChart />
          <span className="nav-label">Workflow Intelligence</span>
        </NavLink>

        <button
          type="button"
          className={
            "nav-item nav-button" +
            (mastersActive ? " active-parent" : "")
          }
          onClick={() => setMastersOpen((prev) => !prev)}
        >
          <IconDatabase />
          <span className="nav-label">Masters</span>
          {mastersOpen ? <ChevronDown /> : <ChevronRight />}
        </button>

        {mastersOpen && (
          <div className="nav-submenu">
            <NavLink
              to="/masters/customers"
              className="nav-subitem"
            >
              Customers
            </NavLink>

            <NavLink
              to="/masters/parts"
              className="nav-subitem"
            >
              Parts
            </NavLink>
          </div>
        )}

        <NavLink to="/orders" className="nav-item">
          <IconClipboard />
          <span className="nav-label">Orders</span>
          <ChevronRight />
        </NavLink>

        <NavLink to="/production" className="nav-item">
          <IconFactory />
          <span className="nav-label">Production</span>
          <ChevronRight />
        </NavLink>

        <div className="nav-submenu">
          <NavLink
            to="/production/lot-execution"
            className="nav-subitem"
          >
            🔁 Lot Execution
          </NavLink>
        </div>

        <NavLink to="/quality" className="nav-item">
          <IconShieldCheck />
          <span className="nav-label">Quality</span>
          <ChevronRight />
        </NavLink>

        <NavLink to="/maintenance" className="nav-item">
          <IconWrench />
          <span className="nav-label">Maintenance</span>
          <ChevronRight />
        </NavLink>

        <NavLink to="/dispatch" className="nav-item">
          <IconTruck />
          <span className="nav-label">Dispatch</span>
          <ChevronRight />
        </NavLink>

        <a href="#reports" className="nav-item" onClick={blockNav}>
          <IconChart />
          <span className="nav-label">Reports</span>
          <ChevronRight />
        </a>

        <a href="#settings" className="nav-item" onClick={blockNav}>
          <IconSettings />
          <span className="nav-label">Settings</span>
          <ChevronRight />
        </a>
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
