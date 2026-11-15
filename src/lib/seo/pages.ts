import { PEAKS_REFUND_SENTENCE } from "@/lib/peaks-refund-terms";
import { SHOPIFY_SEO } from "@/lib/shopify-features";
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
    relatedIds: ["pricing", "how.it.works", "shopify", "commerce", "content", "growth", "support", "presence", "integrations.index", "features.index"],
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
    relatedIds: [
      "features.google.business.profile.management",
      "features.review.management",
      "features.local.listing.health",
      "integrations.google.business.profile",
    ],
  }),
  page({
    pageId: "commerce",
    path: "/commerce",
    primaryPillar: "commerce",
    title: "Commerce — AI storefront assistant | Peakhour.ai",
    description:
      "An AI assistant that knows your whole catalog and sells on WhatsApp and your storefront, 24/7. Included in Peakhour Suite.",
    relatedIds: ["shopify", "integrations.whatsapp"],
  }),
  page({
    pageId: "content",
    path: "/content",
    primaryPillar: "content",
    title: "Content — AI writers in your voice | Peakhour.ai",
    description:
      "AI writers that publish in your brand voice — blogs, newsletters, socials — from your news desk to every channel. Included in Peakhour Suite.",
    relatedIds: [
      "features.brand.voice",
      "features.social.media.content",
      "integrations.beehiiv",
      "integrations.x",
      "integrations.facebook",
      "integrations.instagram",
    ],
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
    relatedIds: ["integrations.linkedin", "integrations.meta.ads", "integrations.x.ads"],
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
