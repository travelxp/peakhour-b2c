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

      if (core && i < 3) {
        ctx.fillStyle = `rgba(${rgb},${(0.05 * (3 - i)).toFixed(3)})`;
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(${rgb},${fade.toFixed(3)})`;
      ctx.lineWidth = i < 2 ? 1.5 : 1;
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
