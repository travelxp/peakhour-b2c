import { PILLARS, type PillarSlug } from "@/lib/pillars";

/**
 * Presentational metadata for the pricing surface — the bits marketing tunes
 * without a DB write (order, one-line promise, which channels a pillar runs in,
 * the upgrade hook). It layers ON TOP of the live catalog: prices, tiers,
 * features and Peaks allowances all come from the pricing API — never from here.
 *
 * Pillar identity (icon, name, lede) is reused from `@/lib/pillars` so the
 * pricing pages and the pillar marketing pages can never drift apart.
 */

/** Pricing shows the FREE pillar first (the on-ramp), then the paid pillars.
 *  This deliberately differs from PILLAR_ORDER (which leads with Commerce). */
export const PRICING_PILLAR_ORDER = [
  "presence",
  "commerce",
  "content",
  "support",
  "growth",
] as const;

/** The paid pillars, in the order the hub lists them under "add as you grow". */
export const PAID_PILLAR_ORDER: PillarSlug[] = [
  "commerce",
  "content",
  "support",
  "growth",
];

export interface PricingPillarMeta {
  slug: PillarSlug;
  /** One plain sentence a browsing buyer instantly gets. */
  promise: string;
  /** The single reason to move from Free to Paid. */
  upgradeHook: string;
  /** Channels this pillar runs inside (keys into CHANNELS). */
  /**
   * Renamed off `channels` deliberately. pricingPillar() spreads this meta
   * OVER PillarContent, which has a `channels` of its own — the marketing
   * chips, a different shape entirely — and the spread silently resolved the
   * collision in this object's favour. Two shapes under one name, merged
   * without a word from the compiler, is a trap; the names are distinct now.
   */
  runsIn: ChannelKey[];
}

export const PRICING_PILLARS: Record<PillarSlug, PricingPillarMeta> = {
  presence: {
    slug: "presence",
    promise: "Get found on Google, Maps and AI search — and keep every listing right.",
    upgradeHook: "Go Pro for multiple locations and competitor insights.",
    runsIn: ["native"],
  },
  commerce: {
    slug: "commerce",
    promise: "An AI shop assistant that answers buyers from your real catalog — 24/7.",
    upgradeHook: "Upgrade for more stores, human handoff and analytics.",
    runsIn: ["shopify", "woocommerce", "bigcommerce"],
  },
  content: {
    slug: "content",
    promise: "AI content for social, blog and newsletters — drafted in your voice, on schedule.",
    upgradeHook: "Upgrade for scheduling, newsletters and brand-voice training.",
    runsIn: ["wordpress", "native"],
  },
  support: {
    slug: "support",
    promise: "Every support message — email, chat, WhatsApp, DMs — in one inbox.",
    upgradeHook: "Upgrade for WhatsApp, social DMs and auto-routing.",
    runsIn: ["native", "whatsapp"],
  },
  growth: {
    slug: "growth",
    promise: "Ads and LinkedIn on autopilot — campaigns, audiences and leads, handled.",
    upgradeHook: "Upgrade for the full optimizer and lead inbox.",
    runsIn: ["native"],
  },
};

/**
 * Merge the pricing meta with the shared pillar identity (icon, name, lede).
 *
 * The result carries BOTH `runsIn` (this file's platform list, what the
 * pricing pages want) and `channels` (PillarContent's marketing chips, which
 * they don't). Reach for `runsIn` here.
 */
export function pricingPillar(slug: PillarSlug) {
  return { ...PILLARS[slug], ...PRICING_PILLARS[slug] };
}

export function isPillarSlug(value: string): value is PillarSlug {
  return value in PRICING_PILLARS;
}

/* ── Channels ──────────────────────────────────────────────────────────── */

export type ChannelKey =
  | "shopify"
  | "woocommerce"
  | "wordpress"
  | "bigcommerce"
  | "magento"
  | "whatsapp"
  | "native";

export interface ChannelMeta {
  key: ChannelKey;
  name: string;
  /**
   * Two-letter tile mark. Fallback only — channels with a real brand mark
   * render it instead (see components/marketing/pricing/channel-tile.tsx).
   */
  tag: string;
  /** Brand color for the tile. */
  color: string;
  /** Plain sentence: what running Peakhour here gets you. */
  blurb: string;
  /** Where billing happens for this channel. */
  billed: string;
  /** Pillars that run inside this channel. */
  pillars: PillarSlug[];
  /** Primary link for the channel's card. */
  href: string;
}

const SHOPIFY_APP_STORE_URL =
  process.env.NEXT_PUBLIC_SHOPIFY_APP_STORE_URL ?? "https://apps.shopify.com/";

export const CHANNELS: Record<ChannelKey, ChannelMeta> = {
  shopify: {
    key: "shopify",
    name: "Shopify App",
    tag: "Sh",
    color: "#5E8E3E",
    blurb: "Install from the Shopify App Store — your assistant is live in minutes.",
    billed: "Billed through Shopify",
    pillars: ["commerce"],
    href: SHOPIFY_APP_STORE_URL,
  },
  wordpress: {
    key: "wordpress",
    name: "WordPress Plugin",
    tag: "WP",
    color: "#21759B",
    blurb: "Publish AI content straight into your site — no copy-paste.",
    billed: "Billed on peakhour.ai",
    pillars: ["content", "commerce"],
    href: "/content",
  },
  woocommerce: {
    key: "woocommerce",
    name: "WooCommerce",
    tag: "Wo",
    // Woo's current brand purple — matches the supplied official mark.
    color: "#873EFF",
    blurb: "Connect your WooCommerce catalog to the shop assistant.",
    billed: "Billed on peakhour.ai",
    pillars: ["commerce"],
    href: "/commerce",
  },
  bigcommerce: {
    key: "bigcommerce",
    name: "BigCommerce",
    tag: "BC",
    color: "#121118",
    blurb: "Bring your BigCommerce products into catalog-grounded answers.",
    billed: "Billed on peakhour.ai",
    pillars: ["commerce"],
    href: "/commerce",
  },
  magento: {
    key: "magento",
    name: "Magento",
    tag: "Ma",
    color: "#EE672F",
    blurb: "Adobe Commerce / Magento catalog connector.",
    billed: "Billed on peakhour.ai",
    pillars: ["commerce"],
    href: "/commerce",
  },
  whatsapp: {
    key: "whatsapp",
    name: "WhatsApp",
    tag: "Wa",
    color: "#25D366",
    blurb: "Answer shoppers and support requests right on WhatsApp.",
    billed: "Billed on peakhour.ai",
    pillars: ["support", "commerce"],
    href: "/support",
  },
  native: {
    key: "native",
    name: "Peakhour web app",
    tag: "Ph",
    color: "#d97a06",
    blurb: "Every pillar works in the Peakhour dashboard out of the box.",
    billed: "Billed on peakhour.ai",
    pillars: ["presence", "content", "support", "commerce", "growth"],
    href: "/auth",
  },
};

/** Channels featured on the hub's "works where you run" strip, in order. */
export const FEATURED_CHANNELS: ChannelKey[] = [
  "shopify",
  "wordpress",
  "woocommerce",
  "whatsapp",
];
