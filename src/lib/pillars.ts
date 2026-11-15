import type { LucideIcon } from "lucide-react";
import {
  ShoppingBag,
  PenLine,
  TrendingUp,
  MessageSquare,
  MapPin,
} from "lucide-react";

/**
 * The five modules' identity: slug (the public route), name, icon, and the channels each one covers.
 * Mirrors cfg_products.pillar. The marketing COPY for each module (headline, lede, features) lives in
 * src/content/pages/<slug>.ts, built from the approved claims in src/lib/seo/capabilities.ts (SEO-7), so there is one
 * place to keep a module's words true; this file holds no claim.
 */

/**
 * One chip under "Channels & platforms".
 *
 * `key` is the /v1/platform/catalog key the chip resolves to, and it is the
 * whole point of this type: with a key, a surface runs the chip through
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
  /**
   * The channels and surfaces this pillar covers, in the order a visitor would look for them. Scope, not a promise:
   * a connector with a `key` is badged "soon" from the catalog on its own when the catalog says so.
   */
  channels: PillarChannel[];
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
    channels: [
      { name: "Shopify", key: "shopify" },
      // No catalog row of its own: one WordPress plugin covers both, so
      // WooCommerce's availability IS the wordpress connector's. Same reason
      // integration-brand.tsx keeps `woocommerce` as a forward-compat spelling.
      { name: "WooCommerce", key: "wordpress" },
      { name: "WhatsApp", key: "whatsapp" },
      { name: "Your storefront" },
    ],
  },
  content: {
    slug: "content",
    icon: PenLine,
    name: "Content",
    channels: [
      { name: "WordPress", key: "wordpress" },
      { name: "LinkedIn", key: "linkedin_content" },
      { name: "Instagram", key: "instagram" },
      { name: "Facebook", key: "facebook_pages" },
      { name: "X", key: "x" },
      { name: "Beehiiv", key: "beehiiv" },
    ],
  },
  growth: {
    slug: "growth",
    icon: TrendingUp,
    name: "Growth",
    channels: [
      { name: "Meta Ads", key: "meta_ads" },
      // The growth engine is the ORGANIC connector; Lead Gen forms come from
      // the ads one. Both are named because the pillar runs both.
      { name: "LinkedIn", key: "linkedin_content" },
      { name: "LinkedIn Ads", key: "linkedin_ads" },
      { name: "X Ads", key: "x_ads" },
      { name: "Google Ads", key: "google_ads" },
    ],
  },
  support: {
    slug: "support",
    icon: MessageSquare,
    name: "Support",
    channels: [
      { name: "WhatsApp", key: "whatsapp" },
      { name: "Instagram", key: "instagram" },
      { name: "Facebook", key: "facebook_pages" },
    ],
  },
  presence: {
    slug: "presence",
    icon: MapPin,
    name: "Presence",
    channels: [
      { name: "Google Business Profile", key: "google_business_profile" },
      // Where the listing SHOWS UP. Neither is a connector, so neither is ever
      // badged — Peakhour doesn't connect to Search, it appears in it.
      { name: "Google Search" },
      { name: "Google Maps" },
    ],
  },
};
