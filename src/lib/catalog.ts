/**
 * Server-side helper for the public platform catalog from peakhour-api's
 * `GET /v1/platform/catalog`. Drives the landing page's integration grid; the
 * static INTEGRATIONS array there survives only as a degraded-mode fallback.
 * (The dashboard Content hub also renders from this endpoint now, via
 * mapCatalogToChannels — channels.config.ts is its fallback + seed input.)
 *
 * Called UNAUTHENTICATED here — the resolver returns the public view (any
 * status except the prod-suppressed in_development/hidden, i.e. live, beta,
 * coming_soon and deprecated, at public visibility), env-gated server-side and
 * capped by the global platform stage. The `platform` block drives the
 * announcement banner + the signup CTA, so the landing and the signup flow can
 * never disagree.
 *
 * The public catalog is country-independent (the resolver only applies country
 * gates for authenticated orgs), so it's cached once with a static key. A
 * 120s revalidate + the "platform-catalog" tag let a CMS stage change
 * propagate via revalidateTag().
 */

import { unstable_cache as cache } from "next/cache";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export type PlatformStage =
  | "coming_soon"
  | "waitlist"
  | "founding"
  | "invitation_only"
  | "live";

export type PlatformSignupMode = "closed" | "invite_only" | "waitlist_only" | "open";

export type SurfacedState =
  | "connectable"
  | "locked"
  | "coming_soon"
  | "deprecated"
  | "dev_only";

export interface ResolvedIntegration {
  key: string;
  name: string;
  tagline?: string;
  description?: string;
  category: string;
  status: string;
  surfacedState: SurfacedState;
  cappedByPlatformStage: boolean;
  isAvailable: boolean;
  isLockedByFeature?: boolean;
  isLockedByPlan?: boolean;
  isLockedByCountry?: boolean;
  lockReason?: string;
  waitlistFeatureKey?: string;
  comingSoon?: { copy?: string; eta?: string; waitlistFeatureKey?: string };
  display?: {
    iconUrl?: string;
    brandColor?: string;
    groupKey?: string;
    sortOrder?: number;
    connectLabel?: string;
    dashboardPath?: string;
  };
}

export interface PlatformBlock {
  stage: PlatformStage;
  signupMode: PlatformSignupMode;
  banner?: { enabled: boolean; copy?: string; tone: "info" | "warn" | "success" };
}

export interface ResolvedCatalog {
  integrations: ResolvedIntegration[];
  org?: { country?: string; plan?: string };
  platform: PlatformBlock;
}

/**
 * Inner fetch — THROWS on any failure so the cache layer below never
 * memoizes a failed/null result. A transient API 5xx must not pin the static
 * fallback (degraded CTA + no banner) for the whole revalidate window; throwing
 * keeps the failure out of the cache so the next request retries.
 */
async function fetchCatalogOrThrow(): Promise<ResolvedCatalog> {
  const res = await fetch(`${API_URL}/v1/platform/catalog`, {
    next: { revalidate: 120, tags: ["platform-catalog"] },
  });
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  const json = (await res.json()) as { ok?: boolean; data?: ResolvedCatalog };
  if (!json.ok || !json.data) throw new Error("catalog malformed response");
  return json.data;
}

const getCachedCatalog = cache(fetchCatalogOrThrow, ["platform-catalog"], {
  revalidate: 120,
  tags: ["platform-catalog"],
});

/**
 * Public catalog, or `null` when the API is unreachable/unconfigured — callers
 * render the static fallback. Only SUCCESSFUL responses are cached (the inner
 * fn throws on failure), so a transient blip recovers on the next request
 * rather than being pinned for 120s.
 */
export async function getPublicCatalog(): Promise<ResolvedCatalog | null> {
  if (!API_URL) return null;
  try {
    return await getCachedCatalog();
  } catch {
    return null;
  }
}

