import { useState } from "react";
import { Outlet } from "react-router-dom";

import Header from "./Header";
import Sidebar from "./Sidebar";

import "../styles/AppLayout.css";


function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  return (
    <div
      className={
        "app-shell" + (sidebarCollapsed ? " sidebar-collapsed" : "")
      }
    >
      <Sidebar />

      <div className="main-area">
        <Header onToggleSidebar={toggleSidebar} />

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
