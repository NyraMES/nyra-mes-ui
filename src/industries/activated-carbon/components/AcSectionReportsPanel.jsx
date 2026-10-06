import { useEffect, useMemo, useState } from "react";
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
  fetchAcDestoningBagQc,
  fetchAcDestoningState,
  fetchAcInStockBags,
  fetchAcKilnFeedLots,
  fetchAcKilnOutputBagQc,
  fetchAcPostActivationQuality,
  fetchAcPostActivationState,
  fetchAcRawMaterialInward,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import { downloadAcExcel } from "../utils/acExcelExport";
import AcAlert from "./AcAlert";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

const RM_PROCESSES = [
  { id: "all", label: "All processes" },
  { id: "receipts", label: "Gate receipt" },
  { id: "lab", label: "Lab" },
  { id: "rms_in", label: "RMS inward" },
  { id: "crusher", label: "Crusher" },
  { id: "rms_out", label: "RMS outward" },
  { id: "released", label: "Release to production" }
];

const CHART_COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#64748b"];

const ACT_PROCESSES = [
  { id: "all", label: "All processes" },
  { id: "kiln_feed", label: "Kiln feed" },
  { id: "kiln_output", label: "Kiln output" },
  { id: "destoning", label: "Destoning" },
  { id: "deston_stock", label: "Destoning In Stock" }
];

const POST_PROCESSES = [
  { key: "screening", label: "Screening" },
  { key: "dedusting", label: "De-dusting" },
  { key: "crushing", label: "Crushing" },
  { key: "demagnetisation", label: "De-magnetisation" },
  { key: "blending", label: "Blending" },
  { key: "fg_qc", label: "Finished Goods" }
];

const POST_REPORT_PROCESSES = [
  { id: "all", label: "All processes" },
  ...POST_PROCESSES.map((row) => ({ id: row.key, label: row.label })),
  { id: "in_stock", label: "In Stock" }
];

const SOURCE_LABELS = {
  destoning: "Destoning",
  screening: "Screening",
  crushing: "Crushing",
  dedusting: "De-dusting",
  demagnetisation: "De-magnetisation",
  blending: "Blending",
  fg_qc: "Finished Goods"
};

