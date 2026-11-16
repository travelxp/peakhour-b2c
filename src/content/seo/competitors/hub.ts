import type { DirectoryContent, DirectoryGroup, DirectoryItem } from "@/components/marketing/seo/content-types";
import { CANDIDATES } from "@/lib/seo/candidates";
import { getPage } from "@/lib/seo/pages";
import { canOpen, isPublishable } from "@/lib/seo/publish";
import { pathFor } from "@/lib/seo/resolve";
import type { PageRecord } from "@/lib/seo/types";
import { COMPETITOR_BRIEFS } from "./index";
import { compareRoute } from "./route";
import type { CompetitorBrief } from "./types";

/*
 * The comparison directories (/shopify/compare and /compare) and every link that leads into the comparisons.
 *
 * One rule runs through all of it: a comparison is shown where a visitor can open it. On production that is a published
 * page only; on dev and previews it is any draft too, with a "Draft" chip on its card, so a reviewer sees the whole set and
 * never mistakes a draft for a published page. Nothing is hand-listed here but the jobs the vendors are grouped under: the
 * cards read the briefs and the registry.
 */

export type DirectoryScope = "shopify" | "global";

/** The job a vendor is chosen for. A brief not named here lands under "More comparisons", so a new brief is never dropped. */
type Job = { id: string; title: string; blurb: string; slugs: readonly string[] };

const SHOPIFY_JOBS: readonly Job[] = [
  {
    id: "whatsapp-cod",
    title: "WhatsApp and cash on delivery",
    blurb: "Tools for talking to shoppers on WhatsApp and for confirming cash-on-delivery orders.",
    slugs: ["aisensy", "interakt", "wati", "zoko", "gokwik", "easysell", "releasit"],
  },
  {
    id: "chat-assistants",
    title: "Chat and shopping assistants",
    blurb: "Live chat, helpdesks and AI assistants that answer shoppers or help you run the store.",
    slugs: ["rep-ai", "manifest-ai", "tidio", "gorgias", "shopify-inbox", "shopify-sidekick"],
  },
  {
    id: "merchandising",
    title: "Recommendations and merchandising",
    blurb: "Apps that choose which products to show, and where, to lift what a shopper adds to the cart.",
    slugs: ["rebuy", "limespot", "nosto"],
  },
  {
    id: "upsells",
    title: "Upsells and post-purchase",
    blurb: "Apps that offer more at the cart, the checkout and after the order.",
    slugs: ["aftersell", "reconvert", "zipify-ocu"],
  },
  {
    id: "bundles",
    title: "Bundles and bought-together",
    blurb: "Apps that sell products together and show what shoppers buy as a set.",
    slugs: ["cbb-frequently-bought-together", "fast-bundle"],
  },
  {
    id: "finders",
    title: "Product finders",
    blurb: "Quizzes and finders that turn a few answers into a shortlist.",
    slugs: ["octane-ai", "revenuehunt"],
  },
  {
    id: "inventory",
    title: "Inventory and purchase orders",
    blurb: "Apps that forecast demand and plan what to reorder.",
    slugs: ["inventory-planner", "prediko"],
  },
  {
    id: "ab-testing",
    title: "A/B testing",
    blurb: "Apps that test prices, pages and themes against each other.",
    slugs: ["intelligems", "shoplift"],
  },
  {
    id: "seo-content",
    title: "SEO and content",
    blurb: "Apps that fix product pages, images and structured data for search, and write blog posts.",
    slugs: ["tinyimg", "searchpie", "seowill"],
  },
  {
    id: "seo-audits",
    title: "SEO audits",
    blurb: "Apps that scan your store for search problems and fix them.",
    slugs: ["plug-in-seo", "booster-seo"],
  },
  {
    id: "product-content",
    title: "Product content",
    blurb: "Tools that write product descriptions and catalogue copy.",
    slugs: ["describely", "hypotenuse"],
  },
  {
    id: "discounts",
    title: "Discounts and promotions",
    blurb: "Apps that run sales, automatic discounts and promotion rules.",
    slugs: ["bold-discounts", "discount-ninja"],
  },
];

const GLOBAL_JOBS: readonly Job[] = [
  {
    id: "social-content",
    title: "Social media and content",
    blurb: "Tools for planning, writing and publishing posts across social channels.",
    slugs: ["hootsuite", "buffer", "jasper"],
  },
  {
    id: "reviews-listings",
    title: "Reviews and local listings",
    blurb: "Tools for collecting and answering reviews and keeping local business listings right.",
    slugs: ["birdeye"],
  },
];

const OTHER: Omit<Job, "slugs"> = { id: "more", title: "More comparisons", blurb: "Further comparisons, each with its sources and the date it was checked." };

export const jobsFor = (scope: DirectoryScope): readonly Job[] => (scope === "global" ? GLOBAL_JOBS : SHOPIFY_JOBS);

const inScope = (b: CompetitorBrief, scope: DirectoryScope) => compareRoute(b).global === (scope === "global");

/** The briefs of a scope whose page a visitor can open, in brief order. */
export function visibleBriefs(scope: DirectoryScope): CompetitorBrief[] {
  return COMPETITOR_BRIEFS.filter((b) => inScope(b, scope) && canOpen(getPage(b.pageId)));
}

