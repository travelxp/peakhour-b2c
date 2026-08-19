/**
 * Peakhour's generative artwork — "topographic instruments".
 *
 * The brand mark is a set of contour lines around a summit, the product is
 * named for the busiest hour of the day, and the currency is called Peaks.
 * That is a complete visual language, and until now the site drew none of it:
 * the landing page rendered zero images, every pixel on it type, a Lucide icon
 * or a CSS gradient.
 *
 * So every image here is a READING OF A BUSINESS DRAWN AS TERRAIN, from one
 * seeded generator. Feed it a name and it draws that business's map — the same
 * input always yields the same picture, so a tenant's artwork is stable and
 * ownable, and a new asset costs a function call rather than a designer.
 *
 * ── Why canvas and not SVG ────────────────────────────────────────────────
 *
 * These are hundreds of smoothly perturbed closed loops. As SVG that is a wall
 * of hand-authored path data nobody can review; as canvas it is the twenty
 * lines below that produced it. Nothing here is interactive or needs to be in
 * the accessibility tree — every caller marks its canvas `aria-hidden`.
 *
 * ── The one rule ──────────────────────────────────────────────────────────
 *
 * Pure drawing. No DOM lookups, no sizing, no animation loop, no React. The
 * client component owns the element and the device-pixel-ratio transform (see
 * `terrain-canvas.tsx`); this file only ever paints into a context it is
 * handed. That split is what lets the same functions render to an offscreen
 * canvas in a future OG-image route with no changes.
 */

/** Deterministic hash → [0,1). Not cryptographic; it seeds pictures. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * Smooth value noise over t, PERIODIC in `period` samples.
 *
 * Periodicity is the load-bearing property: every ring below is a closed loop,
 * and noise that does not wrap leaves a visible seam where the loop rejoins
 * itself — a crease running out of every contour at the same angle, which
 * reads as a rendering fault rather than terrain.
 */
function noise(seed: number, t: number, period = 7): number {
  const x = (((t % 1) + 1) % 1) * period;
  const i = Math.floor(x);
  const f = x - i;
  const smooth = f * f * (3 - 2 * f);
  const a = hash(seed + (i % period));
  const b = hash(seed + ((i + 1) % period));
  return a + (b - a) * smooth;
}

/** A summit in a contour field. Coordinates are fractions of the canvas box. */
export interface Peak {
  x: number;
  y: number;
  /** Innermost ring radius, as a fraction of the box's shorter side. */
  r: number;
  seed: number;
}

export interface ContourFieldOptions {
  /** Stable seed — a business name hashed, a pillar slug, anything. */
  seed?: number;
  /** `"r,g,b"`. Defaults to the brand gold. */
  rgb?: string;
  /** How many rings per peak. */
  rings?: number;
  /** Gap between rings, as a fraction of the box's shorter side. */
  step?: number;
  /** How hard the noise deforms each ring. 0 draws circles. */
  amp?: number;
  /** Peak opacity of the innermost ring. */
  alpha?: number;
  /** Overall size multiplier. */
  scale?: number;
  /** Fill the innermost rings with a faint wash. */
  core?: boolean;
  peaks?: Peak[];
}

/**
 * A topographic bloom: nested, noise-perturbed closed loops around one or more
 * summits, fading outward.
 *
 * Two peaks by default rather than one, because a single set of concentric
 * rings reads as a target or a ripple. Real contour maps have shoulders.
 */