function dayKey(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayKey() {
  return dayKey(new Date());
}

function firstOfMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function inRange(value, from, to) {
  const key = dayKey(value);
  if (!key) return true;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function matchesSearch(row, search, keys) {
  const q = String(search || "").trim().toLowerCase();
  if (!q) return true;
  return keys.some((key) => String(row[key] || "").toLowerCase().includes(q));
}

function doneStatus(status) {
  const raw = String(status || "").toUpperCase();
  if (["DENIED", "FAIL", "QC_FAILED", "REJECTED"].includes(raw)) return "Denied";
  if (["COMPLETED", "RELEASED", "QC_PASSED", "PASS", "APPROVED"].includes(raw)) return "Completed";
  return "Pending";
}

function crusherStatus(order) {
  const exec = order.inbound_execution || order.metadata?.inbound_execution || {};
  const step = exec["IN-CRUSHER"] || exec["IN-CRUSH"] || {};
  return step.status || order.crush_status || order.metadata?.raw_material_crush?.status || "";
}

function rmStepStatus(order, process) {
  if (process === "receipts") return "COMPLETED";
  if (process === "lab") return order.lab_status;
  if (process === "rms_in") return order.rms_inward_status;
  if (process === "crusher") return crusherStatus(order);
  if (process === "rms_out") return order.rm_outward_status;
  if (process === "released") return order.released_to_production_status;
  return "";
}

function destinationOf(bag) {
  const values = bag?.values || bag?.destoning_qc?.values || bag?.quality_qc?.values || {};
  return (
    values.deston_qc_destination ||
    values.post_qc_destination ||
    bag.destination ||
    ""
  );
}

function processesFor(section) {
  if (section === "activation") return ACT_PROCESSES;
  if (section === "post_activation") return POST_REPORT_PROCESSES;
  return RM_PROCESSES;
}

function countBy(rows, nameOf) {
  const buckets = {};
  for (const row of rows) {
    const name = nameOf(row) || "—";
    buckets[name] = (buckets[name] || 0) + 1;
  }
  return Object.entries(buckets).map(([name, value]) => ({ name, value }));
}

function pieChart(rows, nameOf, title) {
  return {
    kind: "pie",
    title,
    data: countBy(rows, nameOf).filter((row) => row.value > 0)
  };
}

function barChart(data, title) {
  return { kind: "bar", title, data };
}

function kilnOf(bag) {
  const code = String(bag.bag_code || "").toUpperCase();
  if (code.startsWith("KA")) return "Kiln A";
  if (code.startsWith("KB")) return "Kiln B";
  return bag.kiln_name || bag.kiln_resource_code || "Kiln";
}

function lotCharged(row) {
  const status = String(row.status || "").toUpperCase();
  return Boolean(
    row.charged_at ||
      num(row.kiln_loaded_kg) > 0 ||
      ["IN_PROGRESS", "COMPLETED", "CHARGED", "LOADED"].includes(status)
  );
}

function isInStockDest(bag) {
  const dest = String(destinationOf(bag) || "In Stock").toLowerCase().replace(/\s+/g, "");
  return dest === "instock";
}

function inwardOf(row) {
  return row.inward_code || row.order_code || row.source_inward_order_code || "—";
}

function filterLots(data, filters) {
  return (data.lots || []).filter(
    (row) =>
      inRange(row.created_at || row.charged_at, filters.from, filters.to) &&
      matchesSearch(row, filters.search, ["lot_code", "order_code", "inward_code"])
  );
}

function filterKilnBags(data, filters) {
  return (data.kilnBags || []).filter(
    (row) =>
      inRange(row.created_at || row.saved_at, filters.from, filters.to) &&
      matchesSearch(row, filters.search, ["bag_code", "lot_code"])
  );
}

function filterDestonBags(data, filters) {
  return (data.destonQc || data.destoningBags || []).filter(
    (row) =>
      inRange(row.created_at || row.saved_at, filters.from, filters.to) &&
      matchesSearch(row, filters.search, ["bag_code", "lot_code", "grade"])
  );
}

function filterPostBags(data, process, filters) {
  return ((data.byProcess?.[process] || {}).output_bags || []).filter(
    (row) =>
      inRange(row.created_at || row.saved_at, filters.from, filters.to) &&
      matchesSearch(row, filters.search, ["bag_code", "lot_code", "grade"])
  );
}

function filterInStock(data, filters) {
  return (data.inStock || []).filter(
    (row) =>
      inRange(row.created_at, filters.from, filters.to) &&
      matchesSearch(row, filters.search, ["bag_code", "grade", "source"])
  );
}

async function loadSectionData(section) {
  if (section === "raw_material") {
    const inward = await fetchAcRawMaterialInward();
    return { inward: inward || [] };
  }
  if (section === "activation") {
    const [lots, kilnQc, destoning, destonQc] = await Promise.all([
      fetchAcKilnFeedLots().catch(() => []),
      fetchAcKilnOutputBagQc().catch(() => []),
      fetchAcDestoningState().catch(() => ({})),
      fetchAcDestoningBagQc().catch(() => [])
    ]);
    return {
      lots: lots || [],
      kilnBags: kilnQc || [],
      destoningBags: destoning?.output_bags || [],
      destonQc: destonQc || []
    };
  }
  const [quality, inStock, ...states] = await Promise.all([
    fetchAcPostActivationQuality().catch(() => ({ sections: [] })),
    fetchAcInStockBags().catch(() => []),
    ...POST_PROCESSES.map((row) => fetchAcPostActivationState(row.key).catch(() => null))
  ]);
  const byProcess = {};
  POST_PROCESSES.forEach((row, index) => {
    byProcess[row.key] = states[index] || { output_bags: [], loaded: [], available: [] };
  });
  return {
    quality: quality?.sections || [],
    inStock: inStock || [],
    byProcess
  };
}

function filterRmOrders(data, filters) {
  return (data.inward || []).filter(
    (row) =>
      inRange(row.created_at || row.order_date, filters.from, filters.to) &&
      matchesSearch(row, filters.search, ["order_code", "dc_number", "supplier_name", "supplier_code"])
  );
}

function buildRmDetails(process, data, filters) {
  const base = filterRmOrders(data, filters).map((row) => ({
    ...row,
    supplier_name: row.supplier_name || row.supplier_code || "—",
    our_weight_kg: row.our_weight_kg ?? row.inward_quantity_kg ?? "",
    process_status: doneStatus(rmStepStatus(row, process === "all" ? "receipts" : process)),
    crusher_status: crusherStatus(row) || "PENDING"
  }));
  const title = RM_PROCESSES.find((row) => row.id === process)?.label || "Raw Material";
  if (process === "all" || process === "receipts") {
    return {
      title: process === "all" ? "All inward orders" : "Gate receipts",
      columns: [
        { key: "order_code", label: "Order" },
        { key: "dc_number", label: "DC" },
        { key: "supplier_name", label: "Supplier" },
        { key: "supplier_weight_kg", label: "Supplier (KG)" },
        { key: "our_weight_kg", label: "Our wt (KG)" },
        { key: "lab_status", label: "Lab" },
        { key: "rms_inward_status", label: "RMS inward" },
        { key: "crusher_status", label: "Crusher" },
        { key: "rm_outward_status", label: "RMS outward" },
        { key: "released_to_production_status", label: "Release" }
      ],
      rows: base
    };
  }
  const statusKey =
    process === "lab"
      ? "lab_status"
      : process === "rms_in"
        ? "rms_inward_status"
        : process === "crusher"
          ? "crusher_status"
          : process === "rms_out"
            ? "rm_outward_status"
            : "released_to_production_status";
  return {
    title,
    columns: [
      { key: "order_code", label: "Order" },
      { key: "dc_number", label: "DC" },
      { key: "supplier_name", label: "Supplier" },
      { key: "our_weight_kg", label: "Our wt (KG)" },
      { key: statusKey, label: "Status" },
      { key: "process_status", label: "Result" },
      { key: "allocated_to_production_kg", label: "Released KG" }
    ],
    rows: base
  };
}

function buildRmChart(process, data, filters) {
  const rows = filterRmOrders(data, filters);
  if (process === "all") {
    return barChart(
      [
        { name: "Gate receipt", value: rows.length },
        { name: "Lab", value: rows.filter((row) => doneStatus(row.lab_status) === "Completed").length },
        { name: "RMS inward", value: rows.filter((row) => doneStatus(row.rms_inward_status) === "Completed").length },
        { name: "Crusher", value: rows.filter((row) => doneStatus(crusherStatus(row)) === "Completed").length },
        { name: "RMS outward", value: rows.filter((row) => doneStatus(row.rm_outward_status) === "Completed").length },
        { name: "Released", value: rows.filter((row) => doneStatus(row.released_to_production_status) === "Completed").length }
      ],
      "Completed counts by process"
    );
  }
  const buckets = { Completed: 0, Pending: 0, Denied: 0 };
  for (const row of rows) {
    buckets[doneStatus(rmStepStatus(row, process))] += 1;
  }
  return {
    kind: "pie",
    title: "Status mix",
    data: Object.entries(buckets)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
  };
}

function buildActDetails(process, data, filters) {
  const lots = filterLots(data, filters).map((row) => ({
    process_label: "Kiln feed",
    identity: inwardOf(row),
    bag_code: row.lot_code || "—",
    quantity_kg: row.lot_quantity || row.quantity_kg || row.kiln_loaded_kg || "",
    status: lotCharged(row) ? "Charged" : "Pending",
    destination: "",
    created_at: row.created_at || row.charged_at || ""
  }));
  const kilnBags = filterKilnBags(data, filters).map((row) => ({
    process_label: "Kiln output",
    identity: row.bag_code || "—",
    bag_code: row.bag_code || "—",
    quantity_kg: row.quantity_kg || "",
    status: kilnOf(row),
    destination: "",
    created_at: row.created_at || row.saved_at || ""
  }));
  const deston = filterDestonBags(data, filters).map((row) => ({
    process_label: "Destoning",
    identity: row.bag_code || "—",
    bag_code: row.bag_code || "—",
    quantity_kg: row.quantity_kg || "",
    status: isInStockDest(row) ? "In Stock" : "Routed",
    destination: destinationOf(row) || "In Stock",
    created_at: row.created_at || row.saved_at || ""
  }));
  const stock = deston.filter((row) => isInStockDest(row));
  const columns = [
    { key: "identity", label: process === "kiln_feed" ? "Inward" : "Bag" },
    { key: "quantity_kg", label: "Qty (KG)" },
    { key: "status", label: "Status" },
    { key: "destination", label: "Destination" },
    { key: "created_at", label: "Date" }
  ];
  if (process === "all") {
    return {
      title: "All activation rows",
      columns: [{ key: "process_label", label: "Process" }, ...columns],
      rows: [...lots, ...kilnBags, ...deston]
    };
  }
  if (process === "kiln_feed") {
    return { title: "Kiln feed", columns, rows: lots };
  }
  if (process === "kiln_output") {
    return { title: "Kiln output bags", columns, rows: kilnBags };
  }
  if (process === "deston_stock") {
    return { title: "Destoning In Stock bags", columns, rows: stock };
  }
  return { title: "Destoning bags", columns, rows: deston };
}

function buildActChart(process, data, filters) {
  const lots = filterLots(data, filters);
  const kilnBags = filterKilnBags(data, filters);
  const deston = filterDestonBags(data, filters);
  const stock = deston.filter((row) => isInStockDest(row));
  if (process === "all") {
    return barChart(
      [
        { name: "Kiln feed", value: lots.length },
        { name: "Kiln output", value: kilnBags.length },
        { name: "Destoning", value: deston.length },
        { name: "In Stock", value: stock.length }
      ],
      "Counts by process"
    );
  }
  if (process === "kiln_feed") {
    return pieChart(lots, (row) => (lotCharged(row) ? "Charged" : "Pending"), "Kiln feed status");
  }
  if (process === "kiln_output") {
    return pieChart(kilnBags, kilnOf, "Kiln output mix");
  }
  if (process === "deston_stock") {
    return pieChart(stock, (row) => destinationOf(row) || "In Stock", "Destoning In Stock");
  }
  return pieChart(deston, (row) => destinationOf(row) || "In Stock", "Destoning destinations");
}

function buildPostDetails(process, data, filters) {
  const columns = [
    { key: "bag_code", label: "Bag" },
    { key: "grade", label: "Grade" },
    { key: "quantity_kg", label: "Qty (KG)" },
    { key: "destination", label: "Destination" },
    { key: "created_at", label: "Date" }
  ];
  if (process === "in_stock") {
    const rows = filterInStock(data, filters).map((row) => ({
      ...row,
      process_label: SOURCE_LABELS[row.source] || row.source || "In Stock",
      destination: "In Stock",
      quantity_kg: row.remaining_kg ?? row.quantity_kg
    }));
    return {
      title: "Available In Stock bags",
      columns: [
        { key: "bag_code", label: "Bag" },
        { key: "process_label", label: "Source" },
        { key: "grade", label: "Grade" },
        { key: "quantity_kg", label: "Available (KG)" }
      ],
      rows
    };
  }
  if (process === "all") {
    const rows = POST_PROCESSES.flatMap((proc) =>
      filterPostBags(data, proc.key, filters).map((row) => ({
        ...row,
        process_label: proc.label,
        destination: destinationOf(row) || ""
      }))
    );
    return {
      title: "All post-activation bags",
      columns: [{ key: "process_label", label: "Process" }, ...columns],
      rows
    };
  }
  const proc = POST_PROCESSES.find((row) => row.key === process);
  return {
    title: `${proc?.label || process} output bags`,
    columns,
    rows: filterPostBags(data, process, filters).map((row) => ({
      ...row,
      destination: destinationOf(row) || ""
    }))
  };
}

function buildPostChart(process, data, filters) {
  if (process === "all") {
    return barChart(
      [
        ...POST_PROCESSES.map((proc) => ({
          name: proc.label.replace("De-magnetisation", "Demag."),
          value: filterPostBags(data, proc.key, filters).length
        })),
        { name: "In Stock", value: filterInStock(data, filters).length }
      ],
      "Output bags by process"
    );
  }
  if (process === "in_stock") {
    return pieChart(
      filterInStock(data, filters),
      (row) => SOURCE_LABELS[row.source] || row.source || "In Stock",
      "In Stock by source"
    );
  }
  const bags = filterPostBags(data, process, filters);
  const dests = bags.filter((row) => destinationOf(row));
  if (dests.length) {
    return pieChart(bags, (row) => destinationOf(row) || "Not set", "Destination mix");
  }
  return pieChart(bags, (row) => row.grade || "Output", "Grade mix");
}

function buildSectionDetails(section, process, data, filters) {
  if (section === "activation") return buildActDetails(process, data, filters);
  if (section === "post_activation") return buildPostDetails(process, data, filters);
  return buildRmDetails(process, data, filters);
}

function buildSectionChart(section, process, data, filters) {
  if (section === "activation") return buildActChart(process, data, filters);
  if (section === "post_activation") return buildPostChart(process, data, filters);
  return buildRmChart(process, data, filters);
}

function ReportChart({ chart }) {
  if (!chart?.data?.length) {
    return <p className="text-sm text-slate-600">No values to chart for the current filters.</p>;
  }
  if (chart.kind === "pie") {
    return (
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chart.data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72} paddingAngle={2}>
              {chart.data.map((row, index) => (
                <Cell key={row.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chart.data}
          layout="vertical"
          margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: "#475569", fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={108}
            tick={{ fill: "#475569", fontSize: 11 }}
          />
          <Tooltip />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
            {chart.data.map((row, index) => (
              <Cell key={row.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ReportDetailsTable({ details }) {
  if (!details) return null;
  if (details.rows.length === 0) {
    return <p className="text-sm text-slate-600">No rows for the current filters.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b">
            {details.columns.map((col) => (
              <th key={col.key} className="py-2 pr-3 font-semibold whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {details.rows.map((row, index) => (
            <tr key={row.bag_code || row.order_code || row.lot_code || index} className="border-b border-slate-100 text-slate-900">
              {details.columns.map((col) => (
                <td key={col.key} className="py-2 pr-3 font-mono whitespace-nowrap">
                  {row[col.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AcSectionReportsPanel({ section = "raw_material" }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(firstOfMonthKey);
  const [to, setTo] = useState(todayKey);
  const [search, setSearch] = useState("");
  const [process, setProcess] = useState("all");

  useEffect(() => {
    setProcess("all");
  }, [section]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const next = await loadSectionData(section);
        if (!cancelled) setData(next);
      } catch (e) {
        if (!cancelled) setError(formatAcApiError(e, "Could not load report data"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section]);

  const filters = useMemo(() => ({ from, to, search }), [from, to, search]);
  const processOptions = processesFor(section);
  const details = useMemo(
    () => buildSectionDetails(section, process, data, filters),
    [section, process, data, filters]
  );
  const chart = useMemo(
    () => buildSectionChart(section, process, data, filters),
    [section, process, data, filters]
  );

  const title =
    section === "activation"
      ? "Activation reports"
      : section === "post_activation"
        ? "Post-activation reports"
        : "Raw Material reports";

  const downloadSummary = () => {
    downloadAcExcel(
      `${section}-${process}-summary`,
      [
        { key: "name", label: process === "all" ? "Process" : "Mix" },
        { key: "value", label: "Count" }
      ],
      chart?.data || []
    );
  };

  const downloadDetails = () => {
    if (!details) return;
    downloadAcExcel(`${section}-${process}`, details.columns, details.rows);
  };

  return (
    <div className="space-y-4">
      <WfCard>
        <WfCardHeader
          title={title}
          subtitle="Choose a process, see the chart and details on screen, then download Excel."
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <label className="text-sm">
                <span className="block mb-1 font-medium text-slate-700">From</span>
                <input
                  type="date"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="block mb-1 font-medium text-slate-700">To</span>
                <input
                  type="date"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="block mb-1 font-medium text-slate-700">Process</span>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={process}
                  onChange={(e) => setProcess(e.target.value)}
                >
                  {processOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="block mb-1 font-medium text-slate-700">Search</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Order, bag, DC, supplier…"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="wf-btn wf-btn-ghost" onClick={downloadSummary} disabled={loading}>
                Download summary Excel
              </button>
              {details ? (
                <button type="button" className="wf-btn wf-btn-ghost" onClick={downloadDetails}>
                  Download details Excel
                </button>
              ) : null}
            </div>
            {error ? <AcAlert variant="error">{error}</AcAlert> : null}
            {loading ? (
              <p className="text-sm text-slate-600">Loading report…</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] gap-4 items-start">
                <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <p className="text-sm font-semibold text-slate-800">{details?.title}</p>
                    <p className="text-xs text-slate-500">{details?.rows?.length || 0} row{(details?.rows?.length || 0) === 1 ? "" : "s"}</p>
                  </div>
                  <div className="max-h-[28rem] overflow-y-auto">
                    <ReportDetailsTable details={details} />
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 xl:sticky xl:top-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                    {chart?.title || (process === "all" ? "Counts by process" : "Status mix")}
                  </p>
                  <ReportChart chart={chart} />
                  {chart?.data?.length ? (
                    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 mt-2">
                      {chart.data.map((row, index) => (
                        <li key={row.name} className="flex items-center gap-1.5">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-sm"
                            style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          {row.name}: <span className="font-semibold text-slate-800">{row.value}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </WfCardBody>
      </WfCard>
    </div>
  );
}
