import type { CSSProperties } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { BRAND_NAME, LOCKUP_VIEWBOX, WORDMARK_VIEWBOX } from "@/lib/brand";

/**
 * The ONLY way to show the Peakhour brand. The owner made it non-negotiable on 2026-11-15:
 * wherever the logo or the name stands as a brand (a header, a footer, an avatar, a hub, a share image),
 * it is the official artwork (src/lib/brand-artwork.ts). It is never an icon someone drew, and never
 * the name set in a font. `brand-guard.test.ts` enforces this.
 *
 *   PeakhourLogo      the lockup: mark + "Peakhour.ai". The default everywhere.
 *   PeakhourWordmark  the letters alone, ONLY beside a `PeakhourMark` (so the mark is not drawn twice).
 *   PeakhourMark      the solid-disc mark, for square slots: an avatar, a collapsed rail, a channel tile.
 *
 * ★The lockup and wordmark are the official SVG files used as a CSS MASK over `currentColor`. They take the text
 * colour of wherever they sit (ink on Daylight, white on an ink band, the theme's foreground in the app), with no
 * `dark:invert`, crisp at any size, and NO path data in client JavaScript: inline paths copied 6.7 KB into four
 * client chunks and broke the bundle budget. Size them with a height (`h-8`); the width follows the artwork's
 * aspect ratio. `forced-color-adjust: none` keeps them visible in Windows high-contrast mode, which drops
 * background colours.
 */

const LOCKUP_SRC = "/brand/peakhour-lockup.svg";
const WORDMARK_SRC = "/brand/peakhour-wordmark.svg";

function ratio(viewBox: string) {
  const [, , w, h] = viewBox.split(" ").map(Number);
  return `${w} / ${h}`;
}

function masked(src: string, viewBox: string): CSSProperties {
  const url = `url(${src})`;
  return {
    aspectRatio: ratio(viewBox),
    maskImage: url,
    WebkitMaskImage: url,
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "left center",
    WebkitMaskPosition: "left center",
  };
}

type ArtProps = {
  className?: string;
  /** Set when the artwork is not the only thing naming the brand, so a screen reader does not hear it twice. */
  decorative?: boolean;
};

function a11y(decorative: boolean | undefined) {
  return decorative ? ({ "aria-hidden": true } as const) : ({ role: "img", "aria-label": BRAND_NAME } as const);
}

const ART = "inline-block shrink-0 bg-current forced-color-adjust-none";

export function PeakhourLogo({ className = "h-8 w-auto", decorative }: ArtProps) {
  return <span className={cn(ART, className)} style={masked(LOCKUP_SRC, LOCKUP_VIEWBOX)} {...a11y(decorative)} />;
}

export function PeakhourWordmark({ className = "h-5 w-auto", decorative }: ArtProps) {
  return <span className={cn(ART, className)} style={masked(WORDMARK_SRC, WORDMARK_VIEWBOX)} {...a11y(decorative)} />;
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
export function PeakhourMark({
  className = "size-8",
  priority = false,
}: {
  className?: string;
  /** Only where the mark is visible on first paint (the sidebar, a hero). Mock-ups below the fold leave it off. */
  priority?: boolean;
}) {
  return (
    <Image
      src="/peakhour-icon.svg"
      alt=""
      aria-hidden
      width={2000}
      height={2000}
      className={className}
      priority={priority}
      unoptimized
    />
  );
}
