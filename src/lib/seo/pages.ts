import { PEAKS_REFUND_SENTENCE } from "@/lib/peaks-refund-terms";
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
 * Titles over 60 characters (how-it-works, /shopify, /pricing, /pricing/teams) are unchanged on
 * purpose; SEO-7 rewrites them with the rest of each page's copy.
 */

const REVIEWED = "2026-11-15";
const OWNER = "growth";

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
};

const WAITLIST = { label: "Join the waitlist", href: "/launch-partner", kind: "launch-partner" as const };

function page(s: Seed): PageRecord {
  return {
    pageId: s.pageId,
    family: s.family ?? "core",
    scope: s.surface === "shopify" ? "shopify" : "global",
    path: s.path,
    ...(s.primaryPillar ? { primaryPillar: s.primaryPillar } : {}),
    capabilityIds: s.capabilityIds ?? [],
    surface: s.surface ?? "web",
    editorialStatus: "published",
    indexable: true,
    title: s.title,
    description: s.description,
    h1: s.h1 ?? s.title,
    primaryCta: s.cta ?? WAITLIST,
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
    capabilityIds: ["support.channel_inbox", "support.instagram_messenger_inbox"],
    title: "Support — one AI inbox for every channel | Peakhour.ai",
    description:
      "WhatsApp, Instagram, email — one inbox. AI answers the routine and hands you what needs a human, with full context. Included in Peakhour Suite.",
  }),
  page({
    pageId: "growth",
    path: "/growth",
    primaryPillar: "growth",
    capabilityIds: ["growth.google_ads"],
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

export function findPageByPath(path: string): PageRecord | undefined {
  return PAGES.find((p) => p.path === path);
}
