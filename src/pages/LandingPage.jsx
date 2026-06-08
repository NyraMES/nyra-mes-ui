import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { useAppContext } from "../context/AppContext";
import {
  getIndustrySelection,
  resolveScopedTenantForIndustry,
  userCanAccessIndustry
} from "../config/industrySelection";
import { resolveAppHostBinding } from "../config/hostConfig";
import ContextLoadWarning from "../components/ContextLoadWarning";
import nyraLogo from "../assets/nyra-logo.png";
import autoImage from "../assets/automobile-oem.png";
import carbonImage from "../assets/activated-carbon.png";

import "../styles/Landing.css";

const INDUSTRY_TILES = [
  {
    key: "activated-carbon",
    image: carbonImage,
    imageAlt: "Activated Carbon Plant",
    label: "MATERIALS AND PROCESS INDUSTRIES",
    name: "Activated Carbon Plant",
    description:
      "End-to-end production visibility for activated carbon — from raw material to dispatch, with quality and yield insights.",
    featured: false
  },
  {
    key: "automotive-oem",
    image: autoImage,
    imageAlt: "Automobile OEM",
    label: "AUTOMOBILE / TIER-1 OEM · WORKFLOW INTELLIGENCE",
    name: "Automobile OEM",
    description:
      "Connected workflow intelligence — orders to dispatch — with feasibility reasoning, ontology graph and lot-level traceability. Every screen derives context from the upstream stage.",
    featured: true
  }
];

