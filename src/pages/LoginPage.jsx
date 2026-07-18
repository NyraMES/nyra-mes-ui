import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { useAppContext } from "../context/AppContext";
import {
  getIndustrySelection,
  resolveScopedTenantForIndustry
} from "../config/industrySelection";
import {
  resolveAppHostBinding,
  tenantMismatchMessage,
  userMatchesHostTenant
} from "../config/hostConfig";
import { cognitoEnv } from "../auth/cognitoConfig";
import nyraLogo from "../assets/nyra-logo.png";
import autoImage from "../assets/automobile-oem.png";
import carbonImage from "../assets/activated-carbon.png";

import "../styles/Landing.css";
import "../styles/Login.css";

const PROFILE_ATTRIBUTE_FIELDS = {
  email: {
    label: "Email",
    type: "email",
    placeholder: "admin1@yourcompany.com",
    autoComplete: "email"
  },
  name: {
    label: "Full name",
    type: "text",
    placeholder: "Admin User",
    autoComplete: "name"
  },
  given_name: {
    label: "First name",
    type: "text",
    placeholder: "Admin",
    autoComplete: "given-name"
  },
  family_name: {
    label: "Last name",
    type: "text",
    placeholder: "User",
    autoComplete: "family-name"
  },
  phone_number: {
    label: "Phone number",
    type: "tel",
    placeholder: "+46701234567",
    autoComplete: "tel"
  }
};

