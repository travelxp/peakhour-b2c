/**
 * Server-side helper for fetching country-resolved pricing from the
 * peakhour-api `/v1/platform/pricing` endpoint. Used by the marketing
 * /pricing pages, the landing hero and /auth — the last two for the free-Peaks
 * figure only, not for prices.
 *
 * Country precedence on the API side:
 *   1. `?country=XX` query — passed explicitly when we already know it.
 *   2. Authenticated org subscription — N/A here (these pages are public).
 *   3. Vercel `x-vercel-ip-country` header — set on every request when
 *      deployed; absent in local dev.
 *
 * ⚠ There is NO `"DEFAULT"` sentinel. The route validates the query param
 * against /^[A-Za-z]{2}$/, so `?country=DEFAULT` fails validation and falls
 * through to the header chain — passing it is identical to passing nothing,
 * and the response comes back geo-resolved (from Vercel's egress region, not
 * the visitor's). Callers that pass `"DEFAULT"` do so only to pin a single
 * cache key, and must read ONLY country-independent fields such as
 * `peaksIncluded`. Never read a price off such a response: you would serve
 * every visitor the currency of whichever region happened to fill the cache.
 *
 * To keep the marketing surface fast, we pass the detected country
 * explicitly (read by the caller from `headers()`) AND fall back to
 * letting the API resolve it via its own header chain if the b2c is
 * called from somewhere that didn't pass `country`.
 */

import { unstable_cache as cache } from "next/cache";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export type PlanKey = "free" | "starter" | "growth" | "agency" | "enterprise";

export interface PricingEntry {
  currency: string;
  monthly: number;
  yearly: number;
  trialDays: number;
  foundingDiscountPct: number;
  billingProviderKey: string;
  taxIncluded: boolean;
  gstApplicable: boolean;
  vatApplicable: boolean;
  displayPrefix?: string;
  tagline?: string;
  /** Per-Business add-on price (paid plans). Absent = single-Business plan. */
  additionalBusinessMonthly?: number;
  additionalBusinessYearly?: number;
}

export interface ResolvedPlan {
  key: PlanKey;
  name: string;
  tagline?: string;
  description?: string;
  features: string[];
  limits: Record<string, number | undefined>;
  highlightAsRecommended: boolean;
  version: number;
  pricing: PricingEntry;
}

/** A cfg_feature granted by a tier, enriched with its catalog display copy. */
export interface ResolvedFeature {
  key: string;
  /** cfg_features.name — the catalog's own display label (source of truth). */
  name: string;
  tagline?: string;
  /** cfg_features.useCases — jobs-to-be-done copy, when the catalog ships it. */
  useCases?: string[];
}

/** A single tier within a product (e.g. commerce_assistant.lens). */
export interface ResolvedProductTier {
  key: string;
  name: string;
  tagline?: string;
  description?: string;
  /** cfg_feature keys granted by this tier. */
  features: string[];
  /**
   * The same features enriched with catalog name/tagline, ordered by the
   * catalog's sortOrder. Present from the API; absent on older API responses
   * (the component then falls back to `features` + `featureLabel`).
   */
  featureDetails?: ResolvedFeature[];
  limits: Record<string, number | undefined>;
  highlightAsRecommended: boolean;
  version: number;
  pricing: PricingEntry;
  /** Included free Peaks/month for this tier (undefined = none/unlimited). */
  peaksIncluded?: number;
  /** Integration keys this tier unlocks (present on newer API responses). */
  allowedIntegrations?: string[];
}

/** A delivery channel available in this env, with its purchase path. */
export interface ResolvedChannel {
  key: string;
  status: string;
  purchaseMode: string;
}

/** A product with its resolved tiers (e.g. Commerce Assistant: [Lens, Commerce]). */
export interface ResolvedProduct {
  key: string;
  name: string;
  tagline?: string;
  pillar: string;
  status: string;
  /** Delivery channels available in this env (in_development/hidden suppressed
   *  in prod), each with its per-channel status + purchase path. */
  channels?: ResolvedChannel[];
  tiers: ResolvedProductTier[];
}

export interface PricingResponse {
  country: string;
  plans: ResolvedPlan[];
  /** Product-scoped tiers (env-gated: empty in prod when product is in_development). */
  products: ResolvedProduct[];
}

/**
 * Cached server fetch — pricing changes infrequently (every supersede
 * via the CMS FormWizard), so a 5-minute revalidate window is plenty.
 * Cache key includes the country so an IN visitor and a US visitor
 * don't share each other's pricing.
 */
