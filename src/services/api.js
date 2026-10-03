import axios from "axios";

import { apiBaseUrl } from "../auth/cognitoConfig";
import { getBearerToken } from "../auth/sessionToken";
import { blockLegacyApiInActivatedCarbon } from "../config/legacyApiGuard";
import { normalizeMesCoreRequestPath } from "./mesCorePaths";

const api = axios.create({
  baseURL: apiBaseUrl
});

api.interceptors.request.use(async (config) => {
  let url = String(config.url || "");
  if (url.includes("/auth/config")) {
    return config;
  }

  const legacyBlock = blockLegacyApiInActivatedCarbon(url);
  if (legacyBlock) {
    return Promise.reject(
      Object.assign(new Error(legacyBlock), {
        isLegacyApiBlocked: true,
        config
      })
    );
  }

  url = normalizeMesCoreRequestPath(url);
  config.url = url;

  const token = await getBearerToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
    delete api.defaults.headers.common.Authorization;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = String(error.config?.url || "");
    if (error?.response?.status === 401 && !url.includes("/auth/config")) {
      delete api.defaults.headers.common.Authorization;
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    return Promise.reject(error);
  }
);

/** Turn FastAPI / axios errors into a readable string for alerts. */
export function formatApiError(error, fallback = "Request failed") {
  if (error?.isLegacyApiBlocked) {
    return error.message || fallback;
  }
  if (!error?.response) {
    if (error?.message === "Network Error") {
      const base = api.defaults.baseURL || "http://127.0.0.1:8000";
      const isAc =
        typeof window !== "undefined" &&
        window.location.pathname.includes("/activated-carbon");
      const script = isAc
        ? ".\\scripts\\run_sam_carbons_api_8003.ps1"
        : ".\\scripts\\run_video_demo.ps1";
      return (
        `Cannot reach the API at ${base}. ` +
        `Start the API: cd nyra-mes-api && ${script} then refresh.`
      );
    }
    return error?.message || fallback;
  }
  const detail = error.response.data?.detail;
  if (error.response?.status === 403) {
    if (typeof detail === "string" && /different plant/i.test(detail)) {
      return detail;
    }
  }
  if (error.response?.status === 404) {
    if (detail === "Not Found") {
      const base = api.defaults.baseURL || apiBaseUrl || "";
      return (
        "API route not found (404). Confirm the backend is running and up to date. " +
        `Base URL: ${base}. Locally: cd nyra-mes-api && .\\scripts\\run_local_api.ps1`
      );
    }
    if (typeof detail === "string" && /workspace.*not found/i.test(detail)) {
      return (
        `${detail} — check tenant/workspace in the top bar. ` +
        "Activated Carbon demo uses SAM_CARBONS_DEMO / SAM_CARBONS_DEMO_WS; client tenants use their own workspace code."
      );
    }
    if (typeof detail === "string" && /tenant.*not found/i.test(detail)) {
      return `${detail} — run migrations and the Activated Carbon seed script for your tenant.`;
    }
  }
  if (detail === "Demo environment is read-only. Contact Nyra for a full evaluation.") {
    return "Demo mode is read-only. Use “Start demo walkthrough” with the pre-seeded Apex Automotive order instead of creating new records.";
  }
  if (error.response?.status === 500) {
    if (typeof detail === "string" && detail.trim()) return detail;
    return "Server error — the API could not complete this request. If this persists, check database connectivity on the server.";
  }
  if (!detail) return error?.message || fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const loc = Array.isArray(item?.loc) ? item.loc.join(".") : "";
        const msg = item?.msg || "";
        return loc ? `${loc}: ${msg}` : msg;
      })
      .filter(Boolean)
      .join("\n") || fallback;
  }
  if (typeof detail === "object") {
    return detail.message || detail.detail || JSON.stringify(detail);
  }
  return fallback;
}

export default api;
