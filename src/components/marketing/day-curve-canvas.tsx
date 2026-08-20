"use client";

import { useEffect, useRef } from "react";
import { dayCurve } from "@/lib/day-curve";
import { cn } from "@/lib/utils";

/**
 * Hosts the day curve and owns what the drawing function deliberately does
 * not: the element, its size, the device-pixel-ratio transform, and redrawing
 * when the box changes.
 *
 * Sizing is measured from the PARENT, never from the canvas. A canvas with a
 * CSS width but no CSS height takes its box height from the `height`
 * ATTRIBUTE — the very thing this rewrites on every draw — so reading the
 * canvas's own box would grow it by the pixel ratio on each pass until it
 * filled the page. The parent is sized by layout and cannot feed back.
 */
export function DayCurveCanvas({ className }: { className?: string }) {
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
      dayCurve(ctx, w, h);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn("relative", className)}>
      <canvas ref={ref} aria-hidden className="block h-full w-full" />
      <span className="sr-only">
        A chart of a typical business day from midnight to midnight, rising
        through the afternoon to a peak between 6 and 10 PM. Illustrative, not
        measured data.
      </span>
    </div>
  );
}
