import type { FetchInfiniteQueryOptions, FetchQueryOptions, QueryClient } from "@tanstack/react-query";
import { storefrontChatsOptions, waConversationsOptions, type ListView } from "@/lib/inbox-list-queries";
import { DEFAULT_STATUS_FILTER } from "@/lib/inbox-view";
import { GROWTH_HOME } from "@/lib/growth-v2-nav";
import { commerceStoresQuery } from "@/hooks/use-commerce-stores";
import { jobsListQuery } from "@/hooks/use-jobs";
import { growthV2HomeQuery } from "@/lib/api/growth-v2";
import {
  contentHubCatalogQuery,
  contentHubIntegrationsQuery,
  deskTagsQuery,
  insightsQuery,
  inboxReviewsQuery,
  integrationsListQuery,
  pipelineIdeasQuery,
} from "@/lib/nav-queries";

/**
 * Prefetch on intent: a pointer resting on a nav link, keyboard focus on it, or
 * a finger touching it warms that destination's route code and its first
 * above-the-fold query, so the click lands on data that is already there.
 *
 * ★NOT ON EVERY LINK, NOT ON PAGE LOAD. Only the destinations in
 * {@link INTENT_QUERIES} fetch data, and only after {@link INTENT_DELAY_MS} of
 * intent, so a pointer sweeping down the sidebar fetches nothing. A repeat
 * hover inside the query's staleTime is a cache hit, not a request.
 *
 * ★THE QUERY OBJECTS ARE THE PAGES' OWN (lib/nav-queries.ts and the hooks they
 * come from), so key and fn cannot drift from what the page reads.
 *
 * Home (/dashboard/overview) is deliberately absent: its queries are inline in
 * the page, and its route code still prefetches.
 */

export const INTENT_DELAY_MS = 100;

export interface PrefetchContext {
  orgId: string | undefined;
  businessId: string | undefined;
  isAuthenticated: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = FetchQueryOptions<any, any, any, any> | FetchInfiniteQueryOptions<any, any, any, any, any>;

/**
 * The Conversations lane as it first renders (the default lane): no search, no desk filters, the default chip.
 * Must equal what ConversationsPane passes on mount; nav-queries.test.ts pins both.
 */
export const INBOX_FIRST_VIEW: ListView = {
  expiringOnly: false,
  status: DEFAULT_STATUS_FILTER,
  assignee: "all",
  tag: null,
  priority: "all",
  topic: null,
};

/** href -> the first query (or two) its page reads above the fold. */
export const INTENT_QUERIES: Record<string, (ctx: PrefetchContext) => AnyQuery[]> = {
  // The default lane is Conversations: both lists and the tag chips, then the tab badges (reviews, insights).
  "/dashboard/inbox": (c) => [
    inboxReviewsQuery,
    ...(c.businessId
      ? [
          waConversationsOptions(c.businessId, INBOX_FIRST_VIEW),
          storefrontChatsOptions(c.businessId, INBOX_FIRST_VIEW),
          deskTagsQuery(c.businessId),
        ]
      : []),
    ...(c.orgId && c.businessId ? [insightsQuery(c.orgId, c.businessId)] : []),
  ],
  "/dashboard/content": () => [contentHubIntegrationsQuery, contentHubCatalogQuery],
  "/dashboard/strategist": () => [pipelineIdeasQuery],
  [GROWTH_HOME]: (c) => (c.businessId ? [growthV2HomeQuery(c.businessId)] : []),
  // The store list gates the whole commerce subtree behind a loading screen.
  "/dashboard/commerce": (c) => (c.businessId ? [commerceStoresQuery(c.businessId)] : []),
  "/dashboard/integrations": (c) => [integrationsListQuery(c.orgId, c.businessId)],
  "/dashboard/tasks": () => [jobsListQuery("recent")],
};

interface ConnectionLike {
  saveData?: boolean;
  effectiveType?: string;
}

/** True on Data Saver or a 2g link, where a speculative request costs the user. */
export function shouldSkipPrefetch(
  connection: ConnectionLike | undefined = (typeof navigator !== "undefined"
    ? (navigator as Navigator & { connection?: ConnectionLike }).connection
    : undefined),
): boolean {
  if (!connection) return false;
  return connection.saveData === true || connection.effectiveType === "2g" || connection.effectiveType === "slow-2g";
}

/** The data half: warm every query registered for `href`. Never throws (a prefetch failure is silent). */
export function prefetchDestinationData(qc: QueryClient, href: string, ctx: PrefetchContext): void {
  if (!ctx.isAuthenticated) return;
  const queries = INTENT_QUERIES[href]?.(ctx) ?? [];
  for (const q of queries) {
    // an infinite query (a paged list) warms its first page under the same key the page reads
    if ("initialPageParam" in q) void qc.prefetchInfiniteQuery(q as FetchInfiniteQueryOptions);
    else void qc.prefetchQuery(q);
  }
}

/**
 * Debounce per href. `schedule` starts (or restarts) the timer; `cancel` clears
 * it when intent ends (pointer left, focus moved on). `skip` is read when the
 * timer fires, so a connection that degrades mid-hover is honoured.
 */
export function createIntentScheduler(
  run: (href: string) => void,
  skip: () => boolean = () => shouldSkipPrefetch(),
  delayMs = INTENT_DELAY_MS,
) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    schedule(href: string) {
      const prior = timers.get(href);
      if (prior) clearTimeout(prior);
      timers.set(
        href,
        setTimeout(() => {
          timers.delete(href);
          if (!skip()) run(href);
        }, delayMs),
      );
    },
    cancel(href: string) {
      const t = timers.get(href);
      if (t) clearTimeout(t);
      timers.delete(href);
    },
  };
}
