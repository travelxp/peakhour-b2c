"use client";

import {
  formatMoney,
  orderCountLine,
  provenanceLine,
  shortDate,
} from "@/lib/outcome-value";
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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { WhatCountsAsAWinDialog } from "@/components/growth/what-counts-as-a-win-dialog";
import { VisibilityFunnel } from "@/components/growth/visibility-funnel";
import { useAuth } from "@/providers/auth-provider";
import { api } from "@/lib/api";
import { growthApi, type OptimizerRun, type OutcomesResponse } from "@/lib/api/growth";
import { paidNote, paidStaleNote } from "@/lib/outcomes-paid";
import { platformLabel } from "@/lib/audience-library-rules";
import {
  ALL_CHANNELS,
  changedHeading,
  channelChips,
  channelRows,
  learningItems,
  needsYouUnder,
  proposalItems,
  reconnectItems,
  sourceState,
  uncheckedNote,
  withoutCoveredAdsStale,
  type MeasurementBadge,
  type NeedsYouItem,
  type SourceState,
} from "@/lib/growth-dashboard";
import type { AdsIntegrationRow } from "@/app/(site)/dashboard/ads/ads-channels";

/**
 * Outcomes (v1) — what happened, what it means, and what to do next.
 *
 * ★D-03, THE UNIFIED GROWTH DASHBOARD, IS THIS PAGE (plan §6.1): the funnel,
 * what changed, CHANNELS (spend, conversions, cost per conversion and D-02's
 * measurement badge), NEEDS YOU and LEARNING — one page, with channel as a
 * filter chip over the three channel sections, never a tab. What each section
 * says is decided in `lib/growth-dashboard.ts`, tested there.
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

  // ★A SEPARATE QUERY, NOT A SECOND FIELD ON /outcomes, and the reason is what
  // the funnel is for: it must be able to fail, be slow, or be absent without
  // touching the page beneath it. The same `days` goes to both so the funnel
  // and the numbers under it describe the same period — the one thing a
  // client-side assembly of this data always gets wrong.
  const visibility = useQuery({
    queryKey: ["growth-visibility", business?._id ?? "none", days],
    queryFn: () => growthApi.visibility(days),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const outcomes = useQuery({
    // Business in the key for the same reason every other business-scoped hook
    // pins it: the route is business-scoped server-side, and a key that does
    // not say which business is one cache clear away from showing another's.
    queryKey: ["growth-outcomes", business?._id ?? "none", days],
    queryFn: () => growthApi.outcomes(days),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // ★NEEDS YOU AND LEARNING READ THESE, AND EACH MAY FAIL ALONE. The optimizer
  // page's decide invalidates `["growth-adjustments"]`, which prefix-matches
  // this key, so a decision there is reflected here.
  const adjustments = useQuery({
    queryKey: ["growth-adjustments", business?._id ?? "none"],
    queryFn: () => growthApi.adjustments(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // The ads hub's key prefix (its invalidations reach this), plus the business:
  // a reconnect card for another business's connection is the cache-clear
  // hazard the outcomes key above names.
  const integrations = useQuery({
    queryKey: ["content-hub-integrations", business?._id ?? "none"],
    queryFn: () => api.get<{ integrations: AdsIntegrationRow[] }>("/v1/integrations"),
    staleTime: 30_000,
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

      {/* ★★THE FUNNEL LEADS, AND EVERYTHING BELOW IT IS UNCHANGED. Found →
          chosen → convinced → bought is the shape of the question a shopkeeper
          actually asks; the ranked actions under it are what to do about the
          answer. It renders nothing at all on a failure rather than a red
          panel, because the page works without it. */}
      {/* ★`isPending` ALONE. A first version wrote `isPending && !isError` —
          a guard after a stronger guard: the two statuses are mutually
          exclusive in Query v5, so the second could never fire and read as a
          precaution somebody had taken. */}
      <VisibilityFunnel data={visibility.data} isPending={visibility.isPending} />

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
        <OutcomesBody
          data={outcomes.data}
          days={days}
          runs={adjustments.data?.runs}
          // ★READ ONLY WITH DATA: loading, retrying and a refetch after an
          //  error (which clears `error`) are all unchecked, not "nothing".
          runsState={sourceState(adjustments)}
          integrations={integrations.data?.integrations}
          integrationsState={sourceState(integrations)}
        />
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

