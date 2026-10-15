import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { useAuth } from "../../../auth/AuthContext";
import { SectionHeader } from "../../../workflow/ui";
import {
  fetchAcDestoningBagQc,
  fetchAcKilnOutputBagQc,
  fetchAcPostActivationQuality,
  fetchAcPostActivationState,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
import useAcPersonLabel from "../hooks/useAcPersonLabel";
import {
  userCanAccessAcActivation,
  userCanAccessAcPostActivation,
  userCanAccessAcQuality
} from "../utils/acPrivileges";
import {
  buildAreaWeeks,
  buildEngineerWeek,
  checksOnDay,
  collectEngineerChecks,
  currentWeekLabel,
  performanceDayKey,
  weekdayLabel
} from "../utils/acEngineerPerformance";

const NAVY = "#0D3A6E";
const EXPECTED = "#d97706";
const POST = "#0f766e";
const POST_EXPECTED = "#7c3aed";
const QUALITY = "#9a3412";
const QUALITY_EXPECTED = "#be123c";
const AREA_META = [
  { id: "activation", label: "Activation", color: NAVY, expected: EXPECTED },
  { id: "post", label: "Post-activation", color: POST, expected: POST_EXPECTED },
  { id: "quality", label: "Quality", color: QUALITY, expected: QUALITY_EXPECTED }
];
const POST_PROCESSES = [
  { key: "screening", label: "Screening" },
  { key: "dedusting", label: "De-dusting" },
  { key: "crushing", label: "Crushing" },
  { key: "demagnetisation", label: "De-magnetisation" },
  { key: "blending", label: "Blending" }
];
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
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} KG`;
}

function clockLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function identityIds(user) {
  return [user?.username, user?.email, user?.sub, user?.displayName];
}

export default function AcEngineerPerformanceDashboard() {
  const { user } = useAuth();
  const person = useAcPersonLabel();
  const roles = user?.roles || [];
  const includeActivation = userCanAccessAcActivation(roles, user);
  const includePost = userCanAccessAcPostActivation(roles, user);
  const includeQuality = userCanAccessAcQuality(roles, user);
  const areas = AREA_META.filter(
    (area) =>
      (area.id === "activation" && includeActivation) ||
      (area.id === "post" && includePost) ||
      (area.id === "quality" && includeQuality)
  ).map((area) => area.id);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState(() => performanceDayKey(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [kilnBags, destonQc, quality, postStates] = await Promise.all([
        includeActivation || includeQuality ? fetchAcKilnOutputBagQc().catch(() => []) : Promise.resolve([]),
        includeActivation || includeQuality ? fetchAcDestoningBagQc().catch(() => []) : Promise.resolve([]),
        includeQuality
          ? fetchAcPostActivationQuality("all").catch(() => ({ sections: [] }))
          : Promise.resolve({ sections: [] }),
        includePost
          ? Promise.all(
              POST_PROCESSES.map((row) => fetchAcPostActivationState(row.key, "all").catch(() => null))
            )
          : Promise.resolve([])
      ]);
      const postOutputs = (postStates || []).flatMap((state, index) =>
        (state?.output_bags || []).map((bag) => ({
          ...bag,
          process_label: state?.process_label || POST_PROCESSES[index].label
        }))
      );
      setChecks(
        collectEngineerChecks({
          kilnBags: kilnBags || [],
          destonQc: destonQc || [],
          qualitySections: quality?.sections || [],
          postOutputs
        })
      );
    } catch (e) {
      setError(formatAcApiError(e, "Could not load your performance"));
    } finally {
      setLoading(false);
    }
  }, [includeActivation, includePost, includeQuality]);

  useEffect(() => {
    load();
  }, [load]);

  const ids = useMemo(() => identityIds(user), [user]);
  const visible = useMemo(
    () => checks.filter((row) => areas.includes(row.area)),
    [checks, areas]
  );
  const multi = areas.length > 1;
  const week = useMemo(
    () => (multi ? null : buildEngineerWeek(visible, ids)),
    [multi, visible, ids]
  );
  const split = useMemo(
    () => (multi ? buildAreaWeeks(visible, ids, areas) : null),
    [multi, visible, ids, areas]
  );
  const chartDays = split?.days || week?.days || [];
  const chartToday = split?.today || week?.today || performanceDayKey(new Date());
  const day = chartDays.includes(selectedDay) ? selectedDay : chartToday;
  const dayChecks = useMemo(() => checksOnDay(visible, ids, day), [visible, ids, day]);
  const dayKg = dayChecks.reduce((sum, row) => sum + row.kg, 0);
  const topDayKg = week?.series.find((row) => row.day === day)?.expected;
  const topName = week?.topActor ? person(week.topActor) : "";
  const areaMeta = AREA_META.filter((area) => areas.includes(area.id));
  const dayKgFor = (area) =>
    dayChecks.filter((row) => row.area === area).reduce((sum, row) => sum + row.kg, 0);
  const singleLabel =
    areas[0] === "quality"
      ? "Your quality checks this week, compared with the top performer"
      : areas[0] === "post"
        ? "Your post-activation this week, compared with the top performer"
        : areas[0] === "activation"
          ? "Your activation this week, compared with the top performer"
          : "Your checks this week, compared with the top performer";

  return (
    <div className="space-y-4 min-w-0">
      <SectionHeader
        title="Dashboard"
        subtitle={`${
          multi
            ? "Each line is that work, compared with the top performer in the same work"
            : singleLabel
        }. This week, ${currentWeekLabel()}. Monday to Sunday.`}
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

      {multi ? (
        <div
          className={`grid gap-2 ${
            areaMeta.length > 2 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"
          }`}
        >
          {areaMeta.map((area) => {
            const summary = split.weeks[area.id];
            const leadName = summary.topActor ? person(summary.topActor) : "";
            return (
              <div key={area.id} className="ac-mgmt-card rounded-lg px-3 py-2">
                <div className="ac-mgmt-label text-[10px] uppercase tracking-wide">{area.label}</div>
                <div className="ac-mgmt-value text-lg font-bold tabular-nums leading-tight">
                  {formatKg(summary.yourWeekKg)}
                </div>
                <div className="ac-mgmt-muted text-[10px] truncate">
                  {summary.yourWeekCount} check{summary.yourWeekCount === 1 ? "" : "s"}
                  {summary.youAreTop ? " · You lead" : leadName ? ` · Top ${leadName} ${formatKg(summary.topWeekKg)}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="ac-mgmt-card rounded-lg px-3 py-2">
            <div className="ac-mgmt-label text-[10px] uppercase tracking-wide">Your week</div>
            <div className="ac-mgmt-value text-lg font-bold tabular-nums leading-tight">{formatKg(week.yourWeekKg)}</div>
            <div className="ac-mgmt-muted text-[10px]">
              {week.yourWeekCount} check{week.yourWeekCount === 1 ? "" : "s"}
            </div>
          </div>
          <div className="ac-mgmt-card rounded-lg px-3 py-2">
            <div className="ac-mgmt-label text-[10px] uppercase tracking-wide">Top this week</div>
            <div className="ac-mgmt-value text-lg font-bold tabular-nums leading-tight">{formatKg(week.topWeekKg)}</div>
            <div className="ac-mgmt-muted text-[10px] truncate">
              {week.youAreTop ? "You" : topName || "No checks yet"}
            </div>
          </div>
          <div className="ac-mgmt-card rounded-lg px-3 py-2">
            <div className="ac-mgmt-label text-[10px] uppercase tracking-wide">{weekdayLabel(day)}</div>
            <div className="ac-mgmt-value text-lg font-bold tabular-nums leading-tight">{formatKg(dayKg)}</div>
            <div className="ac-mgmt-muted text-[10px] truncate">
              {week.youAreTop || topDayKg == null ? "Your checks" : `Top ${formatKg(topDayKg)}`}
            </div>
          </div>
        </div>
      )}

      <div className="ac-mgmt-card rounded-lg p-3 min-w-0">
        <h3 className="ac-mgmt-value text-xs font-semibold mb-2">This week</h3>
        <div className="h-56 sm:h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={split ? split.series : week.series}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              onClick={(state) => {
                const next = state?.activePayload?.[0]?.payload?.day;
                if (next && next <= chartToday) setSelectedDay(next);
              }}
            >
              <CartesianGrid stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fill: "#334155", fontSize: 11 }} axisLine={{ stroke: "#94a3b8" }} tickLine={false} />
              <YAxis
                width={40}
                tick={{ fill: "#334155", fontSize: 11 }}
                axisLine={{ stroke: "#94a3b8" }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={TOOLTIP}
                formatter={(value, name) => [formatKg(value), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {multi
                ? areaMeta.map((area) => (
                    <Line
                      key={area.id}
                      type="monotone"
                      dataKey={area.id}
                      name={area.label}
                      stroke={area.color}
                      strokeWidth={2}
                      connectNulls={false}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  ))
                : (
                <Line
                  type="monotone"
                  dataKey="you"
                  name="You"
                  stroke={NAVY}
                  strokeWidth={2}
                  connectNulls={false}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              )}
              {multi
                ? areaMeta.map((area) => {
                    const summary = split.weeks[area.id];
                    if (!summary?.expectedActor) return null;
                    const leadName = summary.topActor ? person(summary.topActor) : "";
                    return (
                      <Line
                        key={`${area.id}-expected`}
                        type="monotone"
                        dataKey={`${area.id}Expected`}
                        name={leadName ? `${area.label} expected (${leadName})` : `${area.label} expected`}
                        stroke={area.expected}
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        connectNulls={false}
                        dot={{ r: 3 }}
                        isAnimationActive={false}
                      />
                    );
                  })
                : null}
              {!multi && week.expectedActor ? (
                <Line
                  type="monotone"
                  dataKey="expected"
                  name={topName ? `Expected (${topName})` : "Expected"}
                  stroke={EXPECTED}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  connectNulls={false}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {chartDays.map((key) => {
            const future = key > chartToday;
            const selected = key === day;
            return (
              <button
                key={key}
                type="button"
                disabled={future}
                className={`rounded px-2 py-1 text-xs ${
                  selected ? "bg-[#0D3A6E] text-white" : "bg-slate-100 text-slate-700"
                } disabled:opacity-40`}
                onClick={() => setSelectedDay(key)}
              >
                {weekdayLabel(key)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="ac-mgmt-card rounded-lg p-3 min-w-0">
        <h3 className="ac-mgmt-value text-xs font-semibold mb-2">
          {weekdayLabel(day)} checks
          {multi
            ? areaMeta.map((area) => ` · ${area.label} ${formatKg(dayKgFor(area.id))}`).join("")
            : ""}
        </h3>
        {loading ? <p className="ac-mgmt-muted text-xs py-4 text-center">Loading your checks…</p> : null}
        {!loading && dayChecks.length === 0 ? (
          <p className="ac-mgmt-muted text-xs py-4 text-center">No checks saved on this day.</p>
        ) : null}
        {dayChecks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3 font-semibold">Time</th>
                  <th className="py-2 pr-3 font-semibold">Check</th>
                  <th className="py-2 pr-3 font-semibold">Bag</th>
                  <th className="py-2 pr-3 font-semibold text-right">KG</th>
                </tr>
              </thead>
              <tbody>
                {dayChecks.map((row) => (
                  <tr key={`${row.process}-${row.bag}-${row.at}`} className="border-b border-slate-100 text-slate-900">
                    <td className="py-2 pr-3 whitespace-nowrap">{clockLabel(row.at)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{row.process}</td>
                    <td className="py-2 pr-3 font-mono whitespace-nowrap">{row.bag || "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatKg(row.kg)}</td>
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
