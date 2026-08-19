/**
 * Peakhour's generative artwork — a ridgeline.
 *
 * ── WHY THIS REPLACED THE CONTOUR RINGS ───────────────────────────────────
 *
 * The first cut drew noise-perturbed concentric rings, on the reasoning that
 * the brand mark is a contour map. It was wrong in practice: rings at uniform
 * radial spacing read as a RIPPLE or a target, not terrain — real contour maps
 * are irregular and nested at varying density — and thirty of them across a
 * hero is texture without meaning. It also failed the test the design
 * direction set for itself: abstract atmosphere can never be evidence, and it
 * had been promoted to the main event.
 *
 * A ridgeline does four things at once, which is why it earns the space:
 *
 *   • it is literally peaks — the mark, without illustrating it
 *   • it is literally peak hour — the product's name, drawn
 *   • its profile CARRIES DATA: the shape of a day's demand
 *   • it sits low in the frame, so it never competes with the copy above it
 *
 * And for cyclical hourly data it is simply the correct form. The dial this
 * replaces was a 24-spoke radial bar chart, where magnitude is distorted by
 * the area a spoke sweeps and "when am I busy" has to be read around a circle.
 *
 * ── The one rule ──────────────────────────────────────────────────────────
 *
 * Pure drawing. No DOM, no sizing, no animation, no React — the client
 * component owns the element and the device-pixel-ratio transform. That split
 * is what lets these same functions render to an offscreen canvas in an
 * OG-image route unchanged.
 */

/** Deterministic hash → [0,1). Not cryptographic; it seeds pictures. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

/** Smooth value noise over t. `period` samples per unit, cosine-eased. */
function noise(seed: number, t: number, period = 6): number {
  const x = t * period;
  const i = Math.floor(x);
  const f = x - i;
  const smooth = f * f * (3 - 2 * f);
  return hash(seed + i) + (hash(seed + i + 1) - hash(seed + i)) * smooth;
}

/**
 * A day's demand, 24 values 0–100, midnight first — the shape of a typical
 * Indian D2C evening: quiet overnight, a lunchtime lift, the real peak between
 * six and ten.
 *
 * ★ILLUSTRATIVE. Any caller that shows it to a customer must say so. It lives
 * here so the hero and /peaks draw the same day rather than two invented ones.
 */
export const TYPICAL_DAY = [
  6, 4, 3, 2, 2, 3, 7, 14, 22, 28, 31, 36, 44, 41, 38, 42, 52, 63, 78, 96, 100, 88, 54, 22,
];

