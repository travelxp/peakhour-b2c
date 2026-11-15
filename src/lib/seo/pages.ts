import { SHOPIFY_SEO } from "@/lib/shopify-features";
import type { CtaKind, PageFamily, PageRecord, Pillar, Surface } from "./types";

/*
 * The PageRecord registry: every page the site renders on purpose.
 *
 * SEO-2 registers only the EXISTING public marketing pages, each `published` + `indexable`, with
 * the title and description its own metadata carried before the move to `pageMeta`, character for
 * character, so nothing visible changes. Ids are the page audit's ids (docs/seo/page-audit-v2.csv)
 * where a row exists. New pages (SEO-7 to SEO-11) are added here, never inferred from candidates.ts.
 *
 * SEO-7 rewrote the title, description and H1 of the existing public pages with their copy (title <= 60, description
 * <= 160, a unique H1 each; registry.test.ts holds the limits).
 */

const REVIEWED = "2026-11-15";
const OWNER = "growth";

// A page lists in capabilityIds only the capabilities its copy makes a CLAIM on (a capability with
// no approved claim is not checked by the gate). Coming-soon cards (Google Ads, the support inbox) make no claim.

type Seed = {
  pageId: string;
  path: string;
  title: string;
  description: string;
  family?: PageFamily;
  surface?: Surface;
  primaryPillar?: Pillar;
  capabilityIds?: string[];
  h1?: string;
  queryClusterId?: string;
  cta?: { label: string; href: string; kind: CtaKind };
  relatedIds?: string[];
};

const LAUNCH_PARTNER_CTA = { label: "Join the waitlist", href: "/launch-partner", kind: "launch-partner" as const };

function page(s: Seed): PageRecord {
  return {
    pageId: s.pageId,
    family: s.family ?? "core",
    scope: s.surface === "shopify" ? "shopify" : "global",
    path: s.path,
    ...(s.primaryPillar ? { primaryPillar: s.primaryPillar } : {}),
    ...(s.queryClusterId ? { queryClusterId: s.queryClusterId } : {}),
    capabilityIds: s.capabilityIds ?? [],
    surface: s.surface ?? "web",
    editorialStatus: "published",
    indexable: true,
    title: s.title,
    description: s.description,
    h1: s.h1 ?? s.title,
    primaryCta: s.cta ?? LAUNCH_PARTNER_CTA,
    owner: OWNER,
    lastReviewedAt: REVIEWED,
    relatedIds: s.relatedIds ?? [],
  };
}

