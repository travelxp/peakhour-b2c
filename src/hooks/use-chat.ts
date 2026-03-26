"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    try {
      const res = await api.get<{ threadId: string; messages: ChatMessage[] }>(
        "/v1/chat/history"
      );
      if (res.messages?.length) {
        setMessages(res.messages);
        setThreadId(res.threadId);
      }
      setHistoryLoaded(true);
    } catch {
      setHistoryLoaded(true);
    }
  }, [historyLoaded]);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = {
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const res = await api.post<{ response: string; threadId: string }>(
          "/v1/chat",
          { message: text, threadId }
        );
        setThreadId(res.threadId);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.response,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [threadId]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setThreadId(null);
    setHistoryLoaded(false);
  }, []);

  return { messages, isLoading, sendMessage, loadHistory, clearChat };
}
