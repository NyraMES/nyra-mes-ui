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
  fetchAcInwardBags,
  fetchAcRawMaterialInward,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import { useAuth } from "../../../auth/AuthContext";
import { downloadAcExcel } from "../utils/acExcelExport";
import useAcPersonLabel from "../hooks/useAcPersonLabel";
import { MES_ROLES } from "../../../auth/roles";
import { userCanAccessAcDestoningCtc, userCanSeeAcSupplier, userIsAcEngineer } from "../utils/acPrivileges";
import AcAlert from "./AcAlert";
import { WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

const RM_PROCESSES = [
  { id: "all", label: "All processes" },
  { id: "receipts", label: "Gate receipt" },
  { id: "lab", label: "Lab" },
  { id: "debit_note", label: "Debit note" },
  { id: "rms_in", label: "RMS inward" },
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
  { key: "blending", label: "Blending" }
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
  fg_qc: "In Stock"
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
  const wanted = keys?.length ? keys : Object.keys(row || {});
  return wanted.some((key) => String(row[key] ?? "").toLowerCase().includes(q));
}

function rowActor(row) {
  return String(row.created_by || row.raised_by || row.saved_by || row.user_id || "")
    .trim()
    .toLowerCase();
}

function rowKg(row) {
  const kg = num(row.weight_kg || row.quantity_kg || row.our_weight_kg || row.remaining_kg);
  return kg > 0 ? kg : 0;
}

function engineerPerformanceChart(rows, user) {
  return engineerDayChart(rows, (row) => {
    const actor = rowActor(row);
    const ids = new Set(
      [user?.username, user?.email, user?.sub, user?.displayName]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
    );
    return actor && ids.has(actor);
  }, "Your checks (kg)");
}

function engineerTotals(rows, labelOf) {
  const by = new Map();
  for (const row of rows || []) {
    const id = rowActor(row);
    const kg = rowKg(row);
    if (!id || kg <= 0) continue;
    const current = by.get(id) || { id, name: labelOf(id) || id, kg: 0, count: 0 };
    current.kg += kg;
    current.count += 1;
    by.set(id, current);
  }
  return [...by.values()].sort((a, b) => b.kg - a.kg || a.name.localeCompare(b.name));
}

function engineerDayChart(rows, include, title) {
  const byDay = new Map();
  for (const row of rows || []) {
    if (!include(row)) continue;
    const kg = rowKg(row);
    if (kg <= 0) continue;
    const day = dayKey(row.created_at || row.lab_at || row.saved_at || row.raised_at) || "Undated";
    byDay.set(day, (byDay.get(day) || 0) + kg);
  }
  return {
    kind: "bar",
    title,
    data: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }))
  };
}

function formatReportValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit"
      });
    }
  }
  return raw;
}

function doneStatus(status) {
  const raw = String(status || "").toUpperCase();
  if (["DENIED", "FAIL", "QC_FAILED", "REJECTED"].includes(raw)) return "Denied";
  if (["COMPLETED", "RELEASED", "QC_PASSED", "PASS", "APPROVED", "REGISTERED"].includes(raw)) {
    return "Completed";
  }
  return "Pending";
}

function rmStepStatus(order, process) {
  if (process === "receipts") return "COMPLETED";
  if (process === "lab") return order.lab_status;
  if (process === "rms_in") return order.rms_inward_status;
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
  const base =
    section === "activation" ? ACT_PROCESSES : section === "post_activation" ? POST_REPORT_PROCESSES : RM_PROCESSES;
  if (section === "raw_material") return base;
  return [...base, { id: "engineer", label: "User performance" }];
}

const CHECK_SEARCH_KEYS = [
  "process_label",
  "order_code",
  "dc_number",
  "bag_code",
  "grade",
  "rotary",
  "raw_product_code",
  "identity",
  "status",
  "destination",
  "name"
];

const SUPPLIER_DETAIL_KEYS = ["supplier_name", "supplier_code", "supplier_weight_kg", "supplier_value_inr"];

function searchKeysFor(filters, keys) {
  if (filters?.includeSupplier !== false) return keys;
  return (keys || []).filter((key) => !SUPPLIER_DETAIL_KEYS.includes(key));
}