function OutcomesBody({
  data,
  days,
  runs,
  runsState,
  integrations,
  integrationsState,
}: {
  data: OutcomesResponse;
  days: number;
  /** Undefined until read — and while it cannot be. */
  runs: OptimizerRun[] | undefined;
  runsState: SourceState;
  integrations: AdsIntegrationRow[] | undefined;
  integrationsState: SourceState;
}) {
  const { reach, attention, conversions, value, nextActions, movements } = data;
  // Computed once: the guard and the rendered child were two independent
  // evaluations of the same expression.
  const countLine = value ? orderCountLine(value) : null;
  const [winOpen, setWinOpen] = useState(false);
  const [picked, setPicked] = useState<string>(ALL_CHANNELS);
  const nothingHappened =
    reach.organic.posts === 0 && reach.paid === null && (reach.site?.sessions ?? 0) === 0;

  const reconnect = reconnectItems(integrations ?? []);
  const proposals = proposalItems(runs ?? []);
  const channelItems: NeedsYouItem[] = [...reconnect, ...proposals];
  const chips = channelChips([
    ...(reach.paid?.byChannel ?? []).map((c) => c.platform),
    ...(runs ?? []).map((r) => r.platform),
    ...channelItems.flatMap((i) => (i.channel ? [i.channel] : [])),
  ]);
  // A chip that is no longer offered (the window changed) falls back to All
  // rather than filtering every section down to nothing.
  const filter = chips.some((c) => c.key === picked) ? picked : ALL_CHANNELS;
  const rows = channelRows(reach.paid, filter);
  // Broken things first, then the business's own next actions, then the
  // decisions waiting — each in the order its source ranked them.
  const ranked: NeedsYouItem[] = [
    ...reconnect,
    ...withoutCoveredAdsStale(nextActions, reach.paid, reconnect),
    ...proposals,
  ];
  const needsYou = needsYouUnder(filter, ranked);
  const unchecked = uncheckedNote({ proposals: runsState, connections: integrationsState });
  const runsFailed = runsState === "failed";
  const learning = runs ? learningItems(runs, filter) : null;

  return (
    <div className="space-y-6">
      {winOpen && <WhatCountsAsAWinDialog open={winOpen} onOpenChange={setWinOpen} />}

      {/* ── What changed ───────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-5">
          <p className="text-lg leading-relaxed font-medium text-balance">{data.headline}</p>
          {movements.length > 0 && (
            <h3 className="mt-4 text-xs font-medium text-muted-foreground">{changedHeading(days)}</h3>
          )}
          {movements.length > 0 && (
            <ul className="mt-1.5 space-y-1.5">
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

      {/* ── The channel filter ─────────────────────────────────────────
          ★A FILTER, NOT A TAB: it narrows the three sections under it and
          nothing above — the funnel and what changed are the business's. */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Show one channel">
          {chips.map((c) => (
            <Button
              key={c.key}
              type="button"
              size="sm"
              variant={filter === c.key ? "secondary" : "outline"}
              className="h-7 rounded-full px-3 text-xs"
              aria-pressed={filter === c.key}
              onClick={() => setPicked(c.key)}
            >
              {c.label}
            </Button>
          ))}
        </div>
      )}

      {/* ── What to do next ────────────────────────────────────────────
          ★ABOVE THE NUMBERS, ALWAYS. This is the half of the page that is
          worth opening; a customer who reads only one block should read this
          one. Every item names the row it came from — a recommendation that
          cannot be traced to a fact about their own account is advice, and
          advice is exactly what this page exists not to be. */}
      {(needsYou.items.length > 0 || needsYou.heldBack > 0 || unchecked) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">What needs you</h3>
          {unchecked && <p className="text-xs text-muted-foreground">{unchecked}</p>}
          {needsYou.heldBack > 0 && (
            <p className="text-xs text-muted-foreground">
              {needsYou.heldBack} more about your ads {needsYou.heldBack === 1 ? "isn't" : "aren't"} tied to one
              channel —{" "}
              <button type="button" className="underline underline-offset-2" onClick={() => setPicked(ALL_CHANNELS)}>
                show all channels
              </button>
              .
            </p>
          )}
          <div className="space-y-2">
            {needsYou.items.map((a) => {
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

      {/* ── Channels ──────────────────────────────────────────────────
          ★PAID APPEARS WHEN THERE IS PAID, as everywhere on this page. Each
          channel carries D-02's badge, read from /outcomes — /visibility
          reads every measured channel `partial`, so it cannot be the source. */}
      {rows.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Channels</h3>
          <Card>
            <CardContent className="divide-y p-0">
              {rows.map((r) => (
                <div key={r.platform} className="space-y-1.5 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{r.label}</span>
                    {r.badge && <MeasurementBadgeChip badge={r.badge} />}
                    {r.note && <span className="text-xs text-muted-foreground">{r.note}</span>}
                  </div>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                    <ChannelFigure term="Spent" value={r.spend} />
                    <ChannelFigure term="Conversions, as the platform counts them" value={r.conversions} />
                    <ChannelFigure term="Cost per conversion" value={r.costPerConversion} />
                  </dl>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Learning ──────────────────────────────────────────────────
          What was tried and what came of it. Absent until the proposals are
          read: an empty list over a failed read would say nothing was ever
          tried. */}
      {(learning || runsFailed) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">What we tried</h3>
          <Card>
            <CardContent className="p-5">
              {runsFailed ? (
                <p className="text-sm text-muted-foreground">
                  We couldn&apos;t load what the optimizer has tried just now.
                </p>
              ) : learning && learning.length > 0 ? (
                <ul className="space-y-3">
                  {learning.map((l) => (
                    <li key={l.id} className="text-sm">
                      <p className="font-medium">
                        {l.headline}
                        {l.when && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">{l.when}</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">{l.detail}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing has been tried yet. When an optimizer proposal is applied, dismissed or
                  fails, it&apos;s listed here with what it expected to do.
                </p>
              )}
            </CardContent>
          </Card>
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

      {/* ── What was it worth? ─────────────────────────────────────────── */}
      {/* ★GUARDED ON THE FIELD ITSELF, because the two repos deploy separately
          and this build can ship ahead of the api that sends it. Unguarded, one
          `value.available` throws and takes the WHOLE route down — headline,
          next actions, the numbers — over a card that had not arrived yet. */}
      {value && (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">What was it worth?</h3>
        <Card>
          <CardContent className="p-5">
            {value.available ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-3xl font-semibold tabular-nums">
                    {formatMoney(value.amount, value.currency)}
                  </span>
                  {countLine && (
                    <span className="text-sm text-muted-foreground">{countLine}</span>
                  )}
                </div>
                {/* ★WHERE IT CAME FROM, AND — WHEN THE FIGURE FALLS SHORT OF THE
                    PERIOD — WHICH DAYS IT ACTUALLY COVERS. Both come from
                    `provenanceLine`, which is tested and mutated; the page does
                    not recompute `partial` from the day counts, because two
                    surfaces recomputing one rule is how they come to disagree. */}
                <p className="text-xs text-muted-foreground">{provenanceLine(value)}</p>
              </div>
            ) : (
              // ★NO NUMBER HERE EITHER, AND FOR THE SAME REASON AS THE CARD
              // ABOVE. The api has already decided this cannot be shown — a
              // measured zero from a property with no purchase tracking means
              // the opposite of a shop that sold nothing, and rendering "0"
              // over it turns our missing setup step into a verdict on their
              // trading. The message names the fix; this page does not invent
              // one.
              <div className="space-y-2">
                <p className="text-sm">{value.message}</p>
                {/* A purchase count needs no currency, so it survives a window
                    we cannot total — and on a two-currency store it is the only
                    money-adjacent figure there is. Dated when it does not cover
                    the period; absent entirely when the api sent none, because
                    a count nobody took is not a count of nought. */}
                {countLine && <p className="text-xs text-muted-foreground">{countLine}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

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
              {/* ★★THE SESSION COUNT MOVED TO THE FUNNEL, AND THE PEOPLE COUNT
                  STAYED. Both this and the funnel's CONVINCED card were GA4
                  sessions over the same nominal window, from two endpoints that
                  compute it differently: /outcomes uses a rolling now−N×24h
                  cutoff and sums every matching row, while /visibility snaps to
                  UTC midnight, scopes to the selected property, keeps whole-day
                  rows only and de-dupes to the newest snapshot per day. Two
                  numbers for one quantity, on one screen, guaranteed to
                  disagree — the defect the money card was fixed for one review
                  round earlier.
                  ★The funnel's is the better-computed one, so it keeps the
                  sessions; this figure now reports USERS, which the funnel does
                  not carry and which is a different question anyway ("how many
                  people", not "how many visits"). */}
              {reach.site && (
                <Figure
                  label="People who visited"
                  value={NUM.format(reach.site.users)}
                  note={
                    reach.site.stale && reach.site.dataThrough
                      ? `only counted up to ${shortDate(reach.site.dataThrough)}`
                      : undefined
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
                  // ★NULL SPEND IS A REFUSAL, NOT A ZERO (D-01) — see paidNote.
                  note={paidNote(reach.paid)}
                />
              )}
              {attention.paid && (
                <Figure
                  label="Clicked an ad"
                  value={NUM.format(attention.paid.clicks)}
                  note={
                    [
                      attention.paid.ctrPct !== null ? `${attention.paid.ctrPct}% of who saw them` : null,
                      paidStaleNote(reach.paid),
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

const BADGE_TONE: Record<MeasurementBadge["tone"], string> = {
  success: "bg-success/15 text-success-on-tint",
  warning: "bg-warning/15 text-warning-on-tint",
  muted: "bg-muted text-muted-foreground",
};

/** D-02's measurement badge, with its meaning spoken and on hover. */
function MeasurementBadgeChip({ badge }: { badge: MeasurementBadge }) {
  return (
    <Badge variant="ghost" className={`h-5 px-2 text-[11px] ${BADGE_TONE[badge.tone]}`} title={badge.meaning}>
      {badge.label}
      <span className="sr-only">: {badge.meaning}</span>
    </Badge>
  );
}

function ChannelFigure({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="tabular-nums">{value}</dd>
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
