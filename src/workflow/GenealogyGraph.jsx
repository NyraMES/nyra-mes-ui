/**
 * Renders a vertical/horizontal manufacturing genealogy.
 * Input: an array of "levels" where each level is { label, nodes: [{ id, title, sub, kind }] }
 * Each level becomes a column. Edges are drawn from every node in level N
 * to every node in level N+1 (or first node when mapping is parent-child).
 */
export default function GenealogyGraph({ levels }) {
  if (!levels || levels.length === 0) {
    return (
      <div className="text-sm text-slate-500 py-6 text-center">
        No genealogy data.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-stretch gap-4 min-w-max">
        {levels.map((level, idx) => (
          <div className="flex items-stretch gap-4" key={idx}>
            <Column level={level} />
            {idx < levels.length - 1 && <Edge />}
          </div>
        ))}
      </div>
    </div>
  );
}

function Column({ level }) {
  return (
    <div className="flex flex-col gap-3 min-w-[200px]">
      <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80 font-semibold">
        {level.label}
      </div>
      {level.nodes.map((node, i) => (
        <Node key={node.id || i} node={node} />
      ))}
    </div>
  );
}

function Node({ node }) {
  const palette = {
    customer:   { ring: "ring-blue-400/40",    grad: "from-blue-500/20    to-blue-800/30",    text: "text-blue-200" },
    order:      { ring: "ring-cyan-400/40",    grad: "from-cyan-500/20    to-cyan-800/30",    text: "text-cyan-200" },
    production: { ring: "ring-indigo-400/40",  grad: "from-indigo-500/20  to-indigo-800/30",  text: "text-indigo-200" },
    lot:        { ring: "ring-violet-400/40",  grad: "from-violet-500/20  to-violet-800/30",  text: "text-violet-200" },
    operation:  { ring: "ring-sky-400/40",     grad: "from-sky-500/20     to-sky-800/30",     text: "text-sky-200" },
    machine:    { ring: "ring-amber-400/40",   grad: "from-amber-500/20   to-amber-800/30",   text: "text-amber-200" },
    inspection: { ring: "ring-emerald-400/40", grad: "from-emerald-500/20 to-emerald-800/30", text: "text-emerald-200" },
    ncr:        { ring: "ring-rose-400/40",    grad: "from-rose-500/20    to-rose-800/30",    text: "text-rose-200" },
    dispatch:   { ring: "ring-fuchsia-400/40", grad: "from-fuchsia-500/20 to-fuchsia-800/30", text: "text-fuchsia-200" },
    default:    { ring: "ring-slate-400/40",   grad: "from-slate-500/20   to-slate-800/30",   text: "text-slate-200" }
  };
  const p = palette[node.kind] || palette.default;
  return (
    <div className={`relative rounded-xl bg-gradient-to-br ${p.grad} ring-1 ${p.ring} p-3 shadow-lg shadow-black/30`}>
      <div className={`text-[10px] uppercase tracking-wider font-semibold ${p.text} opacity-80`}>
        {node.kind || "node"}
      </div>
      <div className="text-sm font-semibold text-slate-100 mt-1 leading-tight">
        {node.title}
      </div>
      {node.sub && (
        <div className="text-[11px] text-slate-400 mt-1 leading-snug">
          {node.sub}
        </div>
      )}
    </div>
  );
}

function Edge() {
  return (
    <div className="self-center flex flex-col items-center justify-center">
      <svg width="48" height="120" viewBox="0 0 48 120" fill="none">
        <defs>
          <linearGradient id="grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <path
          d="M2 60 C 20 60, 28 60, 46 60"
          stroke="url(#grad)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M38 54 L46 60 L38 66"
          stroke="#a78bfa"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
