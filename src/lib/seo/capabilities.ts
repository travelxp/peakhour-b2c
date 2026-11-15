import type { Capability } from "./types";

/*
 * The Capability registry: what Peakhour can honestly claim, per surface (plan D3). Evidence
 * lives here, in code, pointing at catalog keys; a runtime catalog read was rejected because a
 * catalog flip would silently publish or unpublish a page with no review.
 *
 * SEEDED by SEO-2 with only what the existing pages lean on, each with the evidence the page
 * audit (docs/seo/page-audit-v2.csv, `evidence` column) names. SEO-3 verifies every record
 * against the code and the catalog and fills in the rest. A claim is approved only where the
 * audit's verdict for the page is keep or change. `scripts/seo/check-catalog.ts` prints drift
 * between `catalogKeys` here and the dev catalog.
 */

const APPROVED_BY = "owner";
const APPROVED_AT = "2026-11-15";
const VERIFIED_AT = "2026-11-15";

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "presence.gbp_management",
    label: "Google Business Profile management",
    primaryPillar: "presence",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/presence/",
          "peakhour-api:src/v1/services/presence/listing-score.ts",
        ],
        catalogKeys: ["presence.listings", "google_business_profile"],
        verifiedAt: VERIFIED_AT,
      },
    ],
    approvedClaims: [
      {
        id: "presence.gbp_management.edit_listing",
        text: "Edit your Google Business Profile listing, photos and posts, and see your listing score, from one place.",
        requires: "live",
        approvedBy: APPROVED_BY,
        approvedAt: APPROVED_AT,
      },
    ],
  },
  {
    id: "support.channel_inbox",
    label: "Support inbox: WhatsApp, website chat and Google reviews",
    primaryPillar: "support",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: ["peakhour-api:src/v1/routes/support/index.ts"],
        catalogKeys: ["support.inbox", "support.channels_core", "whatsapp"],
        verifiedAt: VERIFIED_AT,
        limitations: ["Instagram DMs and Messenger are in development."],
      },
    ],
    approvedClaims: [
      {
        id: "support.channel_inbox.live_channels",
        text: "One inbox for WhatsApp, website chat and Google reviews.",
        requires: "live",
        approvedBy: APPROVED_BY,
        approvedAt: APPROVED_AT,
      },
    ],
  },
  {
    id: "support.instagram_messenger_inbox",
    label: "Support inbox: Instagram DMs and Messenger",
    primaryPillar: "support",
    implementations: [
      {
        surface: "web",
        status: "development",
        evidence: ["peakhour-b2c:src/lib/pillars.ts (audit: IG DM + Messenger in_development)"],
        catalogKeys: ["instagram_dm", "messenger"],
        verifiedAt: VERIFIED_AT,
      },
    ],
    // No claim: not live.
    approvedClaims: [],
  },
  {
    id: "growth.google_ads",
    label: "Google Ads campaigns",
    primaryPillar: "growth",
    implementations: [
      {
        surface: "web",
        status: "planned",
        evidence: ["peakhour-b2c:src/lib/pillars.ts (audit: Google Ads coming_soon)"],
        catalogKeys: ["google_ads"],
        verifiedAt: VERIFIED_AT,
      },
    ],
    approvedClaims: [],
  },
  {
    id: "growth.lead_inbox",
    label: "Growth lead inbox",
    primaryPillar: "growth",
    implementations: [
      {
        surface: "web",
        status: "idea",
        evidence: ["peakhour-b2c:src/lib/pillars.ts (audit: no lead inbox UI; the claim is removed)"],
        verifiedAt: VERIFIED_AT,
      },
    ],
    approvedClaims: [],
  },
  {
    id: "commerce.ai_shopping_assistant",
    label: "AI shopping assistant",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: ["peakhour-api:src/v1/chat/storefront-turn.ts"],
        catalogKeys: ["commerce.assistant", "shopify"],
        verifiedAt: VERIFIED_AT,
      },
    ],
    approvedClaims: [
      {
        id: "commerce.ai_shopping_assistant.answers_from_catalogue",
        text: "Answers shoppers from your real catalogue, inside Shopify.",
        requires: "live",
        approvedBy: APPROVED_BY,
        approvedAt: APPROVED_AT,
      },
    ],
  },
  {
    id: "commerce.product_recommendations",
    label: "Product recommendations (Smart Rails)",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: ["peakhour-api:src/v1/services/commerce/rail-zones.ts"],
        verifiedAt: VERIFIED_AT,
      },
    ],
    approvedClaims: [
      {
        id: "commerce.product_recommendations.shelves",
        text: "Builds product shelves that sell, inside Shopify.",
        requires: "live",
        approvedBy: APPROVED_BY,
        approvedAt: APPROVED_AT,
      },
    ],
  },
  {
    id: "content.ai_seo_fixes",
    label: "AI SEO fixes for product pages",
    primaryPillar: "content",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: ["peakhour-api:src/v1/services/seo-fix/adapters/shopify.ts"],
        verifiedAt: VERIFIED_AT,
      },
    ],
    approvedClaims: [
      {
        id: "content.ai_seo_fixes.product_pages",
        text: "Fixes product pages for Google, inside Shopify.",
        requires: "live",
        approvedBy: APPROVED_BY,
        approvedAt: APPROVED_AT,
      },
    ],
  },
];

const BY_ID = new Map(CAPABILITIES.map((c) => [c.id, c]));

export function getCapability(id: string): Capability | undefined {
  return BY_ID.get(id);
}
