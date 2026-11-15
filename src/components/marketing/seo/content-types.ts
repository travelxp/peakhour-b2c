import type { ReleaseStatus, Surface } from "@/lib/seo/types";
import type { ProductArt, ProductTint } from "@/components/marketing/shopify/shopify-art";

/**
 * The content each template takes beside its PageRecord. The PageRecord owns the identity of the page (h1, primary CTA,
 * path, status); these objects own the words and the evidence. Every list is plain data, so a registry or a CMS can
 * build one, and a template stays a pure function of (record, content).
 */

export type Crumb = { label: string; href: string };
export type Cta = { label: string; href: string };
export type LinkItem = { label: string; href: string; note?: string };
export type FaqItem = { q: string; a: string };
export type StepItem = { title: string; body: string };
export type ProofTile = { art: ProductArt; tint: ProductTint; label: string };

/** What a picture on the page is. Bible 11.3: a mock-up is never passed off as a product screenshot. */
export type ProofKind = "demo" | "sample" | "screenshot";
export type ProofContent = {
  kind: ProofKind;
  caption: string;
  title?: string;
  /** Product art tiles (the sample store). Used when `image` is absent. */
  tiles?: ProofTile[];
  /** A real screenshot. Alt text is required. */
  image?: { src: string; alt: string; width: number; height: number };
};

export type PlatformItem = {
  surface: Surface;
  label: string;
  status: ReleaseStatus;
  body: string;
  href?: string;
  limitations?: string[];
};

/** Comparison cell values (Bible 7.4). "Not documented" is never rendered as "No". */
export type CellValue = "yes" | "partial" | "not-documented" | "not-supported" | "unknown";
export type ComparisonCell = {
  value: CellValue;
  note?: string;
  source?: { href: string; label: string };
  /** ISO date the source was read. */
  observedAt?: string;
};
export type ComparisonVendor = { id: string; name: string; url?: string; isPeakhour?: boolean };
export type ComparisonRow = { dimension: string; cells: Record<string, ComparisonCell> };
export type ComparisonContent = {
  vendors: ComparisonVendor[];
  rows: ComparisonRow[];
  /** ISO date of the last full check. */
  lastChecked: string;
};

export type BaseContent = {
  crumbs: Crumb[];
  eyebrow: string;
  /** The direct answer: the first substantive text on the page (Bible 11.1). */
  directAnswer: string;
  secondaryCta?: Cta;
  faqs: FaqItem[];
  /** Two to six related links with descriptive anchors. */
  related: LinkItem[];
  closing: { headline: string; body: string };
  proof?: ProofContent;
};

export type FeatureContent = BaseContent & {
  /** What the feature does, in merchant words. */
  status: ReleaseStatus;
  limitations: string[];
  verifiedAt: string;
  platforms: PlatformItem[];
  steps: StepItem[];
  prerequisites: string[];
  approvalBoundaries: string[];
  integrations: LinkItem[];
  pricingNote: string;
};

export type ShopifyFeatureContent = BaseContent & {
  status: ReleaseStatus;
  limitations: string[];
  verifiedAt: string;
  setupSteps: StepItem[];
  /** Permissions only as the app really asks for them. */
  permissions: { name: string; why: string }[];
  /** The global page this variant stays a child of (Bible 7.1). */
  globalPage: LinkItem;
};

export type SolutionContent = BaseContent & {
  problem: { heading: string; body: string };
  alternatives: { name: string; body: string }[];
  steps: StepItem[];
  examples: { title: string; body: string }[];
  kpis: { name: string; definition: string }[];
  prerequisites: string[];
};

export type IndustryContent = BaseContent & {
  problem: string;
  useCases: { title: string; body: string; pillar: string }[];
  integrations: LinkItem[];
  risks: string[];
  platforms: PlatformItem[];
};

export type PlatformContent = BaseContent & {
  platforms: PlatformItem[];
  included: { label: string; status: ReleaseStatus; body: string }[];
  steps: StepItem[];
};

export type IntegrationContent = BaseContent & {
  status: ReleaseStatus;
  limitations: string[];
  verifiedAt: string;
  does: string[];
  data: { name: string; why: string }[];
  steps: StepItem[];
};

export type ComparisonPageContent = BaseContent & {
  comparison: ComparisonContent;
  buyerUseCases: { title: string; body: string }[];
  pricing: {
    asOf: string;
    currency: string;
    country: string;
    rows: { vendor: string; plan: string; price: string; source?: { href: string; label: string } }[];
  };
  suitability: { vendor: string; bestFor: string }[];
  limitations: string[];
  author: string;
  reviewer: string;
};

export type GuideSection = { id: string; heading: string; paragraphs: string[]; list?: string[] };
export type GuideContent = BaseContent & {
  author: string;
  reviewer: string;
  updatedAt: string;
  sections: GuideSection[];
  sources: LinkItem[];
};

export type DirectoryItem = { title: string; body: string; href: string; status: ReleaseStatus; pillar?: string };
export type DirectoryContent = BaseContent & {
  items: DirectoryItem[];
};
