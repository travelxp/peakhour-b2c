import Image from "next/image";

/**
 * PeakhourLogo — the official Peakhour.ai brand lockup (icon + capital-P
 * "Peakhour.ai" wordmark). Monochrome artwork on a transparent background,
 * inverted to white on dark surfaces via `dark:invert` so it stays legible
 * on light and dark. Self-hosted PNG (the only capital-P wordmark asset we
 * have; the old lowercase SVG wordmark it replaced has been removed).
 */
export function PeakhourLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/peakhour-logo.png"
      alt="Peakhour.ai"
      width={880}
      height={217}
      className={`${className} dark:invert`}
      priority
      unoptimized
    />
  );
}

/**
 * PeakhourMark — the icon half of the lockup on its own, for square slots the
 * wordmark cannot fit: the collapsed sidebar rail, a favicon-sized chip, an
 * avatar-shaped tile.
 *
 * A separate asset rather than a cropped `PeakhourLogo`, because the two are
 * genuinely different artwork. `peakhour-logo.png` draws the mark as OUTLINE
 * strokes on transparency — legible at 32px wide inside a 200px lockup, but a
 * grey smudge once it is the only thing in a 32px box. `peakhour-icon.svg` is
 * the solid-disc cut of the same mark (filled circle, knocked-out radar arcs),
 * which is what survives at rail size.
 *
 * It is also why this one does NOT take `dark:invert`. The lockup inverts
 * because it is black-on-transparent line art; inverting a solid disc turns a
 * black badge into a white one and the arcs inside it black — the mark reads
 * as a photo negative rather than a dark-mode variant. The disc is high
 * contrast on both grounds as drawn, so it is left alone.
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
