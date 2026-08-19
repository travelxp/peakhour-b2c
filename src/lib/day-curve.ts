/**
 * The day curve on /peaks — and nothing else.
 *
 * ── WHAT THIS FILE USED TO BE, AND WHY IT ISN'T ───────────────────────────
 *
 * It shipped three generative "brand artwork" systems in a row: faint contour
 * rings, loud contour rings, then a layered ridgeline. All three were rejected
 * on sight, and the diagnosis is not that the parameters were wrong. It is
 * that procedurally drawn canvas art reads as programmer art, because that is
 * exactly what it is.
 *
 * The case for it was production economics — one generator, infinite assets,
 * no designer in the loop. That is a real argument, and it is not an argument
 * about whether the result looks good. Trading the second for the first was
 * the mistake, and generating MORE carefully was never going to undo it.
 *
 * What survives is the one drawing that was never decoration: a chart. The
 * shape of a day's demand is information, it is the thing /peaks exists to
 * explain, and a clean area chart is a form with a century of precedent rather
 * than something invented here. Everything else is gone.
 *
 * ── The one rule ──────────────────────────────────────────────────────────
 *
 * Pure drawing — no DOM, no sizing, no animation, no React. The client
 * component owns the element and the device-pixel-ratio transform.
 */

/**
 * A day's demand, 24 values 0–100, midnight first: quiet overnight, a
 * lunchtime lift, the real peak between six and ten.
 *
 * ★ILLUSTRATIVE. Any caller showing it to a customer must say so on the page.
 */
export const TYPICAL_DAY = [
  6, 4, 3, 2, 2, 3, 7, 14, 22, 28, 31, 36, 44, 41, 38, 42, 52, 63, 78, 96, 100, 88, 54, 22,
];

/**
 * The demand curve as a clean area chart.
 *
 * Deliberately plain: one series, one line, one fill, four labels and a marked
 * peak. The version this replaced stacked three noise-perturbed ranges with a
 * glow pass on each, which turned a legible curve into scenery — and scenery
 * is what got this whole file rewritten.
 *
 * A monotone cubic would be the textbook interpolation here; with 24 evenly
 * spaced points and no requirement to avoid overshoot between them, cosine
 * easing is indistinguishable at this size and a tenth of the code.
 */
export function dayCurve(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { day?: number[]; rgb?: string } = {},
): void {
  const day = opts.day ?? TYPICAL_DAY;
  const rgb = opts.rgb ?? "255,201,79";
  const AXIS = 24; // room for the hour labels
  const PAD_TOP = 14; // so the peak dot is never clipped
  const plotH = Math.max(1, h - AXIS - PAD_TOP);

  ctx.clearRect(0, 0, w, h);

  const yAt = (value: number) => PAD_TOP + plotH - (value / 100) * plotH;
  const sample = (t: number) => {
    const x = Math.max(0, Math.min(0.9999, t)) * (day.length - 1);
    const i = Math.floor(x);
    const f = x - i;
    const smooth = (1 - Math.cos(f * Math.PI)) / 2;
    return day[i] + (day[Math.min(day.length - 1, i + 1)] - day[i]) * smooth;
  };

  // Baseline, so the fill has something to sit on rather than bleeding out.
  ctx.strokeStyle = "rgba(246,241,231,.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, PAD_TOP + plotH);
  ctx.lineTo(w, PAD_TOP + plotH);
  ctx.stroke();

  const STEP = 2;
  const trace = () => {
    for (let x = 0; x <= w; x += STEP) {
      const y = yAt(sample(x / w));
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };

  ctx.beginPath();
  ctx.moveTo(0, PAD_TOP + plotH);
  trace();
  ctx.lineTo(w, PAD_TOP + plotH);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, PAD_TOP, 0, PAD_TOP + plotH);
  fill.addColorStop(0, `rgba(${rgb},0.28)`);
  fill.addColorStop(1, `rgba(${rgb},0.02)`);
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  trace();
  ctx.strokeStyle = `rgb(${rgb})`;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  // The peak, which is the whole point of the page.
  let peak = 0;
  for (let i = 0; i < day.length; i++) if (day[i] > day[peak]) peak = i;
  const px = (peak / (day.length - 1)) * w;
  const py = yAt(day[peak]);
  ctx.strokeStyle = `rgba(${rgb},0.35)`;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, PAD_TOP + plotH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(px, py, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${rgb})`;
  ctx.fill();

  // Four marks, not twenty-four: the shape is the message and a full ruler
  // only competes with it.
  ctx.fillStyle = "rgba(167,156,139,.85)";
  ctx.font = "500 10px ui-monospace, monospace";
  ctx.textAlign = "center";
  for (const [text, hour] of [
    ["12am", 0],
    ["6am", 6],
    ["12pm", 12],
    ["6pm", 18],
    ["11pm", 23],
  ] as const) {
    const x = (hour / (day.length - 1)) * w;
    ctx.fillText(text, Math.min(w - 16, Math.max(16, x)), h - 7);
  }
}
