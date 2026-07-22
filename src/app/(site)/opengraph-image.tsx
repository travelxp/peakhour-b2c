import { ImageResponse } from "next/og";

// Shared social-share image for the marketing surface. Text-only + inline
// styles (Satori has no Tailwind and finicky gradient-text support), so we use
// a solid gold accent on a dark ground — reliable across renderers.
export const alt = "Peakhour.ai — The AI business platform for growing brands";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#f0a821";
const INK = "#0b0a08";

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
          color: "#f7f4ec",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 40, fontWeight: 800 }}>
          <span>Peakhour</span>
          <span style={{ color: GOLD }}>.ai</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 900 }}>
            The AI business platform for growing brands
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#b9b2a2" }}>
            Five pillars. One platform. A free plan on every one.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: GOLD }}>
            Commerce · Content · Growth · Support · Presence
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#b9b2a2" }}>
            No credit card
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
