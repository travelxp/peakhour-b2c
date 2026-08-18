"use client";

/**
 * Ask Peakhour — streaming chat hook.
 *
 * Thin wrapper over the Vercel AI SDK `useChat` pointed at the Hono `/v1/ask`
 * route. Sends cookies (`credentials: "include"`) + the `X-CSRF-Token` header the
 * API's csrfGuard requires, and injects the latest page context into each turn's
 * body so the server activates the right engines.
 */

import { useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { API_BASE_URL, getCsrfToken } from "@/lib/api";
import { useAskContext } from "@/providers/ask-context-provider";

export function useAsk(threadId: string) {
  const { getPageContext } = useAskContext();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_BASE_URL}/v1/ask`,
        credentials: "include",
        // csrfGuard rejects non-GET without this header; fetched from the shared
        // cached token (same one ApiClient uses).
        headers: async () => {
          const token = await getCsrfToken();
          const h: Record<string, string> = {};
          if (token) h["X-CSRF-Token"] = token;
          return h;
        },
        // Shape the request body to the /v1/ask contract: the client thread id,
        // the UIMessage[] transcript, and the current page context.
        prepareSendMessagesRequest: ({ messages, id }) => ({
          body: { id, messages, context: getPageContext() },
        }),
      }),
    [getPageContext],
  );

  return useChat({ id: threadId, transport });
}
