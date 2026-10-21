"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { getConversation } from "@/lib/api/control-plane";
import {
  anchorKeyPart,
  conversationKey,
  fetchConversationEntry,
  initialConversationParam,
  newerConversationParam,
  olderConversationParam,
  shouldRetryConversation,
  type ConversationAnchor,
  type ConversationEntry,
  type ConversationQueryParam,
} from "@/lib/control-plane-conversation";

/**
 * The signed-in user's own WhatsApp conversation with Peakhour (WA M6), for
 * the session's business only (owner answer 2026-10-21, item 19: the api
 * returns only this business's turns).
 *
 * It opens on `anchor` (item 20): the last 3 days, or a day the reader jumped
 * to. Keyset pages, newest first in the cache: `getNextPageParam` walks OLDER
 * (`nextCursor`) and `getPreviousPageParam` walks NEWER (`newerCursor`, which
 * only a jump to a date has). A 403 is stored as a `refused` entry (see
 * `fetchConversationEntry`).
 *
 * ★The clock is read in the query function, not in render: the latest window
 * is `{ kind: "recent" }` until it is fetched, and a refetch re-reads it from
 * the refresh's own "now".
 *
 * No polling, and no refetch on window focus. Lines are written when someone
 * types on a phone or a Peakhour job follows up, which is not a clock worth
 * polling; and refetching an infinite query refetches every loaded page, which
 * here is a sequential read per verified number on the api. The tab instead
 * fetches when it is opened (Radix unmounts an inactive tab, so returning to it
 * refetches past `staleTime`) and offers "Check for new messages".
 */
export function useConversation(anchor: ConversationAnchor) {
  const { org, business, user, isAuthenticated } = useAuth();
  return useInfiniteQuery<
    ConversationEntry,
    Error,
    { pages: ConversationEntry[] },
    ReturnType<typeof conversationKey>,
    ConversationQueryParam
  >({
    queryKey: conversationKey(org?._id, business?._id, user?._id, anchorKeyPart(anchor)),
    queryFn: ({ pageParam }) => fetchConversationEntry(getConversation, pageParam, Date.now()),
    initialPageParam: initialConversationParam(anchor),
    getNextPageParam: olderConversationParam,
    getPreviousPageParam: newerConversationParam,
    enabled: isAuthenticated && !!org?._id && !!business?._id && !!user?._id,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    // Nor on reconnect: a fetch that was paused offline resumes by itself, and
    // a stale one waits for the reader to ask.
    refetchOnReconnect: false,
    retry: shouldRetryConversation,
  });
}
