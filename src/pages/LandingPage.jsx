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
import { formatContactApiError, submitContactEnquiry } from "../services/contactApi";
import { INDUSTRY_TILES } from "../config/industryTiles";
import nyraLogo from "../assets/nyra-logo.png";

import "../styles/Landing.css";

const CONTACT_EMAIL = "sudhasankaran@nyraias.com";

const TEAM = [
  {
    name: "Sudha Sankaran",
    shortName: "Sudha",
    role: "CEO & Founder",
    bio:
      "20+ years of experience in IT infrastructure, cloud computing, and AI-driven project execution. " +
      "Extensive experience leading data center setups, cloud migrations, network configurations, and " +
      "enterprise deployments for large semiconductor manufacturing MNCs."
  },
  {
    name: "Parameswaran Cs",
    shortName: "Param",
    role: "Co-Founder",
    bio:
      "Senior telecom leader with 30+ years of experience specializing in AI-driven telecom solutions, " +
      "service delivery, and professional consulting."
  }
];

const STORY_ROTATE_MS = 7000;

const KCIRI_STORY_LINE =
  "Nyra Services signed its first MoU with KCIRI — Kumaraguru Centre for Industrial Research & Innovation — to drive Industry 4.0 and 5.0 across MSMEs.";

const SUCCESS_SLIDES = [
  {
    id: "kciri-1",
    kind: "photo",
    tag: "Partnership",
    title: "MOU signing with KCIRI",
    lines: [KCIRI_STORY_LINE],
    image: `${import.meta.env.BASE_URL}success-stories/kciri-mou-1.png`,
    imageAlt: "MOU signing with KCIRI — Nyra Services and Kumaraguru KCIRI partnership"
  },
  {
    id: "kciri-2",
    kind: "photo",
    tag: "Partnership",
    title: "MOU signing with KCIRI",
    lines: [KCIRI_STORY_LINE],
    image: `${import.meta.env.BASE_URL}success-stories/kciri-mou-2.png`,
    imageAlt: "Working session at KCIRI after MOU signing"
  },
  {
    id: "kciri-3",
    kind: "photo",
    tag: "Partnership",
    title: "MOU signing with KCIRI",
    lines: [KCIRI_STORY_LINE],
    image: `${import.meta.env.BASE_URL}success-stories/kciri-mou-3.png`,
    imageAlt: "Collaboration meeting at Kumaraguru KCIRI"
  },
  {
    id: "indopure",
    kind: "photo",
    tag: "Customer story",
    organization: "Indopure",
    organizationFull: "Activated Carbon Manufacturing",
    headline: "Transforming Manufacturing Data into Customer Confidence",
    highlights: [
      "One MES — raw material to dispatch",
      "Real-time production visibility",
      "Quality traceability",
      "Digital Customer Portal"
    ],
    tagline: "Nyra Services. Tuning Data to Decisions.",
    rating: 5,
    captionOnMedia: true,
    imageFit: "contain",
    image: `${import.meta.env.BASE_URL}success-stories/indopure-feedback.png`,
    imageAlt:
      "Indopure customer feedback — Transforming Manufacturing Data into Customer Confidence"
  }
];

