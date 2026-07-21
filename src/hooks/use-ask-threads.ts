"use client";

/**
 * Ask Peakhour — thread history hooks. Read-only helpers over the /v1/ask thread
 * endpoints, scoped server-side to the current operator.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface AskThreadSummary {
  threadId: string;
  title: string | null;
  updatedAt: string;
  lastPageContext: { routeKey?: string } | null;
}

export interface AskThreadDetail {
  threadId: string;
  title: string | null;
  messages: unknown[];
  lastPageContext: { routeKey?: string } | null;
}

/** The operator's recent Ask threads in the current business (metadata only). */
export function useAskThreads() {
  return useQuery({
    queryKey: ["ask-threads"],
    queryFn: () => api.get<{ threads: AskThreadSummary[] }>("/v1/ask/threads"),
    refetchOnWindowFocus: false,
  });
}

/** One thread's full transcript. Disabled until a threadId is provided. */
export function useAskThread(threadId: string | null) {
  return useQuery({
    queryKey: ["ask-thread", threadId],
    queryFn: () => api.get<AskThreadDetail>(`/v1/ask/threads/${threadId}`),
    enabled: Boolean(threadId),
    refetchOnWindowFocus: false,
  });
}
