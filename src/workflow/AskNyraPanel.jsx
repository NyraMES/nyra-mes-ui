import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatApiError } from "../services/api";
import { askMesCoreNyra, fetchMesCoreProductionLots } from "../services/mesCoreApi";
import { useWorkflow } from "./WorkflowContext";

const DEFAULT_SUGGESTIONS = [
  "Why is this lot blocked?",
  "Which machine caused delay?",
  "Show full traceability for this lot",
  "What is the OEE trend this week?",
  "Why was this NCR raised?"
];

function AskNyraPanel({ onClose, suggestions = DEFAULT_SUGGESTIONS }) {
  const { context, update } = useWorkflow();
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lots, setLots] = useState([]);
  const [lotId, setLotId] = useState(context.lotId || "");
  const chatEndRef = useRef(null);
  const answerFocusRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchMesCoreProductionLots();
        if (cancelled) return;
        setLots(rows);
        if (context.lotId) {
          setLotId(context.lotId);
        } else if (rows.length > 0 && !lotId) {
          setLotId(rows[0].lot_id);
        }
      } catch {
        if (!cancelled) setLots([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [context.lotId]);

  useEffect(() => {
    if (context.lotId) setLotId(context.lotId);
  }, [context.lotId]);

  useEffect(() => {
    if (turns.length > 0) {
      answerFocusRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [turns, loading]);

  const effectiveLotId = lotId || context.lotId || lots[0]?.lot_id || "";
  const lotLabel = effectiveLotId ? `Lot ${effectiveLotId}` : "No lot in system";
  const hasConversation = turns.length > 0;

  const submitQuestion = useCallback(
    async (questionText) => {
      const text = String(questionText ?? q).trim();
      if (!text || loading) return;
      if (!effectiveLotId) return;

      const turnId = Date.now();
      setQ("");
      setLoading(true);
      setTurns((prev) => [
        ...prev,
        { id: turnId, question: text, answer: "", sources: [], error: "", pending: true }
      ]);

      try {
        const res = await askMesCoreNyra({
          question: text,
          lot_id: effectiveLotId
        });
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  answer: res.answer || "",
                  sources: Array.isArray(res.sources) ? res.sources : [],
                  pending: false
                }
              : t
          )
        );
      } catch (err) {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  error: formatApiError(err, "Ask Nyra request failed."),
                  pending: false
                }
              : t
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [effectiveLotId, loading, q]
  );

  const handleSuggestion = (suggestion) => {
    submitQuestion(suggestion);
  };

  const handleLotChange = (nextLotId) => {
    setLotId(nextLotId);
    update({ lotId: nextLotId || null });
  };

  const lotOptions = useMemo(
    () => lots.map((l) => l.lot_id).filter(Boolean),
    [lots]
  );

  const latestTurn = turns.length > 0 ? turns[turns.length - 1] : null;

  return (
    <div className={`wf-ask-panel ${hasConversation ? "wf-ask-panel--answered" : ""}`}>
      <div className="wf-ask-panel__header">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            N
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100">Ask Nyra</div>
            <div className="text-[10px] text-cyan-300/80 uppercase tracking-widest truncate">
              Manufacturing AI · {lotLabel}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 w-7 h-7 rounded-md hover:bg-slate-800/60 flex items-center justify-center shrink-0"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12M6 18 18 6" />
          </svg>
        </button>
      </div>

      {lotOptions.length > 0 && (
        <div className="wf-ask-panel__context px-4 py-2 border-b border-white/5">
          <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">
            Context lot
          </label>
          <select
            className="wf-select w-full text-xs"
            value={effectiveLotId}
            onChange={(e) => handleLotChange(e.target.value)}
            disabled={loading}
          >
            {lotOptions.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
      )}

      {!hasConversation && (
        <div className="wf-ask-panel__suggestions wf-ask-panel__suggestions--vertical">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold px-1 pb-1">
            Suggested questions
          </div>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSuggestion(s)}
              disabled={loading || !effectiveLotId}
              className="wf-ask-suggestion-chip"
            >
              {s}
            </button>
          ))}
          {!effectiveLotId && (
            <div className="text-[11px] text-slate-500 px-1 pt-1">
              Select a lot above to ask a question.
            </div>
          )}
        </div>
      )}

      <div className="wf-ask-panel__chat">
        {!hasConversation && !loading && (
          <div className="wf-ask-empty">
            Pick a lot and a suggested question, or type your own below.
          </div>
        )}

        {hasConversation && latestTurn && (
          <div className="wf-ask-turn wf-ask-turn--focus" ref={answerFocusRef}>
            <div className="wf-ask-bubble wf-ask-bubble--user wf-ask-bubble--compact">
              <div className="wf-ask-bubble__label">Question · {effectiveLotId}</div>
              <div className="wf-ask-bubble__text">{latestTurn.question}</div>
            </div>
            <div className="wf-ask-bubble wf-ask-bubble--nyra wf-ask-bubble--focus">
              <div className="wf-ask-bubble__label">Nyra</div>
              {latestTurn.pending ? (
                <div className="wf-ask-bubble__text wf-ask-bubble__text--muted">
                  Thinking over feasibility, execution, quality, and traceability…
                </div>
              ) : latestTurn.error ? (
                <div className="wf-ask-bubble__text wf-ask-bubble__text--error">{latestTurn.error}</div>
              ) : (
                <>
                  <div className="wf-ask-bubble__text wf-ask-bubble__text--answer">{latestTurn.answer}</div>
                  {latestTurn.sources.length > 0 && (
                    <div className="wf-ask-bubble__sources">
                      Sources: {latestTurn.sources.join(", ")}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {hasConversation && turns.length > 1 && (
          <div className="wf-ask-history">
            {turns.slice(0, -1).map((turn) => (
              <div key={turn.id} className="wf-ask-history-item">
                <span className="font-medium">{turn.question}</span>
                {!turn.pending && !turn.error && (
                  <span className="block mt-1 opacity-80 line-clamp-2">{turn.answer}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <div className="wf-ask-panel__footer">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitQuestion();
            }}
            placeholder="Ask about a lot, machine, or NCR…"
            className="wf-input flex-1"
            disabled={loading || !effectiveLotId}
          />
          <button
            type="button"
            className="wf-btn wf-btn-primary shrink-0"
            disabled={loading || !q.trim() || !effectiveLotId}
            onClick={() => submitQuestion()}
          >
            {loading ? "…" : "Ask"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AskNyraPanel;
