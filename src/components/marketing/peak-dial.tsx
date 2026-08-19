"use client";

import { useEffect, useRef } from "react";
import { peakDial } from "@/lib/terrain";

/**
 * The Peak Hour dial — the brand's signature graphic, on the page that exists
 * to explain the currency named after it.
 *
 * ★THE DEMAND CURVE IS ILLUSTRATIVE AND MUST BE LABELLED AS SUCH BY THE
 * CALLER. It is the shape of a typical Indian D2C evening — quiet overnight,
 * a lunchtime lift, the real peak between six and ten — not any tenant's
 * measurements. `peakDial` takes the numbers as an argument precisely so the
 * same component can later render a real hourly series with no change to the
 * drawing; until it does, nothing here should imply it already does.
 */
const ILLUSTRATIVE_DEMAND = [
  6, 4, 3, 2, 2, 3, 7, 14, 22, 28, 31, 36, 44, 41, 38, 42, 52, 63, 78, 96, 100, 88, 54, 22,
];

export function PeakDial({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const draw = () => {
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      peakDial(ctx, w, h, {
        demand: ILLUSTRATIVE_DEMAND,
        label: "PEAK",
        sublabel: "6–10 PM",
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={className}>
      <canvas ref={ref} aria-hidden className="block h-full w-full" />
      <span className="sr-only">
        A 24-hour dial showing when a typical business is busiest, peaking
        between 6 and 10 PM. Illustrative, not measured data.
      </span>
    </div>
  );
}
