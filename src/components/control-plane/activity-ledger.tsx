"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ShieldAlert, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ActivityRow, NotificationDomain } from "@/lib/api/control-plane";
import { WHATSAPP_SETTINGS_HREF } from "@/lib/control-plane";
import {
  activityActor,
  activityCopy,
  activityScopeNote,
  activityWhen,
  displayTimeZone,
} from "@/lib/control-plane-activity";
import { useActivityLedger } from "@/hooks/use-control-plane";

/**
 * §07 — *"What Peakhour said, and what it did"*. PR-2.5d.
 *
 * > If an agent can stop a campaign from a WhatsApp message, the merchant needs
 * > a ledger of **every instruction it acted on and who gave it.**
 *
 * ── ★★THE FOURTH ROW IS THE POINT, AND IT IS NOT THE ROW §07 DREW ────────
 *
 * §07's argument for the whole surface is the refusal: *"it tells them the wall
 * is real, and it tells them someone is probing."* ★That still holds. **What
 * changed is who the refusal is about.**
 *
 * §07 drew a stranger — a number with no rows anywhere. `recordActivity`
 * declines to write that row at all (`no_scope`): with no org it is unreachable
 * by `by_org_recent`, undeletable by either erase filter, and never expired, and
 * a public WhatsApp number receiving spam would grow an undeletable pile.
 * ⏸**So the stranger belongs to a platform-level surface that does not exist**,
 * and this tab does not pretend otherwise — see `control-plane-activity.ts`.
 *
 * ★WHAT DOES REACH THIS PAGE is every refusal that resolved an org: a number
 * mid-registration, a teammate whose membership lapsed, a person verified on
 * two businesses whose command had no scope. **Each of those the merchant can
 * act on, and none of them is visible anywhere else** — `platform-inbound.ts`
 * is deliberately SILENT to the sender on the first two.
 *
 * ── 🚫★★AND THE MASKED COLUMN IS NOT CAPTIONED "NOT A REGISTERED TEAMMATE" ─
 *
 * §07's mock does, and it is wrong: `unknown_sender` covers a
 * registered-but-PENDING contact too, so sometimes they are one. The caption
 * says what is true of every masked row instead — the number was **not
 * verified** when the message arrived — which is also the only sentence that
 * points at the fix, one tab to the left.
 */

/**
 * The clock this list dates its rows by — `null` until the browser has it.
 *
 * ── ⚠️★★BOTH VALUES DIFFER BETWEEN THE SERVER AND THE BROWSER ────────────
 *
 * `new Date()` is what decides *"Yesterday"*, and the zone fallback is
 * `Intl…resolvedOptions().timeZone`, which **on the server is the deploy
 * region's**. Computing either during render makes every date in this list a
 * hydration mismatch, and shows a merchant in Mumbai the server's day for a beat.
 *
 * 🚫★AND THE PAGE'S `business` GATE DOES NOT MAKE THAT SAFE. This component
 * only renders once `business._id` resolves, which today happens client-side —
 * so nothing server-renders it, **but that is a fact about the parent's data
 * rather than a property of this file**, and it is exactly the shape of
 * "protected by what happens to be around it".
 *
 * ★`useSyncExternalStore` IS THE READ THAT SAYS SO. The server snapshot is
 * `false` and the client's is `true`, so React renders the fallback into the
 * HTML and swaps after hydration — 🚫where a `useState` initialiser would run on
 * BOTH sides and reintroduce the mismatch it was reaching for.
 *
 * ★ONE `now` FOR THE WHOLE LIST, so two rows a second apart cannot land in
 * different buckets because the clock moved between them.
 *
 * ⚠️★★AND "NOW" IS WHEN THE LIST WAS FETCHED, WHICH IS WHAT MAKES IT REFRESH.
 * A clock captured once at hydration goes stale on a page somebody leaves open:
 * **after midnight yesterday's rows still render as a bare time and today's
 * render as a date**, which is precisely backwards. `dataUpdatedAt` moves on
 * every refetch — window focus included — so coming back to the tab re-dates
 * the list. ★It is READ as the instant rather than used as a trigger, because
 * *"18:03"* beside a row means "as of this list", and a list and its dates
 * drawn from two different moments can disagree. 🚫Not a timer: a ledger
 * nobody is looking at does not need a re-render a minute.
 */
function useClientClock(
  timeZonePreference: string | null | undefined,
  dataUpdatedAt: number,
) {
  const mounted = useSyncExternalStore(
    // ★NOTHING TO SUBSCRIBE TO: the value changes once, at hydration, and React
    //  re-reads it then. The unsubscribe is what the contract requires back.
    () => () => {},
    () => true,
    () => false,
  );
  return useMemo(
    () =>
      mounted
        ? {
            // ★`dataUpdatedAt` IS 0 UNTIL THE FIRST ANSWER, and a 1970 clock
            //  would date every row as years old. The caller renders a skeleton
            //  in that window, but the fallback is here rather than relying on it.
            now: dataUpdatedAt > 0 ? new Date(dataUpdatedAt) : new Date(),
            timeZone: displayTimeZone(timeZonePreference),
          }
        : null,
    [mounted, timeZonePreference, dataUpdatedAt],
  );
}