function pushCheck(rows, filters, row, actor, at, processLabel) {
  const createdBy = String(actor || "").trim();
  const kg = num(row?.quantity_kg || row?.weight_kg);
  if (!createdBy || kg <= 0 || !inRange(at, filters.from, filters.to)) return;
  rows.push({
    process_label: processLabel,
    order_code: row.order_code || row.inward_code || "",
    dc_number: row.dc_number || "",
    bag_code: row.bag_code || "",
    grade: row.grade || "",
    rotary: row.rotary || "",
    raw_product_code: row.raw_product_code || "",
    identity: row.bag_code || row.lot_code || row.order_code || "",
    quantity_kg: kg,
    weight_kg: kg,
    created_at: at || "",
    created_by: createdBy
  });
}

function activationPerformanceRows(data, filters) {
  const rows = [];
  for (const row of data?.kilnBags || []) {
    pushCheck(rows, filters, row, row.created_by, row.created_at, "Kiln output");
    pushCheck(rows, filters, row, row.user_id, row.saved_at, "Kiln output quality");
  }
  for (const row of data?.destonQc || []) {
    pushCheck(rows, filters, row, row.created_by, row.created_at, "Destoning");
    pushCheck(rows, filters, row, row.user_id, row.saved_at, "Destoning quality");
  }
  return rows;
}

function postPerformanceRows(data, filters) {
  const rows = [];
  for (const section of data?.quality || []) {
    const process = `${section.process_label || section.process || "Post-activation"} quality`;
    for (const row of section.bags || []) {
      pushCheck(rows, filters, row, row.user_id, row.saved_at, process);
    }
  }
  for (const proc of POST_PROCESSES) {
    for (const row of data?.byProcess?.[proc.key]?.output_bags || []) {
      pushCheck(rows, filters, row, row.created_by, row.created_at, proc.label);
    }
  }
  return rows;
}

function rmPerformanceRows(data, filters) {
  const orders = new Map((data?.inward || []).map((row) => [row.order_code, row]));
  const rows = [];
  for (const bag of data?.bags || []) {
    const order = orders.get(bag.order_code) || {};
    const at = bag.created_at || order.created_at || "";
    pushCheck(
      rows,
      filters,
      {
        ...bag,
        order_code: bag.order_code || order.order_code || "",
        dc_number: order.dc_number || "",
        raw_product_code: order.raw_product_code || ""
      },
      bag.created_by,
      at,
      bag.grade ? "RMS outward" : "Bag generation"
    );
  }
  return rows;
}

function checksMatchingPeople(rows, search, labelOf) {
  const q = String(search || "").trim().toLowerCase();
  if (!q) return rows || [];
  return (rows || []).filter((row) => {
    if (matchesSearch(row, q, CHECK_SEARCH_KEYS)) return true;
    const actor = rowActor(row);
    const name = String(labelOf?.(actor) || "").toLowerCase();
    return name.includes(q) || actor.includes(q);
  });
}

function stripSupplierDetails(details) {
  if (!details) return details;
  return {
    ...details,
    columns: (details.columns || []).filter((col) => !SUPPLIER_DETAIL_KEYS.includes(col.key)),
    rows: (details.rows || []).map((row) => {
      const next = { ...row };
      for (const key of SUPPLIER_DETAIL_KEYS) delete next[key];
      return next;
    })
  };
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
    const [inward, bags] = await Promise.all([
      fetchAcRawMaterialInward(),
      fetchAcInwardBags().catch(() => [])
    ]);
    return { inward: inward || [], bags: bags || [] };
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
    fetchAcPostActivationQuality("all").catch(() => ({ sections: [] })),
    fetchAcInStockBags().catch(() => []),
    ...POST_PROCESSES.map((row) => fetchAcPostActivationState(row.key, "all").catch(() => null))
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
      matchesSearch(
        row,
        filters.search,
        searchKeysFor(filters, [
          "order_code",
          "dc_number",
          "supplier_name",
          "supplier_code",
          "raw_product_code",
          "lab_moisture_pct",
          "lab_dust_pct",
          "lab_volatility",
          "bag_code",
          "grade"
        ])
      )
  );
}

