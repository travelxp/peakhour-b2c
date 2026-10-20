"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import {
  replyRequest,
  resumeBody,
  threadPollInterval,
  type ReplyPayload,
  type ReplyResult,
  type StudioTemplate,
} from "@/lib/wa-inbox-reply";

/** A WhatsApp conversation summary (list row). */
export interface WaConversation {
  threadId: string;
  waId: string;
  contactName: string | null;
  status: string;
  updatedAt: string | null;
  lastInboundAt: string | null;
  preview: string;
}

export interface WaMessage {
  role: "user" | "assistant" | "merchant";
  content: string;
  timestamp: string | null;
  /** WA T3: `inbox` = a team member wrote it from the Inbox; `phone` = the
   *  business's own WhatsApp app (and every assistant or shopper line). */
  source?: "phone" | "inbox";
  /** WA T3: the team member who wrote an Inbox line; null from the Shopify admin. */
  authorUserId?: string | null;
}

export interface WaThread {
  threadId: string;
  contactName: string | null;
  status: string;
  /** WA T3: the shopper's last message. */
  lastInboundAt?: string | null;
  /** WA T3: when free text stops being allowed; null = the window is closed. */
  replyWindowEndsAt?: string | null;
  /** WA T2's compare-and-set version, on the read since api#1530 (see `resumeBody`). */
  statusVersion?: number;
  messages: WaMessage[];
}

/** `GET /v1/meta/whatsapp/connection`, the parts the composer reads. */
export interface WaConnectionStatus {
  connected: boolean;
  phoneNumberId?: string;
  phoneNumber?: string;
}

const BASE = "/v1/meta/whatsapp/conversations";

/** List the business's WhatsApp conversations (most recent first). */
export function useWaConversations() {
  const { business } = useAuth();
  const key = ["wa-conversations", business?._id ?? "none"];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.get<{ conversations: WaConversation[] }>(BASE),
    enabled: Boolean(business?._id),
    refetchInterval: 30_000, // inbox stays roughly live
  });
  return { ...query, listKey: key, conversations: query.data?.conversations ?? [] };
}

/** Load one thread's messages. */
export function useWaThread(threadId: string | null) {
  const { business } = useAuth();
  return useQuery({
    queryKey: ["wa-thread", business?._id ?? "none", threadId],
    queryFn: () => api.get<WaThread>(`${BASE}/${encodeURIComponent(threadId!)}`),
    enabled: Boolean(business?._id && threadId),
    // ✅WA T4: while a person holds the thread, the shopper's answers arrive
    //  without a reload (spec: every 5s). Any other open thread is re-read at
    //  the list's 30s (`threadPollInterval`), since the list's poll does not
    //  refresh this query.
    refetchInterval: (q) => threadPollInterval(q.state.data?.status),
  });
}

/** The business's WhatsApp connection, for "Replying as <number>". */
export function useWaConnection(enabled: boolean) {
  const { business } = useAuth();
  return useQuery({
    queryKey: ["wa-connection", business?._id ?? "none"],
    queryFn: () => api.get<WaConnectionStatus>("/v1/meta/whatsapp/connection"),
    enabled: enabled && Boolean(business?._id),
    staleTime: 5 * 60_000,
  });
}

/**
 * The Template Studio's list, for the picker once the 24h window has closed.
 *
 * ★THE STUDIO PAGE'S OWN KEY AND RESPONSE, so an approval seen there is seen
 * here without a second fetch, and a refetch here refreshes that page.
 */
export function useWaStudioTemplates(enabled: boolean) {
  const { business } = useAuth();
  return useQuery({
    queryKey: ["wa-templates", business?._id ?? "none"],
    queryFn: () => api.get<{ templates: StudioTemplate[] }>("/v1/meta/whatsapp/studio/templates"),
    enabled: enabled && Boolean(business?._id),
    // ★Each thread opened remounts the composer (review R3); a refusal that
    //  says the list is stale refetches it explicitly (`refetchTemplates`).
    staleTime: 60_000,
  });
}

/**
 * ✅WA T4: send a reply from the Inbox (api#1528). The caller owns the
 * idempotency key: one per compose attempt, kept while the words are the same.
 */
export function useWaReply(threadId: string) {
  const qc = useQueryClient();
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: { payload: ReplyPayload; idempotencyKey: string }) => {
      const req = replyRequest(threadId, payload, idempotencyKey);
      return api.post<ReplyResult>(req.path, req.body);
    },
    // ★EVERY outcome re-reads the thread: a success to show the line, a repeat
    //  (`duplicate: true` carries no message) to show the first one, and a
    //  refusal because most of them are about the thread's state.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["wa-thread", biz, threadId] });
      qc.invalidateQueries({ queryKey: ["wa-conversations", biz] });
    },
  });
}

/** Flag a thread for human handoff (sets it escalated). */
export function useWaHandoff() {
  const qc = useQueryClient();
  const { business } = useAuth();
  return useMutation({
    mutationFn: (threadId: string) => api.post(`${BASE}/${encodeURIComponent(threadId)}/handoff`),
    onSuccess: (_r, threadId) => {
      qc.invalidateQueries({ queryKey: ["wa-conversations", business?._id ?? "none"] });
      qc.invalidateQueries({ queryKey: ["wa-thread", business?._id ?? "none", threadId] });
    },
  });
}

/** Hand a thread back to the AI (clears escalated → active). Inverse of handoff. */
export function useWaResume() {
  const qc = useQueryClient();
  const { business } = useAuth();
  return useMutation({
    // ★WA T2 follow-up: the rendered `statusVersion` goes with it
    //  (`resumeBody`), so a Resume from a stale view is a 409, not a release.
    mutationFn: ({ threadId, thread }: { threadId: string; thread?: WaThread | null }) =>
      api.post(`${BASE}/${encodeURIComponent(threadId)}/resume`, resumeBody(thread)),
    // ★SETTLED, NOT ONLY SUCCESS: after a stale-view 409 the pane must re-read
    //  the thread, or it keeps the old version and every click is the same 409.
    onSettled: (_r, _e, { threadId }) => {
      qc.invalidateQueries({ queryKey: ["wa-conversations", business?._id ?? "none"] });
      qc.invalidateQueries({ queryKey: ["wa-thread", business?._id ?? "none", threadId] });
    },
  });
}
