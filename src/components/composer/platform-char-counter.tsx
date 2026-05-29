"use client";

/**
 * <PlatformCharCounter/> — circular-gauge character counter for any
 * composer surface. Mirrors the native-X / Typefully visual: a small
 * SVG ring that fills as the user types, transitions green → amber at
 * `warnAt`, and red past `maxChars`. When the ring goes red, the
 * primitive also shows the negative overage as a number to the right
 * of the ring (X's signature pattern).
 *
 * Controlled component — caller passes `value` (current text length OR
 * the text itself) and the `platform` discriminant. No state is kept
 * inside; re-renders are O(string-length) cheap.
 *
 * Note (per types.ts header comment): the X counter is intentionally a
 * simplification — real X collapses URLs to 23 chars regardless of
 * length and weights some emojis double. PR #4 (X composer rewrite)
 * swaps in twitter-text for full parity. Foundation ships the simple
 * counter so the X composer can replace it in-place via the same
 * `<PlatformCharCounter/>` shape, just with a custom `count` prop.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  PLATFORM_LIMITS,
  type PlatformKey,
  type PlatformLimits,
} from "./types";

export interface PlatformCharCounterProps {
  /** Either the composer text (we'll `.length` it) or a precomputed
   *  count from a platform-specific tokeniser (X composer's
   *  twitter-text-aware count, etc.). Accepting both keeps the shape
   *  the same for every host. */
  value: string | number;
  /** Platform discriminant — picks the right `PlatformLimits`. */
  platform: PlatformKey;
  /** Optional override — bypasses `PLATFORM_LIMITS[platform]`. Use
   *  when a per-org config (e.g. a stricter newsletter cap) needs to
   *  apply. */
  limits?: PlatformLimits;
  /** Visual size variant. `sm` = 20px ring (toolbar use), `md` = 32px
   *  ring (composer footer). Default md. */
  size?: "sm" | "md";
  /** Show the raw "N / max" label next to the ring. Default true on
   *  md, false on sm. */
  showCount?: boolean;
  className?: string;
}

export function PlatformCharCounter({
  value,
  platform,
  limits,
  size = "md",
  showCount,
  className,
}: PlatformCharCounterProps) {
  const effectiveLimits = limits ?? PLATFORM_LIMITS[platform];
  const count = typeof value === "number" ? value : value.length;
  const showCountResolved = showCount ?? size === "md";

  const { ringPct, tone, overage } = useMemo(() => {
    const pct = Math.min(1, count / effectiveLimits.maxChars);
    const over = Math.max(0, count - effectiveLimits.maxChars);
    let t: "ok" | "warn" | "danger" = "ok";
    if (over > 0) t = "danger";
    else if (pct >= effectiveLimits.warnAt) t = "warn";
    return { ringPct: pct, tone: t, overage: over };
  }, [count, effectiveLimits]);

  // Ring geometry — calculated once per render. SVG circumference
  // drives the stroke-dasharray trick that fills the ring as pct grows.
  const dim = size === "sm" ? 20 : 32;
  const stroke = size === "sm" ? 2 : 3;
  const radius = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (1 - ringPct);

  // Token colors — read from the existing OKLCH theme tokens so the
  // ring matches the rest of the app's chrome (works in dark mode
  // without per-component overrides).
  const ringColor =
    tone === "danger"
      ? "stroke-destructive"
      : tone === "warn"
      ? "stroke-amber-500"
      : "stroke-emerald-500";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-xs tabular-nums",
        className,
      )}
      role="status"
      aria-label={`${count} of ${effectiveLimits.maxChars} characters used for ${effectiveLimits.label}`}
    >
      <svg
        width={dim}
        height={dim}
        viewBox={`0 0 ${dim} ${dim}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        {/* Progress ring — animate both the fill (stroke-dashoffset)
            and the colour (stroke) so the green→amber→red transition
            crossfades smoothly instead of snapping. motion-reduce
            override respects the user's OS-level preference. */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dash}
          className={cn(
            "transition-[stroke-dashoffset,stroke] duration-150",
            "motion-reduce:transition-none",
            ringColor,
          )}
        />
      </svg>
      {showCountResolved && (
        <span
          className={cn(
            tone === "danger"
              ? "text-destructive font-semibold"
              : tone === "warn"
              ? "text-amber-700 dark:text-amber-400"
              : "text-muted-foreground",
          )}
        >
          {tone === "danger" ? `−${overage}` : `${count} / ${effectiveLimits.maxChars}`}
        </span>
      )}
    </div>
  );
}
