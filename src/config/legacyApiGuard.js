import { isProxiedMesCoreApiPath } from "../services/mesCorePaths";

/** Routes that may run without nyra_mes_core /api/* prefix. */
const ALLOWED_NON_MES_CORE_PREFIXES = ["/auth/"];

export function normalizeRequestPath(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return new URL(raw).pathname;
    }
  } catch {
    /* relative path */
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function isMesCoreApiPath(url) {
  const path = normalizeRequestPath(url);
  if (path.startsWith("/api/")) return true;
  return isProxiedMesCoreApiPath(path);
}

export function isAllowedNonMesCorePath(url) {
  const path = normalizeRequestPath(url);
  return ALLOWED_NON_MES_CORE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** True for old oemauto routes (/work-orders, /customer, /lot/…, etc.). */
export function isLegacyOemApiPath(url) {
  if (isMesCoreApiPath(url) || isAllowedNonMesCorePath(url)) return false;
  return normalizeRequestPath(url).length > 0;
}

export function isActivatedCarbonShell() {
  if (typeof window === "undefined") return false;
  return window.location.pathname.includes("/activated-carbon");
}

/**
 * When user is in AC module, legacy OEM calls must not leave the browser.
 * Returns an error message to reject the request, or null if allowed.
 */
export function blockLegacyApiInActivatedCarbon(url) {
  if (!isActivatedCarbonShell()) return null;
  if (!isLegacyOemApiPath(url)) return null;
  return (
    "Legacy OEM API routes are disabled in Activated Carbon. " +
    "Use nyra_mes_core /api/* routes only."
  );
}
