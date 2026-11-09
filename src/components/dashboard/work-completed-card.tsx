"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "@/components/viz/trend-chart";
import { useHomeWork, type WorkMetric } from "@/hooks/use-home-work";
import { cn } from "@/lib/utils";

/**
 * "What Peakhour did for you" — work completed, and the time it stands in for.
 *
 * ── ★★WHY THIS REPLACED "PEAKS SPENT"
 *
 * The chart it displaces plotted the customer's own AI consumption over 30
 * days. That is a COST curve on the one screen that should be answering "is
 * this worth it" — the dashboard equivalent of showing someone their
 * electricity meter instead of a warm house. It was also the only figure on the
 * Overview that went UP when things were going well AND up when something was
 * looping, so it could not be read either way.
 *
 * Of the four candidates, this one is the only one that is true on day one.
 * Business impact (revenue, leads attributed) needs ads AND commerce
 * attribution connected, so most accounts would see an empty card. Performance
 * trends need per-channel metric sync, which exists for LinkedIn and X and
 * nothing else. Opportunities duplicates the "Waiting for you" queue sitting
 * directly beside it. Work completed is derived from six counts the platform
 * already writes for every tenant, so it is honest for a brand-new account too
 * — where it reads zero and offers a first action rather than a blank.
 *
 * ── ★★THE MINUTES ARE AN ESTIMATE AND THE UI SAYS SO
 *
 * `MINUTES_PER_ACTION` lives here, not in the api, for the reason the activity
 * ribbon already documents: the api sends counts and stable metric keys, and
 * every word of wording — including a multiplier that is really a claim about
 * how long a job takes a person — belongs in the component that says it. The
 * card labels the figure "est." and the tooltip lists the per-task assumption,
 * because an unqualified "4h 20m saved" is a number the owner cannot check and
 * therefore will not believe twice.
 */

/**
 * How long each task takes a person doing it by hand. Conservative on purpose:
 * an inflated figure is worth less than a defensible one, because the owner
 * only has to disbelieve it once.
 */
const MINUTES_PER_ACTION: Record<WorkMetric, number> = {
  // Writing, checking and scheduling one post for one channel.
  published: 25,
  // A drafted idea that still needs a human's yes — worth less than a published
  // one precisely because it is not finished.
  drafted: 10,
  // Reading a merchandising or pricing recommendation and acting on it.
  actions_executed: 15,
  // Capturing a lead off a form and getting it somewhere it will be seen.
  leads_captured: 5,
  // A support conversation answered end to end.
  conversations_resolved: 12,
  // Reading a review and writing a reply that sounds like the business.
  reviews_replied: 8,
};

/** Display order and wording. The api's `metric` key is the stable half. */
const METRIC_LABEL: Record<WorkMetric, { one: string; many: string }> = {
  published: { one: "post published", many: "posts published" },
  drafted: { one: "draft written", many: "drafts written" },
  conversations_resolved: { one: "conversation answered", many: "conversations answered" },
  leads_captured: { one: "lead captured", many: "leads captured" },
  reviews_replied: { one: "review answered", many: "reviews answered" },
  actions_executed: { one: "store action taken", many: "store actions taken" },
};

const METRIC_ORDER: WorkMetric[] = [
  "published",
  "drafted",
  "conversations_resolved",
  "leads_captured",
  "reviews_replied",
  "actions_executed",
];

/** "4h 20m", "45m", "—". Hours only past 60 minutes; nobody says "0h 45m". */
function formatMinutes(total: number): string {
  if (total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "YYYY-MM-DD" in UTC — matches the api's `$dateToString` bucket. */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function WorkCompletedCard({
  className,
  days = 14,
}: {
  className?: string;
  days?: number;
}) {
  const { data, isLoading } = useHomeWork(days);

  /**
   * Fill the quiet days back in.
   *
   * ★A DAY WITH NO WORK IS DATA. The api aggregates by day, so a day with
   * nothing produces no row at all. Charting the rows as returned would
   * silently compress the x-axis — three scattered days of activity would draw
   * as three adjacent points and read as continuous work. Anchored on the
   * server's own `today` so the client's timezone cannot shift the series by a
   * day against the buckets it is filling.
   */
  const series = useMemo(() => {
    // ★ANCHORED ON THE SERVER'S `today`, WITH NO CLOCK FALLBACK. Reading
    //  Date.now() here would be an impure render (it defeats React Compiler
    //  memoization and is lint-enforced), and it would also be pointless: with
    //  no response there is nothing to plot, and the card renders its loading
    //  or first-run branch instead of this series.
    if (!data?.today) return [];
    const byDay = new Map<string, number>();
    for (const row of data.days) byDay.set(row.date, row.count);
    const anchor = Date.parse(`${data.today}T00:00:00Z`);
    return Array.from({ length: days }, (_, i) => {
      const key = isoDay(new Date(anchor - (days - 1 - i) * 86_400_000));
      return { date: key, actions: byDay.get(key) ?? 0 };
    });
  }, [data, days]);

  const totals = data?.totals;
  const totalActions = totals
    ? METRIC_ORDER.reduce((sum, m) => sum + (totals[m] ?? 0), 0)
    : 0;
  const minutesSaved = totals
    ? METRIC_ORDER.reduce((sum, m) => sum + (totals[m] ?? 0) * MINUTES_PER_ACTION[m], 0)
    : 0;

  // Only metrics that actually happened get a row. A brand-new account would
  // otherwise show six zeroes, which is the "unfinished software" look the
  // whole card exists to avoid — it gets the first-action state instead.
  const active = totals ? METRIC_ORDER.filter((m) => (totals[m] ?? 0) > 0) : [];

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <CardTitle className="text-base font-semibold">What Peakhour did for you</CardTitle>
          <span className="text-xs text-muted-foreground">Last {days} days</span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        ) : totalActions === 0 ? (
          // ★NOT AN EMPTY CHART. A flat line at zero is a claim that nothing is
          //  working; this says what would put the first point on it.
          <div className="flex flex-1 flex-col items-start justify-center gap-2 rounded-xl border border-dashed px-4 py-6">
            <p className="text-sm font-semibold">Nothing to report yet</p>
            <p className="text-xs text-muted-foreground">
              Once a channel is connected, everything Peakhour publishes, drafts and answers on
              your behalf is counted here — with an estimate of the time it saved you.
            </p>
            <Link
              href="/dashboard/integrations"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-label"
            >
              Connect your first channel
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-bold leading-none tabular-nums tracking-tight">
                {totalActions.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">
                {totalActions === 1 ? "task done for you" : "tasks done for you"}
              </span>
              <span
                className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink dark:bg-brand/15 dark:text-brand"
                // The estimate is spelled out on hover rather than hidden. An
                // unqualified "time saved" is a number the owner cannot check.
                title={METRIC_ORDER.filter((m) => (totals?.[m] ?? 0) > 0)
                  .map((m) => `${METRIC_LABEL[m].one}: ~${MINUTES_PER_ACTION[m]} min each`)
                  .join(" · ")}
              >
                <Clock className="size-3" aria-hidden />
                ~{formatMinutes(minutesSaved)} saved (est.)
              </span>
            </div>

            <TrendChart
              data={series}
              height={132}
              series={[{ key: "actions", label: "Tasks", color: "var(--brand-strong)" }]}
              emptyLabel="Not enough history yet to chart a trend."
            />

            <ul className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
              {active.map((m) => {
                const n = totals?.[m] ?? 0;
                return (
                  <li key={m} className="flex items-baseline gap-1.5 text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">{n}</span>
                    {n === 1 ? METRIC_LABEL[m].one : METRIC_LABEL[m].many}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
