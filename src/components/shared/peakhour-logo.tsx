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
