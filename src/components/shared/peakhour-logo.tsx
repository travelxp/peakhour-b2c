import Image from "next/image";

/**
 * PeakhourLogo — the official Peakhour.ai wordmark (the SVG already reads
 * "Peakhour.ai", capital P). Swaps black/white by color scheme so it stays
 * legible on light and dark surfaces. Self-hosted SVG, rendered unoptimized
 * (vector — Next's raster optimizer would only add overhead).
 */
export function PeakhourLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <>
      <Image
        src="/logo-black.svg"
        alt="Peakhour.ai"
        width={130}
        height={32}
        className={`${className} block dark:hidden`}
        priority
        unoptimized
      />
      <Image
        src="/logo-white.svg"
        alt="Peakhour.ai"
        width={130}
        height={32}
        className={`${className} hidden dark:block`}
        unoptimized
      />
    </>
  );
}
