import { useMemo, useState } from "react";

import {
  WfCard,
  WfCardHeader,
  WfCardBody,
  SectionHeader,
  StatusPill
} from "../ui";


/**
 * Curated ontology graph describing the domain.
 * Each entity has a kind palette and named relationships pointing to other entity ids.
 */
const ENTITIES = [
  { id: "Customer",        kind: "customer",   desc: "OEM, Tier-1 or end consumer placing demand." },
  { id: "Order",           kind: "order",      desc: "A captured commercial intent with delivery date." },
  { id: "OrderLine",       kind: "order",      desc: "Line item identifying part + quantity in an order." },
  { id: "Part",            kind: "part",       desc: "Manufactured SKU (casting, machined, assembly)." },
  { id: "ProductionOrder", kind: "production", desc: "Authorization to produce against an order line." },
  { id: "Lot",             kind: "lot",        desc: "Atomic manufacturable batch with full traceability." },
  { id: "Routing",         kind: "routing",    desc: "Ordered sequence of operations to produce a part." },
  { id: "Operation",       kind: "operation",  desc: "A discrete manufacturing step (Melt, Pour, QC…)" },
  { id: "Machine",         kind: "machine",    desc: "Physical asset where operations execute." },
  { id: "Tool",            kind: "tool",       desc: "Die, fixture or jig required by an operation." },
  { id: "Workforce",       kind: "people",     desc: "Operators and supervisors with skills & shifts." },
  { id: "Schedule",        kind: "schedule",   desc: "Assignment of a lot/operation to machine + shift." },
  { id: "WorkOrder",       kind: "workorder",  desc: "Executable instance of an operation on shop floor." },
  { id: "Inspection",      kind: "inspection", desc: "Quality observation against a plan and parameters." },
  { id: "Parameter",       kind: "parameter",  desc: "Captured measurement with spec range." },
  { id: "Defect",          kind: "defect",     desc: "Catalogued non-conformance type." },
  { id: "NCR",             kind: "ncr",        desc: "Non-conformance report auto-generated on failure." },
  { id: "Downtime",        kind: "downtime",   desc: "Recorded loss of availability against a machine." },
  { id: "OEE",             kind: "oee",        desc: "Composite Availability × Performance × Quality." },
  { id: "Dispatch",        kind: "dispatch",   desc: "Authorized outbound shipment to customer." },
  { id: "Traceability",    kind: "trace",      desc: "Closed genealogy spanning every entity above." }
];

const EDGES = [
  ["Customer",        "places",      "Order"],
  ["Order",           "contains",    "OrderLine"],
  ["OrderLine",       "specifies",   "Part"],
  ["Order",           "triggers",    "ProductionOrder"],
  ["ProductionOrder", "splitsInto",  "Lot"],
  ["Lot",             "follows",     "Routing"],
  ["Routing",         "hasOperation","Operation"],
  ["Operation",       "requires",    "Machine"],
  ["Operation",       "requires",    "Tool"],
  ["Operation",       "captures",    "Parameter"],
  ["Operation",       "needs",       "Workforce"],
  ["Lot",             "scheduledBy", "Schedule"],
  ["Schedule",        "assignsTo",   "Machine"],
  ["Schedule",        "produces",    "WorkOrder"],
  ["WorkOrder",       "reports",     "Downtime"],
  ["WorkOrder",       "executes",    "Operation"],
  ["Lot",             "inspectedBy", "Inspection"],
  ["Inspection",      "creates",     "NCR"],
  ["NCR",             "references",  "Defect"],
  ["Machine",         "computes",    "OEE"],
  ["Lot",             "dispatchedAs","Dispatch"],
  ["Dispatch",        "fulfills",    "Order"],
  ["Lot",             "tracedBy",    "Traceability"]
];

const KIND_PALETTE = {
  customer:   "from-blue-500/15    border-blue-400/40    text-blue-200",
  order:      "from-cyan-500/15    border-cyan-400/40    text-cyan-200",
  part:       "from-teal-500/15    border-teal-400/40    text-teal-200",
  production: "from-indigo-500/15  border-indigo-400/40  text-indigo-200",
  lot:        "from-violet-500/15  border-violet-400/40  text-violet-200",
  routing:    "from-sky-500/15     border-sky-400/40     text-sky-200",
  operation:  "from-blue-500/15    border-blue-400/40    text-blue-200",
  machine:    "from-amber-500/15   border-amber-400/40   text-amber-200",
  tool:       "from-orange-500/15  border-orange-400/40  text-orange-200",
  people:     "from-pink-500/15    border-pink-400/40    text-pink-200",
  schedule:   "from-purple-500/15  border-purple-400/40  text-purple-200",
  workorder:  "from-fuchsia-500/15 border-fuchsia-400/40 text-fuchsia-200",
  inspection: "from-emerald-500/15 border-emerald-400/40 text-emerald-200",
  parameter:  "from-green-500/15   border-green-400/40   text-green-200",
  defect:     "from-rose-500/15    border-rose-400/40    text-rose-200",
  ncr:        "from-rose-500/15    border-rose-400/40    text-rose-200",
  downtime:   "from-red-500/15     border-red-400/40     text-red-200",
  oee:        "from-yellow-500/15  border-yellow-400/40  text-yellow-200",
  dispatch:   "from-fuchsia-500/15 border-fuchsia-400/40 text-fuchsia-200",
  trace:      "from-cyan-500/15    border-cyan-400/40    text-cyan-200"
};


