import type { ResolvedIntegration } from "@/lib/catalog";
import type { ChannelCategory, ChannelConfig, ChannelLifecycle } from "./channels.config";

/**
 * Maps the resolved platform catalog (CMS-driven, org-personalized, env-gated)
 * into the hub's ChannelConfig shape, so the Content Channels hub renders from
 * the catalog instead of the hardcoded channels.config.ts — while the existing
 * render logic (ChannelRow/StatusBadge/ChannelLogo/tabs) stays untouched.
 *
 * Two mappings carry the weight:
 *
 *  1. cfg_integrations.category (the platform enum) → the hub's tab. Anything
 *     unmapped falls into "Web & SEO" rather than being dropped — the hub must
 *     never silently hide a connectable channel just because a new category
 *     value appeared. (The resolver already strips adminOnly/internal infra
 *     rows, so only user-facing connectors reach here.)
 *
 *  2. resolver `surfacedState` → ChannelLifecycle. A connectable row with a
 *     dashboardPath is "live" (it has a manage surface); connectable without
 *     one is "available" (connect via the OAuth grid); coming_soon stays
 *     coming_soon; deprecated/locked/dev_only collapse to "available" so they
 *     remain reachable (the connect/manage routing + the API gates handle the
 *     rest).
 */

const CATEGORY_TO_TAB: Record<string, ChannelCategory> = {
  newsletter: "Newsletters",
  social_publish: "Social",
  social_engage: "Social",
  social_ads: "Ads",
  ecommerce: "Web & SEO",
  analytics: "Web & SEO",
  messaging: "Messaging",
  telephony: "Messaging",
  crm: "Web & SEO",
};

// Pure-infra categories that are NOT content connectors — drop them from the
// hub even if a future CMS row makes one public (the content hub is a curated
// connector surface; the integrations grid shows everything). `other` is NOT
// here — it's the bucket WordPress ships under, so it keeps the Web & SEO tab.
const DROP_CATEGORIES = new Set([
  "ai_provider",
  "data_provider",
  "webhook",
  "payment",
  "storage",
]);

const FALLBACK_TAB: ChannelCategory = "Web & SEO";

function toLifecycle(i: ResolvedIntegration): ChannelLifecycle {
  switch (i.surfacedState) {
    case "connectable":
      return i.display?.dashboardPath ? "live" : "available";
    case "coming_soon":
      return "coming_soon";
    // deprecated (existing connections work), locked (visible-but-gated), and
    // dev_only (non-prod testers) all remain reachable as "available".
    default:
      return "available";
  }
}

export function mapCatalogToChannels(integrations: ResolvedIntegration[]): ChannelConfig[] {
  // The resolver already strips adminOnly/internal in all envs and
  // in_development/hidden in prod; dev_only rows are intentionally shown in
  // non-prod so testers can exercise them. We additionally drop pure-infra
  // categories that aren't content connectors.
  return integrations
    .filter((i) => !DROP_CATEGORIES.has(i.category))
    .map((i) => ({
      slug: i.key,
      name: i.name,
      // Seed writes the one-liner into `description`; `tagline` is the
      // CMS-curated override. Fall back through both so the row never blanks.
      description: i.tagline ?? i.description ?? i.comingSoon?.copy ?? "",
      category: CATEGORY_TO_TAB[i.category] ?? FALLBACK_TAB,
      // The catalog `key` is the int_connections.provider value, so it doubles
      // as the connection-lookup key (matches flattenMetaIntegration output).
      providerKey: i.key,
      status: toLifecycle(i),
      dashboardPath: i.display?.dashboardPath,
      logoUrl: i.display?.iconUrl,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
