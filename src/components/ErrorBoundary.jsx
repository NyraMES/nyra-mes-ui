import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Nyra MES UI error:", error, info);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            fontFamily: "Inter, system-ui, sans-serif",
            background: "#f1f5f9",
            color: "#0f172a"
          }}
        >
          <div style={{ maxWidth: "32rem", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
              Nyra MES encountered an error
            </h1>
            <p style={{ color: "#475569", marginBottom: "1rem", lineHeight: 1.5 }}>
              {this.state.error?.message ||
                "An unexpected error stopped the app from loading."}
            </p>
            <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              Try a hard refresh (Ctrl+Shift+R) or open this site in a private/incognito
              window. If the problem continues, contact your administrator.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "0.625rem 1.25rem",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
