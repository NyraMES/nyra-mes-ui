/** App base path for subpath deploys (e.g. /mes on nyraservices-testbed.net). */
const configured = import.meta.env.VITE_BASE_PATH || "/";
const trimmed = configured.replace(/\/$/, "");

/** React Router basename — undefined at site root. */
export const ROUTER_BASENAME = trimmed || undefined;
