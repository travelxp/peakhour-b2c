"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";

export interface PreviewMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/**
 * Drives the Commerce assistant preview (shopify-app-submission-plan.md §S5).
 * Each send posts the message + recent history to the api, which runs the SAME
 * catalog-grounded agent the WhatsApp path uses, against the merchant's real
 * catalog. Non-streaming request/response (simple + good enough for a preview).
 */
export function useCommercePreview() {
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const userMsg: PreviewMessage = {
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const res = await api.post<{ reply: string }>("/v1/commerce/assistant/preview", {
          message: trimmed,
          history,
        });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.reply, timestamp: new Date().toISOString() },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Couldn't reach the assistant. Make sure a Shopify store is connected to this business, then try again.",
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages],
  );

  const reset = useCallback(() => setMessages([]), []);

  return { messages, isLoading, sendMessage, reset };
}
