import axios from "axios";

const baseURL = (import.meta.env.VITE_MODBUS_SIM_API_URL || "http://127.0.0.1:8010").replace(/\/$/, "");
const defaultDeviceCode = import.meta.env.VITE_MODBUS_SIM_DEVICE_CODE || "KILN_01_MODBUS_SIM";

const modbusSimApi = axios.create({
  baseURL,
  timeout: 15000
});

export function getModbusSimDeviceCode() {
  return defaultDeviceCode;
}

export function isModbusSimConfigured() {
  return Boolean(baseURL);
}

export async function fetchLatestModbusReadings(deviceCode = defaultDeviceCode) {
  const res = await modbusSimApi.get(`/readings/latest/${encodeURIComponent(deviceCode)}`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function fetchModbusReadingHistory(deviceCode = defaultDeviceCode, limit = 100) {
  const res = await modbusSimApi.get("/readings", {
    params: {
      device_code: deviceCode,
      limit
    }
  });
  return Array.isArray(res.data?.readings) ? res.data.readings : [];
}

export async function fetchModbusParameters() {
  const res = await modbusSimApi.get("/parameters");
  return Array.isArray(res.data) ? res.data : [];
}

export function buildParameterLimitMap(parameters = []) {
  return parameters.reduce((acc, row) => {
    acc[row.parameter_code] = {
      normal_min: row.normal_min,
      normal_max: row.normal_max
    };
    return acc;
  }, {});
}

export function groupModbusHistoryByParameter(readings = []) {
  const grouped = {};
  for (const row of readings) {
    if (!grouped[row.parameter_code]) grouped[row.parameter_code] = [];
    grouped[row.parameter_code].push(row);
  }
  for (const code of Object.keys(grouped)) {
    grouped[code].sort(
      (a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
    );
  }
  return grouped;
}

export async function simulateModbusReading(deviceCode = defaultDeviceCode) {
  const res = await modbusSimApi.post(`/simulate/reading/${encodeURIComponent(deviceCode)}`);
  return res.data;
}

export function formatModbusSimError(error, fallback = "Modbus simulator unavailable") {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  }
  if (error?.code === "ECONNABORTED") return "Modbus simulator request timed out";
  if (error?.message?.includes("Network Error")) {
    return `${fallback} — start nyra-smart-modbus-sim-api on ${baseURL}`;
  }
  return error?.message || fallback;
}