function bagsForOrder(data, orderCode, outward) {
  return (data.bags || []).filter((bag) => {
    if (bag.order_code !== orderCode) return false;
    const hasGrade = Boolean(bag.grade);
    return outward ? hasGrade : !hasGrade;
  });
}

const RM_SEARCH_KEYS = [
  "order_code",
  "dc_number",
  "supplier_name",
  "supplier_code",
  "raw_product_code",
  "lab_moisture_pct",
  "lab_dust_pct",
  "lab_volatility"
];

function rmOrdersForDetails(data, filters) {
  return (data.inward || []).filter((row) => {
    if (!inRange(row.created_at || row.order_date, filters.from, filters.to)) return false;
    if (!String(filters.search || "").trim()) return true;
    if (matchesSearch(row, filters.search, searchKeysFor(filters, RM_SEARCH_KEYS))) return true;
    return (data.bags || []).some(
      (bag) =>
        bag.order_code === row.order_code &&
        matchesSearch(bag, filters.search, ["bag_code", "grade", "rotary", "weight_kg"])
    );
  });
}

function bagMatchesDetailSearch(bag, order, search, includeSupplier = true) {
  if (!String(search || "").trim()) return true;
  if (matchesSearch(order, search, searchKeysFor({ includeSupplier }, RM_SEARCH_KEYS))) return true;
  return matchesSearch(bag, search, ["bag_code", "grade", "rotary", "weight_kg"]);
}

