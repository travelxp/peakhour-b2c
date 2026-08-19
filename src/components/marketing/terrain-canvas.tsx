"use client";

import { useEffect, useRef } from "react";
import { peakRidge, peakRidgeChart, ridgeMark, type RidgeOptions } from "@/lib/terrain";
import { cn } from "@/lib/utils";

/**
 * Hosts a piece of `lib/terrain` artwork and owns everything the drawing
 * functions deliberately do not: the element, its size, the device-pixel-ratio
 * transform, and redrawing when the box changes.
 *
 * Sizing is measured from the PARENT, never from the canvas. A canvas with a
 * CSS width but no CSS height takes its box height from the `height`
 * ATTRIBUTE — the very thing this rewrites on every draw — so reading the
 * canvas's own box would grow it by the pixel ratio on each pass until it
 * filled the page. The parent is sized by layout and cannot feed back.
 *
 * Static by construction: it paints once per size. Nothing here animates, so
 * there is no reduced-motion branch — the moving layer on the hero is CSS,
 * which honours the preference on its own.
 */
export function TerrainCanvas({
  className,
  variant = "ridge",
  seed = 3,
  rgb,
  options,
}: {
  className?: string;
  /** `ridge` for scenery, `chart` for the labelled version, `mark` for a crest. */
  variant?: "ridge" | "chart" | "mark";
  seed?: number;
  rgb?: string;
  /** Extra knobs for `ridge`. The other two are fixed recipes. */
  options?: Omit<RidgeOptions, "seed" | "rgb">;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const draw = () => {
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      // Capped at 2: past that the pixel cost climbs and nothing about a soft
      // gold crest is sharper for it.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (variant === "mark") {
        ridgeMark(ctx, w, h, { seed, rgb: rgb ?? "255,201,79" });
      } else if (variant === "chart") {
        peakRidgeChart(ctx, w, h, { seed, rgb });
      } else {
        peakRidge(ctx, w, h, { ...options, seed, rgb });
      }
    };

    draw();

    // ResizeObserver rather than a window listener: the hero's box changes when
    // the copy above it rewraps, which no window resize event reports.
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [variant, seed, rgb, options]);

  return <canvas ref={ref} aria-hidden className={cn("block h-full w-full", className)} />;
}
