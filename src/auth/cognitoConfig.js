/** @typedef {import('aws-amplify').ResourcesConfig} ResourcesConfig */

const region = import.meta.env.VITE_COGNITO_REGION || "us-east-1";
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID || "";
const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID || "";
const domain = import.meta.env.VITE_COGNITO_DOMAIN || "";
const redirectSignIn =
  import.meta.env.VITE_COGNITO_REDIRECT_SIGN_IN ||
  `${typeof window !== "undefined" ? window.location.origin : "http://localhost:5173"}/login`;
const redirectSignOut =
  import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT ||
  `${typeof window !== "undefined" ? window.location.origin : "http://localhost:5173"}/`;

export const authEnabled =
  (import.meta.env.VITE_AUTH_ENABLED || "false").toLowerCase() === "true";

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

/** @returns {ResourcesConfig | null} */
export function buildAmplifyConfig() {
  if (!authEnabled || !userPoolId || !userPoolClientId) {
    return null;
  }

  /** @type {ResourcesConfig} */
  const config = {
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
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

export const cognitoEnv = {
  region,
  userPoolId,
  userPoolClientId,
  domain,
  redirectSignIn,
  redirectSignOut
};
