import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  confirmResetPassword,
  confirmSignIn,
  fetchAuthSession,
  getCurrentUser,
  resetPassword,
  signIn,
  signInWithRedirect,
  signOut
} from "aws-amplify/auth";

import api from "../services/api";
import {
  ensureAmplifyConfigured,
  isAmplifyConfigured
} from "./amplifySetup";
import {
  authEnabled,
  cognitoEnv,
  isCognitoConfigured
} from "./cognitoConfig";
import { primaryRoleLabel } from "./roles";

const AuthContext = createContext(null);

function resolveUserTenantCode(profile) {
  if (profile?.tenant_code) return profile.tenant_code;
  const groups = profile?.groups || [];
  const tenantGroup = groups.find((row) => String(row || "").toUpperCase().startsWith("TENANT_"));
  if (tenantGroup) return String(tenantGroup).slice(7);
  const username = String(profile?.username || "").trim();
  if (/@grcarbons(\.com)?$/i.test(username)) return "GR_CARBONS";
  return null;
}

function formatAuthError(err) {
  if (!err) return "Sign-in failed";
  const message =
    err.message ||
    err.underlyingError?.message ||
    err.cause?.message ||
    "";

  if (message.includes("SECRET_HASH")) {
    return "This Cognito app client has a secret. Use a public SPA client without a client secret.";
  }
  if (
    message.includes("signIn was not called") ||
    message.includes("session has expired")
  ) {
    return "Your sign-in session expired. Click Start over, sign in again with your temporary password, then set your new password.";
  }
  if (message.includes("Invalid attributes") || message.includes("email is missing")) {
    return "Email is required. Enter a valid email address and try again.";
  }
  if (message.includes("Cannot modify an already provided email")) {
    return "Your email is already on file. Set only your new password, or click Start over and sign in again.";
  }
  if (message.includes("Password did not conform") || err.name === "InvalidPasswordException") {
    return "Password must be at least 8 characters and include upper, lower, number, and symbol.";
  }
  if (err.name === "UserAlreadyAuthenticatedException") {
    return "You are already signed in. Refresh the page or sign out and try again.";
  }
  if (err.name === "NotAuthorizedException") {
    return message || "Incorrect username or password.";
  }
  if (err.name === "UserNotFoundException") {
    return "User not found. Check your username.";
  }
  if (err.name === "PasswordResetRequiredException") {
    return "Your password must be reset in AWS Cognito before you can sign in.";
  }
  if (err.name === "UserNotConfirmedException") {
    return "Your account is not confirmed yet. Ask your administrator to confirm it in Cognito.";
  }
  return message || "Sign-in failed";
}

async function loadDevUser() {
  const res = await api.get("/auth/me");
  const data = res.data || {};
  return {
    sub: data.sub,
    username: data.username,
    email: data.email,
    tenant_code: resolveUserTenantCode(data),
    roles: data.roles || data.groups || [],
    displayName: data.display_name || data.username || data.email,
    roleLabel: primaryRoleLabel(data.roles || data.groups || [])
  };
}

async function loadCognitoUser({ forceRefresh = true } = {}) {
  ensureAmplifyConfigured();
  const session = await fetchAuthSession({ forceRefresh });
  const token =
    session.tokens?.idToken?.toString() ||
    session.tokens?.accessToken?.toString() ||
    null;
  if (!token) {
    return { user: null, token: null };
  }

  api.defaults.headers.common.Authorization = `Bearer ${token}`;

  let profile = null;
  try {
    const res = await api.get("/auth/me");
    profile = res.data;
  } catch {
    const cognitoUser = await getCurrentUser();
    profile = {
      sub: cognitoUser.userId,
      username: cognitoUser.username,
      roles: []
    };
  }

  const roles = profile?.roles || profile?.groups || [];
  return {
    token,
    user: {
      sub: profile?.sub,
      username: profile?.username,
      email: profile?.email,
      tenant_code: resolveUserTenantCode(profile),
      roles,
      displayName: profile?.display_name || profile?.username || profile?.email,
      roleLabel: primaryRoleLabel(roles)
    }
  };
}