export const PAGES: readonly PageRecord[] = [
  page({
    pageId: "home",
    path: "/",
    queryClusterId: "platform.overview",
    title: "Peakhour.ai: the AI business platform for growing brands",
    description:
      "Peakhour answers shoppers, drafts content, plans and reviews ads and prepares Google listing changes. You approve each change. One plan for five modules.",
    h1: "Still running one business across 10 different tools?",
    relatedIds: ["pricing", "how.it.works", "shopify", "commerce", "content", "growth", "support", "presence"],
  }),
  page({
    pageId: "pricing",
    path: "/pricing",
    queryClusterId: "pricing",
    title: "Pricing: Peakhour Suite, Agency and Enterprise",
    description:
      "Peakhour Suite is one plan for Commerce, Content, Growth, Support and Presence, with one login and one Peaks wallet. Agency and Enterprise are for teams.",
    h1: "Everything a business does online. One plan.",
    relatedIds: ["pricing.teams", "peaks", "shopify", "how.it.works", "commerce"],
  }),
  page({
    pageId: "pricing.teams",
    path: "/pricing/teams",
    queryClusterId: "pricing",
    title: "Agency & Enterprise plans",
    description:
      "Every Peakhour module across many businesses: one unit per client, volume Peaks and central billing on Agency, plus SLAs and a dedicated team on Enterprise.",
    relatedIds: ["pricing", "peaks"],
  }),
  page({
    pageId: "peaks",
    path: "/peaks",
    queryClusterId: "pricing",
    title: "Peaks: the AI credits behind every Peakhour feature",
    description:
      "Peaks are the AI credits behind every Peakhour feature. Every plan includes a monthly allowance, and purchased Peaks never expire. Top up any time.",
    h1: "Peaks: the AI credits behind every Peakhour feature",
    relatedIds: ["pricing", "pricing.teams", "how.it.works"],
  }),
  page({
    pageId: "how.it.works",
    path: "/how-it-works",
    queryClusterId: "platform.overview",
    title: "How Peakhour works: connect, approve, then let it run",
    description:
      "Peakhour connects to the tools you already use, learns how your business runs, and links what happens across it, so the next action comes to you.",
    h1: "How Peakhour works",
    relatedIds: ["home", "pricing", "commerce", "content", "growth", "support", "presence"],
  }),
  page({
    pageId: "presence",
    path: "/presence",
    queryClusterId: "pillar.presence",
    primaryPillar: "presence",
    capabilityIds: ["presence.gbp_management", "presence.review_management", "presence.listing_health", "integration.google_business_profile"],
    title: "Presence: Google Business Profile tools | Peakhour.ai",
    description:
      "Prepare Google Business Profile edits, get AI drafts for review replies and see a listing health score. In beta; you approve every change.",
    h1: "Own how you show up on Google",
    relatedIds: ["support", "content", "how.it.works", "pricing"],
  }),
  page({
    pageId: "commerce",
    path: "/commerce",
    queryClusterId: "pillar.commerce",
    primaryPillar: "commerce",
    // No capabilityIds: every commerce capability is on shopify or whatsapp, and the gate reads the page's own surface
    // (web), so the hub states each card's status on ITS surface through hub-helpers instead (and the tests pin that).
    title: "Commerce: AI shopping assistant for your store | Peakhour.ai",
    description:
      "An AI assistant that answers shoppers from your catalogue on Shopify and WhatsApp, confirms COD orders and flags stock. WooCommerce is coming soon.",
    h1: "An AI shopping assistant that answers from your real catalogue",
    relatedIds: ["shopify", "pricing", "support", "growth"],
  }),
  page({
    pageId: "content",
    path: "/content",
    queryClusterId: "pillar.content",
    primaryPillar: "content",
    capabilityIds: ["content.brand_voice", "content.social_publishing", "content.beehiiv_newsletter"],
    title: "Content: AI posts in your brand voice | Peakhour.ai",
    description:
      "Peakhour learns your brand voice from your posts, then drafts social posts, newsletters and Shopify blog articles for you to approve.",
    h1: "AI writers that publish in your voice",
    relatedIds: ["growth", "commerce", "shopify", "how.it.works"],
  }),
  page({
    pageId: "support",
    path: "/support",
    queryClusterId: "pillar.support",
    primaryPillar: "support",
    // Only conversation insights is live: the inbox, AI replies and the WhatsApp assistant are built and switched off
    // pending the owner decision (plan Q3), so the page names them as coming soon and makes no claim on them.
    capabilityIds: ["support.conversation_insights"],
    title: "Support: shopper questions AI missed | Peakhour.ai",
    description:
      "AI support on WhatsApp is built and switching on soon. Today Peakhour shows what shoppers asked your assistant that it could not answer.",
    h1: "Find what your shoppers asked that went unanswered",
    relatedIds: ["commerce", "content", "pricing"],
  }),
  page({
    pageId: "growth",
    path: "/growth",
    queryClusterId: "pillar.growth",
    primaryPillar: "growth",
    capabilityIds: [
      "growth.peakhour_summit",
      "growth.campaign_planning",
      "growth.meta_ads",
      "growth.x_ads",
      "growth.linkedin_growth",
      "growth.ad_audiences",
    ],
    title: "Growth: plan and review ads with your approval | Peakhour.ai",
    description:
      "Draft a growth strategy, pause Meta and X ads, manage LinkedIn posts, and have Peakhour Summit review growth decisions. You approve changes.",
    h1: "Plan and review your ads, with your approval",
    relatedIds: ["content", "commerce", "how.it.works", "pricing"],
  }),
  page({
    pageId: "shopify",
    path: "/shopify",
    queryClusterId: "platform.shopify",
    surface: "shopify",
    primaryPillar: "commerce",
    capabilityIds: ["commerce.ai_shopping_assistant", "commerce.product_recommendations", "content.ai_seo_fixes"],
    title: SHOPIFY_SEO.title,
    description: SHOPIFY_SEO.description,
    h1: "Your store's AI team, right inside Shopify",
    cta: { label: "Install on Shopify", href: "/shopify", kind: "install" },
    relatedIds: ["pricing", "commerce", "content", "growth"],
  }),
  page({
    pageId: "launch.partner",
    path: "/launch-partner",
    title: "Become a Launch Partner — Peakhour",
    description:
      "Join the Peakhour launch partner program. Work directly with our team to shape Peakhour Suite, and get early access ahead of public launch.",
  }),
  page({
    pageId: "contact",
    path: "/contact",
    title: "Contact Us - Peakhour",
    description: "Get in touch with the Peakhour team — we'd love to hear from you.",
    cta: { label: "Contact us", href: "/contact", kind: "contact" },
  }),
  page({
    pageId: "legal.privacy",
    path: "/privacy-policy",
    title: "Privacy Policy - Peakhour.ai",
    description: "Peakhour.ai privacy policy — how we collect, use, and protect your data.",
  }),
  page({
    pageId: "legal.terms",
    path: "/terms",
    title: "Terms of Service - Peakhour.ai",
    description: "Peakhour.ai terms of service — the agreement between you and Peakhour.ai.",
  }),
  page({
    pageId: "legal.cookies",
    path: "/cookie-policy",
    title: "Cookie Policy - Peakhour.ai",
    description:
      "Peakhour.ai cookie policy — the cookies and similar technologies we use, why we use them, and how to control them.",
  }),
  page({
    pageId: "legal.data.deletion",
    path: "/data-deletion",
    title: "Data Deletion - Peakhour.ai",
    description: "Request deletion of your data from Peakhour.ai and check the status of a data-deletion request.",
  }),
  page({
    pageId: "trust.data.processing",
    path: "/help/data-retention",
    title: "Data Retention - Peakhour",
    description: "How long Peakhour keeps the data it pulls from connected platforms, and why.",
  }),
];

const BY_ID = new Map(PAGES.map((p) => [p.pageId, p]));

/** The registry record for a pageId. Throws on an unknown id. */
export function getPage(pageId: string): PageRecord {
  const p = BY_ID.get(pageId);
  if (!p) throw new Error(`Unknown pageId "${pageId}"`);
  return p;
}

const BY_PATH = new Map(PAGES.map((p) => [p.path, p]));

export function findPageByPath(path: string): PageRecord | undefined {
  return BY_PATH.get(path);
}
