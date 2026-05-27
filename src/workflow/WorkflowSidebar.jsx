import { NavLink, Link } from "react-router-dom";

import nyraLogo from "../assets/nyra-logo.png";


const STAGES = [
  { to: "/workflow", label: "Intelligence Hub", icon: <IconHub /> },
  { to: "/workflow/customer-order", label: "Customer Order", icon: <IconOrder />, step: "01" },
  { to: "/workflow/production-order", label: "Production Order", icon: <IconFactory />, step: "02" },
  { to: "/workflow/lot-split", label: "Lot Split", icon: <IconSplit />, step: "03" },
  { to: "/workflow/routing", label: "Routing Flow", icon: <IconFlow />, step: "04" },
  { to: "/workflow/feasibility", label: "Feasibility", icon: <IconCheck />, step: "05" },
  { to: "/workflow/scheduling", label: "Scheduling Board", icon: <IconCalendar />, step: "06" },
  { to: "/workflow/execution", label: "Execution", icon: <IconPlay />, step: "07" },
  { to: "/workflow/inspection", label: "Inspection & NCR", icon: <IconShield />, step: "08" },
  { to: "/workflow/dispatch", label: "Dispatch Gate", icon: <IconTruck />, step: "09" },
  { to: "/workflow/traceability", label: "Traceability", icon: <IconGraph />, step: "10" }
];

const ANALYTICS = [
  { to: "/workflow/oee", label: "OEE Intelligence", icon: <IconChart /> },
  { to: "/workflow/ontology", label: "Ontology Explorer", icon: <IconAtom /> }
];


function NavRow({ item, dim = false }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/workflow"}
      className={({ isActive }) =>
        [
          "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all relative",
          isActive
            ? "bg-blue-50 text-blue-800 border border-blue-200 shadow-sm"
            : "text-slate-600 hover:text-slate-700 hover:bg-slate-100 border border-transparent",
          dim ? "text-slate-500" : ""
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          {item.step && (
            <span
              className={[
                "w-7 h-7 rounded-md font-mono text-[10px] flex items-center justify-center font-bold",
                isActive
                  ? "bg-blue-100 text-blue-700 ring-1 ring-blue-200"
                  : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
              ].join(" ")}
            >
              {item.step}
            </span>
          )}
          {!item.step && (
            <span
              className={[
                "w-7 h-7 rounded-md flex items-center justify-center",
                isActive
                  ? "text-blue-700"
                  : "text-slate-500 group-hover:text-slate-700"
              ].join(" ")}
            >
              {item.icon}
            </span>
          )}
          <span className="truncate">{item.label}</span>
          {isActive && (
            <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </>
      )}
    </NavLink>
  );
}


function WorkflowSidebar() {
  return (
    <aside className="wf-sidebar w-64 flex-shrink-0 h-screen sticky top-0 border-r border-white/10 flex flex-col">
      <Link to="/" className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <img src={nyraLogo} alt="Nyra" className="w-9 h-9 rounded-lg ring-1 ring-white/20" />
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">Nyra MWI</div>
          <div className="text-[10px] uppercase tracking-widest text-blue-200">
            Workflow Intelligence
          </div>
        </div>
      </Link>

      <div className="px-3 py-4 flex-1 overflow-y-auto space-y-5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold px-3 mb-2">
            Manufacturing Workflow
          </div>
          <div className="space-y-1">
            {STAGES.map((s) => (
              <NavRow key={s.to} item={s} />
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold px-3 mb-2">
            Process Intelligence
          </div>
          <div className="space-y-1">
            {ANALYTICS.map((s) => (
              <NavRow key={s.to} item={s} />
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold px-3 mb-2">
            Master Data
          </div>
          <div className="space-y-1">
            <NavRow item={{ to: "/workflow/masters/customers", label: "Customers", icon: <IconUsers /> }} />
            <NavRow item={{ to: "/workflow/masters/parts", label: "Parts", icon: <IconBox /> }} />
            <NavRow item={{ to: "/workflow/masters/routings", label: "Routings", icon: <IconFlow /> }} />
          </div>
        </div>
      </div>

      <div className="m-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
        <div className="flex items-center gap-2 text-blue-800 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 wf-pulse" />
          Knowledge System Live
        </div>
        <div className="text-[11px] text-blue-700/80 mt-1 leading-snug">
          Ontology graph synced with backend operations
        </div>
      </div>
    </aside>
  );
}

function IconHub()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="3"  r="1.5"/><circle cx="12" cy="21" r="1.5"/><circle cx="3"  cy="12" r="1.5"/><circle cx="21" cy="12" r="1.5"/><path d="M12 6v3M12 15v3M6 12h3M15 12h3"/></svg>; }
function IconOrder()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/></svg>; }
function IconFactory(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V10l5 3V10l5 3V6l8 5v10z"/></svg>; }
function IconSplit()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>; }
function IconFlow()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="6" height="6" rx="1"/><rect x="15" y="4" width="6" height="6" rx="1"/><rect x="9" y="14" width="6" height="6" rx="1"/><path d="M9 7h6M6 10v4h6M18 10v4h-6"/></svg>; }
function IconCheck()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.5 8.5 8 9 4.5-.5 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>; }
function IconCalendar(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>; }
function IconPlay()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>; }
function IconShield() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.5 8.5 8 9 4.5-.5 8-4.5 8-9V6z"/></svg>; }
function IconTruck()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h11v10H2zM13 10h5l3 3v4h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>; }
function IconGraph()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="12" cy="14" r="2.5"/><circle cx="5" cy="20" r="2.5"/><circle cx="19" cy="20" r="2.5"/><path d="m7 7 4 6M17 7l-4 6M7 19l4-4M17 19l-4-4"/></svg>; }
function IconChart()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>; }
function IconAtom()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconUsers()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M14 19c0-2.5 2.5-4 4-4s4 1.5 4 4"/></svg>; }
function IconBox()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7 12 3l9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10"/></svg>; }

export default WorkflowSidebar;
