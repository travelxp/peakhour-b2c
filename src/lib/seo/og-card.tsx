import { ImageResponse } from "next/og";
import { OG_IMAGE } from "@/components/brand/brand-colors";
import { BRAND_MARK_SHAPES, BRAND_WORD_SHAPES, LOCKUP_VIEWBOX } from "@/lib/brand-artwork";
import { brandShapes } from "@/components/shared/brand-shapes";

/** Open Graph size: 1200 x 630. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/** The lockup 56px tall, its width from the view box so a new artwork cut cannot stretch it. */
const LOGO_HEIGHT = 56;
const [, , VB_W, VB_H] = LOCKUP_VIEWBOX.split(" ").map(Number);
const LOGO_WIDTH = Math.round((LOGO_HEIGHT * VB_W) / VB_H);

/** A page title is shown whole; a long one steps down a size rather than being cut. */
function titleSize(title: string): number {
  return title.length > 80 ? 52 : title.length > 52 ? 60 : 72;
}

/**
 * The share card, in Daylight: white ground with a warm tint, the official lockup (drawn through `brandShapes(...)`,
 * CALLED not rendered, because Satori rejects a function component inside <svg>), a coral accent bar and eyebrow, and
 * the title in ink. Inline styles only: Satori has no Tailwind. Fonts: Satori's built-in sans, nothing fetched.
 */
export function ogCard({ eyebrow, title, footer }: { eyebrow: string; title: string; footer?: string }): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `linear-gradient(180deg, ${OG_IMAGE.tint} 0%, ${OG_IMAGE.ground} 88%)`,
          color: OG_IMAGE.ink,
          padding: "64px 80px",
          fontFamily: "sans-serif",
          borderLeft: `16px solid ${OG_IMAGE.coral}`,
        }}
      >
        <svg viewBox={LOCKUP_VIEWBOX} width={LOGO_WIDTH} height={LOGO_HEIGHT} fill={OG_IMAGE.ink}>
          {brandShapes(BRAND_MARK_SHAPES)}
          {brandShapes(BRAND_WORD_SHAPES)}
        </svg>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: OG_IMAGE.coralInk }}>
            {eyebrow}
          </div>
          <div style={{ display: "flex", fontSize: titleSize(title), fontWeight: 800, lineHeight: 1.06, letterSpacing: -1.5, maxWidth: 1000 }}>
            {title}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 700, color: OG_IMAGE.muted }}>
          <div style={{ display: "flex", width: 44, height: 8, borderRadius: 4, background: OG_IMAGE.coral }} />
          {footer ?? "peakhour.ai"}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      // The URL carries no version, so a title change must reach a scraper within a day, not a year.
      headers: { "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800" },
    },
  );
}
