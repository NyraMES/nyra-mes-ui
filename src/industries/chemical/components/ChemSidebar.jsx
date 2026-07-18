import { NavLink } from "react-router-dom";

import nyraLogo from "../../../assets/nyra-logo.png";
import { useAppContext } from "../../../context/AppContext";
import { getChemicalMenu } from "../menu/chemicalMenu";
import { resolveChemAppContext } from "../utils/chemContextUtils";

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

export default function ChemSidebar() {
  const { context } = useAppContext();
  const resolved = resolveChemAppContext(context);
  const menu = getChemicalMenu(resolved.enabled_capabilities);

  return (
    <aside className="wf-sidebar wf-ac-sidebar shrink-0">
      <div className="wf-sidebar-brand">
        <img src={nyraLogo} alt="Nyra" className="wf-sidebar-logo" />
        <div>
          <div className="wf-sidebar-brand-title">Chemical Processing</div>
          <div className="wf-sidebar-brand-sub">Batch &amp; reactor MES</div>
        </div>
      </div>
      <nav className="wf-sidebar-nav">
        {menu.map((item) => (
          <SidebarLink key={item.id} to={item.to} label={item.label} end={item.end} />
        ))}
      </nav>
    </aside>
  );
}
