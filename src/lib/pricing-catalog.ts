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
  /**
   * Channels this pillar runs inside (keys into CHANNELS).
   *
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
    // WhatsApp belongs here: it is the one commerce channel the catalog calls
    // live today, and leaving it out made the page say "answers shoppers on
    // WhatsApp" in the lede while the pill below read "Coming to Shopify,
    // WooCommerce, BigCommerce". Keep this in step with PILLARS.commerce
    // .channels in lib/pillars.ts — they are two hand-kept lists describing
    // the same product, and nothing but this comment ties them together.
    runsIn: ["shopify", "woocommerce", "whatsapp", "bigcommerce"],
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
 * PillarContent's own `channels` — the homepage's marketing chips — is
 * dropped rather than carried through. Nothing here wants it, and leaving it
 * on the result would put a `PillarChannel[]` under a name the pricing pages
 * used to read as `ChannelKey[]`: it still compiles in `.length` and `.map()`
 * positions, so the trap survives the rename unless the field does not.
 * `runsIn` is the platform list these pages want.
 */
export function pricingPillar(slug: PillarSlug) {
  const { channels, ...identity } = PILLARS[slug];
  // Referenced only so the omission is explicit: this `channels` is the
  // HOMEPAGE's marketing chips, not this file's platform list.
  void channels;
  return { ...identity, ...PRICING_PILLARS[slug] };
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
  | "whatsapp"
  | "native";

export interface ChannelMeta {
  key: ChannelKey;
  /**
   * The /v1/platform/catalog key that vouches for this channel, when one
   * exists. Same contract as PillarChannel.key on the homepage: with a key
   * the pricing surfaces resolve the channel through the SAME rule the
   * integrations grid and the pillar chips use, so one connector cannot read
   * as installable here and "Coming soon" there.
   *
   * Omitted only for `native` — the Peakhour web app is not a connector, it
   * is where everything already runs.
   *
   * A key the catalog does not carry fails CLOSED, which is the point:
   * BigCommerce has no row anywhere and now says so.
   */
  connectorKey?: string;
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
  /** Primary link for the channel's card. */
  href: string;
}

const SHOPIFY_APP_STORE_URL =
  process.env.NEXT_PUBLIC_SHOPIFY_APP_STORE_URL ?? "https://apps.shopify.com/";

export const CHANNELS: Record<ChannelKey, ChannelMeta> = {
  shopify: {
    key: "shopify",
    connectorKey: "shopify",
    name: "Shopify App",
    tag: "Sh",
    color: "#5E8E3E",
    // A value proposition, not an instruction. "Install from the Shopify App
    // Store" is a step a visitor cannot take while the connector is still
    // coming_soon, and it sat directly under the chip saying so.
    blurb: "Your catalog-grounded assistant, answering shoppers on your storefront.",
    billed: "Billed through Shopify",
    href: SHOPIFY_APP_STORE_URL,
  },
  wordpress: {
    key: "wordpress",
    connectorKey: "wordpress",
    name: "WordPress Plugin",
    tag: "WP",
    color: "#21759B",
    blurb: "Publish AI content straight into your site — no copy-paste.",
    billed: "Billed on peakhour.ai",
    href: "/content",
  },
  woocommerce: {
    key: "woocommerce",
    // One WordPress plugin covers both, and WooCommerce has no catalog row of
    // its own — so its availability IS the wordpress connector's. Same alias
    // the homepage chip uses.
    connectorKey: "wordpress",
    name: "WooCommerce",
    tag: "Wo",
    // Woo's current brand purple — matches the supplied official mark.
    color: "#873EFF",
    blurb: "Connect your WooCommerce catalog to the shop assistant.",
    billed: "Billed on peakhour.ai",
    href: "/commerce",
  },
  bigcommerce: {
    key: "bigcommerce",
    // Deliberately a key nothing publishes. There is no BigCommerce connector
    // in the catalog, in the Channels Hub registry, or in the api's provider
    // list — so this resolves through the fail-closed branch and the card
    // says "Coming soon" instead of quietly reading as installable.
    connectorKey: "bigcommerce",
    name: "BigCommerce",
    tag: "BC",
    color: "#121118",
    blurb: "Bring your BigCommerce products into catalog-grounded answers.",
    billed: "Billed on peakhour.ai",
    href: "/commerce",
  },
  whatsapp: {
    key: "whatsapp",
    connectorKey: "whatsapp",
    name: "WhatsApp",
    tag: "Wa",
    color: "#25D366",
    blurb: "Answer shoppers and support requests right on WhatsApp.",
    billed: "Billed on peakhour.ai",
    href: "/support",
  },
  native: {
    key: "native",
    // No connectorKey: the web app is where the pillars run, not something
    // connected to. Always available, never badged.
    name: "Peakhour web app",
    tag: "Ph",
    color: "#d97a06",
    blurb: "Every pillar works in the Peakhour dashboard out of the box.",
    billed: "Billed on peakhour.ai",
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
