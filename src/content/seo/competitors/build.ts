import type { ComparisonCell, ComparisonPageContent } from "@/components/marketing/seo/content-types";
import type { CompetitorBrief, PeakhourClaim } from "./types";

/** The vendor id the kit's ComparisonTable keys Peakhour's column on. */
const PH = "ph";

/** Builds the kit's page content from a brief. Pure: the brief is the only input. */
export function buildComparisonContent(b: CompetitorBrief): ComparisonPageContent {
  const peakhourPrice = {
    vendor: "Peakhour",
    plan: "Peakhour Suite",
    price: "Priced in Peaks, not in money. See the pricing page.",
    source: { href: "/pricing", label: "Peakhour pricing" },
  };
  return {
    crumbs: [
      { label: "Home", href: "/" },
      { label: "Shopify", href: "/shopify" },
      { label: `Compare with ${b.name}`, href: `/shopify/compare/${b.slug}` },
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
        cells: {
          [PH]: stripInternal(c.peakhour),
          [b.slug]: c.vendor,
        },
      })),
    },
    buyerUseCases: b.buyerUseCases,
    pricing: {
      asOf: b.observedAt,
      currency: b.pricing.currency,
      country: b.pricing.region,
      rows: [
        peakhourPrice,
        ...b.pricing.rows.map((r) => ({
          vendor: b.name,
          plan: `${r.plan} (${r.currency}, ${r.region}, seen ${r.observedAt})`,
          price: r.price,
          source: r.source,
        })),
      ],
    },
    suitability: b.bestFor,
    limitations: b.limitations,
    author: "Peakhour Growth",
    reviewer: "Pending review",
    faqs: b.faqs,
    related: [
      { label: "Peakhour for Shopify", href: "/shopify", note: "What Peakhour does on a Shopify store." },
      { label: "Peakhour pricing", href: "/pricing", note: "Prices in Peaks." },
      { label: "Join the launch-partner waitlist", href: "/launch-partner", note: "Get early access." },
    ],
    closing: {
      headline: "See it on your own store.",
      body: "Join the waitlist and we will show you the assistant and shelves on your catalogue.",
    },
  };
}

/** Only the public cell fields reach the page; the capability bookkeeping stays in the brief. */
function stripInternal(c: PeakhourClaim): ComparisonCell {
  return { value: c.value, note: c.note, source: c.source, observedAt: c.observedAt };
}
