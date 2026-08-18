import type { LucideIcon } from "lucide-react";
import {
  ShoppingBag,
  PenLine,
  TrendingUp,
  MessageSquare,
  MapPin,
} from "lucide-react";

/**
 * Content model for the five pillar marketing pages (/commerce … /presence).
 * Kept as data (not hardcoded JSX) so the pages stay a thin template and so
 * PR-5 (next-intl) can extract these strings without touching layout. Mirrors
 * cfg_products.pillar; the `slug` is the public route + the homepage anchor id.
 */
export interface PillarFeature {
  title: string;
  description: string;
}

export interface PillarContent {
  slug: PillarSlug;
  icon: LucideIcon;
  name: string;
  /** Small uppercase eyebrow. */
  eyebrow: string;
  /** Headline lead; `accent` renders as the gold serif-italic flourish. */
  headline: string;
  accent: string;
  lede: string;
  /**
   * Three-to-four words, rendered under the pillar's name in the homepage
   * orbit diagram. Must survive being set at ~11px inside a ~140px node, so
   * keep it to one short phrase — this is a label, not a sentence.
   */
  hubLine: string;
  /**
   * The single value proposition, in one sentence — what the visitor GETS,
   * not what the pillar contains. Shown on the homepage pillar card (both
   * collapsed and expanded); `lede` stays the longer version for /<slug>.
   */
  valueProp: string;
  /**
   * The channels and surfaces this pillar covers, as brand names. Rendered as
   * chips under "Channels & platforms" on the expanded homepage card.
   *
   * This is SCOPE, not status, and the two are not the same list. Some
   * entries are surfaces rather than connectors and will never appear in the
   * catalog at all ("Your storefront", "Email", "Google Maps"); others are
   * real connectors that the catalog currently seeds as `coming_soon`
   * (Shopify, WordPress, Google Ads), and WooCommerce is a registered
   * provider with no marketing row seeded for it yet.
   *
   * Availability is stated in exactly ONE place on the page: the integrations
   * grid, which reads /v1/platform/catalog and badges per-connector state.
   * Today it badges nothing, because the platform stage caps every row — but
   * once the stage advances, a chip here and a "Coming soon" card down the
   * page will name the same connector. If that ever reads as a contradiction
   * rather than as scope, the fix is to resolve these chips against the same
   * catalog and badge them from it, NOT to quietly prune the product's scope
   * down to whatever shipped first.
   */
  channels: string[];
  /** "What it does" — the capabilities, 3 cards. */
  features: PillarFeature[];
  /** "How it helps" — outcome-framed, plain-language jobs done. */
  outcomes: string[];
  /** Whether the pillar's plan is free ("Free plan included" vs "Always free"). */
  freeLabel: string;
}

export const PILLAR_ORDER = [
  "commerce",
  "content",
  "growth",
  "support",
  "presence",
] as const;

export type PillarSlug = (typeof PILLAR_ORDER)[number];

