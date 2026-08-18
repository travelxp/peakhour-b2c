"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { HOW_IT_WORKS_STEPS } from "@/lib/how-it-works";

/**
 * "How Peakhour works" as three stops on ONE line rather than three cards that
 * happen to be next to each other. A gold path draws itself from step 1 to
 * step 3 as the section moves up the viewport, and each node lights when the
 * path reaches it — so the process reads as connected before a word of it is.
 *
 * Scroll-linked rather than a one-shot entrance: an entrance animation is over
 * before the visitor has read step 1, and the point here is that the steps
 * follow one another. CSS `animation-timeline: view()` would express exactly
 * this, but it is still Chromium-only, so the progress is computed here and
 * handed to CSS as a custom property.
 *
 * Cost control: the scroll handler writes `--tl` straight onto the DOM node
 * (no re-render per frame) and is coalesced into one rAF; React state changes
 * only when a node actually crosses its threshold, which happens three times
 * per page.
 */

/** Fraction of the drawn path at which each node switches on. */
const NODE_THRESHOLDS = [0.02, 0.46, 0.86];

export function StepTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  // How many nodes the path has reached. Only this drives re-renders.
  const [reached, setReached] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const setProgress = (p: number) => {
      el.style.setProperty("--tl", p.toFixed(4));
      const next = NODE_THRESHOLDS.filter((t) => p >= t).length;
      // Same-value setState bails out of the re-render, so calling this every
      // frame is free once the count has settled.
      setReached(next);
    };

    // A visitor who asked for less motion gets the finished path immediately —
    // and no listeners at all.
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setProgress(1);
      return;
    }

    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 0;
      // Starts when the top of the track passes 85% of the viewport height and
      // finishes when its bottom passes 65%. Expressed as a span so the two
      // ends stay monotonic whatever the track's own height turns out to be.
      const span = vh * 0.85 - vh * 0.65 + r.height;
      if (span <= 0) {
        setProgress(1);
        return;
      }
      const p = (vh * 0.85 - r.top) / span;
      setProgress(p < 0 ? 0 : p > 1 ? 1 : p);
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Vertical track (below lg). Sits on the centre line of the 3.5rem node
          column; `bottom-10` stops it inside the last step's body the way the
          /how-it-works spine does. */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-10 left-7 top-7 w-px overflow-hidden bg-linear-to-b from-brand/25 to-brand/5 lg:hidden"
      >
        {/* `var(--tl, 0)` — the fallback IS the initial state, which is why
            React never renders a `--tl` of its own: the effect owns that
            property, and a React-rendered style would be re-applied on every
            re-render and fight it. With JS off nothing sets it, the fallback
            holds, and the muted base track it sits inside still connects the
            three steps on its own. */}
        <span
          className="absolute inset-x-0 top-0 h-full origin-top bg-linear-to-b from-brand via-brand to-brand/40"
          style={{ transform: "scaleY(var(--tl, 0))" }}
        />
      </span>

      {/* Horizontal track (lg and up). The three steps are equal columns and
          the row carries NO column gap (see `lg:gap-x-0` below — the breathing
          room is padding inside each step instead), so the first and last node
          centres land at exactly 1/6 and 5/6 of the width. Reintroduce a gap
          and the line stops short of both end nodes. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-[16.6667%] right-[16.6667%] top-7 hidden h-px overflow-hidden bg-linear-to-r from-brand/25 via-brand/20 to-brand/5 lg:block"
      >
        <span
          className="absolute inset-y-0 left-0 w-full origin-left bg-linear-to-r from-brand via-brand to-brand/40"
          style={{ transform: "scaleX(var(--tl, 0))" }}
        />
      </span>

      <ol className="relative grid gap-8 lg:grid-cols-3 lg:gap-x-0">
        {HOW_IT_WORKS_STEPS.map((s, i) => {
          const lit = reached > i;
          return (
            <li
              key={s.step}
              className="grid grid-cols-[3.5rem_1fr] items-start gap-4 lg:flex lg:flex-col lg:items-center lg:gap-4 lg:px-4 lg:text-center"
            >
              <span
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center rounded-full border-2 font-serif text-xl italic transition-colors duration-500 ease-brand motion-reduce:transition-none",
                  lit
                    ? "border-transparent bg-brand-gradient text-brand-contrast shadow-lg shadow-brand/20"
                    : "border-brand/25 bg-background text-muted-foreground",
                )}
                // The <ol> already numbers these for a screen reader; "1" read
                // out before "1." is the same fact twice.
                aria-hidden
              >
                {s.step}
              </span>
              <div className="min-w-0 pt-1 lg:pt-0">
                <h3 className="text-lg font-bold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground lg:mx-auto lg:max-w-xs">
                  {s.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
