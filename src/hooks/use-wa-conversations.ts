"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

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
}

export interface WaThread {
  threadId: string;
  contactName: string | null;
  status: string;
  messages: WaMessage[];
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
