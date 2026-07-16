"use client";

/**
 * Ask Peakhour — shared conversation surface (message list + composer).
 * Driven by the `useAsk` (Vercel AI SDK `useChat`) hook, rendering v7 UIMessage
 * `parts`: text as prose and tool calls as compact "reading…" chips. Used by
 * both the floating launcher and the full-page /dashboard/ask surface.
 */

import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { Bot, Send, Loader2, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAsk } from "@/hooks/use-ask";

/** Friendly labels for the analytics tools (falls back to a prettified name). */
const TOOL_LABELS: Record<string, string> = {
  gsc_search_digest: "Checking search performance",
  gsc_action_worklist: "Finding SEO actions",
  gsc_site_health: "Checking index health",
  gsc_top_queries: "Reading top search queries",
  ga4_conversion_funnel: "Reading website traffic",
  ga4_top_pages: "Reading top pages",
  ga4_acquisition_channels: "Reading traffic sources",
  ga4_run_report: "Running a custom GA4 report",
};

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

const SUGGESTIONS = [
  "How's my website traffic and search doing?",
  "What should I do to get more search traffic?",
  "Which pages get the most visitors?",
];

interface AskPart {
  type: string;
  text?: string;
  toolName?: string;
  state?: string;
}

/** A tool-call part rendered as a status chip. */
function ToolChip({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
      {done ? (
        <Check className="size-3 text-emerald-500" />
      ) : (
        <Loader2 className="size-3 animate-spin" />
      )}
      <Search className="size-3 opacity-60" />
      <span>{label}</span>
    </div>
  );
}

function MessageView({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const parts = (message.parts ?? []) as AskPart[];

  const textParts = parts.filter((p) => p.type === "text" && p.text);
  const toolParts = parts.filter(
    (p) => p.type.startsWith("tool-") || p.type === "dynamic-tool",
  );

  return (
    <div className={cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
      {/* Tool chips (assistant only) */}
      {!isUser && toolParts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {toolParts.map((p, i) => {
            const name = p.type === "dynamic-tool" ? (p.toolName ?? "tool") : p.type.slice("tool-".length);
            const done = p.state === "output-available" || p.state === "output-error";
            return <ToolChip key={i} label={toolLabel(name)} done={done} />;
          })}
        </div>
      )}
      {textParts.map((p, i) => (
        <div
          key={i}
          className={cn(
            "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md",
          )}
        >
          {p.text}
        </div>
      ))}
    </div>
  );
}

export function AskConversation({
  threadId,
  className,
  autoFocus = true,
}: {
  threadId: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const { messages, sendMessage, status, error } = useAsk(threadId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 80);
  }, [autoFocus]);

  function handleSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !busy && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Bot className="size-8 opacity-30" />
            <p className="text-sm">Ask about your analytics, search, and pages — grounded in your real data.</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageView key={m.id} message={m} />
        ))}

        {status === "submitted" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="flex size-6 items-center justify-center rounded-full bg-primary/10">
              <Bot className="size-3 text-primary" />
            </div>
            <div className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Something went wrong. Please try again.
          </div>
        )}
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your traffic, search, pages…"
            rows={1}
            className="max-h-[120px] min-h-[36px] resize-none text-sm"
            disabled={busy}
          />
          <Button size="icon" className="size-9 shrink-0" onClick={handleSend} disabled={!input.trim() || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
          Ask Peakhour answers only from your connected data — it won&apos;t make numbers up.
        </p>
      </div>
    </div>
  );
}
