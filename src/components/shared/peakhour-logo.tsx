import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  BRAND_MARK_SHAPES,
  BRAND_NAME,
  BRAND_WORD_SHAPES,
  LOCKUP_VIEWBOX,
  WORDMARK_VIEWBOX,
  type BrandShape,
} from "@/lib/brand-artwork";

/**
 * The ONLY way to show the Peakhour brand. The owner made it non-negotiable on 2026-11-15:
 * wherever the logo or the name stands as a brand (a header, a footer, an avatar, a hub, a share image),
 * it is the official artwork from src/lib/brand-artwork.ts. It is never an icon someone drew, and never
 * the name set in a font. `brand-guard.test.ts` enforces this.
 *
 *   PeakhourLogo      the lockup: mark + "Peakhour.ai". The default everywhere.
 *   PeakhourWordmark  the letters alone, ONLY beside a `PeakhourMark` (so the mark is not drawn twice).
 *   PeakhourMark      the solid-disc mark, for square slots: an avatar, a collapsed rail, a channel tile.
 *
 * The lockup and wordmark are inline SVG filled with `currentColor`, so they take the text colour of
 * wherever they sit: ink on Daylight, white on an ink band, the theme's foreground in the app. No
 * `dark:invert`, and no blurry PNG at large sizes.
 */

function Shapes({ shapes }: { shapes: readonly BrandShape[] }) {
  return shapes.map((s, i) => ("d" in s ? <path key={i} d={s.d} /> : <polygon key={i} points={s.points} />));
}

type ArtProps = {
  className?: string;
  /** Set when the artwork is not the only thing naming the brand, so a screen reader does not hear it twice. */
  decorative?: boolean;
};

function a11y(decorative: boolean | undefined) {
  return decorative ? ({ "aria-hidden": true } as const) : ({ role: "img", "aria-label": BRAND_NAME } as const);
}

export function PeakhourLogo({ className = "h-8 w-auto", decorative }: ArtProps) {
  return (
    <svg viewBox={LOCKUP_VIEWBOX} fill="currentColor" focusable="false" className={cn("shrink-0", className)} {...a11y(decorative)}>
      <Shapes shapes={BRAND_MARK_SHAPES} />
      <Shapes shapes={BRAND_WORD_SHAPES} />
    </svg>
  );
}

export function PeakhourWordmark({ className = "h-5 w-auto", decorative }: ArtProps) {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} fill="currentColor" focusable="false" className={cn("shrink-0", className)} {...a11y(decorative)}>
      <Shapes shapes={BRAND_WORD_SHAPES} />
    </svg>
  );
}

/**
 * The solid-disc cut of the mark (public/peakhour-icon.svg).
 *
 * It is a separate asset, not the lockup's outline mark scaled down. The outline strokes are legible
 * inside a lockup but become a grey smudge alone in a 32px box; the disc survives that size.
 *
 * No `dark:invert`: the disc is high-contrast on light and dark grounds as drawn, and inverting it reads
 * as a photo negative.
 */
export function PeakhourMark({ className = "size-8" }: { className?: string }) {
  return (
    <Image
      src="/peakhour-icon.svg"
      alt=""
      aria-hidden
      width={2000}
      height={2000}
      className={className}
      priority
      unoptimized
    />
  );
}