export function contourField(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: ContourFieldOptions = {},
): void {
  const seed = opts.seed ?? 3;
  const rgb = opts.rgb ?? "255,201,79";
  const rings = opts.rings ?? 26;
  const step = opts.step ?? 0.034;
  const amp = opts.amp ?? 0.3;
  const alpha = opts.alpha ?? 0.5;
  const scale = opts.scale ?? 1.9;
  const core = opts.core ?? true;
  const peaks = opts.peaks ?? [
    { x: 0.72, y: 0.34, r: 0.1, seed },
    { x: 0.3, y: 0.74, r: 0.06, seed: seed + 40 },
  ];

  const base = Math.min(w, h);
  ctx.clearRect(0, 0, w, h);

  for (const peak of peaks) {
    const cx = peak.x * w;
    const cy = peak.y * h;
    for (let i = 0; i < rings; i++) {
      const radius = (peak.r + i * step) * base * scale;
      // Stop once a ring has left the box entirely — every further ring is
      // strictly larger, so this is a break rather than a continue.
      if (radius > base * 2.6) break;

      const fade = Math.max(0, 1 - i / rings) * alpha;
      ctx.beginPath();
      const SEGMENTS = 128;
      for (let d = 0; d <= SEGMENTS; d++) {
        const theta = (d / SEGMENTS) * Math.PI * 2;
        // Outer rings deform more than inner ones: a summit is tidy, the
        // ground around it is not.
        const wobble =
          1 + (noise(peak.seed + i * 3.7, d / SEGMENTS, 6) - 0.5) * amp * (0.35 + i / rings);
        const x = cx + Math.cos(theta) * radius * wobble;
        // 0.88 flattens the rings slightly. Perfect circles read as a logo.
        const y = cy + Math.sin(theta) * radius * wobble * 0.88;
        if (d === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      if (core && i < 4) {
        ctx.fillStyle = `rgba(${rgb},${(0.055 * (4 - i)).toFixed(3)})`;
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(${rgb},${fade.toFixed(3)})`;
      // ★1px hairlines at 40% were the same mistake brand-backdrop.tsx makes
      // deliberately — correct behind a band of copy, wrong when the artwork
      // IS the picture. The innermost rings now carry real weight and the
      // outer ones stay fine, so the summit reads at a glance instead of
      // resolving only if you go looking for it.
      ctx.lineWidth = i < 2 ? 2.25 : i < 8 ? 1.5 : 1;
      ctx.stroke();
    }
  }
}

/**
 * A module mark: one summit in the module's own series colour, with a soft
 * bloom under it.
 *
 * Deliberately the same generator as the hero ground rather than a separate
 * illustration style — five marks that share a construction read as one
 * system, which is the entire argument for generating them.
 */
export function moduleMark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { seed: number; rgb: string },
): void {
  contourField(ctx, w, h, {
    seed: opts.seed,
    rgb: opts.rgb,
    rings: 18,
    step: 0.046,
    amp: 0.38,
    alpha: 0.78,
    scale: 0.95,
    core: false,
    peaks: [{ x: 0.5, y: 0.56, r: 0.05, seed: opts.seed }],
  });

  const bloom = ctx.createRadialGradient(w * 0.5, h * 0.56, 0, w * 0.5, h * 0.56, w * 0.38);
  bloom.addColorStop(0, `rgba(${opts.rgb},0.3)`);
  bloom.addColorStop(1, `rgba(${opts.rgb},0)`);
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, w, h);
}

/**
 * The Peak Hour dial — twenty-four hours around a circle, the gold arc
 * swelling where demand does.
 *
 * This is the brand's signature graphic and the one image only Peakhour can
 * own: the product is named for the busiest hour of the day, and this draws
 * it. A contour field says "terrain"; the dial says "peak hour" specifically.
 *
 * `demand` is 24 numbers, 0–100, midnight first. The caller supplies them, so
 * the same function serves a marketing illustration and — later, unchanged —
 * a tenant's real hourly data.
 */
export function peakDial(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { demand: number[]; label?: string; sublabel?: string },
): void {
  const { demand } = opts;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.4;
  const inner = R * 0.46;

  ctx.strokeStyle = "rgba(246,241,231,.13)";
  ctx.lineWidth = 1;
  for (const radius of [inner * 0.72, R * 1.13]) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // One spoke per hour, length proportional to demand. The busy hours get a
  // brighter tip and a thicker stroke, so the peak is legible as a SHAPE
  // before any label is read.
  let peakHour = 0;
  for (let i = 0; i < 24; i++) if (demand[i] > demand[peakHour]) peakHour = i;

  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const value = Math.max(0, Math.min(100, demand[i])) / 100;
    const tip = inner + (R - inner) * value;
    const busy = value > 0.7;
    const grad = ctx.createLinearGradient(
      cx + Math.cos(angle) * inner,
      cy + Math.sin(angle) * inner,
      cx + Math.cos(angle) * tip,
      cy + Math.sin(angle) * tip,
    );
    grad.addColorStop(0, "rgba(217,122,6,.55)");
    grad.addColorStop(1, busy ? "#FFC94F" : "rgba(240,168,33,.85)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = busy ? 7 : 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * tip, cy + Math.sin(angle) * tip);
    ctx.stroke();
  }

  // The arc over the busy window, drawn from the data rather than hardcoded so
  // it cannot disagree with the spokes beneath it.
  const busyHours = demand
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v > 70)
    .map(({ i }) => i);
  if (busyHours.length > 0) {
    const from = Math.min(...busyHours);
    const to = Math.max(...busyHours) + 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.13, (from / 24) * Math.PI * 2 - Math.PI / 2, (to / 24) * Math.PI * 2 - Math.PI / 2);
    ctx.strokeStyle = "#FFC94F";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  ctx.textAlign = "center";
  if (opts.label) {
    ctx.fillStyle = "#F6F1E7";
    ctx.font = "600 12px ui-monospace, monospace";
    ctx.fillText(opts.label, cx, cy - 4);
  }
  if (opts.sublabel) {
    ctx.fillStyle = "#FFC94F";
    ctx.font = "700 17px ui-monospace, monospace";
    ctx.fillText(opts.sublabel, cx, cy + 16);
  }
  ctx.fillStyle = "rgba(167,156,139,.85)";
  ctx.font = "500 10px ui-monospace, monospace";
  for (const [text, hour] of [["00", 0], ["06", 6], ["12", 12], ["18", 18]] as const) {
    const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
    ctx.fillText(text, cx + Math.cos(angle) * R * 1.34, cy + Math.sin(angle) * R * 1.34 + 3.5);
  }
}

/**
 * A stable seed from any string, so a business always gets its own map.
 *
 * djb2. The requirement is only that the same name yields the same picture and
 * different names usually differ — collisions produce a duplicate artwork, not
 * a bug.
 */
export function seedFrom(value: string): number {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return Math.abs(h % 100000);
}
