import { Amplify } from "aws-amplify";
import { fetchAuthSession } from "aws-amplify/auth";

import { authEnabled, buildAmplifyConfig } from "./cognitoConfig";

let amplifyConfigured = false;

function ensureAmplifyConfigured() {
  if (amplifyConfigured || !authEnabled) return authEnabled && amplifyConfigured;
  const config = buildAmplifyConfig();
  if (!config) return false;
  Amplify.configure(config);
  amplifyConfigured = true;
  return true;
}

/** Return a Cognito ID or access token for API calls, or null when auth is off / no session. */
export async function getBearerToken({ forceRefresh = false } = {}) {
  if (!authEnabled) return null;
  if (!ensureAmplifyConfigured()) return null;

  try {
    const session = await fetchAuthSession({ forceRefresh });
    return (
      session.tokens?.idToken?.toString() ||
      session.tokens?.accessToken?.toString() ||
      null
    );
  } catch {
    return null;
  }
}
