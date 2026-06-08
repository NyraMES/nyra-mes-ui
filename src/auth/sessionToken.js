import { fetchAuthSession } from "aws-amplify/auth";

import { ensureAmplifyReady } from "./amplifySetup";

/** Return a Cognito ID or access token for API calls, or null when auth is off / no session. */
export async function getBearerToken({ forceRefresh = false } = {}) {
  const { authEnabled } = await ensureAmplifyReady();
  if (!authEnabled) return null;

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
