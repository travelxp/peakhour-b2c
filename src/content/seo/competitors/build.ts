import type { ComparisonCell, ComparisonPageContent } from "@/components/marketing/seo/content-types";
import { getPage } from "@/lib/seo/pages";
import { pathFor } from "@/lib/seo/resolve";
import type { PageRecord } from "@/lib/seo/types";
import { buildMore } from "./more";
import { compareRoute } from "./route";
import type { CompetitorBrief, PeakhourClaim } from "./types";

/** The vendor id the kit's ComparisonTable keys Peakhour's column on. */
const PH = "ph";

/**
 * Builds the kit's page content from a brief and its registry record. Pure. Links come from the registry (the record's
 * relatedIds, through pathFor), so no marketing URL is typed here.
 */
export function buildComparisonContent(b: CompetitorBrief, page: PageRecord = getPage(b.pageId)): ComparisonPageContent {
  if (page.editorialStatus === "published" && !b.reviewer) {
    throw new Error(`${b.pageId} is published without a named reviewer`);
  }
  const home = getPage("home");
  const { global } = compareRoute(b);
  const shopify = getPage("shopify");
  const directory = getPage(global ? "compare" : "shopify.compare");
  return {
    crumbs: [
      { label: "Home", href: pathFor(home.pageId) },
      ...(global ? [] : [{ label: "Shopify", href: pathFor(shopify.pageId) }]),
      { label: "Compare", href: pathFor(directory.pageId) },
      { label: `Compare with ${b.name}`, href: pathFor(page.pageId) },
    ],
    eyebrow: "Comparison",
    directAnswer: b.directAnswer,
    secondaryCta: { label: "Read the limits", href: "#limits" },
    comparison: {
      lastChecked: b.observedAt,
      vendors: [
        { id: PH, name: "Peakhour", isPeakhour: true },
        { id: b.slug, name: b.name, url: b.url },
      ],
      rows: b.claims.map((c) => ({
        dimension: c.dimension,
        cells: { [PH]: publicCell(c.peakhour), [b.slug]: c.vendor },
      })),
    },
    more: buildMore(b),
    buyerUseCases: b.buyerUseCases,
    pricing: {
      asOf: b.observedAt,
      rows: [
        {
          vendor: "Peakhour",
          plan: "Peakhour Suite · priced in Peaks",
          price: "Priced in Peaks, not in money. See the pricing page.",
          source: { href: pathFor("pricing"), label: "Peakhour pricing" },
        },
        ...b.pricing.rows.map((r) => ({
          vendor: b.name,
          plan: `${r.plan} · ${r.currency} · ${/^not stated/i.test(r.region) ? "region not stated" : r.region}`,
          price: r.price,
          source: r.source,
        })),
      ],
    },
    suitability: b.bestFor,
    limitations: b.limitations,
    reviewer: b.reviewer ?? "Pending review",
    faqs: b.faqs,
    related: page.relatedIds.map((id) => ({ label: getPage(id).title, href: pathFor(id) })),
    closing: global
      ? {
          headline: "See it on your own business.",
          body: "Join the waitlist and we will walk you through Peakhour using your own accounts.",
        }
      : {
          headline: "See it on your own store.",
          body: "Join the waitlist and we will show you the assistant and shelves on your catalogue.",
        },
  };
}

/** Only the public cell fields reach the page; the capability bookkeeping stays in the brief. */
function publicCell(c: PeakhourClaim): ComparisonCell {
  return { value: c.value, note: c.note, source: c.source, observedAt: c.observedAt };
}
