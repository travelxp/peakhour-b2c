import Image from "next/image";
import { PILLAR_ORDER, PILLARS } from "@/lib/pillars";

/**
 * The hero figure: Peakhour at the centre, the five pillars orbiting it, every
 * pillar wired back to the hub AND to its neighbours.
 *
 * It replaced the "pillar console" fake-dashboard panel, and the swap is the
 * point — a screenshot of a product nobody has used yet argues nothing, while
 * this states the one thing the page is actually selling: five jobs, one brain.
 * (The console still ships on /auth, where a visitor has already bought the
 * argument and wants to see the product.)
 *
 * Geometry lives in TS rather than in a hand-drawn SVG so the diagram is
 * derived from PILLAR_ORDER — reorder the pillars, or add one, and the node
 * positions, the spokes and the pillar-to-pillar ring all follow.
 *
 * The lines are SVG on a 0–100 viewBox and the nodes are real HTML positioned
 * in the same coordinate space. That split is deliberate: it keeps the pillar
 * names and their value lines as selectable text a screen reader can read,
 * scaled by the container query below rather than baked into a raster.
 *
 * Deliberately static. globals.css states the house rule — motion means change
 * — and a hero diagram that spins forever is the ambient movement that rule
 * exists to prevent.
 */

/** Centre → node distance, in % of the (square) container. */
const RADIUS = 34;
/** Radius of the centre disc, same units — spokes start just outside it. */
const HUB_RADIUS = 13.5;
/** Node card width, in % of the container. Cards are centred on their point. */
const NODE_WIDTH = 30;

const NODES = PILLAR_ORDER.map((slug, i) => {
  // Start at 12 o'clock and step a fifth of the circle each time. -90° puts
  // the first pillar at the top; SVG's y axis grows downward, which is why sin
  // is ADDED rather than subtracted.
  const angle = ((-90 + i * (360 / PILLAR_ORDER.length)) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    slug,
    x: 50 + RADIUS * cos,
    y: 50 + RADIUS * sin,
    // Spoke endpoints: from the rim of the hub to just short of the node card,
    // so neither end of the line disappears under a surface.
    x1: 50 + (HUB_RADIUS + 1.5) * cos,
    y1: 50 + (HUB_RADIUS + 1.5) * sin,
    x2: 50 + (RADIUS - 7) * cos,
    y2: 50 + (RADIUS - 7) * sin,
  };
});

const RING_POINTS = NODES.map((n) => `${n.x.toFixed(2)},${n.y.toFixed(2)}`).join(" ");

export function PillarOrbit() {
  return (
    // `@container` (not a breakpoint) drives the label sizes below: this figure
    // sits in a hero column whose width does not track the viewport's, so the
    // only honest input is the figure's own width.
    <div className="@container mx-auto w-full max-w-[27rem] min-w-0">
      <div className="relative aspect-square w-full">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 size-full"
          aria-hidden
          focusable="false"
        >
          {/* Fingerprint rings — the Peakhour mark is a set of concentric
              contours, so the hub sits inside an echo of its own logo. Dashed
              on the outer two so it reads as a ridge pattern, not a target. */}
          <g fill="none" stroke="var(--brand)" strokeLinecap="round">
            <circle cx="50" cy="50" r="19" strokeWidth="0.35" opacity="0.22" />
            <circle
              cx="50"
              cy="50"
              r="24.5"
              strokeWidth="0.3"
              opacity="0.16"
              strokeDasharray="1.6 3.2"
            />
            <circle
              cx="50"
              cy="50"
              r="30"
              strokeWidth="0.3"
              opacity="0.1"
              strokeDasharray="0.8 4"
            />
          </g>

          {/* Pillar-to-pillar ring: the "they're connected to each other" half
              of the claim. Drawn before the spokes so the spokes read as the
              stronger relationship. */}
          <polygon
            points={RING_POINTS}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="0.4"
            strokeLinejoin="round"
            opacity="0.3"
          />

          {/* Hub-to-pillar spokes. */}
          <g stroke="var(--brand)" strokeWidth="0.5" strokeLinecap="round" opacity="0.45">
            {NODES.map((n) => (
              <line key={n.slug} x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} />
            ))}
          </g>
        </svg>

        {/* Centre — the hub. A light disc so the gold ring and the black mark
            keep the ivory/black/gold palette rather than introducing a fourth
            surface colour. */}
        <div
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-[3%] rounded-full border border-brand/35 bg-background shadow-lg shadow-brand/10"
          style={{ width: `${HUB_RADIUS * 2}%`, height: `${HUB_RADIUS * 2}%` }}
        >
          {/* `alt=""` already marks the mark decorative — the pillar names
              below are the content. `dark:invert` because the artwork is black
              contours on transparent. */}
          <Image
            src="/peakhour-icon.svg"
            alt=""
            width={64}
            height={64}
            className="w-[42%] dark:invert"
            unoptimized
            // Hero-visible: without this next/image emits loading="lazy" and
            // the centre of the figure arrives after everything around it.
            priority
          />
          <span
            className="font-extrabold leading-none tracking-tight"
            style={{ fontSize: "clamp(0.62rem, 2.9cqw, 0.85rem)" }}
          >
            Peakhour
          </span>
        </div>

        {/* Nodes. A list, not decoration — this is the only place on the page
            that says what each pillar does in three words.

            The list box covers the whole figure, hub included, so it has to
            pass pointer events through: otherwise it swallows the cursor over
            the centre disc and the wordmark there stops being selectable. */}
        <ul className="pointer-events-none absolute inset-0">
          {NODES.map((n) => {
            const pillar = PILLARS[n.slug];
            const Icon = pillar.icon;
            return (
              <li
                key={n.slug}
                className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[0.35rem] rounded-xl border bg-background px-2 py-2 text-center shadow-sm"
                style={{ left: `${n.x}%`, top: `${n.y}%`, width: `${NODE_WIDTH}%` }}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-brand-gradient">
                  <Icon className="size-3.5 text-brand-contrast" strokeWidth={2.25} aria-hidden />
                </span>
                <span
                  className="font-bold leading-tight tracking-tight"
                  style={{ fontSize: "clamp(0.68rem, 2.9cqw, 0.86rem)" }}
                >
                  {pillar.name}
                </span>
                <span
                  className="text-balance leading-tight text-muted-foreground"
                  style={{ fontSize: "clamp(0.58rem, 2.5cqw, 0.74rem)" }}
                >
                  {pillar.hubLine}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
