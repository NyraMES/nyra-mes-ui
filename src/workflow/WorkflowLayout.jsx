import { useState } from "react";
import { Outlet } from "react-router-dom";

import WorkflowSidebar from "./WorkflowSidebar";
import WorkflowTopbar from "./WorkflowTopbar";
import AskNyraPanel from "./AskNyraPanel";
import DemoWatermark from "../components/DemoWatermark";
import { WorkflowProvider } from "./WorkflowContext";


function WorkflowLayout() {
  const [askOpen, setAskOpen] = useState(false);

  return (
    <WorkflowProvider>
      <div className="wf-shell flex w-full">
        <DemoWatermark />
        <WorkflowSidebar />
      <div className="wf-content-column">
        <WorkflowTopbar />
        <main className="p-6 flex-1 wf-page-frame">
            <Outlet />
          </main>
        </div>

        <button
          type="button"
          className="wf-ask-fab"
          onClick={() => setAskOpen((v) => !v)}
          title="Ask Nyra"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 4 6v6c0 4.5 3.5 8.5 8 9 4.5-.5 8-4.5 8-9V6z" />
            <path d="M9 12h6M9 9h6M9 15h4" />
          </svg>
        </button>

        {askOpen && <AskNyraPanel onClose={() => setAskOpen(false)} />}
      </div>
    </WorkflowProvider>
  );
}

export default WorkflowLayout;