const compareCard = (b: CompetitorBrief, extra?: Pick<DirectoryItem, "body">): DirectoryItem => {
  const page = getPage(b.pageId);
  return {
    title: `Peakhour vs ${b.name}`,
    body: extra?.body ?? b.category,
    href: pathFor(page.pageId),
    meta: `Checked ${b.observedAt}`,
    ...(isPublishable(page) ? {} : { draft: true }),
  };
};

/** The groups of a directory: the jobs, each with the cards a visitor can open, and any brief no job names under "More comparisons". */
export function directoryGroups(scope: DirectoryScope): DirectoryGroup[] {
  const briefs = visibleBriefs(scope);
  const named = new Set(jobsFor(scope).flatMap((j) => j.slugs));
  const jobs = [...jobsFor(scope), { ...OTHER, slugs: briefs.filter((b) => !named.has(b.slug)).map((b) => b.slug) }];
  return jobs.flatMap((j) => {
    const items = j.slugs.flatMap((slug) => {
      const b = briefs.find((x) => x.slug === slug);
      return b ? [compareCard(b)] : [];
    });
    return items.length > 0 ? [{ id: j.id, eyebrow: "Compared", title: j.title, blurb: j.blurb, items }] : [];
  });
}

const FAQS: DirectoryContent["faqs"] = [
  {
    q: "How are these comparisons checked?",
    a: "Every claim about another product comes from that vendor's own public pages, with the date it was read. A feature we could not find documented shows as Not documented, never as No.",
  },
  {
    q: "Is every comparison in Peakhour's favour?",
    a: "No. Each page says where the other product is the better fit as well as where Peakhour is.",
  },
  {
    q: "Where do Peakhour's prices appear?",
    a: "Peakhour is priced in Peaks, not in money, so the pricing section of each page links to the pricing page instead of quoting a figure.",
  },
];

/** The content of /shopify/compare or /compare, read from the briefs and the registry. */
export function directoryContent(scope: DirectoryScope): DirectoryContent {
  const pageId = scope === "global" ? "compare" : "shopify.compare";
  const shopify = scope === "shopify";
  return {
    crumbs: [
      { label: "Home", href: pathFor("home") },
      ...(shopify ? [{ label: "Shopify", href: pathFor("shopify") }] : []),
      { label: "Compare", href: pathFor(pageId) },
    ],
    eyebrow: "Comparisons",
    directAnswer: shopify
      ? "Side-by-side comparisons of Peakhour with the apps and tools Shopify merchants weigh it against. Every claim has a source and the date it was read, and each page says where the other product is the better fit."
      : "Side-by-side comparisons of Peakhour with the tools businesses weigh it against. Every claim has a source and the date it was read, and each page says where the other product is the better fit.",
    groups: directoryGroups(scope),
    faqs: FAQS,
    related: shopify
      ? [
          { label: "Peakhour for Shopify", href: pathFor("shopify"), note: "What the Shopify app does, on one page." },
          { label: "Every Shopify feature", href: pathFor("shopify.features"), note: "Each feature with its status." },
          { label: "Peakhour pricing in Peaks", href: pathFor("pricing"), note: "What the plan includes and how Peaks are used." },
        ]
      : [
          { label: "Every Peakhour feature", href: pathFor("features.index"), note: "Each feature with its status." },
          { label: "Peakhour for Shopify", href: pathFor("shopify"), note: "What the Shopify app does, on one page." },
          { label: "Peakhour pricing in Peaks", href: pathFor("pricing"), note: "What the plan includes and how Peaks are used." },
        ],
    // The closing band's words match the page's own button (Install on Shopify, or Join the waitlist) and fit every comparison listed.
    closing: shopify
      ? { headline: "See it on your own store.", body: "Install Peakhour on your Shopify store and see it work on your own products and orders." }
      : { headline: "See it on your own business.", body: "Join the waitlist and we will walk you through Peakhour using your own accounts." },
  };
}

const PRIORITY: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
const priorityOf = (b: CompetitorBrief) => PRIORITY[CANDIDATES.find((c) => c.pageId === b.pageId)?.priority ?? "P2"] ?? 2;

/** The few comparisons /shopify shows: the audit's highest priority first, then brief order. Only those a visitor can open. */
export function topComparisons(limit = 3): DirectoryItem[] {
  return visibleBriefs("shopify")
    .map((b, i) => ({ b, i }))
    .sort((a, z) => priorityOf(a.b) - priorityOf(z.b) || a.i - z.i)
    .slice(0, limit)
    .map(({ b }) => compareCard(b));
}

/**
 * The Shopify comparisons whose table covers a page's capability (a row whose Peakhour cell is claimed on one of the page's
 * capabilityIds), for the "Compared with other apps" section of a Shopify feature page. Each card names the rows.
 */
export function comparedWith(page: Pick<PageRecord, "capabilityIds">): DirectoryItem[] {
  if (page.capabilityIds.length === 0) return [];
  return visibleBriefs("shopify").flatMap((b) => {
    const rows = b.claims.filter((c) => c.peakhour.capabilityId && page.capabilityIds.includes(c.peakhour.capabilityId));
    if (rows.length === 0) return [];
    return [compareCard(b, { body: `Compares ${rows.map((r) => r.dimension.replace(/\.$/, "")).join("; ")}.` })];
  });
}
