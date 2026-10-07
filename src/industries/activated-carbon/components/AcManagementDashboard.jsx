import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import {
  fetchAcKilnOutputBags,
  fetchAcPostActivationState,
  fetchAcRawMaterialInward
} from "../../../services/activatedCarbonApi";
import { StatusPill } from "../../../workflow/ui";
import {
  AC_MGMT_TABS,
  AC_POST_ACTIVATION_MACHINES,
  buildAcManagementModel
} from "../utils/acManagementDashboard";

const NAVY = "#0D3A6E";
const AXIS = { stroke: "#334155", fontSize: 11, tickLine: false, axisLine: { stroke: "#94a3b8" } };
const TOOLTIP = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  color: "#111111",
  fontSize: 12
};

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
}

function Tile({ label, value, hint }) {
  return (
    <div className="ac-mgmt-card rounded-lg px-3 py-2">
      <div className="ac-mgmt-label text-[10px] uppercase tracking-wide">{label}</div>
      <div className="ac-mgmt-value text-lg font-bold tabular-nums leading-tight">{value}</div>
      {hint ? <div className="ac-mgmt-muted text-[10px] truncate">{hint}</div> : null}
    </div>
  );
}

function Card({ title, right, children, className = "" }) {
  return (
    <div className={`ac-mgmt-card rounded-lg p-3 ${className}`}>
      {(title || right) && (
        <div className="flex items-baseline justify-between gap-2 mb-2">
          {title ? <h3 className="ac-mgmt-value text-xs font-semibold">{title}</h3> : null}
          {right ? <div className="ac-mgmt-muted text-[10px]">{right}</div> : null}
        </div>
      )}
      {children}
    </div>
  );
}

function EmptyNote({ message }) {
  return <p className="ac-mgmt-muted text-xs py-4 text-center">{message}</p>;
}

function formatMetric(value, kind) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (kind === "pct") return `${n.toFixed(1)}%`;
  return formatKg(n);
}

function LightTooltip({ active, payload, label, kind = "kg" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP} className="px-2 py-1.5">
      {label ? <div className="font-medium mb-0.5">{label}</div> : null}
      {payload.map((row) => (
        <div key={row.name}>
          {row.name}: {formatMetric(row.value, kind)}
        </div>
      ))}
    </div>
  );
}

