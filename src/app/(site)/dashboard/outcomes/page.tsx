"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Lightbulb,
  Minus,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { WhatCountsAsAWinDialog } from "@/components/growth/what-counts-as-a-win-dialog";
import { useAuth } from "@/providers/auth-provider";
import { growthApi, type OutcomesResponse } from "@/lib/api/growth";
import { platformLabel } from "@/lib/audience-library-rules";

/**
 * Outcomes (v1) — what happened, what it means, and what to do next.
 *
 * ★THE ORDER IS THE ARGUMENT. One sentence about what happened; then the things
 * that need a person; then what moved; and the numbers LAST, small, because a
 * customer who wanted a metrics dashboard already has two of them (their ad
 * platform's and their analytics'). This page exists to be the one that tells
 * them what to do about it.
 *
 * ★IT IS USEFUL BEFORE ANY MONEY IS SPENT, which was the whole reason it could
 * not ship earlier. Every version of this page that started from ad performance
 * had nothing to say to a business in its first months — the state every
 * business is in when it most needs to know whether the work is landing. Reach
 * and attention carry it; paid appears when there is spend.
 *
 * ★AND A MISSING CONVERSION IS NAMED, NEVER RENDERED AS A ZERO. The api sends
 * `configured: false` with a reason and no number precisely so this page cannot
 * put "0 enquiries" over real traffic, which reads as a verdict on the
 * customer's marketing when it is our own missing setup step.
 */

/** The two windows worth offering. A picker with six options is a settings
 *  screen; these are "the last month" and "the last quarter". */
const WINDOWS = [
  { days: 28, label: "28 days" },
  { days: 90, label: "90 days" },
] as const;

const NUM = new Intl.NumberFormat("en-US");

const SEVERITY: Record<
  OutcomesResponse["nextActions"][number]["severity"],
  { dot: string; icon: typeof AlertTriangle; label: string }
> = {
  critical: { dot: "bg-destructive", icon: AlertTriangle, label: "Needs you now" },
  attention: { dot: "bg-warning", icon: AlertTriangle, label: "Worth a look" },
  opportunity: { dot: "bg-success", icon: Lightbulb, label: "Opportunity" },
};

const DIRECTION_ICON = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
} as const;

