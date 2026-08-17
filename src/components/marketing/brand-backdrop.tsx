import { cn } from "@/lib/utils";

/**
 * The ambient layer behind a marketing band: two very soft gold mesh blooms
 * and a set of concentric ridges lifted from the Peakhour mark, which is a
 * fingerprint of contour lines around a peak.
 *
 * Deliberately faint. The palette is ivory / black / one gold accent, and the
 * job here is to stop a full-width band reading as a flat rectangle — not to
 * add a fourth colour. Anything strong enough to notice on its own is too
 * strong.
 *
 * The host needs `relative isolate`: `isolate` gives it a stacking context so
 * this layer's negative z-index stays behind the band's content instead of
 * disappearing behind the page.
 */
export function BrandBackdrop({
  className,
  /** Mirror the ridges to the left edge — for bands that alternate. */
  flip = false,
}: {
  className?: string;
  flip?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      {/* Mesh. `closest-side` keeps each bloom circular whatever the band's
          aspect ratio, and blur-3xl removes the last of the banding. */}
      <div
        className={cn(
          "absolute -top-40 size-[38rem] rounded-full opacity-70 blur-3xl",
          flip ? "-right-40" : "-left-40",
        )}
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 16%, transparent), transparent)",
        }}
      />
      <div
        className={cn(
          "absolute -bottom-48 size-[30rem] rounded-full opacity-60 blur-3xl",
          flip ? "-left-32" : "-right-32",
        )}
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--brand-strong) 11%, transparent), transparent)",
        }}
      />

      {/* Ridges. Anchored off-canvas so only the outer arcs cross the band —
          a complete set of rings would read as a logo watermark. */}
      <svg
        viewBox="0 0 400 400"
        className={cn(
          "absolute -top-24 h-[34rem] w-[34rem] opacity-[0.35]",
          flip ? "-left-40 scale-x-[-1]" : "-right-40",
        )}
        focusable="false"
      >
        <g fill="none" stroke="var(--brand)" strokeLinecap="round">
          <circle cx="330" cy="120" r="70" strokeWidth="1.1" opacity="0.5" />
          <circle cx="330" cy="120" r="105" strokeWidth="1" opacity="0.4" strokeDasharray="6 10" />
          <circle cx="330" cy="120" r="145" strokeWidth="1" opacity="0.3" strokeDasharray="3 12" />
          <circle cx="330" cy="120" r="190" strokeWidth="1" opacity="0.2" strokeDasharray="2 14" />
        </g>
      </svg>
    </div>
  );
}
