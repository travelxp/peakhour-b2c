import { PEAKS_REFUND_SENTENCE } from "@/lib/peaks-refund-terms";
import { SHOPIFY_SEO } from "@/lib/shopify-features";
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
 * Titles over 60 characters (how-it-works, /shopify, /pricing, /pricing/teams) are unchanged on
 * purpose; SEO-7 rewrites them with the rest of each page's copy.
 */

const REVIEWED = "2026-11-15";
const OWNER = "growth";

// A page lists in capabilityIds only the capabilities its copy makes a CLAIM on (a capability with
// no approved claim is not checked by the gate). Growth lists none yet: its Google Ads and lead-inbox
// copy is "coming soon" and SEO-3/SEO-7 decide how the gate should treat it.

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
    title: "Peakhour.ai — The AI business platform for growing brands",
    description:
      "Five AI modules — Commerce, Content, Growth, Support, Presence — that sell, publish, advertise, answer, and get you found. One plan for all five.",
    relatedIds: ["pricing", "how.it.works", "shopify", "commerce", "content", "growth", "support", "presence"],
  }),
  page({
    pageId: "pricing",
    path: "/pricing",
    title: "Pricing — Peakhour Suite, Agency and Enterprise",
    description:
      "Peakhour Suite is one plan for Commerce, Content, Growth, Support and Presence — one login, one Peaks wallet, one price. Agency and Enterprise plans for teams.",
    relatedIds: ["pricing.teams", "peaks"],
  }),
  page({
    pageId: "pricing.teams",
    path: "/pricing/teams",
    title: "Agency & Enterprise plans",
    description:
      "Every Peakhour module across many businesses — one unit per client, volume Peaks and central billing on Agency, plus SLAs and a dedicated team on Enterprise.",
    relatedIds: ["pricing"],
  }),
  page({
    pageId: "peaks",
    path: "/peaks",
    title: "Peaks — AI credits that power Peakhour.ai",
    description: `Peaks are the AI credits behind every Peakhour.ai feature. Every plan includes a monthly allowance; purchased Peaks never expire and work across every Peakhour product. ${PEAKS_REFUND_SENTENCE}`,
    relatedIds: ["pricing"],
  }),
  page({
    // Description kept under ~160 characters: past that, search engines truncate it and the last clause (the promise) is cut.
    pageId: "how.it.works",
    path: "/how-it-works",
    title: "See how Peakhour works — one intelligence layer for your whole business",
    description:
      "Peakhour connects to the tools you already use, learns how your business runs, and links what happens across it — so the next action comes to you.",
    relatedIds: ["home"],
  }),
  page({
    pageId: "presence",
    path: "/presence",
    primaryPillar: "presence",
    capabilityIds: ["presence.gbp_management"],
    title: "Presence — own how you show up on Google | Peakhour.ai",
    description:
      "Your Google Business Profile — listings, hours, photos, and reviews — managed from one place, always current. Included in Peakhour Suite.",
  }),
  page({
    pageId: "commerce",
    path: "/commerce",
    primaryPillar: "commerce",
    title: "Commerce — AI storefront assistant | Peakhour.ai",
    description:
      "An AI assistant that knows your whole catalog and sells on WhatsApp and your storefront, 24/7. Included in Peakhour Suite.",
    relatedIds: ["shopify"],
  }),
  page({
    pageId: "content",
    path: "/content",
    primaryPillar: "content",
    title: "Content — AI writers in your voice | Peakhour.ai",
    description:
      "AI writers that publish in your brand voice — blogs, newsletters, socials — from your news desk to every channel. Included in Peakhour Suite.",
  }),
  page({
    pageId: "support",
    path: "/support",
    primaryPillar: "support",
    // No capability claim: support.channel_inbox is "development" (SEO-3; catalog support.channels_core is coming_soon), so
    // the page's "one inbox for every channel" copy is not backed by a live claim. SEO-7 rewrites it.
    capabilityIds: [],
    title: "Support — one AI inbox for every channel | Peakhour.ai",
    description:
      "WhatsApp, Instagram, email — one inbox. AI answers the routine and hands you what needs a human, with full context. Included in Peakhour Suite.",
  }),
  page({
    pageId: "growth",
    path: "/growth",
    primaryPillar: "growth",
    title: "Growth — ads & LinkedIn, with your approval | Peakhour.ai",
    description:
      "Campaigns drafted, LinkedIn leads captured and budgets reviewed every week, with your approval. Peakhour Growth takes on acquisition work for you. Included in Peakhour Suite.",
  }),
  page({
    pageId: "shopify",
    path: "/shopify",
    surface: "shopify",
    primaryPillar: "commerce",
    capabilityIds: ["commerce.ai_shopping_assistant", "commerce.product_recommendations", "content.ai_seo_fixes"],
    title: SHOPIFY_SEO.title,
    description: SHOPIFY_SEO.description,
    cta: { label: "Install on Shopify", href: "/shopify", kind: "install" },
    relatedIds: ["pricing", "commerce"],
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
    relatedIds: ["shopify.features.product.recommendations", "shopify.features.ai.seo", "shopify"],
  }),
  page({
    // review: the WhatsApp checkout-link claim (commerce.whatsapp_shopping) has no Shopify-surface record, so the gate cannot pass it.
    pageId: "shopify.features.whatsapp.ai.shopping",
    path: "/shopify/features/whatsapp-ai-shopping",
    family: "shopify-feature",
    surface: "shopify",
    primaryPillar: "commerce",
    parentId: "shopify.features",
    queryClusterId: "shopify-whatsapp-shopping",
    capabilityIds: ["commerce.whatsapp_shopping"],
    editorialStatus: "review",
    indexable: false,
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
    relatedIds: ["shopify.features.ai.shopping.assistant", "shopify"],
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