function KgBarChart({
  data = [],
  dataKey = "kg",
  nameKey = "name",
  color = NAVY,
  empty = "No data yet.",
  kind = "kg"
}) {
  const rows = (data || []).filter((row) => {
    const n = Number(row[dataKey]);
    if (!Number.isFinite(n)) return false;
    return kind === "pct" ? true : n > 0;
  });
  if (!rows.length) return <EmptyNote message={empty} />;
  return (
    <div className="h-[132px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey={nameKey} {...AXIS} interval={0} height={28} tick={{ fill: "#334155", fontSize: 9 }} />
          <YAxis
            {...AXIS}
            width={36}
            domain={kind === "pct" ? [0, 100] : ["auto", "auto"]}
            tick={{ fill: "#334155", fontSize: 9 }}
            tickFormatter={(v) => (kind === "pct" ? `${Number(v).toFixed(0)}` : Number(v).toLocaleString())}
          />
          <Tooltip content={<LightTooltip kind={kind} />} />
          <Bar dataKey={dataKey} name={kind === "pct" ? "Efficiency" : "kg"} radius={[3, 3, 0, 0]} maxBarSize={28}>
            {rows.map((row, idx) => (
              <Cell key={row[nameKey] || idx} fill={row.fill || color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function KgPieChart({ data = [], empty = "No data yet." }) {
  const rows = (data || []).filter((row) => Number(row.kg) > 0);
  if (!rows.length) return <EmptyNote message={empty} />;
  return (
    <div className="h-[132px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="kg" nameKey="name" innerRadius={32} outerRadius={52} paddingAngle={2}>
            {rows.map((row) => (
              <Cell key={row.name} fill={row.fill || NAVY} />
            ))}
          </Pie>
          <Tooltip content={<LightTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function Gauge({ pct, label }) {
  const value = Math.max(0, Math.min(100, Number(pct) || 0));
  const data = [
    { name: "Used", kg: value, fill: NAVY },
    { name: "Free", kg: 100 - value, fill: "#e2e8f0" }
  ];
  return (
    <div className="relative h-[88px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="kg" startAngle={180} endAngle={0} innerRadius={28} outerRadius={42} stroke="none">
            {data.map((row) => (
              <Cell key={row.name} fill={row.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
        <div className="ac-mgmt-value text-sm font-bold tabular-nums">{value.toFixed(0)}%</div>
        {label ? <div className="ac-mgmt-muted text-[10px]">{label}</div> : null}
      </div>
    </div>
  );
}

function Legend({ rows }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] mt-1">
      {rows.filter((row) => Number(row.kg) > 0).map((row) => (
        <li key={row.name} className="inline-flex items-center gap-1.5 ac-mgmt-muted">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: row.fill }} />
          {row.name}
        </li>
      ))}
    </ul>
  );
}

function statusKind(status) {
  const st = String(status || "").toUpperCase();
  if (st === "RUNNING") return "ok";
  if (st === "COOLING") return "warn";
  return "neutral";
}

function statusLabel(status) {
  const st = String(status || "").toUpperCase();
  if (st === "RUNNING") return "In use";
  if (st === "COOLING") return "Cooling";
  return "Idle";
}

export default function AcManagementDashboard({ dashboard }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [inwardOrders, setInwardOrders] = useState([]);
  const [stations, setStations] = useState({});
  const [kilnOutputs, setKilnOutputs] = useState({});
  const [loadingExtra, setLoadingExtra] = useState(false);

  const requested = new URLSearchParams(location.search).get("view") || "overview";
  const tab = AC_MGMT_TABS.some((row) => row.id === requested) ? requested : "overview";

  const selectTab = (id) => {
    navigate({ pathname: location.pathname, search: `?view=${id}` }, { replace: true });
  };

  useEffect(() => {
    if (!dashboard) return undefined;
    let cancelled = false;
    (async () => {
      setLoadingExtra(true);
      try {
        const kilnCodes = (dashboard.kilns || [])
          .map((kiln) => kiln.resource_code)
          .filter(Boolean);
        const [inward, ...rest] = await Promise.all([
          fetchAcRawMaterialInward().catch(() => []),
          ...AC_POST_ACTIVATION_MACHINES.map((row) =>
            fetchAcPostActivationState(row.id).catch(() => null)
          ),
          ...kilnCodes.map((code) => fetchAcKilnOutputBags(code).catch(() => ({ bags: [] })))
        ]);
        if (cancelled) return;
        const stationRows = rest.slice(0, AC_POST_ACTIVATION_MACHINES.length);
        const kilnRows = rest.slice(AC_POST_ACTIVATION_MACHINES.length);
        setInwardOrders(Array.isArray(inward) ? inward : []);
        setStations(
          Object.fromEntries(
            AC_POST_ACTIVATION_MACHINES.map((row, idx) => [row.id, stationRows[idx]])
          )
        );
        setKilnOutputs(
          Object.fromEntries(kilnCodes.map((code, idx) => [code, kilnRows[idx] || { bags: [] }]))
        );
      } finally {
        if (!cancelled) setLoadingExtra(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboard]);

  const model = useMemo(
    () => buildAcManagementModel({ dashboard, inwardOrders, stations, kilnOutputs }),
    [dashboard, inwardOrders, stations, kilnOutputs]
  );

  if (!dashboard) {
    return <p className="text-sm text-slate-300">Loading plant dashboard…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="ac-masters-tabs ac-mgmt-tabs flex flex-wrap gap-1 border-b border-white/15">
        {AC_MGMT_TABS.map((row) => (
          <button
            key={row.id}
            type="button"
            className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === row.id ? "ac-masters-tab--active" : ""
            }`}
            onClick={() => selectTab(row.id)}
          >
            {row.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? <OverviewView model={model} /> : null}
      {tab === "raw-material" ? <RawMaterialView model={model.rawMaterial} loading={loadingExtra} /> : null}
      {tab === "activation" ? <ActivationView model={model.activation} /> : null}
      {tab === "post-activation" ? <PostActivationView model={model.postActivation} /> : null}
      {tab === "machine-utilization" ? (
        <MachineView headlines={model.machineHeadlines} machines={model.machines} loading={loadingExtra} />
      ) : null}
    </div>
  );
}

function OverviewView({ model }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {model.plant.map((tile) => (
          <Tile key={tile.label} {...tile} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <Card title="Plant yield" className="lg:col-span-1">
          {model.yieldPct == null ? (
            <EmptyNote message="Stock or dispatch a lot to see yield." />
          ) : (
            <>
              <Gauge pct={model.yieldPct} label="output ÷ charged" />
              <Legend
                rows={[
                  { name: "Yield", kg: model.yieldPct, fill: NAVY },
                  { name: "Loss", kg: Math.max(0, 100 - model.yieldPct), fill: "#e2e8f0" }
                ]}
              />
            </>
          )}
        </Card>
        <Card title="Material in plant" className="lg:col-span-2">
          <KgBarChart data={model.flowStages} empty="No material in the pipeline yet." />
          <Legend rows={model.flowStages} />
        </Card>
      </div>
    </div>
  );
}

function UtilBar({ pct, label = "Now" }) {
  const value = Number(pct);
  const n = Number.isFinite(value) ? value : 0;
  const width = Math.max(0, Math.min(100, n));
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] ac-mgmt-muted mb-0.5">
        <span>{label}</span>
        <span className="tabular-nums">{n.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: NAVY }} />
      </div>
    </div>
  );
}

const RAG_FILL = { green: "#15803d", amber: "#d97706", red: "#dc2626", neutral: "#64748b" };
const RAG_LABEL = { green: "Green", amber: "Amber", red: "Red", neutral: "—" };

function UtilizationPie({ pct, band = "neutral" }) {
  const used = Math.max(0, Math.min(100, Number(pct) || 0));
  const data = [
    { name: "Output", kg: used, fill: RAG_FILL[band] || NAVY },
    { name: "Remaining", kg: Math.max(0.0001, 100 - used), fill: "#e2e8f0" }
  ];
  return (
    <div className="relative h-[88px] w-[88px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="kg" innerRadius={22} outerRadius={38} stroke="none" startAngle={90} endAngle={-270}>
            {data.map((row) => (
              <Cell key={row.name} fill={row.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="ac-mgmt-value text-xs font-bold tabular-nums">{used.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function RagStatusBox({ band = "neutral" }) {
  const label = RAG_LABEL[band] || "—";
  const color = RAG_FILL[band] || RAG_FILL.neutral;
  return (
    <div
      className="inline-flex items-center justify-center min-w-[4.75rem] rounded px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-white"
      style={{ background: color }}
    >
      {label}
    </div>
  );
}

function formatDashPct(value) {
  if (value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function SupplierPerformanceTable({ rows = [] }) {
  if (!rows.length) return <EmptyNote message="No inward receipts yet — record a gate receipt to rank suppliers." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] text-left">
        <thead>
          <tr className="ac-mgmt-muted uppercase tracking-wide">
            <th className="py-1 pr-2 font-medium">Supplier</th>
            <th className="py-1 pr-2 font-medium text-right">Receipts</th>
            <th className="py-1 pr-2 font-medium text-right">Received</th>
            <th className="py-1 pr-2 font-medium text-right">Released</th>
            <th className="py-1 pr-2 font-medium text-right">Recovery</th>
            <th className="py-1 pr-2 font-medium text-right">Lab pass</th>
            <th className="py-1 pr-2 font-medium text-right">Weigh</th>
            <th className="py-1 font-medium text-right">Efficiency</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-slate-200">
              <td className="py-1 pr-2 ac-mgmt-value font-medium truncate max-w-[9rem]">{row.name}</td>
              <td className="py-1 pr-2 tabular-nums text-right ac-mgmt-muted">{row.receipts}</td>
              <td className="py-1 pr-2 tabular-nums text-right ac-mgmt-muted">{formatKg(row.receivedKg)}</td>
              <td className="py-1 pr-2 tabular-nums text-right ac-mgmt-muted">{formatKg(row.releasedKg)}</td>
              <td className="py-1 pr-2 tabular-nums text-right ac-mgmt-value">{formatDashPct(row.recoveryPct)}</td>
              <td className="py-1 pr-2 tabular-nums text-right ac-mgmt-muted">{formatDashPct(row.labPassPct)}</td>
              <td className="py-1 pr-2 tabular-nums text-right ac-mgmt-muted">{formatDashPct(row.weighMatchPct)}</td>
              <td className="py-1 tabular-nums text-right ac-mgmt-value font-semibold">
                {formatDashPct(row.efficiencyPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RawMaterialView({ model, loading }) {
  const performance = model.supplierPerformance || { tiles: [], rows: [], bars: [] };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {model.tiles.map((tile) => (
          <Tile key={tile.label} {...tile} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <Card title="Stock mix" right={model.balancePct != null ? `Balance ${model.balancePct.toFixed(1)}%` : null}>
          <KgPieChart data={model.mix} empty="No raw-material stock yet." />
          <Legend rows={model.mix} />
        </Card>
        <Card title="Charcoal by supplier" className="lg:col-span-2">
          {loading && !model.charcoalBars.length ? (
            <EmptyNote message="Loading charcoal stock…" />
          ) : (
            <KgBarChart
              data={model.charcoalBars.map((row) => ({ name: row.name, kg: row.total, fill: NAVY }))}
              empty="No charcoal in stock — record a gate receipt."
            />
          )}
        </Card>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {performance.tiles.map((tile) => (
          <Tile key={tile.label} {...tile} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <Card title="Supplier efficiency" right="Released, lab, weigh match">
          {loading && !performance.bars.length ? (
            <EmptyNote message="Loading supplier performance…" />
          ) : (
            <KgBarChart
              data={performance.bars}
              dataKey="pct"
              kind="pct"
              empty="Release charcoal or complete lab to rank suppliers."
            />
          )}
        </Card>
        <Card title="Supplier performance" className="lg:col-span-2" right="Ranked by efficiency">
          {loading && !performance.rows.length ? (
            <EmptyNote message="Loading supplier performance…" />
          ) : (
            <SupplierPerformanceTable rows={performance.rows} />
          )}
        </Card>
      </div>
    </div>
  );
}

function ActivationView({ model }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {model.tiles.map((tile) => (
          <Tile key={tile.label} {...tile} />
        ))}
      </div>
      <Card title="Activation stock">
        <KgBarChart data={model.mix} empty="No activation stock yet." />
        <Legend rows={model.mix} />
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {model.kilns.length ? (
          model.kilns.map((kiln) => (
            <Card key={kiln.code}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="ac-mgmt-value text-xs font-semibold">{kiln.name}</h3>
                <StatusPill kind={statusKind(kiln.status)}>{statusLabel(kiln.status)}</StatusPill>
              </div>
              <p className="ac-mgmt-value text-lg font-bold tabular-nums mt-1">
                {kiln.loadedKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
              </p>
              <p className="ac-mgmt-muted text-[10px]">Current kiln load</p>
              <UtilBar pct={kiln.nowPct} />
            </Card>
          ))
        ) : (
          <p className="text-sm text-slate-300">No kilns registered.</p>
        )}
      </div>
    </div>
  );
}

function PostActivationView({ model }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {model.tiles.map((tile) => (
          <Tile key={tile.label} {...tile} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Card title="Grade-wise in stock">
          <KgPieChart data={model.grades} empty="No In Stock bags yet." />
          <Legend rows={model.grades} />
        </Card>
        <Card title="Recent dispatches">
          <KgBarChart data={model.dispatchBars} empty="No shipments yet." />
        </Card>
      </div>
    </div>
  );
}

function MachineView({ headlines, machines, loading }) {
  const groups = ["Kiln", "Post activation"];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {headlines.map((tile) => (
          <Tile key={tile.label} {...tile} />
        ))}
      </div>
      {loading && !machines.some((m) => m.group !== "Kiln") ? (
        <p className="text-sm text-slate-300">Loading station status…</p>
      ) : null}
      {groups.map((group) => {
        const rows = machines.filter((row) => row.group === group);
        if (!rows.length) return null;
        return (
          <div key={group}>
            <h3 className="text-[10px] uppercase tracking-wide text-slate-300 mb-1">{group}</h3>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
              {rows.map((row) => (
                <Card key={row.id}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="ac-mgmt-value text-xs font-semibold truncate">{row.name}</h3>
                    <StatusPill kind={statusKind(row.status)}>{statusLabel(row.status)}</StatusPill>
                  </div>
                  <p className="ac-mgmt-value text-lg font-bold tabular-nums mt-1">{row.load}</p>
                  <p className="ac-mgmt-muted text-[10px]">{row.loadCaption || "Output this month"}</p>
                  <p className="ac-mgmt-muted text-[10px] truncate">{row.detail}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <UtilizationPie pct={row.monthPct ?? row.nowPct} band={row.ragBand} />
                    <div>
                      <RagStatusBox band={row.ragBand} />
                      <p className="ac-mgmt-muted text-[10px] mt-1">vs designed</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
