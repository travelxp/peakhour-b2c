"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { StartAnswer } from "@/lib/markdown-test";
import { useAuth } from "@/providers/auth-provider";
import { useActiveStore } from "@/providers/active-store-provider";
import { ACTIVITY_KEY } from "@/hooks/use-commerce-activity";

/**
 * Commerce Pricer hooks (P2.4/P2.5). `usePricer` reads the free, guardrail-
 * bounded markdown plan (GET /v1/commerce/pricer); `usePricerBrief` runs the
 * paid AI pricing brief (POST /v1/commerce/pricer/brief, Peaks-metered);
 * `useProposePricing` records a markdown intent as a proposed cmrc_actions row
 * (POST /v1/commerce/pricer/propose).
 */

export interface PricerGuardrails {
  maxDiscountPct?: number;
  marginFloorPct?: number;
  maxSpendMinor?: number;
  maxActionsPerDay?: number;
  reversibilityWindowHours?: number;
  businessHoursOnly?: boolean;
}

export interface PricingProposal {
  productId: string | null;
  sourceProductId: string;
  title: string;
  currentPriceMinor: number;
  suggestedDiscountPct: number;
  newPriceMinor: number;
  stock: number | null;
  unitsSold: number;
  daysOfCover: number | null;
  recoveredCapitalMinor: number | null;
  currency: string | null;
  reason: string;
  /** C.3: the route that made this a candidate. Optional: an api that predates it sends none. */
  route?: string;
  /** C.4: false when a sellable variant has no cost per item (the depth is capped at the first step). */
  costKnown?: boolean;
  /** C.9: the old price is shown crossed out. Absent when the api cannot say (WooCommerce prices the product). */
  struck?: boolean;
  /** C.9: why there is no strike-through, when there is none. */
  referenceNote?: string | null;
}

/**
 * Why a markdown plan came back with no proposals — decided by the api
 * (`services/commerce/pricer.ts`), rendered here.
 *
 * ★THE ORDERING IS NOT THIS PANEL'S TO REDERIVE, and re-deriving it is exactly
 * how this panel came to tell merchants "nothing is sitting with tied-up
 * capital" for four different situations, only one of which was good news. The
 * api decides which cause the merchant can act on; each surface chooses its own
 * words for it.
 *
 * ★OPTIONAL, because the SPA and the api deploy separately. An api that predates
 * the field sends nothing, and the panel falls back to the `scanned` flag it has
 * always had rather than rendering an empty string.
 */
export type PricingEmptyReason =
  | "none"
  | "not_scanned"
  | "markdowns_off"
  | "candidates_truncated"
  | "scan_truncated"
  | "held_back"
  | "not_routed_yet"
  | "routed_elsewhere"
  | "clear";

export interface PricingPlan {
  windowDays: number;
  scanned: boolean;
  /** The catalog scan hit its cap — the plan covers part of the store. */
  truncated: boolean;
  /** Slow stock may have been crowded out of the candidate set (the scan
   *  returns at-risk products first and stops at 200). */
  truncatedCandidates?: boolean;
  emptyReason?: PricingEmptyReason;
  /** False when the store's orders could not be read: every "nothing is slow" claim is then unproven. Optional on an older api. */
  ordersConnected?: boolean;
  guardrails: PricerGuardrails;
  proposals: PricingProposal[];
  /** C.3 test facts (read through `planFacts` in `@/lib/markdown-test`, which tolerates an api that sends none). */
  cohortSize?: number;
  slowTotal?: number;
  waitingByRoute?: Record<string, number>;
  waitingCandidates?: number;
  waitingProducts?: Array<{ productId: string; sourceProductId: string; title: string; reason: string; route?: string }>;
  tooFewToMeasure?: boolean;
  totalRecoveredCapitalMinor: number;
  currency: string | null;
}

const PRICER_KEY = "commerce-pricer";

export function usePricer() {
  const store = useActiveStore();
  const { isAuthenticated, org } = useAuth();
  return useQuery<PricingPlan>({
    queryKey: [PRICER_KEY, org?._id ?? null, store.merchantId ?? null],
    queryFn: () => api.get<PricingPlan>(store.path("/v1/commerce/pricer")),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export interface PricerBrief {
  plan: PricingPlan;
  brief: string;
}

export function usePricerBrief() {
  const store = useActiveStore();
  return useMutation<PricerBrief, Error>({
    mutationFn: () => api.post<PricerBrief>(store.path("/v1/commerce/pricer/brief"), {}),
  });
}

export interface ProposePricingResult {
  actionId: string | null;
  proposal: PricingProposal;
}

export function useProposePricing() {
  const store = useActiveStore();
  const qc = useQueryClient();
  const { org } = useAuth();
  // ★ApiError, so a caller reads `code` (LIVE_MARKDOWN) without a cast.
  return useMutation<ProposePricingResult, ApiError, string>({
    mutationFn: (sourceProductId: string) =>
      api.post<ProposePricingResult>(store.path("/v1/commerce/pricer/propose"), { sourceProductId }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [ACTIVITY_KEY, org?._id ?? null] });
    },
  });
}

export const TESTS_KEY = "commerce-pricer-tests";

/** The store's markdown tests, active and recent (GET /v1/commerce/pricer/tests), as the api sent them: read through `acceptTests`. */
export function useMarkdownTests() {
  const store = useActiveStore();
  const { isAuthenticated, org } = useAuth();
  return useQuery<unknown>({
    queryKey: [TESTS_KEY, org?._id ?? null, store.merchantId ?? null],
    queryFn: () => api.get<unknown>(store.path("/v1/commerce/pricer/tests")),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * Start the test (POST /v1/commerce/pricer/test). Never rejects: it answers what came back, so `startOutcome` can tell a clear refusal
 * from an answer that may have reached the store (a thrown request is `null`). ★A 409 MOVED or a start that may have run reloads the plan
 * and the tests either way.
 */
export function useStartMarkdownTest() {
  const store = useActiveStore();
  const qc = useQueryClient();
  const { org } = useAuth();
  return useMutation<StartAnswer | null, never, string[]>({
    mutationFn: async (expectedSourceProductIds) => {
      try {
        const data = await api.post<unknown>(store.path("/v1/commerce/pricer/test"), { expectedSourceProductIds });
        return { ok: true, status: 200, data };
      } catch (e) {
        if (e instanceof ApiError) return { ok: false, status: e.status, data: { code: e.code, error: e.message } };
        return null;
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [PRICER_KEY, org?._id ?? null] });
      qc.invalidateQueries({ queryKey: [TESTS_KEY, org?._id ?? null] });
      qc.invalidateQueries({ queryKey: [ACTIVITY_KEY, org?._id ?? null] });
    },
  });
}