function buildRmDetails(process, data, filters) {
  if (process === "debit_note") {
    const orders = (data.inward || []).map((row) => ({
      ...row,
      supplier_name: row.supplier_name || row.supplier_code || "—"
    }));
    return buildDebitNoteDetails(orders, filters);
  }
  const orders = rmOrdersForDetails(data, filters).map((row) => ({
    ...row,
    supplier_name: row.supplier_name || row.supplier_code || "—",
    raw_product_code: row.raw_product_code || "—",
    our_weight_kg: row.our_weight_kg ?? row.inward_quantity_kg ?? ""
  }));
  const title = RM_PROCESSES.find((row) => row.id === process)?.label || "Raw Material";

  if (process === "receipts") {
    return {
      title: "Gate receipt",
      columns: [
        { key: "order_code", label: "Inward" },
        { key: "dc_number", label: "DC" },
        { key: "raw_product_code", label: "Material" },
        { key: "supplier_name", label: "Supplier" },
        { key: "supplier_weight_kg", label: "Supplier (KG)" },
        { key: "our_weight_kg", label: "Our wt (KG)" },
        { key: "supplier_value_inr", label: "Value (INR)" },
        { key: "created_at", label: "Received" }
      ],
      rows: orders
    };
  }

  if (process === "lab") {
    return {
      title: "Lab",
      columns: [
        { key: "order_code", label: "Inward" },
        { key: "supplier_name", label: "Supplier" },
        { key: "lab_moisture_pct", label: "Moisture %" },
        { key: "lab_dust_pct", label: "Dust %" },
        { key: "lab_volatility", label: "Volatility %" },
        { key: "process_status", label: "Status" },
        { key: "lab_at", label: "Lab at" }
      ],
      rows: orders.map((row) => ({
        ...row,
        process_status: doneStatus(row.lab_status)
      }))
    };
  }

  if (process === "rms_in") {
    const rows = orders.flatMap((order) => {
      const bags = bagsForOrder(data, order.order_code, false).filter(
        (bag) =>
          inRange(bag.created_at || order.created_at, filters.from, filters.to) &&
          bagMatchesDetailSearch(bag, order, filters.search, filters.includeSupplier !== false)
      );
      if (!bags.length) {
        return [
          {
            order_code: order.order_code,
            bag_code: "—",
            weight_kg: "",
            process_status: doneStatus(order.rms_inward_status),
            created_at: order.rms_inward_at || ""
          }
        ];
      }
      return bags.map((bag) => ({
        order_code: order.order_code,
        bag_code: bag.bag_code,
        weight_kg: bag.weight_kg,
        process_status: doneStatus(bag.status || order.rms_inward_status),
        created_at: bag.created_at || order.rms_inward_at || "",
        created_by: bag.created_by || ""
      }));
    });
    return {
      title: "RMS inward bags",
      columns: [
        { key: "order_code", label: "Inward" },
        { key: "bag_code", label: "Bag" },
        { key: "weight_kg", label: "Weight (KG)" },
        { key: "process_status", label: "Status" },
        { key: "created_by", label: "By" },
        { key: "created_at", label: "Created" }
      ],
      rows
    };
  }

  if (process === "rms_out") {
    const rows = orders.flatMap((order) => {
      const bags = bagsForOrder(data, order.order_code, true).filter(
        (bag) =>
          inRange(bag.created_at || order.rm_outward_at || order.created_at, filters.from, filters.to) &&
          bagMatchesDetailSearch(bag, order, filters.search, filters.includeSupplier !== false)
      );
      if (!bags.length) {
        return [
          {
            order_code: order.order_code,
            bag_code: "—",
            grade: "",
            rotary: "",
            weight_kg: "",
            process_status: doneStatus(order.rm_outward_status),
            created_at: order.rm_outward_at || ""
          }
        ];
      }
      return bags.map((bag) => ({
        order_code: order.order_code,
        bag_code: bag.bag_code,
        grade: bag.grade,
        rotary: bag.rotary || "",
        weight_kg: bag.weight_kg,
        process_status: doneStatus(bag.status || order.rm_outward_status),
        created_at: bag.created_at || order.rm_outward_at || ""
      }));
    });
    return {
      title: "RMS outward bags",
      columns: [
        { key: "order_code", label: "Inward" },
        { key: "bag_code", label: "Bag" },
        { key: "grade", label: "Grade" },
        { key: "rotary", label: "Rotary" },
        { key: "weight_kg", label: "Weight (KG)" },
        { key: "process_status", label: "Status" },
        { key: "created_at", label: "Created" }
      ],
      rows
    };
  }

  if (process === "released") {
    return {
      title: "Release to production",
      columns: [
        { key: "order_code", label: "Inward" },
        { key: "supplier_name", label: "Supplier" },
        { key: "our_weight_kg", label: "Our wt (KG)" },
        { key: "allocated_to_production_kg", label: "Released (KG)" },
        { key: "available_quantity_kg", label: "Remaining (KG)" },
        { key: "process_status", label: "Status" },
        { key: "released_to_production_at", label: "Released at" }
      ],
      rows: orders.map((row) => ({
        ...row,
        process_status: doneStatus(row.released_to_production_status)
      }))
    };
  }

  return {
    title: "All inward orders",
    columns: [
      { key: "order_code", label: "Inward" },
      { key: "supplier_name", label: "Supplier" },
      { key: "our_weight_kg", label: "Our wt (KG)" },
      { key: "dc_number", label: "DC" },
      { key: "raw_product_code", label: "Material" },
      { key: "created_at", label: "Received" }
    ],
    rows: orders.map((row) => ({ ...row, process_label: title }))
  };
}

const DEBIT_REASON_LABELS = {
  weight_short: "Short weight",
  moisture_high: "High moisture"
};

function debitReasonLabel(reasons) {
  const labels = (reasons || []).map((code) => DEBIT_REASON_LABELS[code] || code).filter(Boolean);
  return labels.length ? labels.join(", ") : "—";
}

function buildDebitNoteDetails(orders, filters) {
  const rows = orders
    .filter((order) => order.debit_note?.raised)
    .filter((order) => inRange(order.debit_note?.raised_at || order.created_at, filters.from, filters.to))
    .filter((order) =>
      matchesSearch(
        {
          ...order,
          debit_note_code: order.debit_note?.debit_note_code,
          remarks: order.debit_note?.remarks,
          reason: debitReasonLabel(order.debit_note?.reasons)
        },
        filters.search,
        searchKeysFor(filters, [
          "order_code",
          "supplier_name",
          "supplier_code",
          "debit_note_code",
          "remarks",
          "reason",
          "dc_number"
        ])
      )
    )
    .map((order) => {
      const note = order.debit_note || {};
      return {
        debit_note_code: note.debit_note_code || "—",
        order_code: order.order_code,
        supplier_name: note.supplier_name || order.supplier_name,
        reason: debitReasonLabel(note.reasons),
        shortage_kg: note.shortage_kg ?? "",
        moisture_pct: note.moisture_pct ?? "",
        debit_note_value: note.debit_note_value ?? "",
        remarks: note.remarks || "",
        created_by: note.raised_by || "",
        raised_at: note.raised_at || ""
      };
    });
  return {
    title: "Debit notes",
    columns: [
      { key: "debit_note_code", label: "Debit note" },
      { key: "order_code", label: "Inward" },
      { key: "supplier_name", label: "Supplier" },
      { key: "reason", label: "Reason" },
      { key: "shortage_kg", label: "Short (KG)" },
      { key: "moisture_pct", label: "Moisture %" },
      { key: "debit_note_value", label: "Value (INR)" },
      { key: "created_by", label: "By" },
      { key: "raised_at", label: "Raised" }
    ],
    rows
  };
}