/** Sample a 24-point series at any t ∈ [0,1], smoothly. */
function sampleDay(day: number[], t: number): number {
  const x = Math.max(0, Math.min(0.9999, t)) * (day.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  // Cosine easing between hours: demand is continuous, and linear segments
  // make a 24-point series look like a sawtooth at hero width.
  const smooth = (1 - Math.cos(f * Math.PI)) / 2;
  return day[i] + (day[Math.min(day.length - 1, i + 1)] - day[i]) * smooth;
}

export interface RidgeOptions {
  /** Stable seed — the back ranges are generated from it. */
  seed?: number;
  /** Accent colour as `"r,g,b"`. Defaults to the brand gold. */
  rgb?: string;
  /** How many ranges, back to front. 3–5 reads as depth; more reads as noise. */
  layers?: number;
  /** Where the FRONT ridge's baseline sits, as a fraction of height. */
  baseline?: number;
  /** Front ridge height, as a fraction of height. */
  amplitude?: number;
  /** Rim-light opacity on the front ridge. Back ranges fade from it. */
  alpha?: number;
  /**
   * The front range follows this 24-point series instead of noise. Pass it to
   * make the artwork carry the data; omit it for pure scenery.
   */
  day?: number[];
  /** Fill under each ridge. */
  fill?: boolean;
}

/**
 * A layered range of peaks, drawn back to front.
 *
 * Depth comes from three things moving together per layer: the baseline drops,
 * the amplitude grows, and the rim light brightens. Any one alone reads flat.
 */
export function peakRidge(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: RidgeOptions = {},
): void {
  const seed = opts.seed ?? 3;
  const rgb = opts.rgb ?? "255,201,79";
  const layers = opts.layers ?? 4;
  const baseline = opts.baseline ?? 0.96;
  const amplitude = opts.amplitude ?? 0.52;
  const alpha = opts.alpha ?? 0.85;
  const fill = opts.fill ?? true;

  ctx.clearRect(0, 0, w, h);

  for (let l = 0; l < layers; l++) {
    const depth = layers === 1 ? 1 : l / (layers - 1); // 0 = furthest, 1 = front
    const isFront = l === layers - 1;
    // Back ranges sit higher and smaller — the atmospheric cue, and the reason
    // a set of identical ridges never reads as distance.
    const base = h * (baseline - (1 - depth) * 0.2);
    const amp = h * amplitude * (0.42 + depth * 0.58);

    const profile = (t: number): number => {
      if (isFront && opts.day) {
        // The data drives the front range. A little noise keeps it from looking
        // like a chart that wandered into a picture.
        return sampleDay(opts.day, t) / 100 + (noise(seed + 91, t, 9) - 0.5) * 0.05;
      }
      // Generated ranges: three octaves, so peaks have shoulders rather than
      // being evenly spaced bumps.
      return (
        noise(seed + l * 37, t, 2.5 + l) * 0.62 +
        noise(seed + l * 37 + 11, t, 6 + l * 2) * 0.26 +
        noise(seed + l * 37 + 23, t, 13) * 0.12
      );
    };

    const STEP = 2;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += STEP) {
      ctx.lineTo(x, base - profile(x / w) * amp);
    }
    ctx.lineTo(w, h);
    ctx.closePath();

    if (fill) {
      // Each range is darker than the one behind it, so overlaps resolve as
      // silhouettes instead of mud.
      const g = ctx.createLinearGradient(0, base - amp, 0, h);
      g.addColorStop(0, `rgba(${rgb},${(0.1 * (1 - depth) + 0.03).toFixed(3)})`);
      g.addColorStop(0.35, "rgba(12,10,6,0.86)");
      g.addColorStop(1, "rgba(12,10,6,0.98)");
      ctx.fillStyle = g;
      ctx.fill();
    }

    // Rim light along the crest — the line that makes it a ridge, not a blob.
    ctx.beginPath();
    for (let x = 0; x <= w; x += STEP) {
      const y = base - profile(x / w) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${rgb},${(alpha * (0.22 + depth * 0.78)).toFixed(3)})`;
    ctx.lineWidth = isFront ? 2 : 1.25;
    ctx.stroke();
    if (isFront) {
      // One glow pass, on the front crest only. On every layer it becomes haze.
      ctx.shadowColor = `rgba(${rgb},0.9)`;
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
}

/**
 * The same range with an hour axis and the peak marked — the version that is a
 * CHART rather than scenery.
 *
 * A separate function rather than a flag on `peakRidge`: the labelled version
 * reserves room at the bottom, which changes the geometry of every layer above
 * it, and a boolean that silently reflows the whole drawing is worse than two
 * names.
 */
export function peakRidgeChart(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { day?: number[]; rgb?: string; seed?: number } = {},
): void {
  const day = opts.day ?? TYPICAL_DAY;
  const rgb = opts.rgb ?? "255,201,79";
  const AXIS = 26; // room for the hour labels
  const plotH = Math.max(1, h - AXIS);
  const BASELINE = 0.99;
  const AMPLITUDE = 0.78;

  peakRidge(ctx, w, plotH, {
    seed: opts.seed ?? 7,
    rgb,
    layers: 3,
    day,
    baseline: BASELINE,
    amplitude: AMPLITUDE,
    alpha: 0.95,
  });

  // Peak marker. The y here must be derived the same way the front ridge's is,
  // or the dot floats off the crest it is supposed to sit on.
  let peak = 0;
  for (let i = 0; i < day.length; i++) if (day[i] > day[peak]) peak = i;
  const px = (peak / (day.length - 1)) * w;
  const py = plotH * BASELINE - (day[peak] / 100) * plotH * AMPLITUDE;

  const column = ctx.createLinearGradient(0, py, 0, plotH);
  column.addColorStop(0, `rgba(${rgb},0.26)`);
  column.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = column;
  ctx.fillRect(px - 13, py, 26, plotH - py);

  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${rgb})`;
  ctx.shadowColor = `rgba(${rgb},0.9)`;
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Five marks, not twenty-four — the shape is the message, and a full ruler
  // under it only competes.
  ctx.fillStyle = "rgba(167,156,139,.9)";
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
    ctx.fillText(text, Math.min(w - 16, Math.max(16, x)), h - 8);
  }
}

/**
 * A module's mark: one peak, in that module's own colour.
 *
 * Same language as the hero at a fraction of the size — a single silhouette
 * reads at 40px where a whole range does not.
 */
export function ridgeMark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { seed: number; rgb: string },
): void {
  peakRidge(ctx, w, h, {
    seed: opts.seed,
    rgb: opts.rgb,
    layers: 2,
    baseline: 1.04,
    amplitude: 0.78,
    alpha: 0.95,
  });
}

/**
 * A stable seed from any string, so a business always gets its own range.
 *
 * djb2. The requirement is only that the same name yields the same picture and
 * different names usually differ — a collision is a duplicate artwork, not a
 * bug.
 */
export function seedFrom(value: string): number {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return Math.abs(h % 100000);
}
