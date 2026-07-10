"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface InboxCitation {
  waId: string;
  contactName?: string;
  reason: string;
}

export interface InboxAnswer {
  answer: string;
  citations: InboxCitation[];
  hasEnoughData: boolean;
  /** false when the inbox was empty and no AI call (or charge) was made. */
  billed: boolean;
}

/**
 * "Ask your inbox" — a per-question priced query against the business's WhatsApp
 * conversation history (whatsapp.inbox_intelligence). A mutation, not a query:
 * each ask is a deliberate, billed action the merchant triggers.
 */
export function useAskInbox() {
  return useMutation({
    mutationFn: (question: string) =>
      api.post<InboxAnswer>("/v1/meta/whatsapp/intelligence/ask", { question }),
  });
}
