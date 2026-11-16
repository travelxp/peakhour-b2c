import type { CellValue } from "@/components/marketing/seo/content-types";

/**
 * A competitor brief (Bible 12): who is compared, the decision criteria, every claim with its source and observed
 * date, and the vendor's pricing exactly as it publishes it. Plain data: the page content is built from it in
 * ./build.ts, and the tests read it directly. Sources are the vendor's OWN public pages only (never a review site,
 * a forum or a rival's comparison).
 */

export type Source = { href: string; label: string };

/** A claim about the competitor. A Yes, Partial or Not supported claim needs a source and a date; never infer No from silence. */
export type VendorClaim = {
  value: CellValue;
  note?: string;
  source?: Source;
  /** ISO date the source was read. */
  observedAt?: string;
};

/**
 * A claim about Peakhour. A claimed cell (Yes, Partial, Not supported) names the registry capability it rests on
 * (`capabilityId`, which must carry an approved claim in src/lib/seo/capabilities.ts). An Unknown cell claims nothing;
 * it may name `pendingCapability`: an EXISTING capability id whose claim is not yet approved. Where no capability
 * exists at all, the cell is Unknown with neither id.
 */
export type PeakhourClaim = VendorClaim & {
  capabilityId?: string;
  pendingCapability?: string;
};

export type ClaimRow = {
  dimension: string;
  vendor: VendorClaim;
  peakhour: PeakhourClaim;
};

export type PricingRow = {
  plan: string;
  /** As the vendor states it, e.g. "₹2,799 per month, taxes extra", or "Not published". */
  price: string;
  /** ISO 4217 code as stated by the vendor; "(shown as $)" where the page uses a bare symbol. */
  currency: string;
  region: string;
  observedAt: string;
  source: Source;
};

export type CompetitorBrief = {
  slug: "aisensy" | "interakt" | "rep-ai" | "wati" | "zoko" | "gokwik";
  pageId: string;
  name: string;
  url: string;
  /** What the vendor is, in its own category. */
  category: string;
  observedAt: string;
  /** The registry title and description (60 and 160 characters at most) and the H1. */
  title: string;
  description: string;
  h1: string;
  directAnswer: string;
  buyerUseCases: { title: string; body: string }[];
  claims: ClaimRow[];
  pricing: { rows: PricingRow[] };
  bestFor: { vendor: string; bestFor: string }[];
  limitations: string[];
  faqs: { q: string; a: string }[];
  /** The named reviewer. Required before the page is published; "Pending review" shows until then. */
  reviewer?: string;
};