async function fetchPricing(country: string): Promise<PricingResponse | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(
      `${API_URL}/v1/platform/pricing?country=${encodeURIComponent(country)}`,
      { next: { revalidate: 300, tags: ["platform-pricing"] } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: PricingResponse };
    if (!json.ok || !json.data) return null;
    // Normalise: API before this PR omits `products` — default to empty array.
    return { ...json.data, products: json.data.products ?? [] };
  } catch {
    return null;
  }
}

export const getPricing = cache(
  fetchPricing,
  ["platform-pricing"],
  // Tag-based revalidate — pricing surfaces use this so a future
  // /v1/cms/plans supersede can invalidate via revalidateTag().
  { revalidate: 300, tags: ["platform-pricing"] },
);

/**
 * Format a pricing entry as "₹3,499" or "$49" — leans on the entry's
 * `displayPrefix` for the currency symbol so the API stays in charge
 * of i18n strings rather than the b2c hardcoding rupee vs dollar.
 *
 * Free / Enterprise both ship `monthly: 0` — they're differentiated by
 * the entry's `tagline` ("Free forever" / "Contact sales") which the
 * caller decides whether to render in place of the price.
 */
export function formatMonthly(p: PricingEntry): string {
  if (p.monthly === 0) return `${p.displayPrefix ?? ""}0`;
  return `${p.displayPrefix ?? ""}${formatNumber(p.monthly)}`;
}

export function formatYearly(p: PricingEntry): string {
  if (p.yearly === 0) return `${p.displayPrefix ?? ""}0`;
  return `${p.displayPrefix ?? ""}${formatNumber(p.yearly)}`;
}

/* ── The founding offer ─────────────────────────────────────────────────── */

/**
 * `foundingDiscountPct` has been on every pricing entry since the catalog was
 * built, is carried through the resolver into this type — and until now was
 * read by nothing. It is the launch mechanism the platform already has, which
 * is why the Suite's launch price needs no promotions engine.
 *
 * ⚠ DISPLAY ONLY. Nothing in this repo charges anyone. When checkout goes
 * live, the amount collected must come from the same field server-side — a
 * marketing page that advertises half price while the gateway bills full price
 * is the worst possible version of this feature. The schema's own comment
 * ("waitlist members get this when checkout flips on") is the contract.
 */
export function hasFoundingOffer(p: PricingEntry): boolean {
  return p.foundingDiscountPct > 0 && p.foundingDiscountPct < 100 && p.monthly > 0;
}

/**
 * The discounted amount, floored to a whole unit of currency.
 *
 * Every price in this catalog is quoted in whole units (₹4,999, $59), so a
 * rendered "₹2,499.50" would be a price no invoice will ever show. Something
 * has to round.
 *
 * ★AND FLOOR IS NOT THE CONSERVATIVE CHOICE — an earlier version of this
 * comment claimed it was, which was backwards and worth correcting rather than
 * deleting. Flooring displays the LOWEST candidate, so if the gateway ever
 * rounds to nearest it charges ₹2,500 against a page promising ₹2,499. The
 * safe-by-construction fix is not a rounding rule here, it is a list price
 * that halves cleanly: ₹4,999 × 50% = 2499.5 is the only reason any of this
 * arithmetic is load-bearing.
 *
 * Floor is chosen because ₹2,499 is the price the owner set out to offer and
 * the one the catalog's 50% is reverse-engineered from. The obligation that
 * follows is on the server: whatever computes the charge MUST floor too. See
 * `hasFoundingOffer` for the display-only warning this pairs with.
 */
function applyDiscount(amount: number, pct: number): number {
  return Math.floor((amount * (100 - pct)) / 100);
}

export function foundingMonthly(p: PricingEntry): number {
  return applyDiscount(p.monthly, p.foundingDiscountPct);
}

export function foundingYearly(p: PricingEntry): number {
  return applyDiscount(p.yearly, p.foundingDiscountPct);
}

/** "₹2,499" — the founding monthly price, formatted like every other price. */
export function formatFoundingMonthly(p: PricingEntry): string {
  return `${p.displayPrefix ?? ""}${formatNumber(foundingMonthly(p))}`;
}

export function formatFoundingYearly(p: PricingEntry): string {
  return `${p.displayPrefix ?? ""}${formatNumber(foundingYearly(p))}`;
}

