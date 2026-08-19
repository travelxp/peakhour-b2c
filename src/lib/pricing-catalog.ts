import { PILLARS, type PillarSlug } from "@/lib/pillars";

/**
 * Presentational metadata for the pricing surface — the bits marketing tunes
 * without a DB write: pillar order, the one-line promise, the pricing page's
 * headline and standfirst, which capabilities lead on each plan card, the four
 * "what changes on Pro" blocks, and which channels a pillar runs in.
 *
 * It layers ON TOP of the live catalog: prices, tiers, features and Peaks
 * allowances all come from the pricing API — never from here. Card bullets name
 * a cfg_feature key precisely so the catalog keeps the final say over whether
 * one is true (see PlanHighlight).
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

/**
 * One bullet on a plan card.
 *
 * `key` is a cfg_feature key and it is what makes the bullet HONEST: the card
 * renders a highlight only when the tier it belongs to actually grants that
 * key (see `tierGrants`). Marketing picks which capabilities lead and how they
 * are worded; the catalog still decides whether they are true. A bullet whose
 * key the tier lost simply disappears rather than becoming a false claim.
 *
 * Omit `key` only for a plan-level truth that is not a catalog capability at
 * all (billing terms, and nothing else) — there is nothing to ground it
 * against, so each one is a promise made by hand.
 */
export interface PlanHighlight {
  key?: string;
  label: string;
}

/** One "What changes when you go Pro?" block. */
export interface ProValueBlock {
  title: string;
  body: string;
}

