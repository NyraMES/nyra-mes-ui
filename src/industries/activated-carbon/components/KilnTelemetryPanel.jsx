import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildParameterLimitMap,
  fetchLatestModbusReadings,
  fetchModbusParameters,
  fetchModbusReadingHistory,
  formatModbusSimError,
  getModbusSimDeviceCode,
  groupModbusHistoryByParameter,
  simulateModbusReading
} from "../../../services/modbusSimApi";
import { EmptyState, StatusPill, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";
import ParameterTrendSparkline from "./ParameterTrendSparkline";

const REFRESH_MS = 30000;
const TREND_LIMIT = 50;

const PARAMETER_COLORS = {
  TEMP_ZONE_1: "#f97316",
  TEMP_ZONE_2: "#fb923c",
  TEMP_ZONE_3: "#fdba74",
  TEMP_ZONE_4: "#fbbf24",
  PRESSURE: "#38bdf8",
  STEAM_FLOW: "#22d3ee",
  RESIDENCE_TIME: "#a78bfa"
};

function formatValue(row) {
  if (row.value_numeric != null && row.value_numeric !== "") {
    const n = Number(row.value_numeric);
    return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : row.value_numeric;
  }
  return row.value_text || "—";
}

function formatTimestamp(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function KilnTelemetryPanel() {
  const deviceCode = getModbusSimDeviceCode();
  const [readings, setReadings] = useState([]);
  const [trendsByParameter, setTrendsByParameter] = useState({});
  const [limitByParameter, setLimitByParameter] = useState({});
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const loadReadings = useCallback(async () => {
    setError("");
    try {
      const [rows, history, parameters] = await Promise.all([
        fetchLatestModbusReadings(deviceCode),
        fetchModbusReadingHistory(deviceCode, TREND_LIMIT),
        fetchModbusParameters()
      ]);
      setReadings(rows);
      setTrendsByParameter(groupModbusHistoryByParameter(history));
      setLimitByParameter(buildParameterLimitMap(parameters));
      setLastRefreshed(new Date());
    } catch (e) {
      setReadings([]);
      setTrendsByParameter({});
      setLimitByParameter({});
      setError(formatModbusSimError(e));
    } finally {
      setLoading(false);
    }
  }, [deviceCode]);

  useEffect(() => {
    loadReadings();
    const timer = setInterval(loadReadings, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadReadings]);

  const handleSimulate = async () => {
    setSimulating(true);
    setError("");
    try {
      await simulateModbusReading(deviceCode);
      await loadReadings();
    } catch (e) {
      setError(formatModbusSimError(e, "Simulation failed"));
    } finally {
      setSimulating(false);
    }
  };

  const latestTimestamp = useMemo(() => {
    if (!readings.length) return null;
    return readings.reduce((latest, row) => {
      const ts = row.reading_timestamp ? new Date(row.reading_timestamp).getTime() : 0;
      return ts > latest ? ts : latest;
    }, 0);
  }, [readings]);

  const meta = readings[0];

  return (
    <WfCard glow>
      <WfCardHeader
        title="Kiln Telemetry"
        subtitle={`Live Modbus simulation · ${deviceCode}`}
        icon={<IconSignal />}
        right={
          <div className="flex items-center gap-2">
            {readings.length > 0 ? <StatusPill kind="ok">Live</StatusPill> : <StatusPill kind="neutral">No data</StatusPill>}
            <button
              type="button"
              className="wf-btn wf-btn-ghost"
              disabled={loading || simulating}
              onClick={() => loadReadings()}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              className="wf-btn wf-btn-primary"
              disabled={simulating}
              onClick={handleSimulate}
            >
              {simulating ? "Simulating…" : "Simulate reading"}
            </button>
          </div>
        }
      />
      <WfCardBody>
        {error ? (
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 mb-4">
            {error}
            <p className="mt-2 text-xs text-amber-200/80">
              Run <code className="font-mono">uvicorn main:app --reload --port 8010</code> in nyra-smart-modbus-sim-api, then click Simulate reading.
            </p>
          </div>
        ) : null}

        {loading && readings.length === 0 ? (
          <p className="text-sm text-slate-300">Loading telemetry…</p>
        ) : readings.length === 0 ? (
          <EmptyState
            title="No simulated readings yet"
            hint='Click "Simulate reading" to generate random values from the register map and store them in PostgreSQL.'
            icon={<IconSignal />}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              {meta?.device_name ? <span>{meta.device_name}</span> : null}
              {meta?.work_center_code ? (
                <span>
                  Work center <span className="font-mono text-slate-300">{meta.work_center_code}</span>
                </span>
              ) : null}
              <span>
                Last reading{" "}
                <span className="text-slate-300">{formatTimestamp(latestTimestamp ? new Date(latestTimestamp) : null)}</span>
              </span>
              {lastRefreshed ? (
                <span>
                  Panel refreshed <span className="text-slate-300">{formatTimestamp(lastRefreshed)}</span>
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {readings.map((row) => {
                const limits = limitByParameter[row.parameter_code] || {};
                const normalMin = row.normal_min ?? limits.normal_min;
                const normalMax = row.normal_max ?? limits.normal_max;

                return (
                <div
                  key={row.parameter_code}
                  className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400 font-mono">{row.parameter_code}</div>
                      <div className="text-sm text-slate-200 truncate">{row.parameter_name}</div>
                    </div>
                    <StatusPill
                      kind={
                        row.quality === "GOOD" ? "ok" : row.quality === "BAD" ? "bad" : "warn"
                      }
                    >
                      {row.quality || "—"}
                    </StatusPill>
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-50 tabular-nums">
                    {formatValue(row)}
                    {row.uom ? <span className="ml-1 text-sm font-normal text-slate-400">{row.uom}</span> : null}
                  </div>
                  {row.target_entity && row.target_field ? (
                    <div className="mt-1 text-xs text-slate-500 font-mono">
                      {row.target_entity}.{row.target_field}
                    </div>
                  ) : null}
                  <ParameterTrendSparkline
                    points={trendsByParameter[row.parameter_code] || []}
                    uom={row.uom}
                    color={PARAMETER_COLORS[row.parameter_code] || "#22d3ee"}
                    normalMin={normalMin}
                    normalMax={normalMax}
                  />
                </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-500">
              Values are randomly generated between simulation_min and simulation_max from the Modbus register map, then stored via the simulator API — not from a file or manual MES entry.
            </p>
          </div>
        )}
      </WfCardBody>
    </WfCard>
  );
}

function IconSignal() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 20h.01" />
      <path d="M7 20v-4" />
      <path d="M12 20v-8" />
      <path d="M17 20V8" />
      <path d="M22 20V4" />
    </svg>
  );
}

export default KilnTelemetryPanel;
