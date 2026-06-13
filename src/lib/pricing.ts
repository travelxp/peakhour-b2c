/**
 * Server-side helper for fetching country-resolved pricing from the
 * peakhour-api `/v1/platform/pricing` endpoint. Used by the marketing
 * /pricing page and the landing-page pricing section so both render
 * with the same currency for a given visitor.
 *
 * Country precedence on the API side:
 *   1. `?country=XX` query — passed explicitly when we already know it.
 *   2. Authenticated org subscription — N/A here (these pages are public).
 *   3. Vercel `x-vercel-ip-country` header — set on every request when
 *      deployed; absent in local dev.
 *   4. `"DEFAULT"` sentinel → USD via stripe.
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

/** A single tier within a product (e.g. commerce_assistant.lens). */
export interface ResolvedProductTier {
  key: string;
  name: string;
  tagline?: string;
  description?: string;
  /** cfg_feature keys granted by this tier. */
  features: string[];
  limits: Record<string, number | undefined>;
  highlightAsRecommended: boolean;
  version: number;
  pricing: PricingEntry;
}

/** A product with its resolved tiers (e.g. Commerce Assistant: [Lens, Commerce]). */
export interface ResolvedProduct {
  key: string;
  name: string;
  tagline?: string;
  pillar: string;
  status: string;
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
    return { products: [], ...json.data };
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
  return `${p.displayPrefix ?? ""}${p.monthly.toLocaleString()}`;
}

export function formatYearly(p: PricingEntry): string {
  if (p.yearly === 0) return `${p.displayPrefix ?? ""}0`;
  return `${p.displayPrefix ?? ""}${p.yearly.toLocaleString()}`;
}

/**
 * Per-tier marketing bullets. Keys mirror `PlanKey`. Kept here (not in
 * cfg_features.tagline) so marketing can tune the comparison copy
 * without a DB write — these are the punchy "what you get on this
 * tier" lines, not the technical feature descriptions.
 */
export const PLAN_BULLETS: Record<PlanKey, string[]> = {
  free: [
    "1 LinkedIn page",
    "10 AI-generated posts / month",
    "Basic content engine",
  ],
  starter: [
    "3 LinkedIn pages",
    "100 posts / month",
    "Voice card synthesis",
    "Full content engine",
    "14-day trial",
  ],
  growth: [
    "5 LinkedIn pages",
    "500 posts / month",
    "Hook DNA rewrite + AQS engager scoring",
    "Boost recommender",
    "Multi-business workspace",
    "14-day trial",
  ],
  agency: [
    "25 LinkedIn pages × 25 businesses",
    "2,000 posts / month",
    "Client labels & permissions",
    "SSO + audit log",
    "Everything in Growth",
    "14-day trial",
  ],
  enterprise: [
    "Unlimited everything",
    "White-label",
    "Custom AI model keys (BYOK)",
    "Dedicated success manager",
    "SSO + audit log",
  ],
};

/**
 * Display labels for cfg_feature keys used in product tier comparison cards.
 * Keyed by the feature key stored in cfg_features / cfg_plans.features[].
 * Kept client-side so marketing can tune copy without a DB write.
 */
export const FEATURE_LABELS: Record<string, string> = {
  "commerce.assistant": "Live AI commerce assistant",
  "commerce.catalog_sync": "Automatic catalog sync",
  "commerce.whatsapp": "WhatsApp shopping channel",
  "commerce.in_app_assistant": "In-app product assistant",
  "commerce.multilingual": "Multilingual replies (inc. Hinglish)",
  "commerce.insights_network": "Insights Network access",
};
