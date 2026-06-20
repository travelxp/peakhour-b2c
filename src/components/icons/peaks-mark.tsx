import type { SVGProps } from "react";

/**
 * PeaksMark — the Peakhour "Peaks" currency glyph (the two-peak mountain mark
 * used for the Peaks balance and brand lockup in the design system; see
 * design-system/Peakhour-Themes.html).
 *
 * Fills with `currentColor` so it inherits text color — wrap it in an amber
 * tile (`bg-[var(--brand)]` + `text-[var(--brand-ink)]`) for the branded chip
 * look, or color it directly via a text utility. Size it with className
 * (e.g. `size-4`); the viewBox keeps the two peaks crisp at any scale.
 */
export function PeaksMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 14 12"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M7 0l4 7H3l4-7zM2.5 12l2.2-4 1.3 2.3L8 12H2.5z" />
    </svg>
  );
}
