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

/**
 * One chip under "Channels & platforms" on the homepage pillar card.
 *
 * `key` is the /v1/platform/catalog key the chip resolves to, and it is the
 * whole point of this type: with a key, the homepage runs the chip through
 * EXACTLY the rule the integrations grid runs its cards through, so one
 * connector cannot read as plain availability in a chip and "Coming soon" in a
 * card a few hundred pixels below it. See lib/pillar-channels.ts.
 *
 * Omit `key` for a SURFACE — somewhere the pillar's work LANDS rather than
 * something Peakhour connects to. "Your storefront", "Email", "Google Search"
 * and "Google Maps" have no catalog row and never will, so there is no
 * availability to state and they are never badged.
 *
 * A key that the catalog does not publish fails CLOSED (badged). So a typo
 * here is a chip stuck reading "soon" forever rather than a false claim — and
 * pillar-channels.test.ts pins every key against the channel registry to catch
 * it before that.
 */
export interface PillarChannel {
  name: string;
  key?: string;
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
   * The channels and surfaces this pillar covers. Rendered as chips under
   * "Channels & platforms" on the expanded homepage card, and — for the ones
   * carrying a catalog key — badged from the same source as the integrations
   * grid, so the two surfaces cannot disagree. See PillarChannel above.
   *
   * The list is still SCOPE: what the pillar covers, in the order a visitor
   * would look for it. What changed is that scope no longer has to be silent
   * about status. Add what the pillar genuinely does; give it a key when a
   * connector carries it, and the page will say "soon" on its own when the
   * catalog says so.
   */
  channels: PillarChannel[];
  /** "What it does" — the capabilities, 3 cards. */
  features: PillarFeature[];
  /** "How it helps" — outcome-framed, plain-language jobs done. */
  outcomes: string[];
  /** The plan that includes the pillar. One catalog (billing plan D19): every
   *  module is in Peakhour Suite, and none has a free tier of its own. */
  planLabel: string;
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
    eyebrow: "The Commerce module",
    headline: "An AI storefront assistant that",
    accent: "sells while you sleep.",
    lede: "It knows your whole catalog and answers shoppers on WhatsApp and your storefront in real time — accurate prices, live stock, in their language — turning questions into orders 24/7.",
    hubLine: "Sells while you sleep",
    valueProp:
      "Turn product questions into orders around the clock, without adding a single person to the team.",
    channels: [
      { name: "Shopify", key: "shopify" },
      // No catalog row of its own: one WordPress plugin covers both, so
      // WooCommerce's availability IS the wordpress connector's. Same reason
      // integration-brand.tsx keeps `woocommerce` as a forward-compat spelling.
      { name: "WooCommerce", key: "wordpress" },
      { name: "WhatsApp", key: "whatsapp" },
      { name: "Your storefront" },
    ],
    features: [
      {
        title: "Catalog always in sync",
        description:
          "Products, prices, and stock sync from Shopify and WooCommerce, so the assistant answers from your current catalog.",
      },
      {
        title: "WhatsApp & storefront chat",
        description:
          "Shoppers ask on your WhatsApp number or your site. AI replies instantly and shares a checkout link; you step in when needed.",
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
    planLabel: "In Peakhour Suite",
  },
  content: {
    slug: "content",
    icon: PenLine,
    name: "Content",
    eyebrow: "The Content module",
    headline: "AI writers that publish",
    accent: "in your voice.",
    lede: "From your news desk to every channel — blogs, newsletters, socials — Peakhour drafts on-brand content you approve in a tap, then publishes it. No more staring at a blank page.",
    hubLine: "Publishes in your voice",
    valueProp:
      "A full content calendar written the way your brand actually sounds, and shipped to every channel.",
    channels: [
      { name: "WordPress", key: "wordpress" },
      { name: "LinkedIn", key: "linkedin_content" },
      { name: "Instagram", key: "instagram" },
      { name: "Facebook", key: "facebook_pages" },
      { name: "X", key: "x" },
      { name: "Beehiiv", key: "beehiiv" },
    ],
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
    planLabel: "In Peakhour Suite",
  },
  growth: {
    slug: "growth",
    icon: TrendingUp,
    name: "Growth",
    eyebrow: "The Growth module",
    headline: "Ads and LinkedIn,",
    accent: "with your approval.",
    lede: "Campaigns drafted, audiences suggested, LinkedIn leads captured and budgets reviewed every week, with your approval. Growth takes on the acquisition work a small team can't get to.",
    hubLine: "Runs ads and leads",
    valueProp:
      "Campaigns drafted, budgets reviewed each week, LinkedIn leads captured — with you approving the changes.",
    channels: [
      { name: "Meta Ads", key: "meta_ads" },
      // The growth engine is the ORGANIC connector; Lead Gen forms come from
      // the ads one. Both are named because the pillar runs both.
      { name: "LinkedIn", key: "linkedin_content" },
      { name: "LinkedIn Ads", key: "linkedin_ads" },
      { name: "X Ads", key: "x_ads" },
      { name: "Google Ads", key: "google_ads" },
    ],
    features: [
      {
        title: "LinkedIn growth engine",
        description:
          "Post as your brand, engage the right audiences, and turn conversations into a lead pipeline — without living in the feed.",
      },
      {
        title: "Ad campaigns + optimizer",
        description:
          "Draft platform-native campaigns, launch them, and let the AI suggest pausing underperformers and backing winners each week. You approve the changes.",
      },
      {
        title: "Lead inbox",
        description:
          "LinkedIn leads land in one inbox, ready to follow up — so nothing slips through the cracks.",
      },
    ],
    outcomes: [
      "Stop burning ad budget on what isn't converting.",
      "Find shoppers who look like your best customers, automatically.",
      "Keep your LinkedIn leads in one place instead of chasing them across tabs.",
    ],
    planLabel: "In Peakhour Suite",
  },
  support: {
    slug: "support",
    icon: MessageSquare,
    name: "Support",
    eyebrow: "The Support module",
    headline: "One inbox for every channel,",
    accent: "answered.",
    lede: "Your WhatsApp conversations in one place. AI answers the routine questions with full context and hands you only the ones that need a human, so support never runs your day.",
    hubLine: "Answers every message",
    valueProp:
      "One inbox where AI clears the routine questions and hands you only what needs a human.",
    channels: [
      { name: "WhatsApp", key: "whatsapp" },
      { name: "Instagram", key: "instagram" },
      { name: "Facebook", key: "facebook_pages" },
    ],
    features: [
      {
        title: "One inbox",
        description:
          "Your WhatsApp conversations in one thread-per-customer view, with Instagram and Facebook alongside as their connectors open.",
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
    planLabel: "In Peakhour Suite",
  },
  presence: {
    slug: "presence",
    icon: MapPin,
    name: "Presence",
    eyebrow: "The Presence module",
    headline: "Own how you show up",
    accent: "on Google.",
    lede: "Connect your Google Business Profile and see how it performs in Insights, so you know how people find you when they search nearby.",
    hubLine: "Found first on Google",
    valueProp:
      "Connect your Google Business Profile and see how people find you on Google.",
    channels: [
      { name: "Google Business Profile", key: "google_business_profile" },
      // Where the listing SHOWS UP. Neither is a connector, so neither is ever
      // badged — Peakhour doesn't connect to Search, it appears in it.
      { name: "Google Search" },
      { name: "Google Maps" },
    ],
    features: [
      {
        title: "Connect your profile",
        description:
          "Connect your Google Business Profile once, and Peakhour knows which listing is yours.",
      },
      {
        title: "Insights",
        description:
          "See how your profile performs in Insights, next to the rest of your Peakhour results.",
      },
    ],
    outcomes: [
      "See how people find your business on Google.",
      "Keep your Google profile and your other results in one place.",
    ],
    planLabel: "In Peakhour Suite",
  },
};
