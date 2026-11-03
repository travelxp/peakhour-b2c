"use client";

import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { dedupeRows, type AllStoresPage } from "@/lib/inbox-all-stores";
import type { AssigneeFilter } from "@/lib/inbox-desk";
import type { ChannelFilter, StatusFilter } from "@/lib/inbox-view";

/** What narrows the all-stores list. A new value is a new query key, so the list starts again from its first page. */
export interface AllStoresView {
  status: StatusFilter;
  assignee: AssigneeFilter;
  channel: ChannelFilter;
  /** One of the person's stores; null = all of them. */
  store: string | null;
}

export const allStoresParams = (v: AllStoresView, cursor: string | undefined): Record<string, string> => ({
  status: v.status,
  ...(v.assignee !== "all" ? { assignee: v.assignee } : {}),
  ...(v.channel !== "all" ? { channel: v.channel } : {}),
  ...(v.store ? { store: v.store } : {}),
  ...(cursor ? { cursor } : {}),
});

/**
 * The conversations of every store the person belongs to (`GET /v1/inbox-desk/all-stores`), a page at a time. Read-only. The key is
 * the ORG's, not a business's: this list is the same whichever store the session is pinned to.
 */
export function useAllStoresConversations(view: AllStoresView, enabled: boolean) {
  const { org } = useAuth();
  const query = useInfiniteQuery({
    queryKey: ["all-stores-conversations", org?._id ?? "none", view.status, view.assignee, view.channel, view.store ?? ""],
    queryFn: ({ pageParam }) => api.get<AllStoresPage>("/v1/inbox-desk/all-stores", allStoresParams(view, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: enabled && Boolean(org?._id),
    refetchInterval: 30_000,
    placeholderData: (prev: InfiniteData<AllStoresPage, string | undefined> | undefined) => prev,
  });
  const first = query.data?.pages[0];
  return {
    ...query,
    conversations: dedupeRows(query.data?.pages.flatMap((p) => p.conversations) ?? []),
    /** The stores (with the first page's counts) and the note when more stores exist than are read. */
    stores: first?.stores ?? [],
    capNote: first?.capNote ?? null,
  };
}