/**
 * Statuses the public grid may advertise. An ALLOW-list, not a deny-list, so a
 * new `cfg_integrations` status added in Mongo fails CLOSED (stays off the
 * marketing page) instead of silently shipping to it. Covers all six values of
 * zIntegrationStatus:
 *   • live / beta     — advertisable. `beta` is safe for a non-obvious reason
 *                       worth recording: it normally pairs with
 *                       `visibility: "beta_orgs_only"`, which the resolver drops
 *                       outright for a caller with no org — so any beta row that
 *                       reaches this filter is `visibility: public` by
 *                       construction, i.e. genuinely public.
 *   • coming_soon     — advertisable, rendered with a "Coming soon" badge.
 *   • hidden          — EXCLUDED, and the gate that actually earns its keep.
 *                       Prod strips it at the resolver (PROD_HIDDEN_STATUSES)
 *                       but non-prod keeps it, so without this the dev landing
 *                       advertises connectors the CMS explicitly unpublished.
 *   • in_development  — EXCLUDED. Belt-and-braces: the resolver already tags
 *                       these `surfacedState: "dev_only"`, which is dropped
 *                       below too.
 *   • deprecated      — EXCLUDED. A connector being retired. Existing
 *                       connections still work, but "Works with your stack" is
 *                       an acquisition promise we must not make while walking it
 *                       back — and `surfacedState: "deprecated"` renders no
 *                       badge, so these would look identical to live cards.
 */
const MARKETING_STATUSES = new Set(["live", "beta", "coming_soon"]);

/** Live/beta first, then coming_soon — see the sort note below. */
function marketingRank(status: string): number {
  return status === "live" || status === "beta" ? 0 : 1;
}

/**
 * The integrations the public "Works with your stack" grid renders: every
 * published catalog row, ONE CARD PER INTEGRATION.
 *
 * Deliberately NOT collapsed by `display.groupKey`. groupKey is a *provider*
 * grouping (whatsapp + instagram + facebook_pages + meta_ads all sit under
 * "meta"; gbp + gsc + google_ads under "google"), so collapsing on it made the
 * marketing grid silently swallow live, headline integrations — WhatsApp and
 * Google Search Console never appeared at all, hidden behind a single
 * "Facebook Pages" / "Google Business Profile" card. Visitors shop by brand,
 * so each published brand surface gets its own card and the grid mirrors what
 * the CMS actually lists.
 *
 * SORT: `display.sortOrder` first, so the CMS stays in charge — but in practice
 * almost every row still carries the default 100, which made the order purely
 * alphabetical and buried the brands this section exists to show (WhatsApp 15th
 * of 19, behind Ghost, Kit and Mailchimp — all coming_soon). So live/beta rows
 * break the tie ahead of coming_soon ones before falling back to name. Set real
 * sortOrder values in the CMS to override any of this.
 */
export function publicMarketingIntegrations(
  integrations: ResolvedIntegration[],
): ResolvedIntegration[] {
  return integrations
    .filter((i) => i.surfacedState !== "dev_only" && MARKETING_STATUSES.has(i.status))
    .sort(
      (a, b) =>
        (a.display?.sortOrder ?? 100) - (b.display?.sortOrder ?? 100) ||
        marketingRank(a.status) - marketingRank(b.status) ||
        // Pinned locale: this comparator decides the whole order while
        // sortOrder is uniform, so it must not vary with a runtime default.
        a.name.localeCompare(b.name, "en"),
    );
}

/** Landing-page signup CTA derived from the platform signup mode. */
export function signupCta(mode: PlatformSignupMode): { label: string; href: string; disabled?: boolean } {
  switch (mode) {
    case "open":
      return { label: "Start free", href: "/auth" };
    case "waitlist_only":
      return { label: "Join the waitlist", href: "/auth?intent=waitlist" };
    case "invite_only":
      return { label: "Request an invite", href: "/auth?intent=invite" };
    case "closed":
    default:
      return { label: "Launching soon", href: "/auth", disabled: true };
  }
}
