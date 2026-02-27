"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ClientErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Client error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ padding: "2rem", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
          <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
            A client-side error occurred. Check the browser console for details.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--accent-soft)",
              color: "var(--accent)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Reload page
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
