import { ImageResponse } from "next/og";
import { SITE } from "@/lib/utils";
import { OG_IMAGE } from "@/components/brand/brand-colors";
import { BRAND_MARK_SHAPES, BRAND_WORD_SHAPES, LOCKUP_VIEWBOX } from "@/lib/brand-artwork";
import { brandShapes } from "@/components/shared/brand-shapes";

// Shared social-share image for the marketing surface. Text-only + inline
// styles (Satori has no Tailwind and finicky gradient-text support), so we use
// a solid gold accent on a dark ground — reliable across renderers.
export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = OG_IMAGE.gold;
const INK = OG_IMAGE.ink;

/** The lockup 56px tall, its width from the view box so a new artwork cut cannot stretch it. */
const LOGO_HEIGHT = 56;
const [, , VB_W, VB_H] = LOCKUP_VIEWBOX.split(" ").map(Number);
const LOGO_WIDTH = Math.round((LOGO_HEIGHT * VB_W) / VB_H);

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `radial-gradient(1000px 500px at 80% -10%, rgba(240,168,33,0.18), transparent 60%), ${INK}`,
          color: OG_IMAGE.paper,
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* The official lockup (brand-artwork.ts) through the site's own renderer, never the name set in a font.
            ⚠️`brandShapes(...)` is CALLED, never rendered as a component: Satori throws "Only intrinsic elements
            are supported inside <svg>" on a function component there, and the share image would 500. */}
        <svg viewBox={LOCKUP_VIEWBOX} width={LOGO_WIDTH} height={LOGO_HEIGHT} fill={OG_IMAGE.paper}>
          {brandShapes(BRAND_MARK_SHAPES)}
          {brandShapes(BRAND_WORD_SHAPES)}
        </svg>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 900 }}>
            {SITE.tagline}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: OG_IMAGE.muted }}>
            Five modules. One platform. One plan.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: GOLD }}>
            Commerce · Content · Growth · Support · Presence
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
