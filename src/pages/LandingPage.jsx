import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import nyraLogo from "../assets/nyra-logo.png";
import autoImage from "../assets/automobile-oem.png";
import carbonImage from "../assets/activated-carbon.png";

import "../styles/Landing.css";


function LandingPage() {
  const { authEnabled, isAuthenticated } = useAuth();

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
                Nyra connects every stage of manufacturing —
                Customer Order → Production Order → Lot Split → Routing →
                Feasibility → Scheduling → Execution → Inspection → Dispatch —
                into one ontology-driven workflow. Reason across the graph
                and answer questions you cannot in a CRUD ERP.
              </p>

              <div className="landing-pills">
                <span className="landing-pill">
                  Workflow Intelligence
                </span>
                <span className="landing-pill">
                  Feasibility Reasoning
                </span>
                <span className="landing-pill">
                  Genealogy &amp; Traceability
                </span>
                <span className="landing-pill">
                  Ask Nyra · AI Ready
                </span>
              </div>
            </section>

            <section className="industry-card">
              <div className="industry-header">
                <div>
                  <div className="industry-eyebrow">
                    FEATURED INDUSTRIES
                  </div>
                  <h2 className="industry-title">
                    MSME-ready playbooks
                  </h2>
                </div>

                <span className="industry-badge">
                  <span className="industry-badge-dot" />
                  Live Tested
                </span>
              </div>

              <div className="industry-grid">

                <div className="industry-tile">
                  <div className="industry-tile-image">
                    <img
                      src={carbonImage}
                      alt="Activated Carbon Plant"
                    />
                  </div>
                  <div className="industry-tile-label">
                    MATERIALS AND PROCESS INDUSTRIES
                  </div>
                  <div className="industry-tile-name">
                    Activated Carbon Plant
                  </div>
                  <p className="industry-tile-desc">
                    End-to-end production visibility for activated carbon —
                    from raw material to dispatch, with quality and yield
                    insights.
                  </p>
                </div>

                <Link
                  to="/workflow"
                  className="industry-tile industry-tile-link industry-tile-feature"
                >
                  <div className="industry-tile-image">
                    <img src={autoImage} alt="Automobile OEM" />
                  </div>
                  <div className="industry-tile-label">
                    AUTOMOBILE / TIER-1 OEM · WORKFLOW INTELLIGENCE
                  </div>
                  <div className="industry-tile-name">
                    Automobile OEM
                  </div>
                  <p className="industry-tile-desc">
                    Connected workflow intelligence — orders to dispatch — with
                    feasibility reasoning, ontology graph and lot-level
                    traceability. Every screen derives context from the
                    upstream stage.
                  </p>
                  <span className="industry-tile-cta">
                    Open Intelligence Hub →
                  </span>
                </Link>

                <div className="industry-tile">
                  <div className="industry-tile-label">
                    REFINERY / PETROCHEMICALS
                  </div>
                  <div className="industry-tile-name">
                    Chemical Processing
                  </div>
                  <p className="industry-tile-desc">
                    Real-time visibility for batch, quality and utility
                    tracking.
                  </p>
                </div>

                <div className="industry-tile">
                  <div className="industry-tile-label">
                    IRON / STEEL SAND CASTING
                  </div>
                  <div className="industry-tile-name">
                    Foundry &amp; Casting
                  </div>
                  <p className="industry-tile-desc">
                    Core + foundry prep, melting, pouring, fettling and
                    inspection with OEE + FPY KPIs.
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
