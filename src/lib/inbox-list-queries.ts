import { infiniteQueryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { deskListParams } from "@/lib/desk-list-params";
import type { AssigneeFilter, PriorityFilter } from "@/lib/inbox-desk";
import type { StatusFilter } from "@/lib/inbox-view";
import type { StorefrontChat, WaConversation } from "@/hooks/use-wa-conversations";

/**
 * The two Conversations lists as query options, kept out of the hook file so the sidebar's intent prefetch (lib/nav-prefetch.ts)
 * can warm them without pulling the whole Inbox client into every dashboard page. The hooks in hooks/use-wa-conversations.ts spread
 * these, so the key and fn the page reads are the ones the prefetch warms.
 */

const BASE = "/v1/meta/whatsapp/conversations";

/** What narrows a list: the Open / Needs you / Done chip, and the search text (already trimmed and long enough: `searchTerm`). */
export interface ListView {
  expiringOnly?: boolean;
  status?: StatusFilter;
  q?: string;
  /** Team desk (I3a): Mine / Unassigned (All = none), and one tag. A new value is a new query key, so the list starts again from its first page. */
  assignee?: AssigneeFilter;
  tag?: string | null;
  /** Insights: one topic key (`metadata.insightTopics`). A new value is a new query key. */
  topic?: string | null;
  /** SA-10: only the conversations a person flagged high priority. */
  priority?: PriorityFilter;
}

export const listParams = (view: ListView, cursor: string | undefined): Record<string, string> => ({
  ...deskListParams({ assignee: view.assignee ?? "all", tag: view.tag ?? null, priority: view.priority ?? "all" }),
  ...(view.topic ? { topic: view.topic } : {}),
  ...(view.expiringOnly ? { expiring: "1" } : {}),
  ...(view.status ? { status: view.status } : {}),
  ...(view.q ? { q: view.q } : {}),
  ...(cursor ? { cursor } : {}),
});

export interface WaListPage {
  conversations: WaConversation[];
  /** Where the next page starts; null = the list ends here. Absent = an older api (no paging). */
  nextCursor?: string | null;
  expiringCount?: number | null;
  expiringFrom?: string | null;
  /** Inbox phase 1: the connection behind the list. Absent = an older api (nothing is claimed). */
  available?: boolean;
  connected?: boolean;
  needsReauth?: boolean;
}

export interface StorefrontListPage {
  conversations: StorefrontChat[];
  nextCursor?: string | null;
}

/**
 * The first page of the business's WhatsApp conversations (most recent first), a page at a time (Inbox phase 2: fetchNextPage).
 * The key starts `["wa-conversations", business]` in every mode, so every existing invalidation still reaches it.
 */
export const waConversationsOptions = (biz: string, view: ListView = {}) =>
  infiniteQueryOptions({
    queryKey: ["wa-conversations", biz, view.expiringOnly ? "expiring" : "all", view.status ?? "any", view.q ?? "", view.assignee ?? "all", view.tag ?? "", view.topic ?? "", view.priority ?? "all"],
    queryFn: ({ pageParam }) => {
      const params = listParams(view, pageParam);
      return api.get<WaListPage>(BASE, Object.keys(params).length ? params : undefined);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: WaListPage) => last.nextCursor ?? undefined,
  });

/**
 * The business's storefront chats (Inbox phase 1), most recent first, a page at a time. The key starts
 * `["storefront-chats", business]`.
 */
export const storefrontChatsOptions = (biz: string, view: ListView = {}) =>
  infiniteQueryOptions({
    queryKey: ["storefront-chats", biz, view.expiringOnly ? "expiring" : "all", view.status ?? "any", view.assignee ?? "all", view.tag ?? "", view.topic ?? "", view.priority ?? "all"],
    queryFn: ({ pageParam }) => {
      const params = listParams({ ...view, q: undefined }, pageParam);
      return api.get<StorefrontListPage>("/v1/storefront-chats", Object.keys(params).length ? params : undefined);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: StorefrontListPage) => last.nextCursor ?? undefined,
  });