function buildRmChart(process, data, filters) {
  const rows = filterRmOrders(data, filters);
  if (process === "debit_note") {
    const notes = buildDebitNoteDetails(data.inward || [], filters).rows;
    return pieChart(notes, (row) => row.reason, "Debit notes by reason");
  }
  if (process === "all") {
    return barChart(
      [
        { name: "Gate receipt", value: rows.length },
        { name: "Lab", value: rows.filter((row) => doneStatus(row.lab_status) === "Completed").length },
        { name: "Debit note", value: rows.filter((row) => row.debit_note?.raised).length },
        { name: "RMS inward", value: rows.filter((row) => doneStatus(row.rms_inward_status) === "Completed").length },
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
    created_at: row.created_at || row.charged_at || "",
    created_by: row.created_by || row.user_id || ""
  }));
  const kilnBags = filterKilnBags(data, filters).map((row) => ({
    process_label: "Kiln output",
    identity: row.bag_code || "—",
    bag_code: row.bag_code || "—",
    quantity_kg: row.quantity_kg || "",
    status: kilnOf(row),
    destination: "",
    created_at: row.created_at || row.saved_at || "",
    created_by: row.created_by || row.user_id || ""
  }));
  const deston = filterDestonBags(data, filters).map((row) => ({
    process_label: "Destoning",
    identity: row.bag_code || "—",
    bag_code: row.bag_code || "—",
    quantity_kg: row.quantity_kg || "",
    status: isInStockDest(row) ? "In Stock" : "Routed",
    destination: destinationOf(row) || "In Stock",
    created_at: row.created_at || row.saved_at || "",
    created_by: row.created_by || row.user_id || ""
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

function useNarrowScreen() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const onChange = () => setNarrow(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

function shortAxisLabel(name, narrow) {
  const text = String(name || "");
  const limit = narrow ? 10 : 16;
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function ReportChart({ chart }) {
  const narrow = useNarrowScreen();
  if (!chart?.data?.length) {
    return <p className="text-sm text-slate-600">No values to chart for the current filters.</p>;
  }
  if (chart.kind === "pie") {
    return (
      <div className="h-56 w-full min-w-0">
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
  const barHeight = Math.min(520, Math.max(narrow ? 200 : 240, chart.data.length * (narrow ? 40 : 36)));
  return (
    <div className="w-full min-w-0" style={{ height: barHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chart.data}
          layout="vertical"
          margin={{ top: 8, right: 12, bottom: 8, left: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: "#475569", fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={narrow ? 72 : 120}
            interval={0}
            tick={{ fill: "#475569", fontSize: 11 }}
            tickFormatter={(name) => shortAxisLabel(name, narrow)}
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

function ReportDetailsTable({ details, person }) {
  if (!details) return null;
  if (details.rows.length === 0) {
    return <p className="text-sm text-slate-600">No rows for the current filters.</p>;
  }
  return (
    <div className="overflow-x-auto max-w-full">
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
            <tr key={`${row.bag_code || row.order_code || row.lot_code || "row"}-${index}`} className="border-b border-slate-100 text-slate-900">
              {details.columns.map((col) => (
                <td key={col.key} className="py-2 pr-3 font-mono whitespace-nowrap">
                  {formatReportValue(col.key === "created_by" ? person?.(row[col.key]) : row[col.key])}
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
  const person = useAcPersonLabel();
  const { user } = useAuth();
  const roles = user?.roles || [];
  const supervisor = userCanAccessAcDestoningCtc(roles, user);
  const viewer = roles.includes(MES_ROLES.VIEWER) && !supervisor && !userIsAcEngineer(roles, user);
  const seeSupplier = userCanSeeAcSupplier(roles, user);
  const showActivity = supervisor || viewer;
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(firstOfMonthKey);
  const [to, setTo] = useState(todayKey);
  const [search, setSearch] = useState("");
  const [process, setProcess] = useState("all");
  const [engineerId, setEngineerId] = useState("");

  useEffect(() => {
    setProcess("all");
    setEngineerId("");
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

  const filters = useMemo(
    () => ({ from, to, search, includeSupplier: seeSupplier }),
    [from, to, search, seeSupplier]
  );
  const processOptions = processesFor(section);
  const details = useMemo(
    () => buildSectionDetails(section, process, data, filters),
    [section, process, data, filters]
  );
  const ownRows = useMemo(() => {
    const range = { from, to };
    if (section === "activation") return activationPerformanceRows(data, range);
    if (section === "post_activation") return postPerformanceRows(data, range);
    return rmPerformanceRows(data, range);
  }, [section, data, from, to]);
  const performanceRows = useMemo(
    () => checksMatchingPeople(ownRows, search, (id) => person(id)),
    [ownRows, search, person]
  );
  const engineerPeople = useMemo(
    () => engineerTotals(performanceRows, (id) => person(id)),
    [performanceRows, person]
  );
  const selectedEngineer = engineerPeople.find((row) => row.id === engineerId) || null;
  const chart = useMemo(() => {
    if (showActivity && process === "engineer") {
      if (selectedEngineer) {
        return engineerDayChart(
          performanceRows,
          (row) => rowActor(row) === selectedEngineer.id,
          `${selectedEngineer.name} checks (kg)`
        );
      }
      return {
        kind: "bar",
        title: "Checks by person (kg)",
        data: engineerPeople.map((row) => ({
          name: row.name,
          value: Math.round(row.kg * 10) / 10
        }))
      };
    }
    return buildSectionChart(section, process, data, filters);
  }, [showActivity, section, process, data, filters, engineerPeople, selectedEngineer, performanceRows]);
  const activityDetails =
    showActivity && process === "engineer"
      ? {
          title: selectedEngineer ? `${selectedEngineer.name} checks` : "User performance",
          columns: [
            { key: "name", label: "Person" },
            { key: "kg", label: "Checked (KG)" },
            { key: "count", label: "Checks" }
          ],
          rows: (selectedEngineer ? [selectedEngineer] : engineerPeople).map((row) => ({
            name: row.name,
            kg: Math.round(row.kg * 10) / 10,
            count: row.count
          }))
        }
      : details;
  const reportDetails = seeSupplier ? activityDetails : stripSupplierDetails(activityDetails);
  const shownDetails = reportDetails;
  const visibleProcesses = processOptions.filter((opt) => {
    if (!seeSupplier && opt.id === "debit_note") return false;
    if (!showActivity && opt.id === "engineer") return false;
    return true;
  });
  const searchCopy =
    process === "engineer" && showActivity
      ? {
          placeholder: "Person, bag, grade…",
          help: "Narrows user performance to a person, bag, or grade in this date range. Leave it empty to include every check in the range."
        }
      : section === "raw_material"
        ? seeSupplier
          ? {
              placeholder: "Inward, DC, supplier, bag, grade…",
              help: "Narrows the table to rows that match this text: inward, DC, supplier, material, bag, or grade. The From and To dates still apply. Leave it empty to show every row in that range."
            }
          : {
              placeholder: "Inward, DC, bag, grade…",
              help: "Narrows this report to inward, DC, material, bag, or grade. The From and To dates still apply. Supplier names stay off this login."
            }
        : {
            placeholder: "Bag, grade, process…",
            help: "Narrows this report to a bag, grade, or process in the date range. Leave it empty to show every row in that range."
          };

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
    if (!reportDetails) return;
    downloadAcExcel(`${section}-${process}`, reportDetails.columns, reportDetails.rows);
  };

  return (
    <div className="space-y-4 min-w-0">
      <WfCard>
        <WfCardHeader
          title={title}
          subtitle={
            showActivity
              ? "Choose a process, search the rows, and see the chart and details on screen. User performance is the kilograms of checks saved in this period, including checks a supervisor saved."
              : "Search the rows in this date range. Supplier details stay on the supervisor login."
          }
        />
        <WfCardBody>
          <div className="wf-light-panel rounded-xl p-3 sm:p-4 space-y-4 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 min-w-0">
              <label className="text-sm min-w-0">
                <span className="block mb-1 font-medium text-slate-700">From</span>
                <input
                  type="date"
                  className="w-full min-w-0 max-w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    e.target.blur();
                  }}
                />
              </label>
              <label className="text-sm min-w-0">
                <span className="block mb-1 font-medium text-slate-700">To</span>
                <input
                  type="date"
                  className="w-full min-w-0 max-w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    e.target.blur();
                  }}
                />
              </label>
              {visibleProcesses.length ? (
              <label className="text-sm min-w-0">
                <span className="block mb-1 font-medium text-slate-700">Process</span>
                <select
                  className="w-full min-w-0 max-w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={visibleProcesses.some((opt) => opt.id === process) ? process : "all"}
                  onChange={(e) => {
                    setProcess(e.target.value);
                    setEngineerId("");
                  }}
                >
                  {visibleProcesses.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              ) : null}
              {showActivity && process === "engineer" ? (
              <label className="text-sm min-w-0 sm:col-span-2 xl:col-span-1">
                <span className="block mb-1 font-medium text-slate-700">Person</span>
                <select
                  className="w-full min-w-0 max-w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={selectedEngineer ? engineerId : ""}
                  onChange={(e) => setEngineerId(e.target.value)}
                >
                  <option value="">All people</option>
                  {engineerPeople.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <span className="block mt-1 text-xs text-slate-500">
                  All people compares checks saved in this period. A supervisor who saved a check is included. Pick one person to see their daily graph.
                </span>
              </label>
              ) : null}
              <label className="text-sm min-w-0 sm:col-span-2 xl:col-span-1">
                <span className="block mb-1 font-medium text-slate-700">Search</span>
                <input
                  className="w-full min-w-0 max-w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchCopy.placeholder}
                />
                <span className="block mt-1 text-xs text-slate-500">{searchCopy.help}</span>
              </label>
            </div>
            {showActivity ? (
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
              <button type="button" className="wf-btn wf-btn-ghost w-full sm:w-auto" onClick={downloadSummary} disabled={loading}>
                Download summary Excel
              </button>
              {reportDetails ? (
                <button type="button" className="wf-btn wf-btn-ghost w-full sm:w-auto" onClick={downloadDetails}>
                  Download details Excel
                </button>
              ) : null}
            </div>
            ) : null}
            {error ? <AcAlert variant="error">{error}</AcAlert> : null}
            {loading ? (
              <p className="text-sm text-slate-600">Loading report…</p>
            ) : (
              <div className="grid grid-cols-1 min-w-0 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] gap-4 items-start">
                <div className="min-w-0 order-2 xl:order-1 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <p className="text-sm font-semibold text-slate-800">{shownDetails?.title}</p>
                    <p className="text-xs text-slate-500">{shownDetails?.rows?.length || 0} row{(shownDetails?.rows?.length || 0) === 1 ? "" : "s"}</p>
                  </div>
                  <div className="max-h-[28rem] overflow-y-auto">
                    <ReportDetailsTable details={shownDetails} person={person} />
                  </div>
                </div>
                <div className="min-w-0 order-1 xl:order-2 rounded-lg border border-slate-200 bg-white p-3 xl:sticky xl:top-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                    {chart?.title || (process === "all" ? "Counts by process" : "Status mix")}
                  </p>
                  <ReportChart chart={chart} />
                  {chart?.data?.length ? (
                    <ul className="flex flex-col sm:flex-row sm:flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 mt-2 min-w-0">
                      {chart.data.map((row, index) => (
                        <li key={row.name} className="flex items-start gap-1.5 min-w-0 break-words">
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