/**
 * Account-level bundle plans (`cfg_plans` rows that compose every product).
 * The resolver surfaces these as a tier *under each product* they list, keyed
 * by the bare plan key (`agency`/`enterprise`/`suite`) rather than a
 * `<product>.<tier>` key. The pricing surface separates them out: they never
 * belong in a single pillar's Free-vs-Paid table.
 *
 * `suite` is listed AHEAD of the plan existing, and that ordering is the whole
 * point. A cross-product plan appears as a tier under every product it lists,
 * so an unfiltered Suite row becomes a column in every pillar's tier list.
 *
 * Today the damage is bounded by luck: `proTier()` prefers a tier carrying
 * `highlightAsRecommended`, both the module tier and Suite would carry it, and
 * cheapest-first sorting hands back the module tier. That stops holding the
 * moment the per-module tiers are retired in favour of Suite — drop the flag on
 * `commerce_assistant.paid` and the Commerce page starts quoting the Suite
 * price for Commerce. Filtering before the plan exists means the catalog change
 * and the pricing change land as separate, deliberate decisions rather than as
 * one deploy order.
 *
 * Agency and Enterprise route to /pricing/teams. Suite will get its own
 * treatment on the hub and on each module page; until that ships, being in
 * this set means the per-pillar pages ignore it, which is the correct
 * behaviour for a plan the pages cannot yet describe.
 */
export const BUNDLE_PLAN_KEY_LIST = ["agency", "enterprise", "suite"] as const;

/** A bundle plan's key, derived from the list so the two cannot drift. */
export type BundlePlanKey = (typeof BUNDLE_PLAN_KEY_LIST)[number];

export const BUNDLE_PLAN_KEYS: ReadonlySet<string> =
  new Set(BUNDLE_PLAN_KEY_LIST);

/** True when a tier is an account-level bundle (Agency/Enterprise/Suite), not
 *  a product-specific Free/Paid tier. */
export function isBundleTier(tier: ResolvedProductTier): boolean {
  return BUNDLE_PLAN_KEYS.has(tier.key);
}

/**
 * The product's own Free/Paid tiers — bundle plans removed (BUNDLE_PLAN_KEYS) —
 * sorted cheapest-first so Free leads and the paid tier(s) follow. This is what
 * a single pillar's comparison table renders as its columns.
 */
export function productTiers(product: ResolvedProduct): ResolvedProductTier[] {
  return product.tiers
    .filter((t) => !isBundleTier(t))
    .sort((a, b) => a.pricing.monthly - b.pricing.monthly);
}

/**
 * A product's own free tier, or undefined if it has none.
 *
 * The one definition of "free" — reach for this rather than
 * `product.tiers.find(t => t.pricing.monthly === 0)`, which is wrong twice
 * over.
 *
 * First, it searches the raw tier list, which includes the account-level
 * bundles. Enterprise is sales-led: it carries no matrix price, so it reads as
 * `monthly: 0, yearly: 0` while granting 100k Peaks. (Agency is NOT a price
 * trap — it is fully priced, ₹24,999/mo on live data — but it is still not a
 * product's free tier, so both are excluded by key via `isBundleTier`.)
 *
 * Second, the resolver sorts tiers by price and breaks ties alphabetically, so
 * among the zero-priced ones `"enterprise"` sorts BEFORE `"growth.free"` and
 * `"support_inbox.free"` — though AFTER `"commerce_assistant.free"`. The naive
 * find therefore lands on Enterprise for some products and the real free tier
 * for others, which is what makes the bug so easy to miss.
 *
 * Both intervals must be zero: a yearly-only plan is not free.
 */
export function freeTiers(product: ResolvedProduct): ResolvedProductTier[] {
  return productTiers(product).filter(
    (t) => t.pricing.monthly === 0 && t.pricing.yearly === 0,
  );
}

/** The product's free tier — the cheapest one first, for surfaces that show a
 *  single Free column. Products carry one today; `freeTiers` is the honest
 *  plural for callers that must not assume that (see minFreePeaksPerMonth). */
export function freeTier(product: ResolvedProduct): ResolvedProductTier | undefined {
  return freeTiers(product)[0];
}

/**
 * The tier a pillar sells as "Pro" — the paid one the catalog marks as
 * recommended, falling back to the cheapest paid tier when it marks none.
 *
 * Bundles are excluded by `productTiers`, which matters here for the same
 * reason it matters in `freeTier`: Enterprise is sales-led and priced 0/0, so
 * a naive "first tier with a price" search over the raw list would skip it —
 * but Agency IS priced (₹24,999/mo) and would win outright, putting the
 * account-level bundle on a single pillar's Pro card.
 */
