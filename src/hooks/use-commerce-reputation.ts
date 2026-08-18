"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { ACTIVITY_KEY } from "@/hooks/use-commerce-activity";

/**
 * Commerce Reputation hooks (P2.7/P2.8). `useReviewsSummary` reads the free
 * aggregation (GET /reviews); `useReviewsList` the recent reviews
 * (GET /reviews/list); `useAnalyzeReviews` runs the paid batch analysis;
 * `useDraftResponse` drafts a reply (paid); `useProposeFix` records a PDP-fix
 * intent.
 */

export type ReviewSentiment = "positive" | "negative" | "neutral" | "mixed";

export interface ThemeStat {
  theme: string;
  count: number;
  negativeCount: number;
}

export interface ReputationSummary {
  totalReviews: number;
  analysedReviews: number;
  pendingReviews: number;
  respondedReviews: number;
  averageRating: number | null;
  ratingDistribution: Record<string, number>;
  sentimentBreakdown: Record<ReviewSentiment, number>;
  topThemes: ThemeStat[];
}

export interface ReviewListItem {
  id: string;
  title: string | null;
  bodySnippet: string | null;
  rating: number | null;
  authorName: string | null;
  sentiment: ReviewSentiment | null;
  themes: string[];
  reviewedAt: string | null;
  responseStatus: "drafted" | "published" | null;
  responseDraft: string | null;
}

export type ReviewListFilter = "all" | "needs_response" | "negative";

const SUMMARY_KEY = "commerce-reputation-summary";
const LIST_KEY = "commerce-reputation-list";

export function useReviewsSummary() {
  const { isAuthenticated, org } = useAuth();
  return useQuery<ReputationSummary>({
    queryKey: [SUMMARY_KEY, org?._id ?? null],
    queryFn: () => api.get<ReputationSummary>("/v1/commerce/reviews"),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useReviewsList(filter: ReviewListFilter = "needs_response") {
  const { isAuthenticated, org } = useAuth();
  return useQuery<{ items: ReviewListItem[] }>({
    queryKey: [LIST_KEY, org?._id ?? null, filter],
    queryFn: () => api.get<{ items: ReviewListItem[] }>(`/v1/commerce/reviews/list?filter=${filter}`),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export interface AnalyzeResult {
  analysed: number;
  summary: ReputationSummary;
}

export function useAnalyzeReviews() {
  const qc = useQueryClient();
  const { org } = useAuth();
  return useMutation<AnalyzeResult, Error>({
    mutationFn: () => api.post<AnalyzeResult>("/v1/commerce/reviews/analyze", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUMMARY_KEY, org?._id ?? null] });
      qc.invalidateQueries({ queryKey: [LIST_KEY, org?._id ?? null] });
    },
  });
}

export interface DraftResult {
  reviewId: string;
  draft: string;
}

export function useDraftResponse() {
  const qc = useQueryClient();
  const { org } = useAuth();
  return useMutation<DraftResult, Error, string>({
    mutationFn: (reviewId: string) =>
      api.post<DraftResult>(`/v1/commerce/reviews/${reviewId}/draft-response`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST_KEY, org?._id ?? null] });
    },
  });
}

export function useProposeFix() {
  const qc = useQueryClient();
  const { org } = useAuth();
  return useMutation<{ actionId: string | null }, Error, string>({
    mutationFn: (theme: string) =>
      api.post<{ actionId: string | null }>("/v1/commerce/reviews/propose-fix", { theme }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [ACTIVITY_KEY, org?._id ?? null] });
    },
  });
}
