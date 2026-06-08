import { Amplify } from "aws-amplify";

import {
  apiBaseUrl,
  authEnabled as envAuthEnabled,
  buildAmplifyConfig
} from "./cognitoConfig";

let amplifyConfigured = false;
let amplifyServerCfg = null;
let authConfigPromise = null;

export function getAmplifyServerCfg() {
  return amplifyServerCfg;
}

export function isAmplifyConfigured() {
  return amplifyConfigured;
}

export function ensureAmplifyConfigured(serverCfg) {
  const cfg = serverCfg || amplifyServerCfg;
  if (amplifyConfigured && (!serverCfg || serverCfg === amplifyServerCfg)) {
    return Boolean(buildAmplifyConfig(cfg));
  }
  const config = buildAmplifyConfig(cfg);
  if (!config) return false;
  Amplify.configure(config);
  amplifyConfigured = true;
  if (cfg) {
    amplifyServerCfg = cfg;
  }
  return true;
}

export async function loadAuthConfig() {
  if (amplifyServerCfg) {
    return amplifyServerCfg;
  }
  if (!authConfigPromise) {
    authConfigPromise = fetch(`${apiBaseUrl}/auth/config`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Could not load auth config");
        }
        return res.json();
      })
      .catch(() => null);
  }
  const cfg = await authConfigPromise;
  if (cfg) {
    amplifyServerCfg = cfg;
  }
  return cfg;
}

/** Resolve whether Cognito auth is active and configure Amplify when needed. */
export async function ensureAmplifyReady() {
  // Local .env.ac sets VITE_AUTH_ENABLED=false — do not inherit server Cognito for SAM_CARBONS validation.
  if (!envAuthEnabled) {
    const cfg = await loadAuthConfig();
    return { authEnabled: false, cfg };
  }

  ensureAmplifyConfigured();
  const cfg = amplifyServerCfg || (await loadAuthConfig());
  if (!cfg?.auth_enabled) {
    return { authEnabled: false, cfg };
  }

  ensureAmplifyConfigured(cfg);
  return { authEnabled: true, cfg };
}
