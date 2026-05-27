import "../styles/AppLayout.css";

import { useAuth } from "../auth/AuthContext";
import { initialsFromUser } from "../auth/roles";


function IconMenu() {
  return (
    <svg className="topbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg className="topbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg className="topbar-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}


function Header({ onToggleSidebar }) {
  const { user, authEnabled, logout } = useAuth();
  const displayName = user?.displayName || "User";
  const initials = initialsFromUser(user);

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar-button"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <IconMenu />
      </button>

      <div className="topbar-spacer" />

      <button
        type="button"
        className="topbar-button topbar-bell"
      >
        <IconBell />
        <span className="topbar-bell-badge">1</span>
      </button>

      <div className="topbar-user">
        <div className="topbar-user-avatar">{initials}</div>
        <span className="topbar-user-name">{displayName}</span>
        {authEnabled && (
          <button
            type="button"
            className="topbar-button"
            onClick={() => logout()}
            title="Sign out"
          >
            Sign out
          </button>
        )}
        <IconChevronDown />
      </div>
    </header>
  );
}

export default Header;
