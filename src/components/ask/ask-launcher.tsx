"use client";

/**
 * Ask Peakhour — floating launcher. A FAB in the bottom-right that opens a
 * slide-over conversation panel, available across the dashboard. Runs in
 * parallel with the legacy ChatPanel behind the NEXT_PUBLIC_ASK_ENABLED flag
 * until the PR-11 cutover.
 */

import { useState } from "react";
import { Sparkles, X, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AskConversation } from "./ask-conversation";

function newThreadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `ask-${crypto.randomUUID()}`;
  }
  return `ask-${Math.random().toString(36).slice(2)}${Date.now()}`;
}

export function AskLauncher() {
  const [open, setOpen] = useState(false);
  // Minted lazily on first open (client-only → no SSR/hydration mismatch).
  const [threadId, setThreadId] = useState<string | null>(null);

  function openPanel() {
    setThreadId((id) => id ?? newThreadId());
    setOpen(true);
  }

  return (
    <>
      {!open && (
        <button
          onClick={openPanel}
          className="fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Open Ask Peakhour"
        >
          <Sparkles className="size-5" />
        </button>
      )}

      {open && threadId && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[560px] w-[400px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-none">Ask Peakhour</p>
              <p className="text-[11px] text-muted-foreground">Grounded in your real data</p>
            </div>
            <Button variant="ghost" size="icon" className="size-7" asChild title="Open full page">
              <Link href="/dashboard/ask">
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setOpen(false)} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>

          <AskConversation threadId={threadId} className="flex-1 overflow-hidden" />
        </div>
      )}
    </>
  );
}
