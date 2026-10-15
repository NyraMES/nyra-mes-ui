import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { fetchAcRawMaterialInward, formatAcApiError } from "../../../services/activatedCarbonApi";
import { SectionHeader } from "../../../workflow/ui";
import {
  currentWeekDays,
  currentWeekLabel,
  performanceDayKey,
  weekdayLabel
} from "../utils/acEngineerPerformance";

const NAVY = "#0D3A6E";

function done(status) {
  return ["COMPLETED", "RELEASED", "QC_PASSED", "PASS", "APPROVED", "REGISTERED"].includes(
    String(status || "").toUpperCase()
  );
}

function nextStep(order) {
  if (done(order.released_to_production_status)) return "Released";
  if (done(order.rm_outward_status)) return "Release";
  if (done(order.lab_status)) return "RMS outward";
  if (done(order.rms_inward_status)) return "Lab";
  return "RMS inward";
}

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} KG`;
}

function ourKg(order) {
  const n = Number(order.our_weight_kg ?? order.inward_quantity_kg ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function buildWeek(orders, now = new Date()) {
  const days = currentWeekDays(now);
  const today = performanceDayKey(now);
  const series = days.map((day) => {
    if (day > today) return { day, label: weekdayLabel(day), kg: null };
    const kg = (orders || []).reduce((sum, order) => {
      const key = performanceDayKey(order.created_at || order.order_date);
      return key === day ? sum + ourKg(order) : sum;
    }, 0);
    return { day, label: weekdayLabel(day), kg: Math.round(kg * 10) / 10 };
  });
  return { days, today, series };
}

export default function AcRmsEngineerDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState(() => performanceDayKey(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOrders((await fetchAcRawMaterialInward()) || []);
    } catch (e) {
      setError(formatAcApiError(e, "Could not load raw material"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const week = useMemo(() => buildWeek(orders), [orders]);
  const day = week.days.includes(selectedDay) ? selectedDay : week.today;
  const dayOrders = useMemo(
    () =>
      (orders || [])
        .filter((order) => performanceDayKey(order.created_at || order.order_date) === day)
        .map((order) => ({ ...order, step: nextStep(order) })),
    [orders, day]
  );
  const weekKg = week.series.reduce((sum, row) => sum + (Number(row.kg) || 0), 0);

  return (
    <div className="space-y-4 min-w-0">
      <SectionHeader
        title="Dashboard"
        subtitle={`This week, ${currentWeekLabel()}. Monday to Sunday.`}
        right={
          <button type="button" className="wf-btn wf-btn-ghost" disabled={loading} onClick={load}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />
      {error ? (
        <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      <div className="ac-mgmt-card rounded-lg px-3 py-2 max-w-xs">
        <div className="ac-mgmt-label text-[10px] uppercase tracking-wide">This week</div>
        <div className="ac-mgmt-value text-lg font-bold tabular-nums leading-tight">{formatKg(weekKg)}</div>
        <div className="ac-mgmt-muted text-[10px]">Our weight on inward orders</div>
      </div>
      <div className="ac-mgmt-card rounded-lg p-3 min-w-0">
        <h3 className="ac-mgmt-value text-xs font-semibold mb-2">This week</h3>
        <div className="h-56 sm:h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={week.series}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              onClick={(state) => {
                const next = state?.activePayload?.[0]?.payload?.day;
                if (next && next <= week.today) setSelectedDay(next);
              }}
            >
              <CartesianGrid stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fill: "#334155", fontSize: 11 }} axisLine={{ stroke: "#94a3b8" }} tickLine={false} />
              <YAxis width={40} tick={{ fill: "#334155", fontSize: 11 }} axisLine={{ stroke: "#94a3b8" }} tickLine={false} allowDecimals={false} />
              <Tooltip formatter={(value) => [formatKg(value), "Our weight"]} />
              <Line
                type="monotone"
                dataKey="kg"
                name="Our weight"
                stroke={NAVY}
                strokeWidth={2}
                connectNulls={false}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {week.days.map((key) => (
            <button
              key={key}
              type="button"
              disabled={key > week.today}
              className={`rounded px-2 py-1 text-xs ${
                key === day ? "bg-[#0D3A6E] text-white" : "bg-slate-100 text-slate-700"
              } disabled:opacity-40`}
              onClick={() => setSelectedDay(key)}
            >
              {weekdayLabel(key)}
            </button>
          ))}
        </div>
      </div>
      <div className="ac-mgmt-card rounded-lg p-3 min-w-0">
        <h3 className="ac-mgmt-value text-xs font-semibold mb-2">{weekdayLabel(day)}</h3>
        {loading ? <p className="ac-mgmt-muted text-xs py-4 text-center">Loading raw material…</p> : null}
        {!loading && dayOrders.length === 0 ? (
          <p className="ac-mgmt-muted text-xs py-4 text-center">No inward orders on this day.</p>
        ) : null}
        {dayOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3 font-semibold">Inward</th>
                  <th className="py-2 pr-3 font-semibold">Next step</th>
                  <th className="py-2 pr-3 font-semibold text-right">Our weight</th>
                </tr>
              </thead>
              <tbody>
                {dayOrders.map((order) => (
                  <tr key={order.order_code || order.customer_order_id} className="border-b border-slate-100 text-slate-900">
                    <td className="py-2 pr-3 font-mono whitespace-nowrap">{order.order_code || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{order.step}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatKg(ourKg(order))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
