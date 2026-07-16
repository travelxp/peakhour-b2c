"use client";

/**
 * Ask Peakhour — full-page conversation surface. Roomier than the launcher; same
 * grounded engine. threadId is minted client-side (lazy, to avoid an SSR/client
 * hydration mismatch) and reset by "New conversation". Supports a `?q=` deep-link
 * to seed the composer (e.g. "Ask about this" from the Analytics page).
 */

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AskConversation } from "@/components/ask/ask-conversation";

function newThreadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `ask-${crypto.randomUUID()}`;
  }
  return `ask-${Math.random().toString(36).slice(2)}${Date.now()}`;
}

function AskPageInner() {
  const searchParams = useSearchParams();
  const initialInput = searchParams.get("q") ?? undefined;
  // Lazy initializer (not setState-in-effect); threadId isn't rendered to the
  // DOM, so a server/client value difference can't cause a hydration mismatch.
  const [threadId, setThreadId] = useState<string>(() => newThreadId());

  return (
    <div className="mx-auto flex h-[calc(100dvh-5rem)] w-full max-w-3xl flex-col p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-none tracking-tight">Ask Peakhour</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Your SEO manager + data analyst — answers grounded in your real analytics.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setThreadId(newThreadId())}>
          <Plus className="mr-1.5 size-3.5" />
          New conversation
        </Button>
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border bg-background">
        {/* useChat resets on threadId change, so no key needed; initialInput seeds
            the composer once from the ?q deep-link. */}
        <AskConversation threadId={threadId} className="h-full" initialInput={initialInput} />
      </div>
    </div>
  );
}

export default function AskPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <AskPageInner />
    </Suspense>
  );
}
