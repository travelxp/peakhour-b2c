// src/lib/seo/types.ts — shared by SEO-2 (registries) and SEO-5 (template kit). Both lanes create this file with
// EXACTLY this content, so whichever merges second has an identical add and no conflict. Change it only through SEO-2.

/** Every locale the site is built for. Only PUBLISHED_LOCALES render; the rest 404 (plan section 6; owner 2026-11-15: finish English first). */
export type Locale = "en" | "fr-CA" | "fr" | "de" | "es" | "es-ES" | "pt-BR";
export const LOCALES: readonly Locale[] = ["en", "fr-CA", "fr", "de", "es", "es-ES", "pt-BR"];
export const DEFAULT_LOCALE: Locale = "en";
export const PUBLISHED_LOCALES: readonly Locale[] = ["en"];

export type Pillar = "presence" | "commerce" | "content" | "support" | "growth";

/** Where a capability runs. One capability, one record per surface (a live Shopify build says nothing about WooCommerce). */
export type Surface = "web" | "shopify" | "woocommerce" | "wordpress" | "whatsapp" | "google-business-profile";

export type ReleaseStatus = "idea" | "planned" | "development" | "beta" | "live" | "paused" | "retired";

export type CapabilityImplementation = {
  surface: Surface;
  status: ReleaseStatus;
  /** Repo-qualified code paths that prove it runs, e.g. "peakhour-api:src/v1/services/commerce/cod-lane.ts". */
  evidence: string[];
  /** cfg_features / cfg_integrations keys, when the catalog names it. */
  catalogKeys?: string[];
  /** ISO date the evidence was last read. */
  verifiedAt: string;
  /** What it does NOT do, in merchant words; templates show these. */
  limitations?: string[];
};

export type ApprovedClaim = {
  id: string;
  text: string;
  /** The lowest implementation status the claim needs on the page's surface. */
  requires: "beta" | "live";
  approvedBy: string;
  approvedAt: string;
};

export type Capability = {
  id: string; // e.g. "commerce.cod_confirmation"
  label: string;
  primaryPillar: Pillar;
  secondaryPillars?: Pillar[];
  implementations: CapabilityImplementation[];
  approvedClaims: ApprovedClaim[];
};

export type EditorialStatus = "idea" | "briefed" | "draft" | "review" | "approved" | "published" | "archived";

export type PageFamily =
  | "core" | "feature" | "solution" | "industry" | "platform" | "integration" | "compare" | "guide" | "tool"
  | "case-study" | "shopify-feature" | "shopify-solution" | "shopify-compare" | "shopify-alternatives"
  | "shopify-guide" | "shopify-tool";

export type PageScope = "global" | "shopify" | "wordpress" | "woocommerce";

export type CtaKind = "install" | "waitlist" | "contact" | "trial" | "launch-partner";

export type LocaleVariant = { path: string; status: "draft" | "review" | "published"; reviewer?: string; publishedAt?: string };

export type PageRecord = {
  /** Immutable, e.g. "shopify.features.whatsapp.cod.confirmation" (the audit CSV's id). */
  pageId: string;
  family: PageFamily;
  scope: PageScope;
  /** English path, no trailing slash. */
  path: string;
  parentId?: string;
  primaryPillar?: Pillar;
  /** Capabilities the page's claims lean on; the publish gate checks each on the page's surface. */
  capabilityIds: string[];
  /** The surface the page is about, for the gate: "shopify" for /shopify/*, else "web" unless stated. */
  surface: Surface;
  queryClusterId?: string;
  editorialStatus: EditorialStatus;
  indexable: boolean;
  title: string; // <= 60 chars
  description: string; // <= 160 chars
  h1: string;
  primaryCta: { label: string; href: string; kind: CtaKind };
  owner: string;
  lastReviewedAt: string; // ISO date; the sitemap's lastmod
  relatedIds: string[];
  /** Non-English variants only; English is `path`. */
  locales?: Partial<Record<Exclude<Locale, "en">, LocaleVariant>>;
};
