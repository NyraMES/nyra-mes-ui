import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  createMesCoreProduct,
  fetchMesCoreOrderLines,
  fetchMesCoreProducts,
} from "../../services/mesCoreApi";
import { useWorkflow } from "../WorkflowContext";
import {
  WfCard,
  WfCardHeader,
  WfCardBody,
  SectionHeader,
  StatusPill,
  KpiTile,
  OntologyEdge,
  EmptyState
} from "../ui";


const PART_TYPES = [
  { value: "casting",     label: "Casting",     tone: "amber"   },
  { value: "machined",    label: "Machined",    tone: "cyan"    },
  { value: "fabrication", label: "Fabrication", tone: "violet"  },
  { value: "assembly",    label: "Assembly",    tone: "emerald" }
];

const UOMS = ["NOS", "KG", "MTR", "SET", "LTR"];


function PartMaster() {
  const navigate = useNavigate();
  const { update } = useWorkflow();

  const [parts, setParts] = useState([]);
  const [orderLines, setOrderLines] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [partName, setPartName] = useState("");
  const [partType, setPartType] = useState("casting");
  const [uom, setUom] = useState("NOS");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [parts, lines] = await Promise.all([
        fetchMesCoreProducts(),
        fetchMesCoreOrderLines(),
      ]);
      setParts(parts || []);
      setOrderLines(lines || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const canSave = partName.trim() && partType && uom;

  const createPart = async () => {
    if (!canSave) return;
    try {
      await createMesCoreProduct({
        part_name: partName.trim(),
        part_type: partType,
        unit_of_measure: uom
      });
      setPartName("");
      setPartType("casting");
      setUom("NOS");
      await loadAll();
    } catch (e) {
      alert(e.response?.data?.detail || "Error creating part");
    }
  };

  const startOrder = (p) => {
    update({ partId: p.part_code || p.part_id });
    navigate("/workflow/customer-order");
  };

  const defineRouting = (p) => {
    const code = p.part_code || p.part_id;
    update({ partId: code });
    navigate(`/workflow/masters/routings?part=${encodeURIComponent(code)}`);
  };

  const usageByPart = useMemo(() => {
    const map = {};
    orderLines.forEach((l) => {
      const k = l.part_code || l.part_id;
      if (!k) return;
      map[k] = (map[k] || 0) + 1;
    });
    return map;
  }, [orderLines]);

  const typeBreakdown = useMemo(() => {
    const map = {};
    parts.forEach((p) => {
      const t = (p.part_type || "other").toLowerCase();
      map[t] = (map[t] || 0) + 1;
    });
    return PART_TYPES
      .map((pt) => ({ ...pt, count: map[pt.value] || 0 }))
      .concat(
        Object.entries(map)
          .filter(([k]) => !PART_TYPES.find((pt) => pt.value === k))
          .map(([k, v]) => ({ value: k, label: k, tone: "blue", count: v }))
      );
  }, [parts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter(
      (p) =>
        (p.part_code || "").toLowerCase().includes(q) ||
        (p.part_id || "").toLowerCase().includes(q) ||
        (p.part_name || "").toLowerCase().includes(q) ||
        (p.part_type || "").toLowerCase().includes(q)
    );
  }, [parts, query]);

  const partsInUse = Object.keys(usageByPart).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Master Data · Parts"
        title="Manufactured SKUs"
        subtitle="Each part is a node in the ontology that drives routing, feasibility, inspection and dispatch downstream."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile label="Parts" value={parts.length} sub="Total in catalog" accent="cyan" icon={<IconBox />} />
        <KpiTile label="In Production" value={partsInUse} sub="Have open orders" accent="indigo" icon={<IconLink />} />
        <KpiTile label="Categories" value={typeBreakdown.filter((t) => t.count > 0).length} sub="Distinct types" accent="violet" icon={<IconLayers />} />
        <KpiTile label="Order Lines" value={orderLines.length} sub="Across catalog" accent="blue" icon={<IconOrder />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WfCard className="lg:col-span-2" glow>
          <WfCardHeader
            title="Add Part"
            subtitle="A new part becomes available for customer orders and routing"
            icon={<IconBoxPlus />}
          />
          <WfCardBody className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 wf-info-banner">
                Part ID is assigned automatically from the part sequence when you save.
              </div>
              <div>
                <label className="wf-label">Part Name</label>
                <input
                  className="wf-input"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  placeholder="e.g. Crankshaft Housing"
                />
              </div>

              <div>
                <label className="wf-label">Part Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {PART_TYPES.map((t) => {
                    const sel = partType === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setPartType(t.value)}
                        className={[
                          "rounded-lg px-3 py-2 text-xs font-medium border transition-colors text-left",
                          sel
                            ? `bg-${t.tone}-500/20 border-${t.tone}-400/50 text-${t.tone}-100`
                            : "bg-slate-900/40 border-slate-700/40 text-slate-300 hover:border-slate-500"
                        ].join(" ")}
                        style={
                          sel
                            ? {
                                background: `color-mix(in srgb, ${toneToColor(t.tone)} 18%, transparent)`,
                                borderColor: `color-mix(in srgb, ${toneToColor(t.tone)} 55%, transparent)`,
                                color: "#f1f5ff"
                              }
                            : undefined
                        }
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="wf-label">Unit of Measure</label>
                <div className="grid grid-cols-5 gap-2">
                  {UOMS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUom(u)}
                      className={[
                        "rounded-lg px-2 py-2 text-xs font-mono border transition-colors",
                        uom === u
                          ? "bg-blue-500/20 border-blue-400/50 text-blue-100"
                          : "bg-slate-900/40 border-slate-700/40 text-slate-300 hover:border-slate-500"
                      ].join(" ")}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
              <div className="text-xs text-slate-400">
                After saving, define a <span className="text-cyan-300 font-medium">Routing</span> for this part, then jump into a <span className="text-cyan-300 font-medium">Customer Order</span>.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="wf-btn wf-btn-ghost"
                  onClick={() => {
                    setPartId("");
                    setPartName("");
                    setPartType("casting");
                    setUom("NOS");
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="wf-btn wf-btn-primary"
                  disabled={!canSave}
                  onClick={createPart}
                >
                  Save Part
                </button>
              </div>
            </div>
          </WfCardBody>
        </WfCard>

        <div className="space-y-5">
          <WfCard>
            <WfCardHeader title="Ontology" subtitle="Part relationships" icon={<IconAtom />} />
            <WfCardBody className="space-y-2.5">
              <OntologyEdge from="Part" to="OrderLine" label="appears in" />
              <OntologyEdge from="Part" to="Routing" label="follows" />
              <OntologyEdge from="Part" to="Operation" label="produced via" />
              <OntologyEdge from="Part" to="Inspection" label="QA-plan" />
              <OntologyEdge from="Part" to="Dispatch" label="shipped as" />
            </WfCardBody>
          </WfCard>

          <WfCard>
            <WfCardHeader title="Category Mix" subtitle="Catalog distribution" icon={<IconLayers />} />
            <WfCardBody>
              {parts.length === 0 ? (
                <EmptyState title="No parts yet" hint="Add a part to anchor the catalog." icon={<IconBox />} />
              ) : (
                <div className="space-y-2">
                  {typeBreakdown
                    .filter((t) => t.count > 0)
                    .map((t) => {
                      const pct = parts.length ? (t.count / parts.length) * 100 : 0;
                      return (
                        <div key={t.value} className="flex items-center gap-3">
                          <div className="text-xs text-slate-300 w-28 truncate capitalize">{t.label}</div>
                          <div className="flex-1 h-1.5 rounded-full bg-slate-800/60 overflow-hidden">
                            <div
                              className="h-full"
                              style={{
                                width: `${pct}%`,
                                background: `linear-gradient(90deg, ${toneToColor(t.tone)}, ${toneToColor(t.tone)}aa)`
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono text-slate-200 w-8 text-right">{t.count}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </WfCardBody>
          </WfCard>
        </div>
      </div>

      <WfCard>
        <WfCardHeader
          title="Part Catalog"
          subtitle={`${filtered.length} of ${parts.length} shown`}
          icon={<IconList />}
          right={
            <div className="relative">
              <IconSearchInline />
              <input
                className="wf-input pl-9"
                placeholder="Search parts…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ minWidth: 240 }}
              />
            </div>
          }
        />
        <WfCardBody>
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={parts.length === 0 ? "No parts in catalog" : "No matches"}
              hint={parts.length === 0 ? "Add a part above to anchor the workflow." : "Try a different search term."}
              icon={<IconBox />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                    <th className="text-left py-2 px-3 font-semibold">Part ID</th>
                    <th className="text-left py-2 px-3 font-semibold">Name</th>
                    <th className="text-left py-2 px-3 font-semibold">Type</th>
                    <th className="text-left py-2 px-3 font-semibold">UOM</th>
                    <th className="text-left py-2 px-3 font-semibold">In Use</th>
                    <th className="text-right py-2 px-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const code = p.part_code || p.part_id;
                    const usage = usageByPart[code] || 0;
                    const meta = PART_TYPES.find((t) => t.value === (p.part_type || "").toLowerCase());
                    return (
                      <tr key={p.product_id || code} className="border-b border-white/5 hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-200">{code}</td>
                        <td className="py-2.5 px-3 text-slate-100">{p.part_name}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className="px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider"
                            style={{
                              background: `color-mix(in srgb, ${toneToColor(meta?.tone || "blue")} 15%, transparent)`,
                              color: toneToColor(meta?.tone || "blue"),
                              border: `1px solid color-mix(in srgb, ${toneToColor(meta?.tone || "blue")} 40%, transparent)`
                            }}
                          >
                            {p.part_type || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{p.unit_of_measure || "—"}</td>
                        <td className="py-2.5 px-3">
                          {usage > 0 ? (
                            <StatusPill kind="ok">{usage} order line{usage === 1 ? "" : "s"}</StatusPill>
                          ) : (
                            <StatusPill kind="neutral">Unused</StatusPill>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            className="text-xs px-3 py-1.5 rounded-md bg-violet-500/10 border border-violet-400/40 text-violet-200 hover:bg-violet-500/20 transition-colors mr-2"
                            onClick={() => defineRouting(p)}
                          >
                            Define Routing
                          </button>
                          <button
                            type="button"
                            className="text-xs px-3 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/20 transition-colors"
                            onClick={() => startOrder(p)}
                          >
                            Use in Order →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </WfCardBody>
      </WfCard>
    </div>
  );
}

function toneToColor(tone) {
  const map = {
    amber:   "#fbbf24",
    cyan:    "#22d3ee",
    violet:  "#a78bfa",
    emerald: "#34d399",
    blue:    "#60a5fa",
    rose:    "#fb7185",
    indigo:  "#818cf8"
  };
  return map[tone] || "#60a5fa";
}

function IconBox()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7 12 3l9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10"/></svg>; }
function IconBoxPlus()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7 12 3l9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10M16 6h6M19 3v6"/></svg>; }
function IconLink()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>; }
function IconLayers()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/></svg>; }
function IconOrder()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/></svg>; }
function IconAtom()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>; }
function IconList()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>; }
function IconSearchInline() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default PartMaster;
