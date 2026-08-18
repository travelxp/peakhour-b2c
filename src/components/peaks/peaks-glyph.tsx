import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * PeaksGlyph — the Peaks currency coin: the logo's stacked peaks rendered as a
 * double chevron on the Solar-amber gradient tile.
 *
 * The gradient + ink are INTENTIONALLY fixed (not theme tokens): Peaks is a
 * product-brand element that always carries the Solar-amber identity, even on
 * pages running another data-theme. Per the brand rule, the glyph is never
 * recolored. Size the coin with the `size` prop (px); the chevrons scale with it.
 */
const PEAKS_GRADIENT =
  "linear-gradient(135deg, oklch(0.86 0.13 88) 0%, oklch(0.77 0.146 67) 48%, oklch(0.64 0.16 48) 100%)";
const PEAKS_INK = "oklch(0.28 0.06 55)";

interface PeaksGlyphProps extends HTMLAttributes<HTMLSpanElement> {
  /** Coin size in px (tile width/height). Default 24. */
  size?: number;
}

export function PeaksGlyph({ size = 24, className, style, ...rest }: PeaksGlyphProps) {
  const inner = Math.round(size * 0.64);
  return (
    <span
      aria-hidden="true"
      className={cn("inline-grid shrink-0 place-items-center align-middle", className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(4, Math.round(size * 0.28)),
        background: PEAKS_GRADIENT,
        ...style,
      }}
      {...rest}
    >
      <svg
        width={inner}
        height={inner}
        viewBox="0 0 24 24"
        fill="none"
        stroke={PEAKS_INK}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12l7-6 7 6" />
        <path d="M5 18l7-6 7 6" />
      </svg>
    </span>
  );
}