export interface PricingPillarMeta {
  slug: PillarSlug;
  /** One plain sentence a browsing buyer instantly gets. */
  promise: string;
  /**
   * The pricing page's own headline and standfirst — value-led, and about
   * what Pro buys rather than what the pillar is. `/{slug}` already sells the
   * pillar; someone on `/pricing/{slug}` has decided they want it and is
   * choosing a plan.
   *
   * Deliberately carries NO figures. Prices, Peaks allowances and the
   * Pro-vs-Free multiple are read from the live catalog and rendered by the
   * cards; a number written into copy here is a number that goes stale the
   * next time pricing is superseded, and nothing would catch it.
   */
  priceHeadline: string;
  priceLede: string;
  /** Pro card bullets, strongest first. Rendered until 6 have passed the
   *  grant check, so list them in the order they should be dropped from. */
  proHighlights: PlanHighlight[];
  /** Free card bullets — the core of the pillar, same rules, capped at 4. */
  freeHighlights: PlanHighlight[];
  /** "What changes when you go Pro?" — exactly four, or none for a pillar
   *  that has no paid tier to change to. */
  proValueBlocks: ProValueBlock[];
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
    priceHeadline: "Get found everywhere — free, forever.",
    priceLede:
      "Claim your business, keep every listing right, and reply to reviews with AI drafts. There is no plan to pick and no card to enter.",
    // Presence ships no paid tier. Empty rather than aspirational: the page
    // renders its free-only view, and the day a Pro tier lands the copy gets
    // written against what it actually grants.
    proHighlights: [],
    freeHighlights: [
      { key: "presence.listings", label: "One business listing, synced everywhere" },
      { key: "presence.reviews", label: "Every review in one inbox, with AI drafts" },
      { key: "presence.insights", label: "See views, calls and directions" },
      { key: "presence.control_plane", label: "Update your listing over WhatsApp" },
    ],
    proValueBlocks: [],
    runsIn: ["native"],
  },
  commerce: {
    slug: "commerce",
    promise: "An AI shop assistant that answers buyers from your real catalog — 24/7.",
    priceHeadline: "Sell on every channel, in every language, around the clock.",
    priceLede:
      "Pro puts your shop assistant on every connected channel — multilingual, on autopilot, with a far bigger monthly Peaks allowance behind it.",
    proHighlights: [
      { key: "commerce.channels_all", label: "Every connected sales channel" },
      { key: "commerce.assistant", label: "AI shopping assistant on your storefront" },
      { key: "commerce.whatsapp", label: "Answers shoppers on WhatsApp" },
      { key: "commerce.multilingual", label: "Replies in your shopper’s own language" },
      { key: "commerce.autopilot", label: "Autopilot, with approval controls you set" },
      { key: "commerce.command_center", label: "See what the assistant did — and earned" },
    ],
    freeHighlights: [
      { key: "commerce.assistant", label: "AI shopping assistant on your storefront" },
      { key: "commerce.catalog_sync", label: "Products, prices and stock stay in sync" },
      { key: "commerce.whatsapp", label: "Answers shoppers on WhatsApp" },
      { key: "commerce.product_descriptions", label: "AI product descriptions" },
    ],
    proValueBlocks: [
      {
        title: "Sell more",
        body: "Far more Peaks each month, so the assistant keeps answering right through your busiest week.",
      },
      {
        title: "Reach every channel",
        body: "The same assistant on every connected storefront channel, not just the one you started with.",
      },
      {
        title: "Speak their language",
        body: "Shoppers get answers in their own language, Hinglish included — no separate setup.",
      },
      {
        title: "Automate more",
        body: "Autopilot takes the repetitive questions at full volume, inside the approval limits you set.",
      },
    ],
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
    priceHeadline: "Publish more, in more places, with far less work.",
    priceLede:
      "Pro adds advanced writers, trusted sources and recurring schedules — with the Peaks to keep your calendar full without you filling it.",
    proHighlights: [
      { key: "content.multi_format", label: "Blogs, newsletters, social posts and more" },
      { key: "content.scheduler", label: "Content calendar with scheduled publishing" },
      { key: "scheduler.bundles", label: "Publish to several channels at once" },
      { key: "scheduler.recurring", label: "Recurring slots that refill themselves" },
      { key: "content.trusted_sources", label: "Ground everything in sources you trust" },
      { key: "content.supervisor", label: "Automatic content ideas, ranked for you" },
    ],
    freeHighlights: [
      { key: "content.studio", label: "AI writing workspace" },
      { key: "content.brand_voice", label: "Writes in your brand voice" },
      { key: "content.repurpose", label: "Turn one piece into many" },
    ],
    proValueBlocks: [
      {
        title: "Create more",
        body: "More Peaks and the advanced writers — blogs, newsletters and social, from one workspace.",
      },
      {
        title: "Publish everywhere",
        body: "Schedule and publish across your channels, several at once, from a single calendar.",
      },
      {
        title: "Stay consistent",
        body: "Trusted sources and recurring schedules hold the voice and the cadence steady.",
      },
      {
        title: "Automate more",
        body: "Less repetitive publishing work: slots refill themselves and posts go out on your rules.",
      },
    ],
    runsIn: ["wordpress", "native"],
  },
  support: {
    slug: "support",
    promise: "Every support message — email, chat, WhatsApp, DMs — in one inbox.",
    priceHeadline: "Answer everyone, everywhere, faster.",
    priceLede:
      "Pro adds WhatsApp and social DMs, AI-drafted replies, routing and SLA timers — with the Peaks to keep up with all of it.",
    proHighlights: [
      { key: "support.channels_all", label: "WhatsApp and social DMs too" },
      { key: "support.ai_replies", label: "AI-drafted replies, ready to send" },
      { key: "support.assignment", label: "Assign and route to the right person" },
      { key: "support.sla", label: "Response and resolution timers" },
      { key: "support.inbox", label: "One inbox for every conversation" },
      { key: "support.channels_core", label: "Email, website and in-app chat" },
    ],
    // Two, not the usual three-to-four. The Support free tier genuinely grants
    // exactly two capabilities today, and a bullet without a key behind it is
    // a claim nothing checks — a short honest list beats a padded one.
    freeHighlights: [
      { key: "support.inbox", label: "One inbox for every conversation" },
      { key: "support.channels_core", label: "Email, website and in-app chat" },
    ],
    proValueBlocks: [
      {
        title: "Answer more",
        body: "A much larger monthly Peaks allowance sits behind every AI-drafted reply.",
      },
      {
        title: "Add every channel",
        body: "WhatsApp and social DMs land in the same inbox as email, website and in-app chat.",
      },
      {
        title: "Nothing slips",
        body: "Response and resolution timers run on every conversation, so a missed SLA is visible.",
      },
      {
        title: "Route automatically",
        body: "Conversations reach the right owner without someone triaging the queue by hand.",
      },
    ],
    runsIn: ["native", "whatsapp"],
  },
  growth: {
    slug: "growth",
    promise: "Ads and LinkedIn on autopilot — campaigns, audiences and leads, handled.",
    // Growth's Free and Pro tiers grant the SAME capability set in the live
    // catalog — the whole difference is the Peaks allowance. So the copy here
    // sells capacity rather than unlocked features, and the comparison table
    // honestly shows two matching columns rather than inventing a gap.
    priceHeadline: "Run growth every day, not just the first week of the month.",
    priceLede:
      "Pro is the same engine with the capacity to keep it running — ads, SEO, creator campaigns and nurture flows, all month long.",
    proHighlights: [
      { key: "growth.ads", label: "Ad campaigns across platforms" },
      { key: "growth.seo", label: "SEO and answer-engine optimisation" },
      { key: "growth.creator_campaigns", label: "Creator and influencer campaigns" },
      { key: "growth.automation", label: "Automated acquisition and nurture flows" },
      { key: "growth.performance_analytics", label: "See which channels actually pay back" },
    ],
    freeHighlights: [
      { key: "growth.ads", label: "Ad campaigns across platforms" },
      { key: "growth.seo", label: "SEO and answer-engine optimisation" },
      { key: "growth.performance_analytics", label: "See which channels actually pay back" },
    ],
    proValueBlocks: [
      {
        title: "Always on",
        body: "Enough Peaks to keep optimisation running all month, instead of stopping after week one.",
      },
      {
        title: "Run more at once",
        body: "Capacity to keep ads, SEO and creator campaigns going in parallel rather than one at a time.",
      },
      {
        title: "See what pays back",
        body: "Attribution and channel performance across everything you have running, kept current.",
      },
      {
        title: "Automate more",
        body: "Acquisition and nurture flows that keep working without you topping anything up.",
      },
    ],
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
    blurb: "Every pillar works in the Peakhour dashboard out of the box.",
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
