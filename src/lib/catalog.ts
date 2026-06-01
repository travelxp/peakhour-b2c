/**
 * Server-side helper for the public platform catalog from peakhour-api's
 * `GET /v1/platform/catalog`. Replaces the hardcoded INTEGRATIONS array on the
 * landing page (and, later, the dashboard hub's channels.config.ts).
 *
 * Called UNAUTHENTICATED here — the resolver returns the public view (live +
 * coming_soon, public visibility), env-gated server-side (prod hides
 * in_development/hidden) and capped by the global platform stage. The `platform`
 * block drives the announcement banner + the signup CTA, so the landing and the
 * signup flow can never disagree.
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
 * Collapse the resolved catalog into one card per logical product
 * (groupKey, falling back to key) for the marketing grid — e.g. LinkedIn
 * Content + LinkedIn Ads render as a single "LinkedIn" card. Keeps the
 * lowest sortOrder representative and drops dev-only rows defensively
 * (prod already strips them; this guards a non-prod marketing build).
 */
export function dedupePublicIntegrations(integrations: ResolvedIntegration[]): ResolvedIntegration[] {
  const byGroup = new Map<string, ResolvedIntegration>();
  for (const i of integrations) {
    if (i.surfacedState === "dev_only") continue;
    const g = i.display?.groupKey || i.key;
    const existing = byGroup.get(g);
    if (!existing || (i.display?.sortOrder ?? 100) < (existing.display?.sortOrder ?? 100)) {
      byGroup.set(g, i);
    }
  }
  return Array.from(byGroup.values()).sort(
    (a, b) => (a.display?.sortOrder ?? 100) - (b.display?.sortOrder ?? 100),
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
