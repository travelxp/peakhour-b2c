import { PILLARS, type PillarSlug } from "@/lib/pillars";
import { pillarProducts, productBundleTier, type PricingResponse } from "@/lib/pricing";

/**
 * Presentational metadata for the pricing surface — the bits marketing tunes
 * without a DB write: the order the hub lists the modules in and the one-line
 * promise each one makes, plus the channels the hub's strip names (below).
 *
 * It layers ON TOP of the live catalog: prices, plans and Peaks allowances all
 * come from the pricing API — never from here.
 *
 * ★ONE CATALOG (billing plan D19, P4.7). The per-module plans (each a Free and
 * a Pro tier) are scrapped: Peakhour Suite sells all five modules, Agency and
 * Enterprise sell them to teams, and there is no free tier. What this file held
 * for the per-module pricing pages (their headlines, the Free and Pro card
 * bullets, the "what changes on Pro" blocks) went with those pages.
 *
 * Pillar identity (icon, name, lede) is reused from `@/lib/pillars` so the
 * pricing pages and the pillar marketing pages can never drift apart.
 */

/** The order the hub lists the modules Peakhour Suite includes. Presence leads
 *  as the simplest promise; this deliberately differs from PILLAR_ORDER
 *  (which leads with Commerce). */
export const PRICING_PILLAR_ORDER = [
  "presence",
  "commerce",
  "content",
  "support",
  "growth",
] as const;

export interface PricingPillarMeta {
  slug: PillarSlug;
  /** One plain sentence a browsing buyer instantly gets. */
  promise: string;
}

export const PRICING_PILLARS: Record<PillarSlug, PricingPillarMeta> = {
  presence: {
    slug: "presence",
    promise: "Get found on Google, Maps and AI search — and keep every listing right.",
  },
  commerce: {
    slug: "commerce",
    promise: "An AI shop assistant that answers buyers from your real catalog — 24/7.",
  },
  content: {
    slug: "content",
    promise: "AI content for social, blog and newsletters — drafted in your voice, on schedule.",
  },
  support: {
    slug: "support",
    promise: "Every support message — email, chat, WhatsApp, DMs — in one inbox.",
  },
  growth: {
    slug: "growth",
    promise: "Ads and LinkedIn on autopilot — campaigns, audiences and leads, handled.",
  },
};

/**
 * Merge the pricing meta with the shared pillar identity (icon, name, lede).
 *
 * PillarContent's own `channels` — the homepage's marketing chips — is
 * dropped rather than carried through: nothing here wants it.
 */
export function pricingPillar(slug: PillarSlug) {
  const { channels, ...identity } = PILLARS[slug];
  // Referenced only so the omission is explicit: this `channels` is the
  // HOMEPAGE's marketing chips.
  void channels;
  return { ...identity, ...PRICING_PILLARS[slug] };
}

/**
 * The modules Peakhour Suite includes AND this site renders, in hub order.
 *
 * ★ASKED OF EACH PRODUCT (`productBundleTier`), NOT OF THE STATIC ORDER. The
 * resolver groups a plan under every product its `products[]` composes, so
 * Suite's presence in a product's tiers IS the statement "Suite includes this
 * module"; the order constant is only what the site knows about, and Suite's
 * `products` has drifted from the served set before. Empty when the
 * environment sells no Suite.
 */
export function suiteModuleSlugs(pricing: PricingResponse | null): PillarSlug[] {
  return PRICING_PILLAR_ORDER.filter((slug) =>
    Boolean(productBundleTier(pillarProducts(pricing, slug)[0], "suite")),
  );
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
  /**
   * Where billing happens — set ONLY when that is somewhere other than
   * peakhour.ai.
   *
   * It used to be set on every channel, and five of the six said the same
   * "Billed on peakhour.ai". Six cards in a row carrying one identical sentence
   * is not information, it is furniture: it pushed the line that differs (the
   * one channel billed through Shopify) into the same visual weight as the five
   * that don't. Absent means the default, and the card renders nothing.
   */
  billed?: string;
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
    href: "/commerce",
  },
  whatsapp: {
    key: "whatsapp",
    connectorKey: "whatsapp",
    name: "WhatsApp",
    tag: "Wa",
    color: "#25D366",
    blurb: "Answer shoppers and support requests right on WhatsApp.",
    href: "/support",
  },
  native: {
    key: "native",
    // No connectorKey: the web app is where the pillars run, not something
    // connected to. Always available, never badged.
    name: "Peakhour web app",
    tag: "Ph",
    color: "#d97a06",
    blurb: "Every module works in the Peakhour dashboard out of the box.",
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
