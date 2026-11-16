import { SHOPIFY_HERO, SHOPIFY_SEO } from "@/lib/shopify-features";
import { SEO9_PAGES } from "./pages-seo9";
import { COMPETITOR_BRIEFS } from "@/content/seo/competitors";
import type { CtaKind, EditorialStatus, PageFamily, PageRecord, PageScope, Pillar, Surface } from "./types";

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
  cta?: { label: string; href: string; kind: CtaKind };
  relatedIds?: string[];
  parentId?: string;
  queryClusterId?: string;
  scope?: PageScope;
  editorialStatus?: EditorialStatus;
  indexable?: boolean;
};

// The CTA /shopify itself carries: a visitor lands there and it decides between the App Store and the waitlist.
const SHOPIFY_INSTALL_CTA = { label: "Install on Shopify", href: "/shopify", kind: "install" as const };

export const LAUNCH_PARTNER_CTA = { label: "Join the waitlist", href: "/launch-partner", kind: "launch-partner" as const };

function page(s: Seed): PageRecord {
  return {
    pageId: s.pageId,
    family: s.family ?? "core",
    scope: s.scope ?? (s.surface === "shopify" ? "shopify" : "global"),
    path: s.path,
    ...(s.primaryPillar ? { primaryPillar: s.primaryPillar } : {}),
    ...(s.parentId ? { parentId: s.parentId } : {}),
    ...(s.queryClusterId ? { queryClusterId: s.queryClusterId } : {}),
    capabilityIds: s.capabilityIds ?? [],
    surface: s.surface ?? "web",
    ...(s.parentId ? { parentId: s.parentId } : {}),
    ...(s.queryClusterId ? { queryClusterId: s.queryClusterId } : {}),
    editorialStatus: s.editorialStatus ?? "published",
    indexable: s.indexable ?? true,
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
    relatedIds: ["pricing", "how.it.works", "shopify", "commerce", "content", "growth", "support", "presence", "integrations.index", "features.index"],
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
    h1: "Built for many businesses at once.",
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
    relatedIds: ["features.google.business.profile.management", "features.review.management", "features.local.listing.health", "integrations.google.business.profile", "support", "content"],
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
    relatedIds: ["shopify", "integrations.whatsapp", "pricing", "support", "growth"],
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
    relatedIds: ["features.brand.voice", "features.social.media.content", "integrations.beehiiv", "integrations.x", "integrations.facebook", "integrations.instagram"],
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
    relatedIds: ["integrations.linkedin", "integrations.meta.ads", "integrations.x.ads", "content", "commerce"],
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
    h1: `${SHOPIFY_HERO.headline} ${SHOPIFY_HERO.accent}`,
    cta: { label: "Install on Shopify", href: "/shopify", kind: "install" },
    relatedIds: ["pricing", "commerce", "content", "growth"],
  }),
  // SEO-8: wave-1 Shopify feature pages. Titles are <= 60 characters; every claim a page makes is an approved
  // claim of the capabilities it lists (capabilities.ts). A page whose claim has no Shopify-surface record is "review".
  page({
    pageId: "shopify.features",
    path: "/shopify/features",
    family: "shopify-feature",
    surface: "shopify",
    primaryPillar: "commerce",
    parentId: "shopify",
    queryClusterId: "shopify-app-features",
    title: "Peakhour features for Shopify stores",
    description:
      "Every Peakhour feature for Shopify with its status: the AI shopping assistant, Smart Rails, COD confirmation on WhatsApp, AI SEO and product descriptions.",
    h1: "Everything Peakhour does on Shopify",
    cta: SHOPIFY_INSTALL_CTA,
    relatedIds: ["shopify", "pricing", "how.it.works"],
  }),
  page({
    pageId: "shopify.features.ai.shopping.assistant",
    path: "/shopify/features/ai-shopping-assistant",
    family: "shopify-feature",
    surface: "shopify",
    primaryPillar: "commerce",
    parentId: "shopify.features",
    queryClusterId: "shopify-ai-shopping-assistant",
    capabilityIds: ["commerce.ai_shopping_assistant", "commerce.find_my_match"],
    title: "AI shopping assistant and chatbot for Shopify",
    description:
      "An AI chatbot for Shopify that answers shoppers from your own catalogue, with a Find my match quiz. You can pause it or take over any chat.",
    h1: "An AI shopping assistant for your Shopify store",
    cta: SHOPIFY_INSTALL_CTA,
    relatedIds: ["shopify.features.whatsapp.ai.shopping", "shopify.features.product.recommendations", "shopify.features.ai.seo", "shopify"],
  }),
  page({
    // commerce.whatsapp_shopping has a WhatsApp record only; the publish gate falls back to it (publish.ts), so this page publishes.
    pageId: "shopify.features.whatsapp.ai.shopping",
    path: "/shopify/features/whatsapp-ai-shopping",
    family: "shopify-feature",
    surface: "shopify",
    primaryPillar: "commerce",
    parentId: "shopify.features",
    queryClusterId: "shopify-whatsapp-shopping",
    capabilityIds: ["commerce.whatsapp_shopping"],
    title: "WhatsApp AI shopping for Shopify stores",
    description:
      "Shoppers chat with your AI assistant on your WhatsApp Business number, and get a link into your own Shopify checkout when they agree to buy.",
    h1: "Sell on WhatsApp with an AI assistant, and check out on your Shopify store",
    cta: SHOPIFY_INSTALL_CTA,
    relatedIds: ["shopify.features.ai.shopping.assistant", "shopify.features.whatsapp.cod.confirmation", "shopify"],
  }),
  page({
    pageId: "shopify.features.product.recommendations",
    path: "/shopify/features/product-recommendations",
    family: "shopify-feature",
    surface: "shopify",
    primaryPillar: "commerce",
    parentId: "shopify.features",
    queryClusterId: "shopify-product-recommendations",
    capabilityIds: ["commerce.product_recommendations"],
    title: "Shopify product recommendations: Smart Rails",
    description:
      "Smart Rails builds product shelves that sell inside your Shopify store, with 11 kinds to choose from. Changes the engine suggests wait for your approval.",
    h1: "Smart Rails: product recommendations that sell on Shopify",
    cta: SHOPIFY_INSTALL_CTA,
    relatedIds: ["shopify.features.frequently.bought.together", "shopify.features.ai.shopping.assistant", "shopify"],
  }),
  page({
    pageId: "shopify.features.frequently.bought.together",
    path: "/shopify/features/frequently-bought-together",
    family: "shopify-feature",
    surface: "shopify",
    primaryPillar: "commerce",
    parentId: "shopify.features",
    queryClusterId: "shopify-frequently-bought-together",
    capabilityIds: ["commerce.frequently_bought_together", "commerce.buy_together_bundles"],
    title: "Frequently bought together for Shopify",
    description:
      "Peakhour works out what customers buy together from your own Shopify orders every night, and can take 5 to 30 percent off the companions.",
    h1: "Show what customers buy together on your Shopify product pages",
    cta: SHOPIFY_INSTALL_CTA,
    relatedIds: ["shopify.features.product.recommendations", "shopify.features.ai.shopping.assistant", "shopify"],
  }),
  page({
    pageId: "shopify.features.whatsapp.cod.confirmation",
    path: "/shopify/features/whatsapp-cod-confirmation",
    family: "shopify-feature",
    surface: "shopify",
    primaryPillar: "commerce",
    parentId: "shopify.features",
    queryClusterId: "shopify-cod-confirmation",
    capabilityIds: ["commerce.cod_confirmation"],
    title: "WhatsApp COD confirmation for Shopify stores",
    description:
      "Peakhour asks the shopper on WhatsApp to confirm or cancel each cash-on-delivery Shopify order. Needs your own WhatsApp number and a Meta-approved template.",
    h1: "Confirm cash-on-delivery orders on WhatsApp, on Shopify",
    cta: SHOPIFY_INSTALL_CTA,
    relatedIds: ["shopify.features.whatsapp.ai.shopping", "shopify.features.ai.shopping.assistant", "shopify"],
  }),
  page({
    pageId: "shopify.features.ai.seo",
    path: "/shopify/features/ai-seo",
    family: "shopify-feature",
    surface: "shopify",
    primaryPillar: "content",
    parentId: "shopify.features",
    queryClusterId: "shopify-ai-seo",
    capabilityIds: ["content.ai_seo_fixes"],
    title: "AI SEO for Shopify product pages",
    description:
      "Fix with AI drafts SEO titles, meta descriptions and image alt text for your Shopify products. You tick what to apply, and every change can be undone.",
    h1: "Fix your Shopify SEO titles, meta descriptions and alt text with AI",
    cta: SHOPIFY_INSTALL_CTA,
    relatedIds: ["shopify.features.ai.product.descriptions", "shopify.features.ai.shopping.assistant", "shopify"],
  }),
  page({
    pageId: "shopify.features.ai.product.descriptions",
    path: "/shopify/features/ai-product-descriptions",
    family: "shopify-feature",
    surface: "shopify",
    primaryPillar: "content",
    parentId: "shopify.features",
    queryClusterId: "shopify-ai-product-descriptions",
    capabilityIds: ["content.ai_product_descriptions"],
    title: "AI product descriptions for Shopify",
    description:
      "Peakhour writes descriptions for Shopify products that have none or very thin ones. You review and edit each draft, apply it, and can undo it.",
    h1: "Write Shopify product descriptions with AI, and approve each one",
    cta: SHOPIFY_INSTALL_CTA,
    relatedIds: ["shopify.features.ai.seo", "shopify.features.ai.shopping.assistant", "shopify"],
  }),
  page({
    pageId: "launch.partner",
    path: "/launch-partner",
    h1: "Build Peakhour.ai with us.",
    title: "Become a Launch Partner — Peakhour",
    description:
      "Join the Peakhour launch partner program. Work directly with our team to shape Peakhour Suite, and get early access ahead of public launch.",
  }),
  page({
    pageId: "contact",
    path: "/contact",
    h1: "Get in touch",
    title: "Contact Us - Peakhour",
    description: "Get in touch with the Peakhour team — we'd love to hear from you.",
    cta: { label: "Contact us", href: "/contact", kind: "contact" },
  }),
  page({
    pageId: "legal.privacy",
    path: "/privacy-policy",
    h1: "Privacy Policy",
    title: "Privacy Policy - Peakhour.ai",
    description: "Peakhour.ai privacy policy — how we collect, use, and protect your data.",
  }),
  page({
    pageId: "legal.terms",
    path: "/terms",
    h1: "Terms of Service",
    title: "Terms of Service - Peakhour.ai",
    description: "Peakhour.ai terms of service — the agreement between you and Peakhour.ai.",
  }),
  page({
    pageId: "legal.cookies",
    path: "/cookie-policy",
    h1: "Cookie Policy",
    title: "Cookie Policy - Peakhour.ai",
    description:
      "Peakhour.ai cookie policy — the cookies and similar technologies we use, why we use them, and how to control them.",
  }),
  page({
    pageId: "legal.data.deletion",
    path: "/data-deletion",
    h1: "Data Deletion",
    title: "Data Deletion - Peakhour.ai",
    description: "Request deletion of your data from Peakhour.ai and check the status of a data-deletion request.",
  }),
  page({
    pageId: "trust.data.processing",
    path: "/help/data-retention",
    h1: "Data Retention",
    title: "Data Retention - Peakhour",
    description: "How long Peakhour keeps the data it pulls from connected platforms, and why.",
  }),
  ...SEO9_PAGES,
  // SEO-11 ----------------------------------------------------------------------------------------------------
  page({
    pageId: "feature.peakhour.summit",
    path: "/features/peakhour-summit",
    family: "feature",
    primaryPillar: "growth",
    capabilityIds: ["growth.peakhour_summit"],
    queryClusterId: "peakhour-summit",
    title: "Peakhour Summit: a four-part AI review of growth decisions",
    description:
      "Peakhour Summit reviews your growth proposals with the case for, the case against, safety checks and a final call. You can ask it a question, priced in Peaks.",
    h1: "Peakhour Summit reviews your growth decisions before you make them",
    relatedIds: ["growth", "how.it.works", "pricing", "peaks"],
  }),
  page({
    pageId: "about",
    path: "/about",
    queryClusterId: "organization",
    // Draft until the owner confirms the company facts it states (docs: SEO-11 report lists them).
    editorialStatus: "review",
    indexable: false,
    title: "About Peakhour: the AI business platform for growing brands",
    description:
      "Peakhour is an AI business platform with five modules: Commerce, Content, Growth, Support and Presence. Who runs it, where it works and how to reach us.",
    h1: "About Peakhour",
    relatedIds: ["home", "how.it.works", "contact", "legal.privacy", "legal.terms"],
  }),
  page({
    pageId: "industries",
    path: "/industries",
    editorialStatus: "review",
    indexable: false,
    title: "Peakhour by industry",
    description: "How Peakhour helps different kinds of business, with what is live and what is not.",
    h1: "Peakhour by industry",
    relatedIds: ["industries.fashion.apparel"],
  }),
  page({
    pageId: "industries.fashion.apparel",
    path: "/industries/fashion-apparel",
    family: "industry",
    parentId: "industries",
    primaryPillar: "commerce",
    // Claims: Find my match, Smart Rails (Shopify) and COD confirmation are live on the Shopify surface. The page is a
    // draft until it has industry-specific evidence (Bible 7.3, 7.6), so it names the Shopify surface for the gate.
    surface: "shopify",
    capabilityIds: ["commerce.find_my_match", "commerce.product_recommendations", "commerce.cod_confirmation", "commerce.ai_shopping_assistant"],
    queryClusterId: "industry-fashion",
    editorialStatus: "review",
    indexable: false,
    title: "Peakhour for fashion and apparel stores",
    description:
      "Shopify fashion stores: a Complete the look shelf, a Find my match quiz, a shopping assistant and WhatsApp confirmation of cash-on-delivery orders.",
    h1: "Peakhour for fashion and apparel stores",
    cta: { label: "Install on Shopify", href: "/shopify", kind: "install" },
    relatedIds: ["shopify", "commerce", "shopify.guides.whatsapp.cod.confirmation", "pricing"],
  }),
  page({
    pageId: "guides",
    path: "/guides",
    editorialStatus: "review",
    indexable: false,
    title: "Peakhour guides",
    description: "Original how-to guides for running a store with Peakhour.",
    h1: "Peakhour guides",
    relatedIds: ["shopify.guides.whatsapp.cod.confirmation"],
  }),
  page({
    pageId: "shopify.guides.whatsapp.cod.confirmation",
    path: "/shopify/guides/whatsapp-cod-confirmation",
    family: "shopify-guide",
    surface: "shopify",
    parentId: "shopify",
    primaryPillar: "commerce",
    capabilityIds: ["commerce.cod_confirmation"],
    queryClusterId: "cod-confirmation",
    editorialStatus: "review",
    indexable: false,
    title: "Set up WhatsApp COD confirmation on Shopify",
    description:
      "How to ask cash-on-delivery shoppers to confirm on WhatsApp: what you need, the setup steps, what happens to unanswered orders and the limits.",
    h1: "How to set up WhatsApp confirmation for cash-on-delivery orders on Shopify",
    cta: { label: "Install on Shopify", href: "/shopify", kind: "install" },
    relatedIds: ["shopify", "pricing", "commerce"],
  }),
  // SEO-10: the wave-1 Shopify comparisons. At `review` they render on dev with the draft ribbon and 404 on
  // production until Growth signs off each source (plan D4, Q1). capabilityIds hold only what the Peakhour cells claim.
  ...COMPETITOR_BRIEFS.map((b) =>
    page({
      pageId: b.pageId,
      path: `/shopify/compare/${b.slug}`,
      family: "shopify-compare",
      surface: "shopify",
      primaryPillar: "commerce",
      capabilityIds: [...new Set(b.claims.map((c) => c.peakhour.capabilityId).filter((id): id is string => !!id))],
      title: b.title,
      description: b.description,
      h1: b.h1,
      cta: LAUNCH_PARTNER_CTA,
      relatedIds: ["shopify", "pricing"],
      editorialStatus: "review",
      indexable: false,
    }),
  ),
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
