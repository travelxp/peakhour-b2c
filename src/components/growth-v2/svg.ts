/** Small helpers for the hand-drawn SVG charts in this folder. */

/** A linear scale from [d0, d1] to [r0, r1]. A zero-width domain maps to the range's start. */
export const scale = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

/** "M x,y L x,y ..." for a run of points. */
export const linePath = (pts: ReadonlyArray<readonly [number, number]>): string =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

/** The next "round" number at or above `v`: 1, 2, 5 or 10 times a power of ten. */
export function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/**
 * A top and ticks that land on round numbers: a step of 1, 2, 2.5, 5 or 10 times
 * a power of ten, giving three to five intervals.
 */
export function niceScale(max: number): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const p = 10 ** Math.floor(Math.log10(max / 3));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => max / s <= 5) ?? 10 * p;
  const top = Math.ceil(max / step - 1e-9) * step;
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

/** Evenly spaced tick values from 0 to `max` inclusive. */
export const ticks = (max: number, count = 3): number[] => Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
