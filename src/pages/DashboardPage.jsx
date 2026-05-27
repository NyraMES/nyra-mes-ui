import { useEffect, useMemo, useState } from "react";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

import api from "../services/api";

import "../styles/Dashboard.css";


const WO_STATUS_ORDER = ["Planned", "Released", "In Progress", "Completed"];

const WO_STATUS_COLORS = {
  Planned: "#3b82f6",
  Released: "#22c55e",
  "In Progress": "#8b5cf6",
  Completed: "#f59e0b"
};


function IconClipboardList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
      <path d="M8 12h8M8 16h6" />
    </svg>
  );
}

function IconFactoryFilled() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21V10l5 3V10l5 3V6l8 5v10z" />
      <path d="M9 17h2M14 17h2" />
    </svg>
  );
}

function IconClipboardCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

function IconTrendingUp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}


function KpiCard({ label, value, sub, accent, icon }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-text">
        <div className="kpi-card-label">{label}</div>
        <div className="kpi-card-value">{value}</div>
        <div className="kpi-card-sub">{sub}</div>
      </div>

      <div
        className="kpi-card-icon"
        style={{ background: accent.bg, color: accent.fg }}
      >
        {icon}
      </div>
    </div>
  );
}


function DashboardPage() {
  const [kpis, setKpis] = useState({
    production_orders: 0,
    work_orders: 0,
    ncr_count: 0,
    dispatch_count: 0,
    average_oee: 0
  });

  const [orderCount, setOrderCount] = useState(0);
  const [oeeTrend, setOeeTrend] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [oeeSummaries, setOeeSummaries] = useState([]);
  const [inspectionResults, setInspectionResults] = useState([]);
  const [openWorkOrders, setOpenWorkOrders] = useState([]);
  const [openNcrs, setOpenNcrs] = useState([]);
  const [recentDispatches, setRecentDispatches] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const safeFetch = async (url) => {
    try {
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error(`Failed to load ${url}`, error);
      return null;
    }
  };

  const loadDashboard = async () => {
    const [
      kpiData,
      orders,
      trend,
      wos,
      oee,
      inspections,
      openWos,
      openNcrList,
      dispatches
    ] = await Promise.all([
      safeFetch("/dashboard/kpis"),
      safeFetch("/orders"),
      safeFetch("/dashboard/oee-trend"),
      safeFetch("/work-orders"),
      safeFetch("/oee-daily-summary"),
      safeFetch("/inspection-results"),
      safeFetch("/dashboard/open-work-orders"),
      safeFetch("/dashboard/open-ncrs"),
      safeFetch("/dashboard/recent-dispatches")
    ]);

    if (kpiData) setKpis(kpiData);
    if (Array.isArray(orders)) setOrderCount(orders.length);
    if (Array.isArray(trend)) setOeeTrend(trend);
    if (Array.isArray(wos)) setWorkOrders(wos);
    if (Array.isArray(oee)) setOeeSummaries(oee);
    if (Array.isArray(inspections)) setInspectionResults(inspections);
    if (Array.isArray(openWos)) setOpenWorkOrders(openWos);
    if (Array.isArray(openNcrList)) setOpenNcrs(openNcrList);
    if (Array.isArray(dispatches)) setRecentDispatches(dispatches);
  };

  const workOrderStatusData = useMemo(() => {
    const counts = {};
    workOrders.forEach((wo) => {
      const status = wo.work_order_status || "Other";
      counts[status] = (counts[status] || 0) + 1;
    });

    const ordered = WO_STATUS_ORDER
      .filter((s) => counts[s])
      .map((s) => ({ name: s, value: counts[s] }));

    Object.keys(counts).forEach((s) => {
      if (!WO_STATUS_ORDER.includes(s)) {
        ordered.push({ name: s, value: counts[s] });
      }
    });

    return ordered;
  }, [workOrders]);

  const workOrderTotal = workOrderStatusData.reduce(
    (sum, d) => sum + d.value,
    0
  );

  const topMachines = useMemo(() => {
    const latestByMachine = {};
    oeeSummaries.forEach((row) => {
      const id = row.machine_id;
      if (!id) return;
      const existing = latestByMachine[id];
      if (!existing || (row.oee_date || "") > (existing.oee_date || "")) {
        latestByMachine[id] = row;
      }
    });

    return Object.values(latestByMachine)
      .map((r) => ({
        machine_id: r.machine_id,
        oee: Number(r.oee_percent) || 0
      }))
      .sort((a, b) => b.oee - a.oee)
      .slice(0, 5);
  }, [oeeSummaries]);

  const qualityStats = useMemo(() => {
    let inspected = 0;
    let accepted = 0;
    let rejected = 0;
    inspectionResults.forEach((ir) => {
      inspected += Number(ir.inspected_quantity) || 0;
      accepted += Number(ir.accepted_quantity) || 0;
      rejected += Number(ir.rejected_quantity) || 0;
    });
    const score = inspected > 0 ? (accepted / inspected) * 100 : 0;
    return { inspected, accepted, rejected, score };
  }, [inspectionResults]);

  const qualityDonut = [
    { name: "Passed", value: qualityStats.accepted },
    { name: "Failed", value: qualityStats.rejected }
  ];

  const activities = useMemo(() => {
    const items = [];

    openWorkOrders.slice(0, 2).forEach((wo) => {
      items.push({
        key: `wo-${wo.work_order_id}`,
        text: `WO ${wo.work_order_id} ${wo.work_order_status || "open"}`,
        kind: "info"
      });
    });

    openNcrs.slice(0, 2).forEach((ncr) => {
      items.push({
        key: `ncr-${ncr.ncr_id}`,
        text: `NCR ${ncr.ncr_id} raised`,
        kind: "alert"
      });
    });

    recentDispatches.slice(0, 2).forEach((d) => {
      items.push({
        key: `dispatch-${d.dispatch_id}`,
        text: `Dispatch ${d.dispatch_id} ${d.dispatch_status || ""}`.trim(),
        kind: "success"
      });
    });

    return items;
  }, [openWorkOrders, openNcrs, recentDispatches]);

  const renderActivityIcon = (kind) => {
    if (kind === "alert") {
      return (
        <span className="activity-icon activity-icon-red">
          <IconAlert />
        </span>
      );
    }
    if (kind === "info") {
      return (
        <span className="activity-icon activity-icon-blue">
          <IconInfo />
        </span>
      );
    }
    return (
      <span className="activity-icon activity-icon-green">
        <IconCheckCircle />
      </span>
    );
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Welcome back, Admin User!</h1>
        <p className="dashboard-subtitle">
          Real-time overview of your manufacturing operations
        </p>
      </div>

      <div className="kpi-grid">
        <KpiCard
          label="Orders"
          value={orderCount}
          sub="Total Orders"
          accent={{ bg: "#dbeafe", fg: "#2563eb" }}
          icon={<IconClipboardList />}
        />

        <KpiCard
          label="Production Orders"
          value={kpis.production_orders}
          sub="In Progress"
          accent={{ bg: "#dcfce7", fg: "#16a34a" }}
          icon={<IconFactoryFilled />}
        />

        <KpiCard
          label="Work Orders"
          value={kpis.work_orders}
          sub="Active"
          accent={{ bg: "#ede9fe", fg: "#7c3aed" }}
          icon={<IconClipboardCheck />}
        />

        <KpiCard
          label="OEE"
          value={`${Number(kpis.average_oee || 0).toFixed(1)}%`}
          sub="Overall"
          accent={{ bg: "#fef3c7", fg: "#d97706" }}
          icon={<IconTrendingUp />}
        />
      </div>

      <div className="dashboard-row">
        <div className="panel panel-overview">
          <div className="panel-header">
            <h3 className="panel-title">Production Overview</h3>
            <select className="panel-select" defaultValue="this-week">
              <option value="this-week">This Week</option>
              <option value="this-month">This Month</option>
            </select>
          </div>

          <div className="chart-area">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={oeeTrend}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="overviewGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  domain={[0, 100]}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="oee"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fill="url(#overviewGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Work Order Status</h3>
          </div>

          <div className="donut-row">
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={workOrderStatusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {workOrderStatusData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={WO_STATUS_COLORS[entry.name] || "#94a3b8"}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="donut-center">
                <div className="donut-center-value">{workOrderTotal}</div>
                <div className="donut-center-label">Total</div>
              </div>
            </div>

            <div className="donut-legend">
              {workOrderStatusData.map((entry) => {
                const pct = workOrderTotal > 0
                  ? ((entry.value / workOrderTotal) * 100).toFixed(1)
                  : "0.0";
                return (
                  <div className="legend-row" key={entry.name}>
                    <span
                      className="legend-dot"
                      style={{
                        background:
                          WO_STATUS_COLORS[entry.name] || "#94a3b8"
                      }}
                    />
                    <span className="legend-label">{entry.name}</span>
                    <span className="legend-value">{entry.value}</span>
                    <span className="legend-pct">({pct}%)</span>
                  </div>
                );
              })}
              {workOrderStatusData.length === 0 && (
                <div className="empty-note">No work orders yet</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-row dashboard-row-three">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Top Machines by OEE</h3>
          </div>

          <div className="bar-list">
            {topMachines.map((m) => (
              <div className="bar-row" key={m.machine_id}>
                <div className="bar-label">{m.machine_id}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.min(m.oee, 100)}%` }}
                  />
                </div>
                <div className="bar-value">{m.oee.toFixed(1)}%</div>
              </div>
            ))}
            {topMachines.length === 0 && (
              <div className="empty-note">No OEE data yet</div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Quality Summary</h3>
          </div>

          <div className="quality-row">
            <div className="donut-wrap quality-donut">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={qualityDonut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={2}
                    stroke="none"
                  >
                    <Cell fill="#22c55e" />
                    <Cell fill="#ef4444" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="donut-center">
                <div className="donut-center-value donut-center-value-green">
                  {qualityStats.score.toFixed(1)}%
                </div>
                <div className="donut-center-label">Quality Score</div>
              </div>
            </div>

            <div className="quality-stats">
              <div className="quality-stat">
                <div className="quality-stat-label">Total Inspections</div>
                <div className="quality-stat-value">
                  {qualityStats.inspected.toLocaleString()}
                </div>
              </div>
              <div className="quality-stat">
                <div className="quality-stat-label">Passed</div>
                <div className="quality-stat-value quality-stat-green">
                  {qualityStats.accepted.toLocaleString()}
                </div>
              </div>
              <div className="quality-stat">
                <div className="quality-stat-label">Failed</div>
                <div className="quality-stat-value quality-stat-red">
                  {qualityStats.rejected.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Recent Activities</h3>
          </div>

          <div className="activity-list">
            {activities.map((a) => (
              <div className="activity-row" key={a.key}>
                {renderActivityIcon(a.kind)}
                <span className="activity-text">{a.text}</span>
              </div>
            ))}
            {activities.length === 0 && (
              <div className="empty-note">No recent activity</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