export function proTier(product: ResolvedProduct): ResolvedProductTier | undefined {
  const paid = productTiers(product).filter((t) => t.pricing.monthly > 0);
  return paid.find((t) => t.highlightAsRecommended) ?? paid[0];
}

/**
 * The smallest monthly Peaks grant on any free plan — i.e. the amount every
 * free plan is guaranteed to include at minimum.
 *
 * Deliberately the MINIMUM, not the sum. The wallet is one pool and grants do
 * stack (peakhour-api's `stackCreditAllowance` adds up every plan an org
 * holds), so someone on all five free pillars really does get five grants —
 * but quoting that total would promise a five-pillar signup to a visitor who
 * may only ever take one. The floor is true for everybody.
 *
 * Bundles are excluded (see `freeTier`), which is load-bearing rather than
 * tidiness — Enterprise is sales-led, priced at 0/0, and grants 100k Peaks.
 *
 * Only `live` products count. The resolver does NOT narrow to live for us: in
 * prod it merely suppresses in_development/hidden (so `coming_soon` still
 * arrives), and outside prod it applies no status filter at all. Since this
 * number sits beside "free plan on every pillar" as something you get on
 * signup, a pillar you can't sign up for yet must not set the floor — nor
 * should a half-built dev product quietly move the figure on devapi.
 *
 * Returns null when pricing is unavailable (the caller falls back to
 * FREE_PEAKS_FALLBACK) or when no free tier advertises a grant. A grant of 0
 * counts as nothing to advertise rather than as a minimum of zero — otherwise
 * one credit-less free tier would drag the headline to "0+ free Peaks/mo",
 * which `?? FREE_PEAKS_FALLBACK` could not rescue (0 is not nullish).
 */
export function minFreePeaksPerMonth(pricing: PricingResponse | null): number | null {
  if (!pricing) return null;
  let min: number | null = null;
  for (const product of pricing.products) {
    if (product.status !== "live") continue;
    // Every free tier, not just the first: if a product ever ships two, the
    // floor is the smaller grant, and picking one would overstate it.
    for (const tier of freeTiers(product)) {
      const peaks = tier.peaksIncluded;
      if (typeof peaks !== "number" || peaks <= 0) continue;
      min = min === null ? peaks : Math.min(min, peaks);
    }
  }
  return min;
}

/**
 * Shown when the pricing API is unreachable, mirroring how the landing page
 * keeps a static integrations list for the same case. Matches the catalog at
 * the time of writing (every free tier grants 500); it is a degraded mode, not
 * a source of truth — `minFreePeaksPerMonth` is.
 */
export const FREE_PEAKS_FALLBACK = 500;

/**
 * Grouping separators for every number on the pricing surface — prices and
 * Peaks alike.
 *
 * The locale is pinned rather than left to `toLocaleString()`'s default,
 * which on the server is the host's ICU locale (LANG/LC_ALL) and so varies
 * between a laptop, CI and Vercel. Pinning also keeps one card internally
 * consistent: prices and Peaks used to run through different code paths, so
 * an en-IN host rendered "₹2,49,999" beside "100,000" — Indian grouping for
 * the price, Western for the allowance.
 *
 * en-US (not en-IN) because the surface is priced for a global audience and
 * quotes USD alongside INR; revisit alongside real localisation, at which
 * point this should take the active locale rather than a constant.
 */
const NUMBER_LOCALE = "en-US";

export function formatNumber(value: number): string {
  return value.toLocaleString(NUMBER_LOCALE);
}

/** Peaks amounts. Alias of formatNumber — named for the call sites so the
 *  intent reads at a glance. */
export const formatPeaks = formatNumber;

/**
 * Find a bundle tier (Agency/Enterprise/Suite) anywhere in the response.
 * Bundle plans appear as a tier under every product they compose, so the first
 * occurrence carries the canonical price + Peaks allowance (identical across
 * products). Returns undefined when the bundle isn't publicly listed in this
 * env — which is the normal state for `suite` until the catalog seeds it.
 */
export function findBundleTier(
  pricing: PricingResponse | null,
  key: BundlePlanKey,
): ResolvedProductTier | undefined {
  if (!pricing) return undefined;
  for (const product of pricing.products) {
    const match = product.tiers.find((t) => t.key === key);
    if (match) return match;
  }
  return undefined;
}