function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    authEnabled,
    cognitoConfigured,
    isAuthenticated,
    loading,
    user,
    loginWithPassword,
    completeNewPassword,
    loginWithHostedUi,
    resetLoginFlow
  } = useAuth();
  const { selectIndustryContext } = useAppContext();
  const hostBinding = resolveAppHostBinding();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [missingAttributes, setMissingAttributes] = useState([]);
  const [profileAttributes, setProfileAttributes] = useState({ email: "", name: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [contextReady, setContextReady] = useState(false);

  const industry =
    hostBinding?.industry_key || location.state?.industry;
  const fromLanding = Boolean(location.state?.fromLanding);
  const industrySelection = industry ? getIndustrySelection(industry) : null;
  const redirectTo =
    location.state?.from ||
    hostBinding?.landing_path ||
    industrySelection?.landing_path ||
    "/workflow";
  const loginTenantScope = industry
    ? resolveScopedTenantForIndustry(industry, isAuthenticated ? user : null)
    : resolveScopedTenantForIndustry(null, isAuthenticated ? user : null);
  const scopedTenantCode =
    loginTenantScope.tenant_code ||
    hostBinding?.tenant_code ||
    location.state?.tenant_code ||
    industrySelection?.tenant_code ||
    user?.tenant_code;
  const scopedWorkspaceCode =
    loginTenantScope.workspace_code ??
    hostBinding?.workspace_code ??
    location.state?.workspace_code ??
    industrySelection?.workspace_code ??
    null;
  const needsIndustryContext = Boolean(scopedTenantCode);
  const heroImage =
    industry === "activated-carbon" ? carbonImage : autoImage;
  const heroAlt =
    industry === "activated-carbon"
      ? "Activated Carbon Plant"
      : "Automobile OEM manufacturing";
  const plantTitle =
    hostBinding?.tenant_name ||
    industrySelection?.tenant_name ||
    "your manufacturing workspace";

  useEffect(() => {
    if (!isAuthenticated || loading || !needsIndustryContext) {
      if (isAuthenticated && !loading && !needsIndustryContext) {
        setContextReady(true);
      }
      return;
    }

    if (
      industry === "activated-carbon" &&
      user &&
      !user.tenant_code
    ) {
      setError(
        "This account has no plant assigned (missing custom:tenant_code in Cognito). " +
          "Ask your administrator to run scripts/provision_ac_admin1.ps1 or use ac-demo-admin@nyra.local."
      );
      void resetLoginFlow();
      return;
    }

    let active = true;
    (async () => {
      await selectIndustryContext({
        tenant_code: scopedTenantCode,
        workspace_code: scopedWorkspaceCode,
        industryKey: industry
      });
      if (active) setContextReady(true);
    })();

    return () => {
      active = false;
    };
  }, [
    isAuthenticated,
    loading,
    needsIndustryContext,
    scopedTenantCode,
    scopedWorkspaceCode,
    industry,
    selectIndustryContext,
    resetLoginFlow
  ]);

  useEffect(() => {
    if (!authEnabled || loading || !isAuthenticated || !user || !hostBinding) {
      return;
    }
    if (!userMatchesHostTenant(user, hostBinding)) {
      setError(tenantMismatchMessage(hostBinding));
      void resetLoginFlow();
    }
  }, [authEnabled, hostBinding, isAuthenticated, loading, resetLoginFlow, user]);

  const requiredProfileFields = () => {
    return missingAttributes.filter((attribute) => PROFILE_ATTRIBUTE_FIELDS[attribute]);
  };

  const clearFormState = () => {
    setNeedsNewPassword(false);
    setMissingAttributes([]);
    setNewPassword("");
    setConfirmPassword("");
    setProfileAttributes({ email: "", name: "" });
    setPassword("");
    setError("");
  };

  const onStartOver = async () => {
    setSubmitting(true);
    setError("");
    try {
      await resetLoginFlow();
      clearFormState();
    } catch (err) {
      setError(err?.message || "Could not reset login. Refresh the page and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("reset") !== "1" || loading) {
      return;
    }
    void onStartOver().then(() => {
      window.history.replaceState({}, "", "/login");
    });
    // Only run when arriving with ?reset=1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, location.search]);

  if (loading) {
    return (
      <div className="landing">
        <header className="landing-header">
          <div className="landing-header-left">
            <div className="landing-header-logo">
              <img src={nyraLogo} alt="Nyra Services" />
            </div>
            <div className="landing-header-text">
              <div className="landing-header-title">Nyra Services</div>
              <div className="landing-header-subtitle">
                Manufacturing Workflow Intelligence Platform
              </div>
            </div>
          </div>
        </header>
        <div className="landing-body">
          <div className="login-loading">Checking session…</div>
        </div>
      </div>
    );
  }

  if (!loading && !authEnabled) {
    return <Navigate to={redirectTo} replace />;
  }

  if (
    !loading &&
    isAuthenticated &&
    !fromLanding &&
    (contextReady || !needsIndustryContext)
  ) {
    return <Navigate to={redirectTo} replace />;
  }

  const onContinueSignedIn = async () => {
    setSubmitting(true);
    setError("");
    try {
      if (needsIndustryContext) {
        await selectIndustryContext({
          tenant_code: scopedTenantCode,
          workspace_code: scopedWorkspaceCode,
          industryKey: industry
        });
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err?.message || "Could not open workspace");
    } finally {
      setSubmitting(false);
    }
  };

  if (
    !loading &&
    isAuthenticated &&
    needsIndustryContext &&
    !contextReady &&
    !fromLanding
  ) {
    return (
      <div className="landing">
        <div className="landing-body">
          <div className="login-loading">Loading workspace…</div>
        </div>
      </div>
    );
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await loginWithPassword(username.trim(), password);
      if (
        result?.ok &&
        hostBinding &&
        result.user &&
        !userMatchesHostTenant(result.user, hostBinding)
      ) {
        await resetLoginFlow();
        setError(tenantMismatchMessage(hostBinding));
        return;
      }
      if (result?.needsNewPassword) {
        const attrs = result.missingAttributes || [];
        setMissingAttributes(attrs);
        setProfileAttributes((current) => ({
          ...current,
          email: current.email || (username.includes("@") ? username.trim() : ""),
          name: current.name || username.trim() || "Admin User"
        }));
        setNeedsNewPassword(true);
        return;
      }
      if (result?.ok) {
        if (needsIndustryContext) {
          await selectIndustryContext({
            tenant_code: scopedTenantCode,
            workspace_code: scopedWorkspaceCode,
            industryKey: industry
          });
        }
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError(err?.message || "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onSetNewPassword = async (event) => {
    event.preventDefault();
    setError("");

    const fields = requiredProfileFields();
    for (const field of fields) {
      if (!String(profileAttributes[field] || "").trim()) {
        const label = PROFILE_ATTRIBUTE_FIELDS[field]?.label || field;
        setError(`${label} is required to finish setting up your account.`);
        return;
      }
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setError("Password must include upper, lower, number, and symbol.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const userAttributes = {};
      fields.forEach((field) => {
        userAttributes[field] = String(profileAttributes[field]).trim();
      });
      const result = await completeNewPassword(newPassword, userAttributes);
      if (
        hostBinding &&
        result?.user &&
        !userMatchesHostTenant(result.user, hostBinding)
      ) {
        await resetLoginFlow();
        setError(tenantMismatchMessage(hostBinding));
        return;
      }
      if (needsIndustryContext) {
        await selectIndustryContext({
          tenant_code: scopedTenantCode,
          workspace_code: scopedWorkspaceCode,
          industryKey: industry
        });
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err?.message || "Could not set new password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-header-left">
          <Link to="/" className="landing-header-left" style={{ textDecoration: "none" }}>
            <div className="landing-header-logo">
              <img src={nyraLogo} alt="Nyra Services" />
            </div>
            <div className="landing-header-text">
              <div className="landing-header-title">Nyra Services</div>
              <div className="landing-header-subtitle">
                Manufacturing Workflow Intelligence Platform · Ontology-Driven MES
              </div>
            </div>
          </Link>
        </div>

        <div className="landing-header-right">
          <span className="aws-pill">AWS Hosted</span>
          <span className="aws-pill" style={{ marginLeft: 8 }}>
            Cognito Secure Login
          </span>
        </div>
      </header>

      <div className="landing-body">
        <div className="landing-container">
          <div className="login-grid">
            <section className="landing-hero">
              <div className="landing-eyebrow">
                SECURE ACCESS · ROLE-BASED · AWS COGNITO
              </div>

              <h1 className="landing-title" style={{ fontSize: "34px" }}>
                Sign in to {plantTitle}
              </h1>

              <p className="landing-text">
                {industry === "activated-carbon"
                  ? "Access activated carbon production — raw material inward, kiln, QC, routing, execution, and dispatch — with tenant-scoped credentials."
                  : "Access the Nyra workflow intelligence platform with your plant credentials. Orders, production, execution, quality, and traceability — connected in one ontology-driven system."}
              </p>

              <div className="industry-tile-image" style={{ maxWidth: 420, marginBottom: 20 }}>
                <img src={heroImage} alt={heroAlt} />
              </div>

              <div className="landing-pills">
                <span className="landing-pill">MES_Admin</span>
                <span className="landing-pill">MES_Planner</span>
                <span className="landing-pill">MES_Operator</span>
                <span className="landing-pill">MES_Quality</span>
              </div>
            </section>

            <section className="industry-card login-card">
              <div className="login-card-inner">
                <div className="login-card-header">
                  <div className="login-card-eyebrow">ACCOUNT ACCESS</div>
                  <h2 className="login-card-title">
                    {needsNewPassword ? "Complete your account" : "Welcome back"}
                  </h2>
                  <p className="login-card-subtitle">
                    {needsNewPassword
                      ? requiredProfileFields().length
                        ? "Set your profile details and a new password to finish signing in."
                        : "Set a new password to finish signing in."
                      : industry === "automotive-oem"
                        ? "Sign in to open the Automobile OEM workflow dashboard."
                        : industry === "activated-carbon"
                          ? "Sign in to open the activated carbon production workspace."
                          : "Use your Cognito username and password to continue."}
                  </p>
                </div>

                {!cognitoConfigured && (
                  <div className="login-warning" style={{ marginBottom: 16 }}>
                    Cognito is not configured in the UI environment. Set{" "}
                    <code>VITE_COGNITO_*</code> variables and restart Vite.
                  </div>
                )}

                {needsNewPassword ? (
                  <form onSubmit={onSetNewPassword} className="login-form">
                    <div className="login-info">
                      Signed in as <strong>{username.trim() || "your account"}</strong>.
                      Complete this step without refreshing the page. If it fails,
                      click <strong>Start over</strong> and sign in again with your
                      temporary password.
                    </div>

                    {requiredProfileFields().map((field) => {
                      const config = PROFILE_ATTRIBUTE_FIELDS[field];
                      if (!config) return null;
                      return (
                        <div className="login-field" key={field}>
                          <label htmlFor={`login-${field}`}>{config.label}</label>
                          <input
                            id={`login-${field}`}
                            type={config.type}
                            value={profileAttributes[field] || ""}
                            onChange={(e) =>
                              setProfileAttributes((current) => ({
                                ...current,
                                [field]: e.target.value
                              }))
                            }
                            autoComplete={config.autoComplete}
                            placeholder={config.placeholder}
                            required
                          />
                        </div>
                      );
                    })}

                    <div className="login-field">
                      <label htmlFor="login-new-password">New password</label>
                      <input
                        id="login-new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                    </div>

                    <div className="login-field">
                      <label htmlFor="login-confirm-password">Confirm password</label>
                      <input
                        id="login-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                    </div>

                    <div className="login-info">
                      Use at least 8 characters with upper, lower, number, and symbol.
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="login-btn login-btn-primary"
                    >
                      {submitting ? "Saving…" : "Set password and continue"}
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void onStartOver()}
                      className="login-btn login-btn-secondary"
                    >
                      Start over
                    </button>
                  </form>
                ) : (
                  <>
                    {fromLanding && isAuthenticated && user ? (
                      <div className="login-form" style={{ marginBottom: 16 }}>
                        <div className="login-info">
                          Signed in as{" "}
                          <strong>{user.email || user.username || "your account"}</strong>
                          {user.tenant_code ? ` (${user.tenant_code})` : ""}.
                        </div>
                        <button
                          type="button"
                          disabled={submitting}
                          className="login-btn login-btn-primary"
                          onClick={() => void onContinueSignedIn()}
                        >
                          {submitting ? "Opening…" : "Continue to workspace"}
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          className="login-btn login-btn-secondary"
                          onClick={() => void onStartOver()}
                        >
                          Sign in as a different user
                        </button>
                      </div>
                    ) : null}

                    <form onSubmit={onSubmit} className="login-form">
                    <div className="login-field">
                      <label htmlFor="login-username">Username or email</label>
                      <input
                        id="login-username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        placeholder="admin1"
                        required
                      />
                    </div>

                    <div className="login-field">
                      <label htmlFor="login-password">Password</label>
                      <input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                      />
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <button
                      type="submit"
                      disabled={submitting || !cognitoConfigured}
                      className="login-btn login-btn-primary"
                    >
                      {submitting ? "Signing in…" : "Sign in to Workflow"}
                    </button>

                    {cognitoEnv.domain && (
                      <button
                        type="button"
                        onClick={() => loginWithHostedUi()}
                        className="login-btn login-btn-secondary"
                      >
                        Continue with SSO
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void onStartOver()}
                      className="login-reset-link"
                    >
                      Start over / reset password flow
                    </button>
                  </form>
                  </>
                )}

                <div className="login-secure-note">
                  <span className="login-secure-dot" />
                  Protected by AWS Cognito authentication
                </div>

                <div className="login-footer">
                  {!hostBinding?.lock_industry && <Link to="/">← Back to home</Link>}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