function LandingPage() {
  const navigate = useNavigate();
  const { authEnabled, isAuthenticated, loading: authLoading, user } = useAuth();
  const { selectIndustryContext, loading: contextLoading } = useAppContext();
  const [selecting, setSelecting] = useState(null);
  const [selectError, setSelectError] = useState("");
  const hostBinding = resolveAppHostBinding();

  useEffect(() => {
    if (!hostBinding?.lock_industry || authLoading || contextLoading) return;
    if (authEnabled && !isAuthenticated) return;

    let active = true;
    (async () => {
      setSelecting(hostBinding.industry_key);
      try {
        const ctx = await selectIndustryContext({
          tenant_code: hostBinding.tenant_code,
          workspace_code: hostBinding.workspace_code,
          industryKey: hostBinding.industry_key
        });
        if (!active) return;
        navigate(ctx.landing_page || hostBinding.landing_path || "/");
      } catch {
        if (!active) return;
        navigate(hostBinding.landing_path || "/");
      } finally {
        if (active) setSelecting(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    authEnabled,
    authLoading,
    contextLoading,
    hostBinding,
    isAuthenticated,
    navigate,
    selectIndustryContext
  ]);

  if (
    hostBinding?.lock_industry &&
    authEnabled &&
    !authLoading &&
    !isAuthenticated
  ) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: hostBinding.landing_path,
          industry: hostBinding.industry_key,
          tenant_code: hostBinding.tenant_code,
          workspace_code: hostBinding.workspace_code
        }}
      />
    );
  }

  const handleIndustrySelect = async (industryKey) => {
    const selection = getIndustrySelection(industryKey);
    if (!selection) return;

    if (authEnabled && isAuthenticated && !userCanAccessIndustry(industryKey, user)) {
      setSelectError(
        `Your account (${user?.tenant_code || "unknown tenant"}) is not assigned to this industry. ` +
          "Use an Activated Carbon admin login (SAM_CARBONS or SAM_CARBONS_DEMO), or open Automobile OEM."
      );
      return;
    }

    const tenantScope = resolveScopedTenantForIndustry(industryKey, user);

    if (authEnabled && !isAuthenticated) {
      navigate("/login", {
        state: {
          from: selection.landing_path,
          industry: industryKey,
          tenant_code: tenantScope.tenant_code,
          workspace_code: tenantScope.workspace_code
        }
      });
      return;
    }

    setSelecting(industryKey);
    setSelectError("");

    try {
      const ctx = await selectIndustryContext({
        tenant_code: tenantScope.tenant_code,
        workspace_code: tenantScope.workspace_code,
        industryKey
      });

      const target = ctx.landing_page || selection.landing_path;
      navigate(target);

      if (ctx.fromFallback) {
        setSelectError(
          "Workspace context API unavailable — loaded with local industry defaults."
        );
      }
    } catch {
      navigate(selection.landing_path);
      setSelectError("Could not load workspace context — opening with defaults.");
    } finally {
      setSelecting(null);
    }
  };

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
              Manufacturing Workflow Intelligence Platform · Ontology-Driven MES
            </div>
          </div>
        </div>

        <div className="landing-header-right">
          <span className="aws-pill">AWS Hosted</span>
          {authEnabled && !isAuthenticated && (
            <Link to="/login" className="landing-sign-in">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <ContextLoadWarning className="landing-context-warning" />

      <div className="landing-body">
        <div className="landing-container">
          <div className="landing-grid">
            <section className="landing-hero">
              <div className="landing-eyebrow">
                ONTOLOGY-DRIVEN · WORKFLOW INTELLIGENCE ·
                FEASIBILITY · TRACEABILITY · ASK NYRA
              </div>

              <h1 className="landing-title">
                A Manufacturing Knowledge System, not a Form-based ERP
              </h1>

              <p className="landing-text">
                Nyra connects every stage of manufacturing — Customer Order →
                Production Order → Lot Split → Routing → Feasibility →
                Scheduling → Execution → Inspection → Dispatch — into one
                ontology-driven workflow. Reason across the graph and answer
                questions you cannot in a CRUD ERP.
              </p>

              <div className="landing-pills">
                <span className="landing-pill">Workflow Intelligence</span>
                <span className="landing-pill">Feasibility Reasoning</span>
                <span className="landing-pill">Genealogy &amp; Traceability</span>
                <span className="landing-pill">Ask Nyra · AI Ready</span>
              </div>
            </section>

            <section className="industry-card">
              <div className="industry-header">
                <div>
                  <div className="industry-eyebrow">FEATURED INDUSTRIES</div>
                  <h2 className="industry-title">MSME-ready playbooks</h2>
                </div>

                <span className="industry-badge">
                  <span className="industry-badge-dot" />
                  Live Tested
                </span>
              </div>

              {selectError && (
                <div className="landing-select-error" role="alert">
                  {selectError}
                </div>
              )}

              <div className="industry-grid">
                {INDUSTRY_TILES.map((tile) => (
                  <button
                    key={tile.key}
                    type="button"
                    className={
                      "industry-tile industry-tile-link" +
                      (tile.featured ? " industry-tile-feature" : "")
                    }
                    disabled={Boolean(selecting) || contextLoading}
                    onClick={() => handleIndustrySelect(tile.key)}
                  >
                    <div className="industry-tile-image">
                      <img src={tile.image} alt={tile.imageAlt} />
                    </div>
                    <div className="industry-tile-label">{tile.label}</div>
                    <div className="industry-tile-name">{tile.name}</div>
                    <p className="industry-tile-desc">{tile.description}</p>
                    <span className="industry-tile-cta">
                      {selecting === tile.key
                        ? "Loading workspace…"
                        : authEnabled && !isAuthenticated
                          ? "Sign in to open →"
                          : "Open dashboard →"}
                    </span>
                  </button>
                ))}

                <div className="industry-tile">
                  <div className="industry-tile-label">REFINERY / PETROCHEMICALS</div>
                  <div className="industry-tile-name">Chemical Processing</div>
                  <p className="industry-tile-desc">
                    Real-time visibility for batch, quality and utility tracking.
                  </p>
                </div>

                <div className="industry-tile">
                  <div className="industry-tile-label">IRON / STEEL SAND CASTING</div>
                  <div className="industry-tile-name">Foundry &amp; Casting</div>
                  <p className="industry-tile-desc">
                    Core + foundry prep, melting, pouring, fettling and inspection
                    with OEE + FPY KPIs.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
