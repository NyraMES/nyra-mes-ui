/** @typedef {import('aws-amplify').ResourcesConfig} ResourcesConfig */

const region = import.meta.env.VITE_COGNITO_REGION || "us-east-1";
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID || "";
const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID || "";
const domain = import.meta.env.VITE_COGNITO_DOMAIN || "";

function defaultRedirectSignIn() {
  const base = import.meta.env.VITE_BASE_PATH || "/";
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${prefix === "/" ? "" : prefix}/login`;
  }
  return (
    import.meta.env.VITE_COGNITO_REDIRECT_SIGN_IN ||
    "http://localhost:5173/login"
  );
}

function defaultRedirectSignOut() {
  const base = import.meta.env.VITE_BASE_PATH || "/";
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${prefix === "/" ? "" : prefix}/`;
  }
  return (
    import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT ||
    "http://localhost:5173/"
  );
}

const redirectSignIn =
  import.meta.env.VITE_COGNITO_REDIRECT_SIGN_IN || defaultRedirectSignIn();
const redirectSignOut =
  import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT || defaultRedirectSignOut();

export const authEnabled =
  (import.meta.env.VITE_AUTH_ENABLED || "false").toLowerCase() === "true";

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

/**
 * Build Amplify config from build-time env and/or `/auth/config` from the API.
 * @param {{ auth_enabled?: boolean, cognito_region?: string, cognito_user_pool_id?: string, cognito_app_client_id?: string } | null | undefined} serverCfg
 * @returns {ResourcesConfig | null}
 */
export function buildAmplifyConfig(serverCfg) {
  const enabled = serverCfg?.auth_enabled ?? authEnabled;
  const poolId = serverCfg?.cognito_user_pool_id || userPoolId;
  const clientId = serverCfg?.cognito_app_client_id || userPoolClientId;

  if (!enabled || !poolId || !clientId) {
    return null;
  }

  /** @type {ResourcesConfig} */
  const config = {
    Auth: {
      Cognito: {
        userPoolId: poolId,
        userPoolClientId: clientId,
        loginWith: domain
          ? {
              oauth: {
                domain,
                scopes: ["openid", "email", "profile"],
                redirectSignIn: [redirectSignIn],
                redirectSignOut: [redirectSignOut],
                responseType: "code"
              }
            }
          : undefined
      }
    }
  };

  return config;
}

export function isCognitoConfigured(serverCfg) {
  const poolId = serverCfg?.cognito_user_pool_id || userPoolId;
  const clientId = serverCfg?.cognito_app_client_id || userPoolClientId;
  return Boolean(poolId && clientId);
}

export const cognitoEnv = {
  region,
  userPoolId,
  userPoolClientId,
  domain,
  redirectSignIn,
  redirectSignOut
};