/** All products under a given pillar. `pillar` isn't guaranteed 1:1 with a
 *  product (future pillars may span several), so callers group, not `.find`. */
export function pillarProducts(
  pricing: PricingResponse | null,
  pillar: string,
): ResolvedProduct[] {
  return (pricing?.products ?? []).filter((p) => p.pillar === pillar);
}

/** The lowest paid monthly price across a product's own tiers, or null when the
 *  product has no paid tier (free-only). Drives the hub card's "from" price. */
export function fromMonthly(product: ResolvedProduct): ResolvedProductTier | null {
  const paid = productTiers(product).filter((t) => t.pricing.monthly > 0);
  return paid[0] ?? null;
}

/**
 * Display labels for cfg_feature keys used in product tier comparison cards.
 * Keyed by the feature key stored in cfg_features / cfg_plans.features[].
 * Kept client-side so marketing can tune copy without a DB write.
 *
 * Keys are stored under the platform-agnostic `commerce.<leaf>` form. The
 * catalog namespaces commerce features per platform — Shopify ships them
 * un-namespaced (`commerce.assistant`, migration 053) while WooCommerce ships
 * them platform-scoped (`commerce.woocommerce.assistant`, migration 054).
 * `featureLabel()` collapses the platform segment so a single entry covers both.
 */
export const FEATURE_LABELS: Record<string, string> = {
  "commerce.product_descriptions": "AI product descriptions",
  "commerce.assistant": "Live AI commerce assistant",
  "commerce.catalog_sync": "Automatic catalog sync",
  "commerce.whatsapp": "WhatsApp shopping channel",
  "commerce.in_app_assistant": "In-app product assistant",
  "commerce.multilingual": "Multilingual replies (inc. Hinglish)",
  "commerce.insights_network": "Insights Network access",
  "commerce.inventory": "Inventory intelligence",
  "commerce.smart_rails": "Self-updating product showcases",
  "commerce.brand_voice": "Brand-voice recommendations",
  "commerce.campaigns": "Daily campaign recommendations",
  "commerce.autopilot": "Autopilot",
  // Content pillar (content_studio — Scout / Peakhour Content). Fallback labels
  // for when the API response omits `featureDetails`; the catalog's own
  // cfg_features.name is preferred when present.
  "content.ai_draft": "AI article drafts",
  "content.autonomous_publish": "Autonomous publishing",
  "content.meta_sync": "AI SEO meta (Yoast / Rank Math / SEOPress)",
  "content.aeo_audit": "Answer-Engine (AEO) audit",
  "content.schema": "Structured data (schema)",
  "content.internal_links": "Internal link suggestions",
  "content.refresh": "Automatic content refresh",
  "content.brand_voice": "Brand-voice learning",
  "content.insights_lens": "Content Insights",
};

/** Platform segments that may sit between the category and the feature leaf. */
const PLATFORM_SEGMENTS = new Set(["shopify", "woocommerce"]);

/**
 * The platform-agnostic form of a feature key —
 * `commerce.woocommerce.assistant` → `commerce.assistant`, everything else
 * unchanged.
 *
 * Exported because it is an IDENTITY, not a formatting detail: two keys that
 * collapse to the same canonical form are the same capability wearing two
 * connector badges, and every surface that keys a map, a set or a comparison
 * row off a feature has to agree on that or it renders the same row twice.
 */
export function canonicalFeatureKey(key: string): string {
  const parts = key.split(".");
  if (parts.length >= 3 && PLATFORM_SEGMENTS.has(parts[1])) {
    return [parts[0], ...parts.slice(2)].join(".");
  }
  return key;
}

/**
 * Resolve a cfg_feature key to a human-readable label, platform-namespace
 * agnostic. Tries an exact match, then collapses a platform segment
 * (`commerce.woocommerce.assistant` → `commerce.assistant`), and finally falls
 * back to a humanized leaf token so an unmapped key never renders raw.
 */
export function featureLabel(key: string): string {
  if (FEATURE_LABELS[key]) return FEATURE_LABELS[key];

  const collapsed = canonicalFeatureKey(key);
  if (collapsed !== key && FEATURE_LABELS[collapsed]) return FEATURE_LABELS[collapsed];

  const parts = key.split(".");
  const leaf = parts[parts.length - 1] ?? key;
  return leaf
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
