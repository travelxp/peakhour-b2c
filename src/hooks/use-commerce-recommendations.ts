"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/**
 * Commerce recommendations — the engine's proposals for the Command Center's
 * "Needs you" rail (GET /v1/commerce/recommendations, api#833). Approve/reject
 * are optimistic: the row leaves the pending list immediately and the summary's
 * pending-approvals count is refreshed.
 */

export interface RecommendationPreview {
  id: string;
  title: string | null;
  imageUrl: string | null;
}

export interface Recommendation {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  suggestedDiscount: number;
  suggestedDurationHours: number;
  /** AI-estimated revenue lift in MAJOR units of `currency` (not minor units). */
  expectedRevenueRange: { min: number; max: number; currency: string } | null;
  confidenceScore: number;
  reasonSummary: string;
  approvalStatus: string;
  productCount: number;
  productsPreview: RecommendationPreview[];
  createdAt: string | null;
}

export interface RecommendationPage {
  items: Recommendation[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const RECS_KEY = "commerce-recommendations";
const SUMMARY_KEY = "commerce-summary";

export function useCommerceRecommendations() {
  const { isAuthenticated, org } = useAuth();
  return useQuery<RecommendationPage>({
    queryKey: [RECS_KEY, org?._id ?? null],
    queryFn: () =>
      api.get<RecommendationPage>("/v1/commerce/recommendations?status=pending"),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 60_000,
    // A missing store returns 4xx — don't hammer it.
    retry: false,
  });
}

export type RecommendationDecision = "approve" | "reject";

export function useDecideRecommendation() {
  const qc = useQueryClient();
  const { org } = useAuth();
  const recsKey = [RECS_KEY, org?._id ?? null];

  return useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: RecommendationDecision;
      reason?: string;
    }) =>
      api.post(
        `/v1/commerce/recommendations/${id}/${decision}`,
        decision === "reject" && reason ? { reason } : {},
      ),
    // Optimistically drop the decided row from the pending list.
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: recsKey });
      const prev = qc.getQueryData<RecommendationPage>(recsKey);
      if (prev) {
        qc.setQueryData<RecommendationPage>(recsKey, {
          ...prev,
          items: prev.items.filter((i) => i.id !== id),
          total: Math.max(0, prev.total - 1),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(recsKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: recsKey });
      // pending-approvals count on the Command Center summary
      qc.invalidateQueries({ queryKey: [SUMMARY_KEY, org?._id ?? null] });
    },
  });
}
