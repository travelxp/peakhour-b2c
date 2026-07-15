"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface LoadingScreenProps {
  /** Primary line, e.g. "Setting up your store…". */
  message?: string;
  /**
   * Optional reassurance lines cycled every ~2.2s under the primary message —
   * ideal for longer waits (verifying, provisioning) so the screen feels alive
   * and communicates progress instead of stalling on one static string.
   */
  steps?: string[];
  /**
   * `true` → fixed full-viewport overlay (blocks the page while a critical
   * async step runs). `false` (default) → fills its parent, for section-level
   * loading inside a card/page.
   */
  fullScreen?: boolean;
  className?: string;
}

/**
 * Shared loading screen — a branded dual-ring spinner with a message and
 * optional rotating sub-steps. Use anywhere the UI is doing async work
 * (fetching, parsing URL params, verifying a token, provisioning) so the user
 * never sees a blank screen. Accessible (role=status / aria-live) and
 * theme-aware via design tokens.
 */
export function LoadingScreen({
  message = "Loading…",
  steps,
  fullScreen = false,
  className,
}: LoadingScreenProps) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!steps || steps.length < 2) return;
    const id = setInterval(
      () => setIdx((n) => (n + 1) % steps.length),
      2200,
    );
    return () => clearInterval(id);
  }, [steps]);

  const sub = steps && steps.length > 0 ? steps[idx % steps.length] : undefined;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        fullScreen
          ? "fixed inset-0 z-50 bg-background/85 backdrop-blur-sm"
          : "relative w-full",
        "flex min-h-60 flex-col items-center justify-center gap-5 p-8 text-center",
        className,
      )}
    >
      {/* Dual-ring: a faint full track + a spinning brand arc, with a soft
          pulsing core. Reads as premium without a heavy dependency — only
          the built-in spin/pulse keyframes. */}
      <div className="relative flex size-14 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-4 border-muted" />
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" />
        <span className="size-2 animate-pulse rounded-full bg-primary" />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{message}</p>
        {sub ? (
          <p className="text-xs text-muted-foreground">{sub}</p>
        ) : null}
      </div>

      <span className="sr-only">{sub ? `${message} ${sub}` : message}</span>
    </div>
  );
}
