"use client";

import type { ReactNode } from "react";

/**
 * Fades its children in on mount — for the skeleton→content (data-arrival)
 * transition. Complements the shell's pathname-keyed entrance: the skeleton
 * fades in on navigation, then the real content fades in when it loads.
 *
 * Mount is the trigger, so place it on the LOADED branch only (never around a
 * loading skeleton — the shell already animates that). It re-runs only when
 * the loaded subtree first mounts, not on subsequent in-page re-renders.
 *
 * Motion is GPU-only and disabled under prefers-reduced-motion (the
 * `ph-fade-in-up` rule in _styles/motion.css).
 */
export function FadeIn({ children }: { children: ReactNode }) {
  return <div className="ph-fade-in-up">{children}</div>;
}
