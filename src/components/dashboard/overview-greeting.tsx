"use client";

import { useSyncExternalStore } from "react";
import { Globe } from "lucide-react";
import { displayBusinessName, greetingForHour } from "@/lib/business-name";
import { cn } from "@/lib/utils";

/**
 * The Overview hero: a greeting, the business it belongs to, and one line about
 * what the page is for.
 *
 * ★IT IS A GREETING BECAUSE THE HOME SCREEN IS THE ONE PAGE THAT ISN'T A TOOL.
 * The header used to print the org name as a bare title with "Your AI marketing
 * command center" under it — a label and a slogan, neither addressed to anyone.
 * Naming the business and the time of day is the cheapest possible way for the
 * product to sound like it has been running while the owner was away, which is
 * the literal claim the ribbon underneath it makes.
 *
 * ★THE DOT FIELD IS CONFINED TO THIS BAND. See `u-dot-field` in globals.css for
 * the full argument; in short, texture behind a greeting reads as a workspace,
 * and the same texture behind KPI cards and charts reads as noise. The mask
 * fades it out before the content below begins, so there is no edge to align
 * anything to.
 */
export function OverviewGreeting({
  businessName,
  websiteUrl,
  className,
}: {
  businessName: string | null | undefined;
  websiteUrl?: string | null;
  className?: string;
}) {
  /**
   * The local hour — null on the server and on the hydrating render, the real
   * value from the first client render after that.
   *
   * ★A GREETING IS THE WORST POSSIBLE HYDRATION MISMATCH, which is why this is
   * not just `new Date().getHours()` in the render body. The server renders in
   * UTC; a user in IST would be served "Good morning" and watch it flip to
   * "Good evening" a beat later — the first thing they read, changing under
   * them. Rendering a blank slot for one frame and then the right answer is
   * strictly better than rendering the wrong one confidently.
   *
   * ★useSyncExternalStore RATHER THAN useState + useEffect, and rather than
   * reading the clock during render. It is the sanctioned way to hold a value
   * that differs between server and client: React uses `getServerSnapshot` for
   * the server pass and the hydrating render, then re-renders with the client
   * snapshot — so there is no setState inside an effect (which cascades a
   * render) and no impure read in the render body (which defeats React
   * Compiler memoization). Both are lint-enforced in this repo.
   *
   * The subscribe callback is an empty unsubscribe: nothing pushes at us. The
   * hour is re-read on any later render the page happens to do, which is
   * plenty — a dashboard left open across noon is not worth a timer.
   */
  const hour = useSyncExternalStore<number | null>(
    () => () => {},
    () => new Date().getHours(),
    () => null,
  );

  const name = displayBusinessName(businessName) || "there";

  return (
    <header className={cn("relative isolate -mx-2 px-2 pb-2 pt-6 sm:pt-8", className)}>
      {/* The band. Absolutely positioned and `-z-10` so it never intercepts a
          click meant for the link below it. Deliberately taller than the text
          it sits behind — the mask needs somewhere to fade out INTO, and a band
          cropped to the copy would show a hard bottom edge. */}
      <span aria-hidden className="u-dot-field pointer-events-none absolute inset-x-0 -top-4 -z-10 h-48" />

      <h1 className="wrap-break-word text-2xl font-semibold tracking-tight sm:text-3xl">
        {/* The greeting slot holds its width from the first paint, so the name
            beside it does not jump sideways when the hour resolves one frame
            later. `ch` rather than `rem`: the reservation has to hold at both
            the 2xl and 3xl steps, and a fixed length that fits one is wrong for
            the other. 15ch is "Good afternoon," — the longest of the three. */}
        <span className="inline-block min-w-[15ch]">
          {hour === null ? " " : `${greetingForHour(hour)},`}
        </span>{" "}
        <em className="font-semibold italic">{name}</em>{" "}
        <span aria-hidden>👋</span>
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Here&rsquo;s what&rsquo;s happening across your business today.
      </p>
      {websiteUrl && (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-w-0 max-w-full items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Globe className="size-3 shrink-0" aria-hidden />
          <span className="truncate">
            {websiteUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
          </span>
        </a>
      )}
    </header>
  );
}
