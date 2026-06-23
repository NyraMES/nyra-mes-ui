import { useMemo, useState } from "react";

import {
  AC_ISA95_ENTITIES,
  AC_ISA95_TRIPLES,
  ISA95_LEVELS,
  ISA95_KIND_PALETTE,
  entityIdForFlowPath,
  getAcIsa95Children,
  getAcIsa95Entity,
  getAcIsa95IncomingTriples,
  getAcIsa95OutgoingTriples,
  getAcIsa95RootEntities,
  labelForEntityId
} from "../constants/acIsa95Ontology";
import { EmptyState, StatusPill, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function AcIsa95OntologyDrilldown({ flowSteps = [], kilnRows = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState("Site:AC_Plant");
  const [levelFilter, setLevelFilter] = useState(null);

  const activeFlowPath = useMemo(() => {
    const active = flowSteps.find((s) => s.status === "active");
    if (active?.id) return active.id;
    const lastDone = [...flowSteps].reverse().find((s) => s.status === "done");
    return lastDone?.id || null;
  }, [flowSteps]);

  const highlightedId = useMemo(
    () => (activeFlowPath ? entityIdForFlowPath(activeFlowPath) : null),
    [activeFlowPath]
  );

  const selected = getAcIsa95Entity(selectedId);
  const children = getAcIsa95Children(selectedId);
  const outgoing = getAcIsa95OutgoingTriples(selectedId);
  const incoming = getAcIsa95IncomingTriples(selectedId);

  const visibleEntities = useMemo(() => {
    if (levelFilter == null) return AC_ISA95_ENTITIES;
    return AC_ISA95_ENTITIES.filter((e) => e.level === levelFilter);
  }, [levelFilter]);

  const roots = getAcIsa95RootEntities();
  const kilnHint =
    kilnRows.length > 0
      ? kilnRows.map((k) => k.resource_code).join(", ")
      : null;

  return (
    <WfCard>
      <WfCardHeader
        title="ISA-95 Manufacturing Ontology"
        subtitle="Activated Carbon — Enterprise → Site → Area → Cell → Unit → Control"
        icon={<IconOntology />}
        right={
          <button
            type="button"
            className="wf-btn wf-btn-ghost inline-flex items-center gap-1.5"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? "Collapse" : "Drill down"}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={expanded ? "rotate-180 transition-transform" : "transition-transform"}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        }
      />
      <WfCardBody>
        {!expanded ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <StatusPill kind="info">{AC_ISA95_ENTITIES.length} entities</StatusPill>
            <StatusPill kind="neutral">{AC_ISA95_TRIPLES.length} triples</StatusPill>
            {highlightedId ? (
              <span>
                Active flow maps to{" "}
                <button
                  type="button"
                  className="text-cyan-300 hover:text-cyan-200 font-mono text-xs"
                  onClick={() => {
                    setSelectedId(highlightedId);
                    setExpanded(true);
                  }}
                >
                  {labelForEntityId(highlightedId)}
                </button>
              </span>
            ) : (
              <span>Click drill down to explore the ISA-95 model for this plant.</span>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <FilterChip active={levelFilter == null} onClick={() => setLevelFilter(null)}>
                All levels
              </FilterChip>
              {ISA95_LEVELS.map((lvl) => (
                <FilterChip
                  key={lvl.level}
                  active={levelFilter === lvl.level}
                  onClick={() => setLevelFilter(lvl.level)}
                >
                  {lvl.short} · {lvl.label}
                </FilterChip>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">
                  Hierarchy — click to drill down
                </div>
                <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-3 max-h-64 overflow-y-auto space-y-1">
                  {roots.map((root) => (
                    <TreeNode
                      key={root.id}
                      entity={root}
                      selectedId={selectedId}
                      highlightedId={highlightedId}
                      depth={0}
                      onSelect={setSelectedId}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {visibleEntities.map((entity) => {
                    const isSel = entity.id === selectedId;
                    const isHi = entity.id === highlightedId;
                    const pal =
                      ISA95_KIND_PALETTE[entity.kind] ||
                      "from-slate-500/15 border-slate-400/30 text-slate-200";
                    return (
                      <button
                        key={entity.id}
                        type="button"
                        onClick={() => setSelectedId(entity.id)}
                        className={[
                          "text-left rounded-xl p-2.5 border bg-gradient-to-br to-slate-900/50 transition-all",
                          pal,
                          isSel ? "ring-2 ring-cyan-300/60" : "hover:scale-[1.01]",
                          isHi ? "shadow-[0_0_16px_-6px_rgba(56,189,248,0.5)]" : ""
                        ].join(" ")}
                      >
                        <div className="text-[10px] uppercase tracking-widest opacity-70">
                          L{entity.level} · {entity.kind.replace("_", " ")}
                        </div>
                        <div className="text-xs font-semibold mt-1 truncate" title={entity.label}>
                          {entity.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <WfCard className="!shadow-none">
                  <WfCardHeader
                    title={selected?.label || "—"}
                    subtitle={selected?.desc}
                    icon={<IconNode />}
                  />
                  <WfCardBody className="!pt-0">
                    {selected ? (
                      <div className="space-y-3 text-xs">
                        <div className="flex flex-wrap gap-2">
                          <StatusPill kind="info">ISA-95 Level {selected.level}</StatusPill>
                          <StatusPill kind="neutral">{selected.kind}</StatusPill>
                          {selected.id === "Unit:Kiln01" && kilnHint ? (
                            <StatusPill kind="ok">{kilnHint}</StatusPill>
                          ) : null}
                        </div>

                        {children.length > 0 ? (
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">
                              Children ({children.length})
                            </div>
                            <div className="space-y-1">
                              {children.map((child) => (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => setSelectedId(child.id)}
                                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-800/50 font-mono text-cyan-200"
                                >
                                  {child.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <TripleSection
                          title="Outgoing"
                          rows={outgoing}
                          onNavigate={setSelectedId}
                          navigateTo="object"
                        />
                        <TripleSection
                          title="Incoming"
                          rows={incoming}
                          onNavigate={setSelectedId}
                          navigateTo="subject"
                        />
                      </div>
                    ) : (
                      <EmptyState title="Select an entity" hint="Use the tree or entity map." />
                    )}
                  </WfCardBody>
                </WfCard>
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
                Traceability chain (Subject → Predicate → Object)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {AC_ISA95_TRIPLES.map(([subject, predicate, object], i) => (
                  <div
                    key={i}
                    className="rounded-md px-3 py-2 bg-slate-900/40 border border-slate-700/30 text-xs flex items-center gap-2 flex-wrap"
                  >
                    <button
                      type="button"
                      className="font-mono text-slate-200 hover:text-cyan-200"
                      onClick={() => setSelectedId(subject)}
                    >
                      {labelForEntityId(subject)}
                    </button>
                    <span className="text-cyan-300/80 uppercase tracking-wider text-[10px]">
                      {predicate}
                    </span>
                    <button
                      type="button"
                      className="font-mono text-slate-200 hover:text-cyan-200"
                      onClick={() => setSelectedId(object)}
                    >
                      {labelForEntityId(object)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </WfCardBody>
    </WfCard>
  );
}

function TreeNode({ entity, selectedId, highlightedId, depth, onSelect }) {
  const children = getAcIsa95Children(entity.id);
  const isSel = entity.id === selectedId;
  const isHi = entity.id === highlightedId;

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <button
        type="button"
        onClick={() => onSelect(entity.id)}
        className={[
          "w-full text-left flex items-center gap-2 px-2 py-1 rounded-md text-xs font-mono",
          isSel ? "bg-cyan-500/15 text-cyan-100" : "text-slate-300 hover:bg-slate-800/40",
          isHi ? "border border-cyan-400/30" : "border border-transparent"
        ].join(" ")}
      >
        <span className="text-[10px] text-slate-500 w-6 shrink-0">L{entity.level}</span>
        <span className="truncate">{entity.label}</span>
      </button>
      {children.map((child) => (
        <TreeNode
          key={child.id}
          entity={child}
          selectedId={selectedId}
          highlightedId={highlightedId}
          depth={depth + 1}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function TripleSection({ title, rows, onNavigate, navigateTo }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">
        {title} ({rows.length})
      </div>
      <div className="space-y-1">
        {rows.length === 0 ? (
          <div className="text-slate-500">None</div>
        ) : (
          rows.map(([subject, rel, object], i) => (
            <button
              key={i}
              type="button"
              onClick={() => onNavigate(navigateTo === "subject" ? subject : object)}
              className="w-full flex items-center gap-1 text-left px-2 py-1 rounded-md hover:bg-slate-800/50 text-xs"
            >
              <span className="font-mono text-slate-300 truncate">{labelForEntityId(subject)}</span>
              <span className="text-cyan-300/70 text-[10px] uppercase shrink-0">— {rel} →</span>
              <span className="font-mono text-cyan-200 truncate">{labelForEntityId(object)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1 text-xs border transition-colors",
        active
          ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
          : "border-slate-600/50 text-slate-400 hover:text-slate-200"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function IconOntology() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.5" />
      <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)" />
    </svg>
  );
}

function IconNode() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="5" r="2" />
    </svg>
  );
}

export default AcIsa95OntologyDrilldown;
