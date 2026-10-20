"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { getConversation } from "@/lib/api/control-plane";
import {
  conversationKey,
  fetchConversationEntry,
  nextConversationCursor,
  shouldRetryConversation,
  type ConversationEntry,
} from "@/lib/control-plane-conversation";

/**
 * The signed-in user's own WhatsApp conversation with Peakhour (WA M6).
 *
 * Keyset pages, newest first in the cache; `nextCursor` fetches OLDER ones.
 * A 403 is stored as a `refused` entry (see `fetchConversationEntry`).
 *
 * No polling, and no refetch on window focus. Lines are written when someone
 * types on a phone or a Peakhour job follows up, which is not a clock worth
 * polling; and refetching an infinite query refetches every loaded page, which
 * here is a sequential read per verified number on the api. The tab instead
 * fetches when it is opened (Radix unmounts an inactive tab, so returning to it
 * refetches past `staleTime`) and offers "Check for new messages".
 *
 * A refetch re-reads every loaded page, but the history is small: each thread
 * keeps its latest 50 lines and a page is 50, so there are at most about as
 * many pages as the user has verified numbers.
 */
export function useConversation() {
  const { org, business, user, isAuthenticated } = useAuth();
  return useInfiniteQuery<
    ConversationEntry,
    Error,
    { pages: ConversationEntry[] },
    ReturnType<typeof conversationKey>,
    string | null
  >({
    queryKey: conversationKey(org?._id, business?._id, user?._id),
    queryFn: ({ pageParam }) => fetchConversationEntry(getConversation, pageParam),
    initialPageParam: null,
    getNextPageParam: nextConversationCursor,
    enabled: isAuthenticated && !!org?._id && !!business?._id && !!user?._id,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    // Nor on reconnect: a fetch that was paused offline resumes by itself, and
    // a stale one waits for the reader to ask.
    refetchOnReconnect: false,
    retry: shouldRetryConversation,
  });
}
