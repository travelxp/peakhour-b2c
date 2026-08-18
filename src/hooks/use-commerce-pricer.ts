"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
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
  guardrails: PricerGuardrails;
  proposals: PricingProposal[];
  totalRecoveredCapitalMinor: number;
  currency: string | null;
}

const PRICER_KEY = "commerce-pricer";

export function usePricer() {
  const { isAuthenticated, org } = useAuth();
  return useQuery<PricingPlan>({
    queryKey: [PRICER_KEY, org?._id ?? null],
    queryFn: () => api.get<PricingPlan>("/v1/commerce/pricer"),
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
  return useMutation<PricerBrief, Error>({
    mutationFn: () => api.post<PricerBrief>("/v1/commerce/pricer/brief", {}),
  });
}

export interface ProposePricingResult {
  actionId: string | null;
  proposal: PricingProposal;
}

export function useProposePricing() {
  const qc = useQueryClient();
  const { org } = useAuth();
  return useMutation<ProposePricingResult, Error, string>({
    mutationFn: (sourceProductId: string) =>
      api.post<ProposePricingResult>("/v1/commerce/pricer/propose", { sourceProductId }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [ACTIVITY_KEY, org?._id ?? null] });
    },
  });
}