export default function OutcomesPage() {
  const { business } = useAuth();
  const [days, setDays] = useState<number>(28);

  const outcomes = useQuery({
    // Business in the key for the same reason every other business-scoped hook
    // pins it: the route is business-scoped server-side, and a key that does
    // not say which business is one cache clear away from showing another's.
    queryKey: ["growth-outcomes", business?._id ?? "none", days],
    queryFn: () => growthApi.outcomes(days),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      {/* The two crons that put the numbers on this page there. */}
      <CronToolbar crons={["performance-sync", "ad-campaign-monitor", "linkedin-post-sync"]} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Outcomes</h2>
          <p className="text-muted-foreground">
            What your marketing actually did, and what to do about it next.
          </p>
        </div>
        <div className="flex shrink-0 gap-1 rounded-md border p-0.5">
          {WINDOWS.map((w) => (
            <Button
              key={w.days}
              type="button"
              size="sm"
              variant={days === w.days ? "secondary" : "ghost"}
              className="h-7 px-3 text-xs"
              aria-pressed={days === w.days}
              onClick={() => setDays(w.days)}
            >
              {w.label}
            </Button>
          ))}
        </div>
      </div>

      {outcomes.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : outcomes.isError ? (
        <EmptyState
          icon={TrendingUp}
          title="We couldn't work out your outcomes"
          description="That's on us — nothing has been changed. Try again in a moment."
          action={{ label: "Try again", onClick: () => void outcomes.refetch() }}
        />
      ) : (
        <OutcomesBody data={outcomes.data} />
      )}
    </div>
  );
}

/** Naive plural for a customer-supplied noun. Deliberately not a library: the
 *  label is theirs and short ("enquiry", "demo request", "new lead"), and a
 *  wrong "s" is a smaller cost than a dependency that would also get the
 *  irregular cases wrong in a language we did not ask them to type in. */
function plural(label: string, n: number): string {
  if (n === 1) return label;
  if (/(s|x|z|ch|sh)$/i.test(label)) return `${label}es`;
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

function OutcomesBody({ data }: { data: OutcomesResponse }) {
  const { reach, attention, conversions, nextActions, movements } = data;
  const [winOpen, setWinOpen] = useState(false);
  const nothingHappened =
    reach.organic.posts === 0 && reach.paid === null && (reach.site?.sessions ?? 0) === 0;

  return (
    <div className="space-y-6">
      {winOpen && <WhatCountsAsAWinDialog open={winOpen} onOpenChange={setWinOpen} />}

      {/* ── What happened ──────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-5">
          <p className="text-lg leading-relaxed font-medium text-balance">{data.headline}</p>
          {movements.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {movements.map((m, i) => {
                const Icon = DIRECTION_ICON[m.direction];
                return (
                  <li key={`${m.direction}-${i}`} className="flex items-start gap-2 text-sm">
                    <Icon
                      className={`mt-0.5 size-4 shrink-0 ${
                        m.direction === "up"
                          ? "text-success-on-tint"
                          : m.direction === "down"
                            ? "text-destructive-on-tint"
                            : "text-muted-foreground"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground">{m.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── What to do next ────────────────────────────────────────────
          ★ABOVE THE NUMBERS, ALWAYS. This is the half of the page that is
          worth opening; a customer who reads only one block should read this
          one. Every item names the row it came from — a recommendation that
          cannot be traced to a fact about their own account is advice, and
          advice is exactly what this page exists not to be. */}
      {nextActions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">What needs you</h3>
          <div className="space-y-2">
            {nextActions.map((a) => {
              const s = SEVERITY[a.severity];
              return (
                <Card key={a.id}>
                  <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full sm:mt-0 ${s.dot}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        <span className="sr-only">{s.label}: </span>
                        {a.title}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{a.detail}</p>
                    </div>
                    {a.href && a.cta && (
                      <Button asChild size="sm" variant="outline" className="shrink-0">
                        <Link href={a.href}>
                          {a.cta}
                          <ArrowRight className="ml-1.5 size-3.5" aria-hidden="true" />
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Did it turn into anything? ─────────────────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Did it turn into anything?</h3>
        <Card>
          <CardContent className="p-5">
            {conversions.configured ? (
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-3xl font-semibold tabular-nums">
                    {NUM.format(conversions.count)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {/* ★THEIR WORD FOR IT, NOT OURS. `label` is the whole reason
                        that field is stored — without it this reads "23
                        generate_lead", which is the machine's name for the
                        thing. Plain "wins" only while nobody has chosen. */}
                    {conversions.label
                      ? plural(conversions.label, conversions.count)
                      : conversions.count === 1
                        ? "win"
                        : "wins"}
                    {conversions.costPer !== null && conversions.currency
                      ? ` · ${conversions.currency} ${conversions.costPer.toFixed(2)} each in ad spend`
                      : ""}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setWinOpen(true)}
                >
                  Change what counts
                </Button>
              </div>
            ) : (
              // ★NO NUMBER HERE, AND THAT IS THE FEATURE. A business whose
              // property has no key event has not had zero enquiries — nobody
              // has ever counted one. Printing "0" over 11,851 people who saw
              // their posts turns our missing setup step into a verdict on
              // their marketing.
              <div className="space-y-3">
                <p className="text-sm">{conversions.message}</p>
                {/* ★THE SAME BUTTON WHICHEVER REASON IT IS. Both roads end at
                    the same decision, and the dialog is what knows whether the
                    analytics half is reachable — sending "not connected" to
                    Integrations instead would make the customer solve OUR
                    plumbing before they can answer a question about their own
                    business, when the inbox option needs no connection at all. */}
                <Button size="sm" variant="outline" onClick={() => setWinOpen(true)}>
                  Tell us what counts as a win
                  <ArrowRight className="ml-1.5 size-3.5" aria-hidden="true" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── The numbers, small and last ────────────────────────────────── */}
      {!nothingHappened && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">The numbers behind it</h3>
          <Card>
            <CardContent className="divide-y p-0">
              <Figure
                label="Saw your posts"
                value={NUM.format(reach.organic.impressions)}
                note={
                  reach.organic.posts > 0
                    ? `across ${reach.organic.posts} post${reach.organic.posts === 1 ? "" : "s"}` +
                      (reach.organic.byPlatform.length > 1
                        ? ` on ${reach.organic.byPlatform.map((p) => platformLabel(p.platform)).join(" and ")}`
                        : "")
                    : "nothing published in this window"
                }
              />
              <Figure
                label="Reacted, commented or shared"
                value={NUM.format(attention.organic.engagements)}
                note={
                  attention.organic.ratePct !== null
                    ? `${attention.organic.ratePct}% of everyone who saw you`
                    : undefined
                }
              />
              {/* ★A SITE BLOCK ONLY WHEN ANALYTICS IS CONNECTED, and dated when
                  the data has stopped moving — the number is still true, it is
                  just true about three weeks ago, and a figure without that
                  caveat is the one people plan against. */}
              {reach.site && (
                <Figure
                  label="Visited your site"
                  value={NUM.format(reach.site.sessions)}
                  note={
                    reach.site.stale && reach.site.dataThrough
                      ? `${NUM.format(reach.site.users)} people · only counted up to ${new Date(reach.site.dataThrough).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                      : `${NUM.format(reach.site.users)} people`
                  }
                />
              )}
              {/* ★PAID APPEARS WHEN THERE IS PAID. A row of zeros for a business
                  that has never advertised is a section pretending to be a
                  measurement. */}
              {reach.paid && (
                <Figure
                  label="Saw your ads"
                  value={NUM.format(reach.paid.impressions)}
                  note={
                    `${reach.paid.campaigns} campaign${reach.paid.campaigns === 1 ? "" : "s"}` +
                    (reach.paid.currency
                      ? ` · ${reach.paid.currency} ${NUM.format(Math.round(reach.paid.spend))} spent`
                      : "")
                  }
                />
              )}
              {attention.paid && (
                <Figure
                  label="Clicked an ad"
                  value={NUM.format(attention.paid.clicks)}
                  note={attention.paid.ctrPct !== null ? `${attention.paid.ctrPct}% of who saw them` : undefined}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/** One figure, as a sentence rather than a tile. Deliberately not a KPI card:
 *  a grid of big numbers is the thing this page exists to replace. */
function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-3">
      <span className="text-sm">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums">{value}</span>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </span>
    </div>
  );
}
