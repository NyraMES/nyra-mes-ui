import { useState } from "react";


const SUGGESTIONS = [
  "Why is this lot blocked?",
  "Which machine caused delay?",
  "Show full traceability for this lot",
  "What is the OEE trend this week?",
  "Why was this NCR raised?"
];

function AskNyraPanel({ onClose }) {
  const [q, setQ] = useState("");

  return (
    <div className="wf-ask-panel">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">
            N
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100">Ask Nyra</div>
            <div className="text-[10px] text-cyan-300/80 uppercase tracking-widest">
              Manufacturing AI · Coming Soon
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 w-7 h-7 rounded-md hover:bg-slate-800/60 flex items-center justify-center"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12M6 18 18 6" />
          </svg>
        </button>
      </div>

      <div className="p-4 overflow-y-auto flex-1">
        <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
          Suggested
        </div>
        <div className="flex flex-col gap-2 mb-4">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQ(s)}
              className="text-left text-sm text-slate-300 hover:text-slate-100 px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-700/40 hover:border-cyan-400/40 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
          Reasoning preview
        </div>
        <div className="rounded-lg bg-slate-900/40 border border-slate-700/40 p-3 text-xs text-slate-400 leading-relaxed">
          Nyra reasons over the ontology graph
          <span className="text-cyan-300 mx-1">CustomerOrder → Lot → Operation → Machine → Inspection</span>
          to surface blockers, root causes and traceability. Connect to your reasoning engine to enable live answers.
        </div>
      </div>

      <div className="px-3 py-3 border-t border-white/5">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask about a lot, machine, or NCR…"
            className="wf-input flex-1"
          />
          <button type="button" className="wf-btn wf-btn-primary" disabled>
            Ask
          </button>
        </div>
        <div className="text-[10px] text-slate-500 mt-2 text-center">
          AI responses will appear here once Ask Nyra is wired to the backend.
        </div>
      </div>
    </div>
  );
}

export default AskNyraPanel;