function StarRating({ count = 5 }) {
  return (
    <div className="landing-story-stars" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="landing-story-star" aria-hidden="true">
          ★
        </span>
      ))}
    </div>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  const { authEnabled, isAuthenticated, loading: authLoading, user } = useAuth();
  const { selectIndustryContext, loading: contextLoading } = useAppContext();
  const [selecting, setSelecting] = useState(null);
  const [selectError, setSelectError] = useState("");
  const [messageSent, setMessageSent] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [activeStorySlide, setActiveStorySlide] = useState(0);
  const hostBinding = resolveAppHostBinding();

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStorySlide((index) => (index + 1) % SUCCESS_SLIDES.length);
    }, STORY_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, []);

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

    if (authLoading) return;

    const tenantScope = resolveScopedTenantForIndustry(industryKey, user);

    if (authEnabled) {
      navigate("/login", {
        state: {
          from: selection.landing_path,
          industry: industryKey,
          tenant_code: tenantScope.tenant_code,
          workspace_code: tenantScope.workspace_code,
          fromLanding: true
        }
      });
      return;
    }

    if (isAuthenticated && !userCanAccessIndustry(industryKey, user)) {
      setSelectError(
        `Signed in as ${user?.tenant_code || "unknown tenant"} — opening ${selection.name} with the demo workspace.`
      );
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

  const handleMessageSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const organisation = String(data.get("organisation") || "").trim();
    const message = String(data.get("message") || "").trim();

    if (!name) {
      setMessageError("Please enter your name.");
      return;
    }
    if (!email) {
      setMessageError("Please enter your email address.");
      return;
    }
    if (message.length < 10) {
      setMessageError("Please enter at least 10 characters in your message.");
      return;
    }

    setMessageSending(true);
    setMessageError("");
    setMessageSent(false);

    try {
      await submitContactEnquiry({
        name,
        email,
        organisation: organisation || undefined,
        message
      });
      setMessageSent(true);
      form.reset();
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setMessageError(
        formatContactApiError(detail) ||
          (typeof detail === "string" ? detail : null) ||
          error?.message ||
          "Could not send your message. Please email us directly."
      );
    } finally {
      setMessageSending(false);
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
          <nav className="landing-nav" aria-label="Page sections">
            <a href="#about-us">About</a>
            <a href="#success-stories">Success stories</a>
            <a href="#contact-us">Contact</a>
          </nav>
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
            <div className="landing-left-stack">
              <section className="landing-hero landing-hero--compact">
                <div className="landing-eyebrow landing-eyebrow--compact">
                  ONTOLOGY-DRIVEN · WORKFLOW INTELLIGENCE · FEASIBILITY · TRACEABILITY · ASK NYRA
                </div>

                <h1 className="landing-title landing-title--compact">
                  A Manufacturing Knowledge System, not a Form-based ERP
                </h1>

                <p className="landing-text landing-text--compact">
                  Nyra connects every stage of manufacturing — Customer Order → Production Order →
                  Lot Split → Routing → Feasibility → Scheduling → Execution → Inspection → Dispatch
                  — into one ontology-driven workflow.
                </p>

                <div className="landing-pills landing-pills--compact">
                  <span className="landing-pill">Workflow Intelligence</span>
                  <span className="landing-pill">Feasibility Reasoning</span>
                  <span className="landing-pill">Genealogy &amp; Traceability</span>
                  <span className="landing-pill">Ask Nyra · AI Ready</span>
                </div>
              </section>

              <section id="success-stories" className="landing-stories-inline">
                <div className="landing-stories-inline-head">
                  <div className="landing-section-eyebrow">SUCCESS STORIES</div>
                </div>

                <div className="landing-story-carousel landing-story-carousel--compact" aria-live="polite">
                  <div className="landing-story-carousel-track">
                    {SUCCESS_SLIDES.map((slide, index) => (
                      <article
                        key={slide.id}
                        className={
                          "landing-story-slide" +
                          (index === activeStorySlide ? " landing-story-slide--active" : "") +
                          (slide.imageFit === "contain" ? " landing-story-slide--contain" : "") +
                          (slide.captionOnMedia ? " landing-story-slide--caption-left" : "")
                        }
                        aria-hidden={index !== activeStorySlide}
                      >
                        <div className="landing-story-slide-media">
                          <img
                            src={slide.image}
                            alt={slide.imageAlt}
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.classList.add("landing-story-photo--missing");
                            }}
                          />
                          {slide.captionOnMedia ? (
                            <div className="landing-story-media-caption">
                              {slide.headline ? (
                                <h3 className="landing-story-headline landing-story-headline--caption">
                                  {slide.headline}
                                </h3>
                              ) : null}
                              {slide.highlights ? (
                                <div className="landing-story-caption-lines">
                                  {slide.highlights.map((item) => (
                                    <p key={item} className="landing-story-caption-line">
                                      {item}
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                              {slide.tagline ? (
                                <p className="landing-story-tagline landing-story-tagline--caption">
                                  {slide.tagline}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <div className="landing-story-slide-content">
                          <span className="landing-story-tag">{slide.tag}</span>

                          {slide.kind === "testimonial" ? (
                            <>
                              <div className="landing-story-customer">{slide.customer}</div>
                              <StarRating count={slide.rating} />
                              <h3 className="landing-story-headline">{slide.headline}</h3>
                              <p className="landing-story-body">{slide.body}</p>
                              <p className="landing-story-tagline">{slide.tagline}</p>
                            </>
                          ) : (
                            <>
                              {slide.organization ? (
                                <div className="landing-story-org">
                                  <span className="landing-story-org-name">{slide.organization}</span>
                                  {slide.organizationFull ? (
                                    <span className="landing-story-org-full">{slide.organizationFull}</span>
                                  ) : null}
                                </div>
                              ) : null}
                              {slide.rating ? <StarRating count={slide.rating} /> : null}
                              {!slide.captionOnMedia && slide.headline ? (
                                <h3 className="landing-story-headline landing-story-headline--compact">
                                  {slide.headline}
                                </h3>
                              ) : null}
                              {!slide.captionOnMedia && !slide.headline && slide.title ? (
                                <h3 className="landing-story-title">{slide.title}</h3>
                              ) : null}
                              {!slide.captionOnMedia && slide.highlights ? (
                                <ul className="landing-story-highlights">
                                  {slide.highlights.map((item) => (
                                    <li key={item} className="landing-story-highlight">
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              ) : !slide.captionOnMedia && slide.lines ? (
                                <div className="landing-story-lines">
                                  {slide.lines.map((line, lineIndex) => (
                                    <p key={lineIndex} className="landing-story-line">
                                      {line}
                                    </p>
                                  ))}
                                </div>
                              ) : !slide.captionOnMedia ? (
                                <p className="landing-story-body">{slide.body}</p>
                              ) : null}
                              {!slide.captionOnMedia && slide.tagline ? (
                                <p className="landing-story-tagline">{slide.tagline}</p>
                              ) : null}
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="landing-story-carousel-controls">
                    <button
                      type="button"
                      className="landing-story-nav"
                      aria-label="Previous success story"
                      onClick={() =>
                        setActiveStorySlide(
                          (activeStorySlide - 1 + SUCCESS_SLIDES.length) % SUCCESS_SLIDES.length
                        )
                      }
                    >
                      ‹
                    </button>

                    <div className="landing-story-dots" role="tablist" aria-label="Success stories">
                      {SUCCESS_SLIDES.map((slide, index) => (
                        <button
                          key={slide.id}
                          type="button"
                          role="tab"
                          aria-selected={index === activeStorySlide}
                          aria-label={`Show story ${index + 1} of ${SUCCESS_SLIDES.length}`}
                          className={
                            "landing-story-dot" +
                            (index === activeStorySlide ? " landing-story-dot--active" : "")
                          }
                          onClick={() => setActiveStorySlide(index)}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      className="landing-story-nav"
                      aria-label="Next success story"
                      onClick={() =>
                        setActiveStorySlide((activeStorySlide + 1) % SUCCESS_SLIDES.length)
                      }
                    >
                      ›
                    </button>
                  </div>
                </div>
              </section>
            </div>

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
                    disabled={Boolean(selecting) || contextLoading || authLoading}
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
                        : authLoading
                          ? "Checking session…"
                        : authEnabled && !isAuthenticated
                          ? "Sign in to open →"
                          : authEnabled
                            ? "Sign in to open →"
                          : "Open dashboard →"}
                    </span>
                  </button>
                ))}

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

          <section id="about-us" className="landing-section landing-about">
            <div className="landing-section-head">
              <div className="landing-section-eyebrow">ABOUT US</div>
              <h2 className="landing-section-title">Nyra Services leadership</h2>
              <p className="landing-section-lead">
                Building ontology-driven manufacturing workflow intelligence for MSMEs and
                enterprise plants — from cloud infrastructure to shop-floor adoption.
              </p>
            </div>

            <div className="landing-about-grid">
              {TEAM.map((member) => (
                <article key={member.name} className="landing-about-card">
                  <div className="landing-about-avatar" aria-hidden="true">
                    {member.shortName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="landing-about-name">{member.name}</h3>
                    <div className="landing-about-role">{member.role}</div>
                    <p className="landing-about-bio">{member.bio}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="contact-us" className="landing-section landing-contact">
            <div className="landing-contact-grid">
              <div className="landing-contact-info">
                <div className="landing-section-eyebrow">CONTACT US</div>
                <h2 className="landing-section-title">Reach us</h2>
                <p className="landing-section-lead">
                  Interested in a demo, partnership, or deploying Nyra on your plant? We would
                  love to hear from you.
                </p>
                <a className="landing-contact-email" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>
              </div>

              <div className="landing-message-card">
                <h3 className="landing-message-title">Leave a message</h3>
                <p className="landing-message-hint">
                  Share a few details and we will get back to you.
                </p>

                {messageSent ? (
                  <div className="landing-message-success" role="status">
                    Thank you — your message has been sent. We will get back to you soon.
                    You can also reach us directly at{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                  </div>
                ) : null}

                {messageError ? (
                  <div className="landing-message-error" role="alert">
                    {messageError}{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                  </div>
                ) : null}

                <form className="landing-message-form" onSubmit={handleMessageSubmit}>
                  <label className="landing-field">
                    <span>Name</span>
                    <input
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Your name"
                      required
                    />
                  </label>
                  <label className="landing-field">
                    <span>Email</span>
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      required
                    />
                  </label>
                  <label className="landing-field">
                    <span>Organisation</span>
                    <input
                      name="organisation"
                      type="text"
                      autoComplete="organization"
                      placeholder="Your company or organisation"
                    />
                  </label>
                  <label className="landing-field">
                    <span>Message</span>
                    <textarea
                      name="message"
                      rows={5}
                      minLength={10}
                      placeholder="Tell us about your plant, use case, or partnership interest…"
                      required
                      aria-describedby="landing-message-min-hint"
                    />
                    <span id="landing-message-min-hint" className="landing-field-hint">
                      Please enter at least 10 characters.
                    </span>
                  </label>
                  <button
                    type="submit"
                    className="landing-message-submit"
                    disabled={messageSending}
                  >
                    {messageSending ? "Sending…" : "Send message"}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Nyra Services</span>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </footer>
    </div>
  );
}

export default LandingPage;
