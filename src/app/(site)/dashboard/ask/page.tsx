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
import { PageShell, PageHeader } from "@/components/dashboard/page-shell";

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
    // `fill` instead of the old `h-[calc(100dvh-5rem)]`, which assumed 80px of
    // shell chrome when the real figure is 120px — so this page overflowed its
    // container by 40px on every device and pushed the composer below the fold.
    // The shell owns the measurement now; nothing here can go stale when its
    // padding or banner slot changes. Also drops a duplicate `p-4`: the shell
    // already insets the page.
    <PageShell width="narrow" fill className="space-y-3 sm:space-y-3">
      <PageHeader
        icon={
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
        }
        title="Ask Peakhour"
        description="Your SEO manager + data analyst — answers grounded in your real analytics."
        actions={
          <Button variant="outline" size="sm" onClick={() => setThreadId(newThreadId())}>
            <Plus className="mr-1.5 size-3.5" />
            New conversation
          </Button>
        }
      />

      {/* min-h-0 lets this shrink below its content so the thread scrolls
          inside the bordered box rather than growing the page. */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-background">
        {/* useChat resets on threadId change, so no key needed; initialInput seeds
            the composer once from the ?q deep-link. */}
        <AskConversation threadId={threadId} className="h-full" initialInput={initialInput} />
      </div>
    </PageShell>
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
