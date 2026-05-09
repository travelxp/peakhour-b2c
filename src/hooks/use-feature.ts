"use client";

import type { EntitlementLimits } from "@/lib/auth";
import { useAuth } from "@/providers/auth-provider";

/**
 * Feature flag hook backed by the org's entitlements snapshot from
 * GET /v1/auth/me (populated on session boot + every org/business
 * switch via the auth provider).
 *
 * Usage:
 *   const { allowed, plan } = useFeature("linkedin.autonomy.l3");
 *   if (!allowed) return <UpgradeButton feature="linkedin.autonomy.l3" />;
 *
 * Locked-by-default semantics:
 *   - Returns `allowed: false` when entitlements are still loading.
 *   - Returns `allowed: false` when entitlements is null (no active org,
 *     or peakhour-api flagged entitlementsError on /me).
 *   - Returns `allowed: true` when the feature key is present in
 *     entitlements.features (cfg_features.key, dotted.snake_case).
 *
 * The conservative default is intentional: a brief flicker showing
 * "locked" is better than briefly showing gated content while the
 * snapshot loads.
 */
export interface UseFeatureResult {
  /** True when the feature is unlocked for this org. */
  allowed: boolean;
  /** True while the entitlements snapshot is still loading. */
  loading: boolean;
  /** Active plan key (e.g., "free", "pro") — useful for upgrade-drawer copy. */
  plan: string | null;
  /** Active country (ISO 3166-1 alpha-2) — for region-aware plan cards. */
  country: string | null;
  /** Currency from the entitlements snapshot. */
  currency: string | null;
}

export function useFeature(featureKey: string): UseFeatureResult {
  const { entitlements, isLoading } = useAuth();
  const allowed = !isLoading && Boolean(entitlements?.features?.includes(featureKey));
  return {
    allowed,
    loading: isLoading,
    plan: entitlements?.plan ?? null,
    country: entitlements?.country ?? null,
    currency: entitlements?.currency ?? null,
  };
}

/**
 * Variant — returns `true` when ANY of the listed feature keys is on.
 * Useful for routes that accept multiple plan tiers.
 */
export function useAnyFeature(featureKeys: string[]): UseFeatureResult {
  const { entitlements, isLoading } = useAuth();
  const allowed =
    !isLoading &&
    Boolean(entitlements?.features) &&
    featureKeys.some((k) => entitlements!.features.includes(k));
  return {
    allowed,
    loading: isLoading,
    plan: entitlements?.plan ?? null,
    country: entitlements?.country ?? null,
    currency: entitlements?.currency ?? null,
  };
}

/**
 * Lookup a numeric limit from entitlements. Returns null if not set
 * (treat as "no quota explicitly defined" — caller decides default).
 *
 * Typed via `keyof EntitlementLimits` directly so a refactor of the
 * AuthState shape doesn't silently widen this surface.
 */
export function useLimit(limitKey: keyof EntitlementLimits): number | null {
  const { entitlements } = useAuth();
  const v = entitlements?.limits?.[limitKey];
  return typeof v === "number" ? v : null;
}
