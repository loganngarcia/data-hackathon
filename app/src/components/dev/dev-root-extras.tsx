"use client";

import type { ErrorInfo, ReactNode } from "react";
import { Component, useEffect } from "react";

/**
 * Development-only: logs client-side failures with a searchable prefix so the
 * browser console shows where things broke (file/line when available).
 */
function useDevDiagnostics() {
  useEffect(() => {
    const tag = "[dev]";

    const onError = (event: ErrorEvent) => {
      const t = event.target;
      const isScript = t instanceof HTMLScriptElement;
      const isChunk =
        isScript &&
        typeof t.src === "string" &&
        (t.src.includes("/_next/") || t.src.includes("chunk"));

      console.error(`${tag} window error`, {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        stack: event.error instanceof Error ? event.error.stack : undefined,
        chunkLoadFailure: isChunk || undefined,
        scriptSrc: isScript ? t.src : undefined,
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      console.error(`${tag} unhandled rejection`, {
        reason,
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    console.info(
      `${tag} diagnostics on — chunk/script failures and uncaught errors will log here. If you see missing ./_next/ chunks, stop dev, run: rm -rf .next && npm run dev`,
    );

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
}

class DevErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[dev] React error boundary", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            margin: 16,
            padding: 16,
            borderRadius: 12,
            background: "color-mix(in srgb, red 12%, transparent)",
            fontFamily: "system-ui, sans-serif",
            fontSize: 14,
          }}
        >
          <strong>[dev] Render error</strong>
          <pre style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{this.state.error.message}</pre>
          <p style={{ marginTop: 8, opacity: 0.85 }}>Details were logged to the console.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function DevRootExtras({ children }: { children: ReactNode }) {
  useDevDiagnostics();
  return <DevErrorBoundary>{children}</DevErrorBoundary>;
}
