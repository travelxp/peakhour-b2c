"use client";

import { cn } from "@/lib/utils";

/**
 * Animated conic-gradient ring used as an accent on locked UI.
 * Tailwind-only — no Framer Motion dep — but motion-safe via
 * `motion-reduce:animate-none`. The gradient revolves slowly (~8s);
 * hovering speeds it to 4s so the user gets a subtle response without
 * us shipping a JS animation library.
 *
 * Renders as a positioned overlay; the parent should be `position:
 * relative` and have a sensible `border-radius`. The ring sits as a
 * 1.5px outline over the parent's content via `inset-[-1.5px]`.
 */
interface GradientRingProps {
  className?: string;
  /** Speed up on hover. Defaults to true. */
  hoverAccelerate?: boolean;
}

export function GradientRing({ className, hoverAccelerate = true }: GradientRingProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-[-1.5px] rounded-[inherit]",
        "[background:conic-gradient(from_var(--ring-angle,0deg),#0A66C2_0deg,#7c3aed_120deg,#f59e0b_240deg,#0A66C2_360deg)]",
        "[mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)]",
        "[mask-composite:exclude] [-webkit-mask-composite:xor]",
        "p-[1.5px] motion-safe:animate-[gradient-ring-spin_8s_linear_infinite] motion-reduce:animate-none",
        hoverAccelerate
          ? "group-hover/gradient-ring:motion-safe:[animation-duration:4s]"
          : "",
        className,
      )}
    />
  );
}
