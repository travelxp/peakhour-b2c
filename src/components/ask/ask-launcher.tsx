"use client";

/**
 * Ask Peakhour — floating launcher. A FAB in the bottom-right that opens a
 * slide-over conversation panel, available across the dashboard. Runs in
 * parallel with the legacy ChatPanel behind the NEXT_PUBLIC_ASK_ENABLED flag
 * until the PR-11 cutover.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AskConversation } from "./ask-conversation";

function newThreadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `ask-${crypto.randomUUID()}`;
  }
  return `ask-${Math.random().toString(36).slice(2)}${Date.now()}`;
}

/**
 * How long the launcher stays expanded on arrival before collapsing back to a
 * circle. Long enough to be read once, short enough that it is not a banner.
 */
const INTRODUCTION_MS = 2600;

export function AskLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Minted lazily on first open (client-only → no SSR/hydration mismatch).
  const [threadId, setThreadId] = useState<string | null>(null);

  /**
   * The pill's expanded state.
   *
   * ★IT STARTS COLLAPSED AND EXPANDS IN AN EFFECT, WHICH IS THE WHOLE TRICK.
   * Starting expanded would mean the server-rendered markup is the wide pill,
   * so the first paint is a full-width label that snaps shut — a layout jump on
   * every page load rather than a gesture. Mounting collapsed and widening one
   * frame later makes the same motion read as an introduction.
   *
   * ★AND IT ONLY DOES IT ONCE PER SESSION, not once per route. The launcher
   * lives in the dashboard shell, which does not unmount between navigations,
   * so the effect below runs on mount only — introducing itself again on every
   * click through the sidebar is how a friendly animation becomes a tic.
   */
  const [introducing, setIntroducing] = useState(false);

  useEffect(() => {
    // `prefers-reduced-motion` is honoured by not animating at all rather than
    // by animating faster: the expand/collapse is decoration, and the button is
    // fully usable as a circle. (The CSS below also disables the glow, but a
    // width transition driven by React state cannot be reached from CSS.)
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const inTimer = window.setTimeout(() => setIntroducing(true), 400);
    const outTimer = window.setTimeout(() => setIntroducing(false), 400 + INTRODUCTION_MS);
    return () => {
      window.clearTimeout(inTimer);
      window.clearTimeout(outTimer);
    };
  }, []);

  // The full-page /dashboard/ask surface already hosts a conversation — don't
  // also float a (separate-thread) launcher over it.
  if (pathname === "/dashboard/ask") return null;

  function openPanel() {
    setThreadId((id) => id ?? newThreadId());
    setOpen(true);
  }

  return (
    <>
      {!open && (
        <button
          onClick={openPanel}
          onMouseEnter={() => setIntroducing(true)}
          onMouseLeave={() => setIntroducing(false)}
          onFocus={() => setIntroducing(true)}
          onBlur={() => setIntroducing(false)}
          className={cn(
            "group fixed bottom-6 right-6 z-50 flex h-12 items-center overflow-hidden rounded-full",
            "bg-primary text-primary-foreground shadow-lg",
            // Width is the animated property, and it animates between two fixed
            // values rather than to `auto` — `auto` is not an animatable length,
            // so the transition would simply not run.
            "transition-[width,box-shadow] duration-500 ease-brand active:scale-95",
            introducing ? "w-44" : "w-12",
            // The pulse. `u-ask-glow` lives in globals.css and is inert under
            // prefers-reduced-motion; it is a shadow animation, so it costs no
            // layout and cannot shift anything around it.
            "u-ask-glow",
            "motion-reduce:w-12 motion-reduce:transition-none",
          )}
          aria-label="Open Ask Peakhour"
        >
          {/* Fixed 3rem lane for the icon so the label slides out beside a mark
              that does not move. Centring the icon in the growing box instead
              would drift it right as the pill widened. */}
          <span className="flex size-12 shrink-0 items-center justify-center">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <span
            className={cn(
              "whitespace-nowrap pr-5 text-sm font-semibold transition-opacity duration-300",
              // Fades slightly behind the width so the text never appears
              // clipped mid-reveal.
              introducing ? "opacity-100 delay-100" : "opacity-0 delay-0",
            )}
          >
            Ask Peakhour
          </span>
        </button>
      )}

      {/* Mount once opened, then toggle visibility (don't unmount) so useChat keeps
          the conversation across close→reopen. */}
      {threadId && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 h-140 w-100 flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl",
            open ? "flex" : "hidden",
          )}
        >
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-none">Ask Peakhour</p>
              <p className="text-[11px] text-muted-foreground">Grounded in your real data</p>
            </div>
            <Button variant="ghost" size="icon" className="size-7" asChild>
              <Link href="/dashboard/ask" aria-label="Open Ask Peakhour full page" title="Open full page">
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setOpen(false)} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>

          <AskConversation threadId={threadId} className="flex-1 overflow-hidden" autoFocus={open} />
        </div>
      )}
    </>
  );
}
