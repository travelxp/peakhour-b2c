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
 * How long the launcher stays expanded before collapsing back to a circle.
 * Long enough to be read once, short enough that it is not a banner.
 */
const INTRODUCTION_MS = 2600;

/**
 * How often it re-introduces itself.
 *
 * ⚠️THE FIRST VERSION DID THIS ONCE PER SESSION AND THAT WAS TOO SHY TO WORK.
 * The launcher lives in the dashboard shell, which does not unmount between
 * navigations, so the animation fired 400ms after the very first mount and
 * never again — an owner who was reading the page at that moment, or who
 * arrived on a deep link, simply never saw it. An affordance nobody sees is not
 * subtle, it is absent.
 *
 * ★45 SECONDS IS THE WHOLE DESIGN. It is far longer than anything that reads as
 * "loading" and far shorter than a session, so the pill is a thing that
 * occasionally catches the eye rather than a thing that moves while you work.
 * Expanded for 2.6 of every 45 seconds, it is animating six per cent of the
 * time.
 */
const REINTRODUCE_EVERY_MS = 45_000;

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
   */
  const [introducing, setIntroducing] = useState(false);

  /**
   * Has the owner ever opened the panel in this session?
   *
   * ★ONCE THEY HAVE, IT STOPS INTRODUCING ITSELF. The animation exists to tell
   * somebody the button is there; a user who has already used it knows, and
   * repeating at them from that point on is the difference between an
   * affordance and a tic. The glow stays either way — that is ambient, and it
   * does not move.
   */
  const [discovered, setDiscovered] = useState(false);

  /**
   * Pointer or keyboard focus is on the pill.
   *
   * ⚠️★KEPT SEPARATE FROM `introducing` BECAUSE THE TIMER AND THE USER WERE
   * FIGHTING OVER ONE FLAG. Both used to write `introducing`, so a tick landing
   * one second into a hover scheduled a collapse 2.6s later — and the label
   * vanished from under the reader's cursor, mid-word. While the animation only
   * ran in the first three seconds that was a load-time curiosity; on a 45-second
   * interval it is a recurring one, for the whole session.
   *
   * With two flags the timer can no longer close anything the user is holding
   * open: the pill is expanded when EITHER is set, and each owns only its own.
   */
  const [engaged, setEngaged] = useState(false);

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
    if (discovered) return;
    // 🚫NOT ON THE FULL-PAGE ASK SURFACE. The component returns null there, but
    //  this effect sits above that early return and would otherwise keep an
    //  interval alive for the whole session, re-rendering an element nobody can
    //  see — and `discovered` can never flip on that route, so it would never
    //  stop.
    if (pathname === "/dashboard/ask") return;

    // Each cycle is its own pair of timers rather than one interval driving a
    // toggle: an interval that fired while the tab was throttled could leave
    // the pill stuck open, and a pair that always schedules its own collapse
    // cannot.
    let collapse: number | undefined;
    const expand = () => {
      setIntroducing(true);
      collapse = window.setTimeout(() => setIntroducing(false), INTRODUCTION_MS);
    };
    const first = window.setTimeout(expand, 400);
    const repeat = window.setInterval(expand, REINTRODUCE_EVERY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(repeat);
      if (collapse !== undefined) window.clearTimeout(collapse);
    };
  }, [discovered, pathname]);

  // The full-page /dashboard/ask surface already hosts a conversation — don't
  // also float a (separate-thread) launcher over it.
  if (pathname === "/dashboard/ask") return null;

  function openPanel() {
    setThreadId((id) => id ?? newThreadId());
    setOpen(true);
    // Stops the re-introduction loop for the rest of the session — see
    // `discovered`. Both flags are cleared so the pill is not left wide behind
    // the panel that just opened over it (the pointer is, by definition, on it).
    setDiscovered(true);
    setIntroducing(false);
    setEngaged(false);
  }

  return (
    <>
      {!open && (
        <button
          onClick={openPanel}
          onMouseEnter={() => setEngaged(true)}
          onMouseLeave={() => setEngaged(false)}
          onFocus={() => setEngaged(true)}
          onBlur={() => setEngaged(false)}
          className={cn(
            "group fixed bottom-6 right-6 z-50 flex h-12 items-center overflow-hidden rounded-full",
            "bg-primary text-primary-foreground shadow-lg",
            // Width is the animated property, and it animates between two fixed
            // values rather than to `auto` — `auto` is not an animatable length,
            // so the transition would simply not run.
            "transition-[width,box-shadow] duration-500 ease-brand active:scale-95",
            // Expanded while EITHER holds it open — see `engaged`.
            introducing || engaged ? "w-44" : "w-12",
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
              introducing || engaged ? "opacity-100 delay-100" : "opacity-0 delay-0",
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