async function waitForCognitoSession() {
  for (const forceRefresh of [false, true, true]) {
    const result = await loadCognitoUser({ forceRefresh });
    if (result.token) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return { user: null, token: null };
}

function mapSignInStep(result) {
  const step = result?.nextStep?.signInStep;
  if (step === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
    return {
      needsNewPassword: true,
      missingAttributes: result?.nextStep?.missingAttributes || []
    };
  }
  if (step === "DONE" || result?.isSignedIn) {
    return { ok: true };
  }
  if (
    step === "CONTINUE_SIGN_IN_WITH_FIRST_FACTOR_SELECTION" ||
    step === "CONFIRM_SIGN_IN_WITH_PASSWORD"
  ) {
    return { continueSignIn: true, step };
  }
  if (step) {
    return {
      error: `Additional sign-in step required: ${step}. Contact your administrator.`
    };
  }
  return { error: "Sign-in did not complete. Check your username and password." };
}

async function clearExistingSession() {
  try {
    await signOut({ global: false });
  } catch {
    // Ignore when there is no active Cognito session.
  }
  delete api.defaults.headers.common.Authorization;
}

async function continueSignInFlow(result, password) {
  const step = result?.nextStep?.signInStep;
  if (step === "CONTINUE_SIGN_IN_WITH_FIRST_FACTOR_SELECTION") {
    return confirmSignIn({ challengeResponse: "PASSWORD_SRP" });
  }
  if (step === "CONFIRM_SIGN_IN_WITH_PASSWORD") {
    return confirmSignIn({ challengeResponse: password });
  }
  return result;
}

async function runPasswordSignIn(username, password) {
  await clearExistingSession();

  let result = await signIn({
    username,
    password,
    options: { authFlowType: "USER_SRP_AUTH" }
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const mapped = mapSignInStep(result);
    if (mapped.needsNewPassword) {
      return mapped;
    }
    if (mapped.ok) {
      return mapped;
    }
    if (mapped.error) {
      throw new Error(mapped.error);
    }
    if (mapped.continueSignIn) {
      result = await continueSignInFlow(result, password);
      continue;
    }
    break;
  }

  const finalMapped = mapSignInStep(result);
  if (finalMapped.error) {
    throw new Error(finalMapped.error);
  }
  return finalMapped;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverAuthEnabled, setServerAuthEnabled] = useState(authEnabled);
  const [authConfig, setAuthConfig] = useState(null);

  const applySession = useCallback(async () => {
    const result = await waitForCognitoSession();
    setUser(result.user);
    setToken(result.token);
    if (!result.token) {
      delete api.defaults.headers.common.Authorization;
    }
    return result;
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const cfgRes = await api.get("/auth/config");
      const cfg = cfgRes.data || {};
      setAuthConfig(cfg);
      setServerAuthEnabled(!!cfg.auth_enabled);

      if (!cfg.auth_enabled || !authEnabled) {
        delete api.defaults.headers.common.Authorization;
        const devUser = await loadDevUser();
        setUser(devUser);
        setToken(null);
        return { ok: true, user: devUser };
      }

      if (!ensureAmplifyConfigured(cfg)) {
        setUser(null);
        setToken(null);
        return { ok: false, error: "Cognito is not configured in the UI or API." };
      }

      return await applySession();
    } catch {
      setUser(null);
      setToken(null);
      delete api.defaults.headers.common.Authorization;
      return { ok: false, error: "Could not load auth session." };
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setToken(null);
      delete api.defaults.headers.common.Authorization;
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  const loginWithPassword = useCallback(async (username, password) => {
    ensureAmplifyConfigured();
    try {
      const mapped = await runPasswordSignIn(username, password);
      if (mapped.needsNewPassword) {
        return {
          needsNewPassword: true,
          missingAttributes: mapped.missingAttributes || []
        };
      }

      const session = await applySession();
      if (!session.user) {
        throw new Error("Signed in to Cognito, but the app session could not be loaded.");
      }
      return { ok: true, user: session.user };
    } catch (err) {
      throw new Error(formatAuthError(err));
    }
  }, [applySession]);

  const completeNewPassword = useCallback(async (newPassword, userAttributes = {}) => {
    ensureAmplifyConfigured();
    try {
      const cleanedAttributes = Object.fromEntries(
        Object.entries(userAttributes).filter(([, value]) => String(value || "").trim())
      );

      const confirmOptions = { challengeResponse: newPassword };
      if (Object.keys(cleanedAttributes).length > 0) {
        confirmOptions.options = { userAttributes: cleanedAttributes };
      }

      let result = await confirmSignIn(confirmOptions);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const mapped = mapSignInStep(result);
        if (mapped.error) {
          throw new Error(mapped.error);
        }
        if (mapped.ok || result?.isSignedIn) {
          break;
        }
        if (mapped.continueSignIn) {
          result = await continueSignInFlow(result, newPassword);
          continue;
        }
        break;
      }

      const session = await applySession();
      if (!session.user) {
        throw new Error("Password updated, but the app session could not be loaded.");
      }
      return { ok: true, user: session.user };
    } catch (err) {
      throw new Error(formatAuthError(err));
    }
  }, [applySession]);

  const loginWithHostedUi = useCallback(async () => {
    ensureAmplifyConfigured();
    await signInWithRedirect();
  }, []);

  const logout = useCallback(async () => {
    if (serverAuthEnabled && isAmplifyConfigured()) {
      await signOut();
    }
    delete api.defaults.headers.common.Authorization;
    setUser(null);
    setToken(null);
  }, [serverAuthEnabled]);

  const requestPasswordReset = useCallback(async (username) => {
    ensureAmplifyConfigured();
    try {
      await resetPassword({ username: String(username || "").trim() });
    } catch (err) {
      throw new Error(formatAuthError(err));
    }
  }, []);

  const confirmPasswordReset = useCallback(async (username, confirmationCode, newPassword) => {
    ensureAmplifyConfigured();
    try {
      await confirmResetPassword({
        username: String(username || "").trim(),
        confirmationCode: String(confirmationCode || "").trim(),
        newPassword
      });
    } catch (err) {
      throw new Error(formatAuthError(err));
    }
  }, []);

  const resetLoginFlow = useCallback(async () => {
    if (serverAuthEnabled && isAmplifyConfigured()) {
      await clearExistingSession();
    } else {
      delete api.defaults.headers.common.Authorization;
    }
    setUser(null);
    setToken(null);
  }, [serverAuthEnabled]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      authEnabled: serverAuthEnabled,
      cognitoConfigured: isCognitoConfigured(authConfig),
      isAuthenticated: serverAuthEnabled ? !!(user && token) : !!user,
      refreshSession,
      loginWithPassword,
      completeNewPassword,
      loginWithHostedUi,
      logout,
      resetLoginFlow,
      requestPasswordReset,
      confirmPasswordReset
    }),
    [
      user,
      token,
      loading,
      serverAuthEnabled,
      authConfig,
      refreshSession,
      loginWithPassword,
      completeNewPassword,
      loginWithHostedUi,
      logout,
      resetLoginFlow,
      requestPasswordReset,
      confirmPasswordReset
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