export const PILLARS: Record<PillarSlug, PillarContent> = {
  commerce: {
    slug: "commerce",
    icon: ShoppingBag,
    name: "Commerce",
    eyebrow: "The Commerce pillar",
    headline: "An AI storefront assistant that",
    accent: "sells while you sleep.",
    lede: "It knows your whole catalog and answers shoppers on WhatsApp and your storefront in real time — accurate prices, live stock, in their language — turning questions into orders 24/7.",
    hubLine: "Sells while you sleep",
    valueProp:
      "Turn product questions into orders around the clock, without adding a single person to the team.",
    channels: ["Shopify", "WooCommerce", "WhatsApp", "Your storefront"],
    features: [
      {
        title: "Catalog always in sync",
        description:
          "Products, prices, and stock pull automatically from Shopify and WooCommerce. The AI always answers from live data — no stale info, no wrong prices.",
      },
      {
        title: "WhatsApp & storefront chat",
        description:
          "Shoppers ask on your WhatsApp number or your site. AI replies instantly, reserves items, and shares a checkout link — zero agent time.",
      },
      {
        title: "Inventory intelligence",
        description:
          "See what shoppers ask for most, spot the sizes selling out, and get nudged to restock before you lose the sale.",
      },
    ],
    outcomes: [
      "Recover the late-night sales you miss when no one's online to reply.",
      "Cut the repetitive “is this in stock / my size?” questions off your plate.",
      "Know which products to reorder before they sell out.",
    ],
    freeLabel: "Free plan included",
  },
  content: {
    slug: "content",
    icon: PenLine,
    name: "Content",
    eyebrow: "The Content pillar",
    headline: "AI writers that publish",
    accent: "in your voice.",
    lede: "From your news desk to every channel — blogs, newsletters, socials — Peakhour drafts on-brand content you approve in a tap, then publishes it. No more staring at a blank page.",
    hubLine: "Publishes in your voice",
    valueProp:
      "A full content calendar written the way your brand actually sounds, and shipped to every channel.",
    channels: ["WordPress", "LinkedIn", "Instagram", "Facebook", "X", "Beehiiv"],
    features: [
      {
        title: "Brand-voice AI writers",
        description:
          "The AI learns how your brand sounds from your existing content and writes new posts, articles, and emails that match it.",
      },
      {
        title: "News-driven ideas",
        description:
          "A news desk surfaces what's trending in your world and turns it into ready-to-approve content ideas, so you're never short of something to say.",
      },
      {
        title: "Multi-format publishing",
        description:
          "One idea becomes a blog post, a newsletter, and a week of social posts — each formatted natively for its channel.",
      },
    ],
    outcomes: [
      "Turn one idea into a week of content instead of a blank calendar.",
      "Stay consistent across channels without hiring a content team.",
      "Publish on-brand every time — the AI keeps your voice, you keep approval.",
    ],
    freeLabel: "Free plan included",
  },
  growth: {
    slug: "growth",
    icon: TrendingUp,
    name: "Growth",
    eyebrow: "The Growth pillar",
    headline: "Ads and LinkedIn",
    accent: "on autopilot.",
    lede: "Campaigns drafted, audiences found, leads captured, budgets optimized — around the clock. Growth runs the acquisition work a small team can't get to, and stops wasting spend on what isn't working.",
    hubLine: "Runs ads and leads",
    valueProp:
      "Acquisition that keeps running — campaigns drafted, budgets tuned, every lead captured.",
    channels: ["Meta Ads", "LinkedIn", "X Ads", "Google Ads"],
    features: [
      {
        title: "LinkedIn growth engine",
        description:
          "Post as your brand, engage the right audiences, and turn conversations into a lead pipeline — without living in the feed.",
      },
      {
        title: "Ad campaigns + optimizer",
        description:
          "Draft platform-native campaigns, launch them, and let the AI pause underperformers and double down on winners hourly.",
      },
      {
        title: "Lead inbox",
        description:
          "Every lead from every channel lands in one inbox, enriched and ready — so nothing slips through the cracks.",
      },
    ],
    outcomes: [
      "Stop burning ad budget on what isn't converting.",
      "Find shoppers who look like your best customers, automatically.",
      "Capture and follow up on every lead — no manual chasing.",
    ],
    freeLabel: "Free plan included",
  },
  support: {
    slug: "support",
    icon: MessageSquare,
    name: "Support",
    eyebrow: "The Support pillar",
    headline: "One inbox for every channel,",
    accent: "answered.",
    lede: "WhatsApp, Instagram, email — all in one place. AI answers the routine questions with full context and hands you only the ones that need a human, so support never runs your day.",
    hubLine: "Answers every message",
    valueProp:
      "One inbox where AI clears the routine questions and hands you only what genuinely needs a human.",
    channels: ["WhatsApp", "Instagram", "Facebook", "Email"],
    features: [
      {
        title: "Omnichannel inbox",
        description:
          "Every conversation from every channel in one thread-per-customer view — no more tab-switching to keep up.",
      },
      {
        title: "AI-drafted replies",
        description:
          "The AI drafts accurate answers grounded in your catalog and policies; you approve, edit, or let it send the easy ones.",
      },
      {
        title: "Human handoff",
        description:
          "When something needs you, it hands over with the full history — so you step in already knowing the context.",
      },
    ],
    outcomes: [
      "Clear the routine “where's my order?” questions without lifting a finger.",
      "Never leave a customer waiting, even after hours.",
      "Step in only for the conversations that actually need you.",
    ],
    freeLabel: "Free plan included",
  },
  presence: {
    slug: "presence",
    icon: MapPin,
    name: "Presence",
    eyebrow: "The Presence pillar",
    headline: "Own how you show up",
    accent: "on Google.",
    lede: "Your Google Business Profile — listings, hours, photos, and reviews — managed from one place, always current. So when someone searches nearby, you're the one they find and trust.",
    hubLine: "Found first on Google",
    valueProp:
      "Show up accurate and current wherever people look for you — and never leave a review unanswered.",
    channels: ["Google Business Profile", "Google Search", "Google Maps"],
    features: [
      {
        title: "Google Business Profile",
        description:
          "Keep your listing accurate everywhere — hours, contact, categories, photos — updated from one dashboard.",
      },
      {
        title: "Review management",
        description:
          "Every review surfaced and replied to, with AI-drafted responses in your voice, so your rating keeps climbing.",
      },
      {
        title: "Listing health",
        description:
          "Spot what's missing or out of date before it costs you a customer — and fix it in a tap.",
      },
    ],
    outcomes: [
      "Be the business that shows up first for “near me” searches.",
      "Never let a review go unanswered and drag your rating down.",
      "Keep every listing detail current without the busywork.",
    ],
    freeLabel: "Always free",
  },
};
