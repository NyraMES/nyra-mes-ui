import axios from "axios";

import { apiBaseUrl } from "../auth/cognitoConfig";
import { getBearerToken } from "../auth/sessionToken";

const api = axios.create({
  baseURL: apiBaseUrl
});

api.interceptors.request.use(async (config) => {
  const url = String(config.url || "");
  if (url.includes("/auth/config")) {
    return config;
  }

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
  const detail = error?.response?.data?.detail;
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
