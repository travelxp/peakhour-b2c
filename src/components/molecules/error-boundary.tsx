"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorFallback } from "./error-fallback";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback. Receives the error and a reset callback; rendered in place of children on catch. */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
  /** Optional side effect on catch — e.g. log to Sentry, post a breadcrumb, fire a metric. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Primitive values (string/number) compared by `Object.is` between renders;
   *  any change resets the boundary. Useful for "auto-recover on navigation."
   *  Arrays/objects would create a fresh reference every render and reset
   *  loop forever — primitives only. */
  resetKeys?: ReadonlyArray<string | number | boolean | null | undefined>;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function resetKeysChanged(
  a: ErrorBoundaryProps["resetKeys"],
  b: ErrorBoundaryProps["resetKeys"],
): boolean {
  if (a === b) return false;
  if (!a || !b || a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return true;
  }
  return false;
}

/**
 * Class-based React error boundary for client subtrees that need isolation
 * INSIDE a page (e.g. a chart widget, an embedded iframe wrapper) — Next.js's
 * `error.tsx` files already wrap whole route segments, so use those for
 * page-level catches and reach for this only when you want one widget's
 * failure not to take down the rest of the screen.
 *
 * NOTE: only render-time and lifecycle errors are caught. Event handlers and
 * promise rejections still escape — handle those at the call site (try/catch
 * around async work, useMutation onError, etc.).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    // Surface to the browser console too — without this, a custom fallback
    // would silently swallow the stack and make production triage harder.
    console.error("[ErrorBoundary]", error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.error && resetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ error: null });
    }
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback({ error, reset: this.reset });
    return <ErrorFallback error={error} reset={this.reset} />;
  }
}
