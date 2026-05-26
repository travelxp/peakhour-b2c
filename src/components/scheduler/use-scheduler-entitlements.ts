"use client";

/**
 * useSchedulerEntitlements — React Query-cached read of the scheduler-
 * shaped entitlements slice. The b2c calendar + composer both call
 * this on mount to gate UI affordances (greyed auto-approve checkbox,
 * "X / Y queued" indicator, "upgrade to bundle 4+ channels" banner).
 *
 * Cache: keyed only on a stable token so all consumers on the same
 * page share one in-flight request. The server sets
 * `Cache-Control: private, max-age=60` so the browser also caches at
 * the HTTP layer. 60s staleTime here matches the server hint.
 *
 * Failure mode: when the request 4xx/5xx, returns `data: undefined`.
 * Callers should default-to-permissive (assume the feature is gated)
 * so a transient API failure doesn't unlock paid features. Errors are
 * NOT bubbled by default — the composer renders a degraded UI but
 * doesn't blow up.
 */

import { useQuery } from "@tanstack/react-query";
import { scheduler } from "@/lib/scheduler/client";
import type { SchedulerEntitlementsResponse } from "@/lib/scheduler/types";

export function useSchedulerEntitlements() {
  return useQuery<SchedulerEntitlementsResponse>({
    queryKey: ["scheduler:entitlements"],
    queryFn: () => scheduler.getEntitlements(),
    staleTime: 60_000,
    // Don't retry on 402/403/404 — entitlements don't transiently
    // recover; a real change requires a billing event which would
    // invalidate this query separately.
    retry: 1,
  });
}

/** Default-permissive accessor. Returns `undefined` when entitlements
 *  haven't loaded yet — caller should fall back to the most-restrictive
 *  interpretation (feature gated) so we never unlock a paid feature
 *  on a transient failure. */
export function schedulerFeatureEnabled(
  ent: SchedulerEntitlementsResponse | undefined,
  feature: keyof SchedulerEntitlementsResponse["schedulerFeatures"],
): boolean {
  if (!ent) return false;
  return ent.schedulerFeatures[feature];
}