/** ★ONE ROW, AND THE REFUSAL IS VISIBLE BEFORE THE SENTENCE IS READ. */
function LedgerLine({
  row,
  domains,
  timeZone,
  now,
}: {
  row: ActivityRow;
  domains: NotificationDomain[];
  timeZone: string;
  now: Date;
}) {
  const copy = activityCopy(row, domains);
  const actor = activityActor(row);
  const scope = activityScopeNote(row);

  return (
    <li className="flex gap-3 border-b border-border py-3 last:border-b-0">
      <div className="w-24 shrink-0 pt-0.5">
        <span className="text-xs font-medium text-muted-foreground">
          {copy.group}
        </span>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {copy.refused && (
            <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
              <ShieldAlert className="size-3" aria-hidden />
              Refused
            </Badge>
          )}
          <span className={copy.refused ? "font-medium" : undefined}>{copy.what}</span>
        </p>

        <p className="text-xs text-muted-foreground">
          {/* ★THE NUMBER IS RENDERED IN A MONO FACE so a merchant comparing two
              masked rows can see at a glance that it is the same number twice —
              which is the "someone is probing" signal §07 is built around. */}
          <span className={actor.masked ? "font-mono" : undefined}>{actor.label}</span>
          {actor.masked && (
            <>
              {" · "}
              <span>not a verified number</span>
            </>
          )}
          {row.confirmed && (
            <>
              {" · "}
              {/* ★§07's own words. ⚠️Absent means the command needed no
                  confirmation — NOT that nobody was asked — so nothing is
                  rendered in its place. */}
              <strong className="font-medium text-foreground">
                confirmed before acting
              </strong>
            </>
          )}
          {scope && (
            <>
              {" · "}
              <span>{scope}</span>
            </>
          )}
        </p>
      </div>

      <div className="w-20 shrink-0 pt-0.5 text-right">
        <time
          dateTime={row.occurredAt}
          className="text-xs tabular-nums text-muted-foreground"
        >
          {activityWhen(row.occurredAt, now, timeZone)}
        </time>
      </div>
    </li>
  );
}

export function ActivityLedger({
  domains,
  timeZonePreference,
}: {
  domains: NotificationDomain[];
  /** The merchant's own zone, when they have set one. See `activityWhen`. */
  timeZonePreference: string | null | undefined;
}) {
  const ledger = useActivityLedger();

  const clock = useClientClock(timeZonePreference, ledger.dataUpdatedAt);

  const rows = ledger.data?.pages.flatMap((p) => p.rows) ?? [];

  const header = (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <ScrollText className="size-4" aria-hidden />
        <h2 className="text-base font-semibold">What Peakhour did</h2>
      </CardTitle>
      <CardDescription>
        Every instruction Peakhour acted on over WhatsApp, who gave it, and
        every one it refused.
      </CardDescription>
    </CardHeader>
  );

  // ⚠️★★A FAILED READ AND AN EMPTY ONE MUST NOT SHARE A BODY: "nothing has
  //  happened yet" is reassurance, and showing it after a request that failed
  //  tells a merchant the wall was never tested when in fact nobody asked.
  //
  // ⚠️🚫★★BUT ONLY WHEN THERE IS NOTHING TO SHOW — A FIRST VERSION ASKED
  //  `isError` BEFORE LOOKING AT THE DATA. On an infinite query `isError` goes
  //  true when the SECOND page fails, while the pages already fetched are still
  //  in the cache — so one failed "Show older", or one refetch on window focus,
  //  **replaced the whole ledger with an error card** and threw away rows the
  //  merchant was reading. ★A failure to extend a list is a failure of the
  //  pager, and it is reported there.
  if (ledger.isError && rows.length === 0) {
    return (
      <Card>
        {header}
        <CardContent>
          <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            Could not load the activity ledger. Reload the page to try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (ledger.isLoading || !clock) {
    return (
      <Card>
        {header}
        <CardContent>
          <div
            className="space-y-2"
            role="status"
            aria-label="Loading the activity ledger"
          >
            <div className="h-10 rounded bg-muted animate-pulse" />
            <div className="h-10 rounded bg-muted animate-pulse" />
            <div className="h-10 rounded bg-muted animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          // ★AN EMPTY LEDGER IS THE ORDINARY STATE FOR A NEW BUSINESS, and the
          //  copy says what would fill it rather than apologising for the gap.
          <p className="text-sm text-muted-foreground">
            Nothing yet. Once someone messages Peakhour on WhatsApp, every
            instruction it runs — and every one it refuses — appears here.
          </p>
        ) : (
          <ul>
            {rows.map((row) => (
              <LedgerLine
                key={row.id}
                row={row}
                domains={domains}
                timeZone={clock.timeZone}
                now={clock.now}
              />
            ))}
          </ul>
        )}

        {/* ★THE PAGER REPORTS ITS OWN FAILURE, beside the button that caused
            it, and the rows above stay on the screen. */}
        {ledger.isError && rows.length > 0 && (
          <p role="alert" className="text-sm text-destructive">
            Could not load more of the ledger. Try again in a moment.
          </p>
        )}

        {ledger.hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void ledger.fetchNextPage()}
            disabled={ledger.isFetchingNextPage}
          >
            {ledger.isFetchingNextPage ? "Loading…" : "Show older"}
          </Button>
        )}

        {/* ⚠️★★THE FOOTNOTE IS NOT DECORATION. A merchant reading "not a
            verified number" beside a mask will assume a stranger, and on this
            page it is at least as likely to be their own colleague part-way
            through registering. **The row cannot say which**, so the page says
            so once rather than guessing per row. */}
        {rows.some((r) => r.actorMasked) && (
          <p className="text-xs text-muted-foreground">
            A hidden number is one Peakhour could not match to a verified
            teammate — which includes a teammate whose number is still being
            confirmed.{" "}
            <Link href={WHATSAPP_SETTINGS_HREF} className="underline">
              Check your numbers
            </Link>
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}
