"use client";

import { useState, useRef, useEffect } from "react";
import { useCommercePreview } from "@/hooks/use-commerce-preview";

/**
 * Simulated-WhatsApp preview of the catalog-grounded assistant
 * (shopify-app-submission-plan.md §S5). Lets a merchant try the assistant
 * against their real catalog from the Peakhour dashboard, before/without a
 * live WhatsApp number. Styled to read like a WhatsApp thread.
 */

const SUGGESTIONS = [
  "What do you sell?",
  "Show me something under 1000",
  "Is this available in small?",
];

export function CommerceAssistantPreview() {
  const { messages, isLoading, sendMessage } = useCommercePreview();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const submit = (text: string) => {
    if (!text.trim() || isLoading) return;
    setInput("");
    void sendMessage(text);
  };

  return (
    <div className="mx-auto flex h-[560px] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
      {/* WhatsApp-style header */}
      <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
          P
        </div>
        <div className="leading-tight">
          <div className="text-sm font-medium">Store Assistant</div>
          <div className="text-xs text-white/70">preview · catalog-grounded</div>
        </div>
      </div>

      {/* Thread */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto bg-[#ECE5DD] px-3 py-4"
      >
        {messages.length === 0 && (
          <div className="mx-auto mt-6 max-w-xs rounded-lg bg-white/70 px-3 py-2 text-center text-xs text-neutral-500">
            Ask about your products the way a customer would — in any language.
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[78%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm shadow-sm ${
                m.role === "user"
                  ? "rounded-br-none bg-[#DCF8C6] text-neutral-900"
                  : "rounded-bl-none bg-white text-neutral-900"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-lg rounded-bl-none bg-white px-3 py-2 text-sm text-neutral-400 shadow-sm">
              typing…
            </div>
          </div>
        )}
      </div>

      {/* Suggestion chips (only before the first message) */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 bg-[#ECE5DD] px-3 pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submit(s)}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="flex items-center gap-2 border-t border-neutral-200 bg-white px-3 py-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-full border border-neutral-200 px-4 py-2 text-sm outline-none focus:border-[#075E54]"
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-full bg-[#075E54] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
