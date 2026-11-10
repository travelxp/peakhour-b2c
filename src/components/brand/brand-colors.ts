import type { CSSProperties } from "react";

/**
 * The ONE place a hard-coded colour may live in app code (enforced by
 * src/lib/no-hardcoded-colours.test.ts). Everything else uses the semantic
 * tokens in globals.css so light/dark and theming cannot drift.
 *
 * What belongs here: colours owned by a third party that must match their
 * mark (channel/brand tiles), and the Open Graph card palette (satori renders
 * outside the DOM, so it cannot resolve CSS variables).
 *
 * These are inline-style values, not Tailwind classes: a dynamic class name
 * is invisible to Tailwind's scanner, and a per-brand literal would put a
 * hex back into every consumer.
 */
export const BRAND_COLORS = {
  linkedin: "#0A66C2",
  meta: "#0668E1",
  facebook: "#1877F2",
  instagram: "#E4405F",
  whatsapp: "#25D366",
  google: "#4285F4",
  googleAnalytics: "#E37400",
  googleSearchConsole: "#458CF7",
  googleBusinessProfile: "#34A853",
  youtube: "#FF0000",
  beehiiv: "#FFD100",
  substack: "#FF6719",
  mailchimp: "#FFE01B",
  kit: "#FB6970",
  shopify: "#96BF48",
  wordpress: "#21759B",
  woocommerce: "#873EFF",
  ghost: "#15171A",
  x: "#000000",
  tiktok: "#000000",
  slack: "#4A154B",
  discord: "#5865F2",
  telegram: "#26A5E4",
  teams: "#6264A7",
} as const;

export type BrandName = keyof typeof BRAND_COLORS;

const LIGHT_FG = "#FFFFFF";
const DARK_FG = "#000000";

/** Brand tile: the mark's own background with a legible glyph colour. */
export function brandTileStyle(brand: BrandName, fg: "light" | "dark" = "light"): CSSProperties {
  return { backgroundColor: BRAND_COLORS[brand], color: fg === "dark" ? DARK_FG : LIGHT_FG };
}

/** Peakhour's Open Graph card. satori cannot read CSS variables, so the
 *  values mirror the brand tokens in globals.css (gold, ink, paper). */
export const OG_IMAGE = {
  gold: "#F0A821",
  ink: "#0B0A08",
  paper: "#F7F4EC",
  muted: "#B9B2A2",
} as const;
