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

/** An extra section on a feature page: a short explanation, with an optional grid of named parts. */
export type DetailSectionContent = {
  id: string;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  /**
   * Named parts of the feature (a kind of shelf, a step of a flow). An odd last card spans the row, so any count is safe.
   * `linkLabel` is the descriptive anchor text when `href` is set (never "read more").
   */
  items?: { title: string; body: string; href?: string; linkLabel?: string }[];
  /** What this part does NOT do, shown under the items. */
  limitations?: string[];
};

/** Permissions the app really asks for; or, when the feature asks for none of its own, a note that says so (never an empty list). */
export type PermissionsContent =
  | { permissions: { name: string; why: string }[]; permissionsNote?: undefined }
  | { permissions: []; permissionsNote: string };
export type ShopifyFeatureContent = BaseContent & PermissionsContent & {
  /** Sections between the status and the setup, for what the feature is made of (Smart Rails kinds, Find my match). */
  sections?: DetailSectionContent[];
  status: ReleaseStatus;
  limitations: string[];
  verifiedAt: string;
  setupSteps: StepItem[];
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

/** "Peakhour Suite gives more": what Peakhour does beyond the rows of a comparison, each card from an approved claim. */
export type MoreContent = {
  heading: string;
  intro: string;
  items: DirectoryItem[];
  /** The way on to every feature (the directories), only those a visitor can open. */
  links: LinkItem[];
};

export type ComparisonPageContent = BaseContent & {
  /** Built by buildComparisonContent for every brief; optional so a hand-made content object still renders. */
  more?: MoreContent;
  comparison: ComparisonContent;
  buyerUseCases: { title: string; body: string }[];
  pricing: {
    /** ISO date the prices were read. Each row states its own currency and region in its plan label. */
    asOf: string;
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

/**
 * A card of a directory. `href` is a page or a section of one; without it the card is plain text (a feature with no page to
 * open yet). `status` is the capability record's, and is left out where no record covers the feature.
 */
export type DirectoryItem = {
  title: string;
  body: string;
  href?: string;
  status?: ReleaseStatus;
  pillar?: string;
  /** A small line under the body (a comparison card's "Checked <date>"). */
  meta?: string;
  /** The linked page is a draft: a "Draft" chip shows, so a reviewer on dev never mistakes the card for a published page. */
  draft?: boolean;
};
/** A heading over a run of cards, for a directory that groups its features (the Shopify directory groups like the app). */
export type DirectoryGroup = { id: string; eyebrow: string; title: string; blurb: string; items: DirectoryItem[] };
/** One flat grid (`items`), or the groups of a directory that groups its features (`groups`): never both. */
export type DirectoryContent = BaseContent &
  (
    | { items: DirectoryItem[]; /** The heading over the grid. */ listTitle?: string; groups?: undefined }
    | { groups: DirectoryGroup[]; items?: undefined; listTitle?: undefined }
  );
/** Every card of a directory, flat. */
export const directoryItems = (c: DirectoryContent): DirectoryItem[] => c.groups?.flatMap((g) => g.items) ?? c.items ?? [];

/** One thing a module does (or will), with the status the capability record gives it on its surface. */
export type HubItem = {
  title: string;
  body: string;
  status: ReleaseStatus;
  surface: Surface;
  /** What it does not do, one sentence, from the capability's limitations. */
  limitation?: string;
};
/** A module hub (/commerce, /growth ...): what runs today, what is coming, where, and where you stay in charge. */
export type HubContent = BaseContent & {
  items: HubItem[];
  /** Where it runs, one card per surface, each with its own status. */
  platforms: PlatformItem[];
  /** Where you stay in charge: the lines of the hero card. */
  control: string[];
  /** The hero card's heading, when "You stay in charge" is not what its lines say. */
  controlTitle?: string;
  /** Limits that belong to no one card (a channel that is not in the inbox), added to the one "What it does not do" block. */
  limits?: { title: string; text: string }[];
  /** Shown under the coming-soon heading, so a reader never mistakes it for a live feature. Empty for none. */
  comingSoonNote: string;
  /** The coming-soon band's heading when it needs to name the things ("Coming soon: WordPress"). */
  comingSoonTitle?: string;
  /** The heading over the platform cards ("Where it runs: Shopify, WhatsApp, WooCommerce"). */
  platformsTitle?: string;
};
