import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { inboxApi } from "@/lib/api/inbox";
import { REVIEW_PAGE_LIMIT } from "@/lib/review-page-limit";
import type { InsightsResponse } from "@/lib/insights";
import type { DeskTag } from "@/lib/inbox-desk";
import type { ResolvedCatalog } from "@/lib/catalog";
import type { PipelineIdea } from "@/app/(site)/dashboard/strategist/components/kanban-card";
import type { Integration } from "@/app/(site)/dashboard/integrations/_components/shared";

/**
 * The first, above-the-fold query of a primary destination, as `queryOptions`.
 *
 * ★ONE OBJECT, TWO READERS. The page reads it with useQuery; the sidebar's
 * hover/focus/touchstart handler reads it with prefetchQuery (see
 * nav-prefetch.ts). Key and fn live here once, so a prefetch can never warm a
 * key the page does not read. nav-queries.test.ts pins every key.
 *
 * A Next page file may export nothing but its default, so these live here.
 */

/** Content hub: the connected channels. */
export const contentHubIntegrationsQuery = queryOptions({
  queryKey: ["content-hub-integrations"],
  queryFn: () => api.get<{ integrations: ContentHubIntegration[] }>("/v1/integrations"),
  staleTime: 30_000,
});

export interface ContentHubIntegration {
  provider: string;
  connected?: boolean;
  status?: string;
  lastSyncAt?: string;
  lastError?: string;
  account?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extra?: Record<string, any>;
  };
}

/** Content hub: the CMS-driven channel catalog. */
export const contentHubCatalogQuery = queryOptions({
  queryKey: ["content-hub-catalog"],
  queryFn: () => api.get<ResolvedCatalog>("/v1/platform/catalog"),
  staleTime: 30_000,
});

/** Content plan (strategist): the idea pipeline. */
export const pipelineIdeasQuery = queryOptions({
  queryKey: ["pipeline-ideas"],
  queryFn: () => api.get<Record<string, PipelineIdea[]>>("/v1/content/ideas?grouped=true"),
  staleTime: 30_000,
});

/** Inbox: the review lane, hoisted to the page so its tab badge exists before the lane is opened. */
export const inboxReviewsQuery = queryOptions({
  queryKey: ["inbox-reviews"],
  queryFn: () => inboxApi.list({ kind: "review", limit: REVIEW_PAGE_LIMIT }),
  staleTime: 30_000,
  refetchOnWindowFocus: false,
});

/**
 * Connected accounts. Keyed on org AND business: the list is per-business, and
 * the page used to hold it in useState outside the cache.
 */
export const integrationsListQuery = (orgId: string | undefined, businessId: string | undefined) =>
  queryOptions({
    queryKey: ["integrations-list", orgId ?? null, businessId ?? null],
    queryFn: () => api.get<{ integrations: Integration[] }>("/v1/integrations"),
    staleTime: 30_000,
  });

/** Inbox, Conversations lane: the tag chips. (Key spelled as deskKeys.tags in hooks/use-inbox-desk.ts, which invalidates it.) */
export const deskTagsQuery = (biz: string) =>
  queryOptions({
    queryKey: ["inbox-desk", "tags", biz] as const,
    queryFn: () => api.get<{ tags: DeskTag[] }>("/v1/inbox-desk/tags"),
    staleTime: 60_000,
  });

/** Every Insights read starts with this, so an answer or a dismissal can refresh them all. */
export const INSIGHTS_KEY = "insights";

/** Inbox tab badge: what customers keep raising. The api scopes the read to the session's pinned org AND business. */
export const insightsQuery = (orgId: string | null, businessId: string | null, days = 30) =>
  queryOptions({
    queryKey: [INSIGHTS_KEY, orgId, businessId, days],
    queryFn: () => api.get<InsightsResponse>("/v1/insights", { days: String(days) }),
    retry: false,
  });