function OntologyExplorer() {
  const [selected, setSelected] = useState("Lot");

  const entity = useMemo(() => ENTITIES.find((e) => e.id === selected), [selected]);
  const outgoing = useMemo(() => EDGES.filter(([a]) => a === selected), [selected]);
  const incoming = useMemo(() => EDGES.filter(([, , b]) => b === selected), [selected]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Knowledge System"
        title="Ontology Explorer"
        subtitle="Every screen of this platform is derived from the same manufacturing knowledge graph. Pick an entity to view its relationships."
        right={
          <StatusPill kind="info">{ENTITIES.length} entities · {EDGES.length} edges</StatusPill>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WfCard className="lg:col-span-2" glow>
          <WfCardHeader
            title="Entity Map"
            subtitle="Click an entity to inspect its relationships"
            icon={<IconAtom />}
          />
          <WfCardBody>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {ENTITIES.map((e) => {
                const isSel = e.id === selected;
                const pal = KIND_PALETTE[e.kind] || "from-slate-500/15 border-slate-400/30 text-slate-200";
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelected(e.id)}
                    className={[
                      "text-left rounded-xl p-3 border bg-gradient-to-br to-slate-900/50 transition-all",
                      pal,
                      isSel
                        ? "ring-2 ring-cyan-300/60 shadow-[0_0_24px_-8px_rgba(56,189,248,0.6)]"
                        : "hover:scale-[1.02]"
                    ].join(" ")}
                  >
                    <div className="text-[10px] uppercase tracking-widest opacity-70">{e.kind}</div>
                    <div className="text-sm font-semibold mt-1">{e.id}</div>
                  </button>
                );
              })}
            </div>
          </WfCardBody>
        </WfCard>

        <div className="space-y-5">
          <WfCard>
            <WfCardHeader title={entity?.id || "—"} subtitle={entity?.desc} icon={<IconNode />} />
            <WfCardBody>
              <div className="text-[11px] uppercase tracking-widest text-cyan-300/80 font-semibold mb-2">
                Outgoing ({outgoing.length})
              </div>
              <div className="space-y-1.5 mb-4">
                {outgoing.length === 0 && <div className="text-xs text-slate-500">None</div>}
                {outgoing.map(([, rel, b], i) => (
                  <EdgeRow key={i} from={selected} rel={rel} to={b} onClick={() => setSelected(b)} />
                ))}
              </div>

              <div className="text-[11px] uppercase tracking-widest text-violet-300/80 font-semibold mb-2">
                Incoming ({incoming.length})
              </div>
              <div className="space-y-1.5">
                {incoming.length === 0 && <div className="text-xs text-slate-500">None</div>}
                {incoming.map(([a, rel], i) => (
                  <EdgeRow key={i} from={a} rel={rel} to={selected} reverse onClick={() => setSelected(a)} />
                ))}
              </div>
            </WfCardBody>
          </WfCard>
        </div>
      </div>

      <WfCard>
        <WfCardHeader title="All Relationships" subtitle="Full edge list — basis for Ask Nyra reasoning" icon={<IconList />} />
        <WfCardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {EDGES.map(([a, rel, b], i) => (
              <div key={i} className="rounded-md px-3 py-2 bg-slate-900/40 border border-slate-700/30 text-xs flex items-center gap-2">
                <span className="font-mono text-slate-200">{a}</span>
                <span className="flex-1 text-center text-cyan-300/80 uppercase tracking-wider text-[10px]">
                  {rel}
                </span>
                <span className="font-mono text-slate-200">{b}</span>
              </div>
            ))}
          </div>
        </WfCardBody>
      </WfCard>
    </div>
  );
}

function EdgeRow({ from, rel, to, reverse = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-slate-800/50 transition-colors text-left"
    >
      <span className={`font-mono ${reverse ? "text-violet-200" : "text-slate-200"}`}>{from}</span>
      <span className="text-cyan-300/80 uppercase tracking-wider text-[10px] mx-1">— {rel} →</span>
      <span className={`font-mono ${reverse ? "text-slate-200" : "text-cyan-200"}`}>{to}</span>
    </button>
  );
}

function IconAtom() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconNode() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/></svg>; }
function IconList() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>; }

export default OntologyExplorer;
