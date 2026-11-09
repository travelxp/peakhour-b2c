"use client";

import Link from "next/link";
import {
  ShoppingBag,
  PenLine,
  TrendingUp,
  MessagesSquare,
  MapPin,
  AlertCircle,
  PlugZap,
  Check,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Pillar, RailItem, RailItemType } from "@/hooks/use-home-summary";
import { cn } from "@/lib/utils";

/**
 * "Waiting for you" — every decision the platform is holding, in one list.
 *
 * Backed by the `needsYou` rail on GET /v1/home/summary, which is
 * cross-pillar: a failed post and an unread pricing recommendation sit in the
 * same queue because they ask the same thing of the same person.
 *
 * Each row carries its pillar, so the origin reads at a glance without the
 * label having to say it. Colour comes from --chart-*, the same tokens the
 * pillar series use in charts, so a row and a bar for one pillar agree.
 *
 * ── ★★WHAT BELONGS IN IT, AND WHAT DOES NOT
 *
 * The rule is one question: does this need a HUMAN DECISION that only this
 * person can make? Approvals, blocked or failed work, unanswered conversations
 * and broken connections all qualify — each is stopped until someone says
 * something. The api's three row types (`approve`, `failed`, `reconnect`)
 * are exactly that set.
 *
 * 🚫Integration status and AI-engine progress are NOT that, which is why they
 * now live in their own section further down the Overview rather than in or
 * beside this queue. Neither is stuck: a channel you have not connected is a
 * standing option, and a setup step you have not finished is a state, not a
 * decision. Mixing them in made the count meaningless — a merchant with a
 * genuinely clear queue still read "5 waiting", learned the number did not mean
 * anything urgent, and stopped reading it. A queue you can safely ignore is
 * worse than no queue.
 *
 * ── ★★AND IT COLLAPSES WHEN IT IS EMPTY
 *
 * An empty queue is the GOOD outcome, so it gets one quiet line rather than a
 * full card with a heading, a count and a dashed placeholder box. It still says
 * something — silence here would read as a component that failed to load — but
 * it takes a row, not a panel, and the space goes to the business.
 */

const PILLAR_ICON: Record<Pillar, React.ElementType> = {
  commerce: ShoppingBag,
  content: PenLine,
  growth: TrendingUp,
  support: MessagesSquare,
  presence: MapPin,
};

/** Pillar → chart series token, in the platform's canonical order. */
const PILLAR_TINT: Record<Pillar, string> = {
  commerce: "bg-chart-1/12 text-chart-1 dark:bg-chart-1/18",
  content: "bg-chart-2/12 text-chart-2 dark:bg-chart-2/18",
  growth: "bg-chart-3/12 text-chart-3 dark:bg-chart-3/18",
  support: "bg-chart-4/12 text-chart-4 dark:bg-chart-4/18",
  presence: "bg-chart-5/12 text-chart-5 dark:bg-chart-5/18",
};

/**
 * What the row is asking for. `reconnect` and `failed` are things that broke;
 * `approve` is a judgement call. The verb differs because the ask differs.
 */
const TYPE_META: Record<RailItemType, { verb: string; icon: React.ElementType }> = {
  reconnect: { verb: "Reconnect", icon: PlugZap },
  failed: { verb: "Fix", icon: AlertCircle },
  approve: { verb: "Review", icon: Check },
};

export function WaitingForYou({
  items,
  total,
  isLoading,
  className,
}: {
  items: RailItem[] | undefined;
  /** Uncapped count — the rail itself is capped at 8 by the api. */
  total: number | undefined;
  isLoading?: boolean;
  className?: string;
}) {
  const rows = items ?? [];
  const count = total ?? rows.length;

  // ★COLLAPSED, NOT HIDDEN. Removing it entirely would make the section appear
  //  and disappear between page loads, and an owner who saw an item yesterday
  //  would have no way to tell "nothing is waiting" from "that panel is gone".
  if (!isLoading && rows.length === 0) {
    return (
      <p
        className={cn(
          "flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground",
          className,
        )}
      >
        <Check className="size-4 shrink-0 text-success" aria-hidden />
        <span>
          <span className="font-medium text-foreground">Nothing waiting on you.</span> Your pillars
          keep working — approvals, failures and unanswered messages land here.
        </span>
      </p>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">Waiting for you</CardTitle>
          {!isLoading && count > 0 && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {count} {count === 1 ? "item" : "items"}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading ? (
          <>
            <span className="h-14 animate-pulse rounded-xl bg-muted" />
            <span className="h-14 animate-pulse rounded-xl bg-muted" />
          </>
        ) : (
          rows.map((item) => {
            const PillarIcon = PILLAR_ICON[item.pillar] ?? PenLine;
            const meta = TYPE_META[item.type];
            const TypeIcon = meta.icon;
            return (
              <Link
                key={`${item.type}-${item.refId}`}
                href={item.ctaHref}
                className="group u-lift flex items-center gap-3 rounded-xl border bg-card p-3"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 ease-brand group-hover:-rotate-6 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:rotate-0 motion-reduce:group-hover:scale-100",
                    PILLAR_TINT[item.pillar] ?? PILLAR_TINT.content,
                  )}
                >
                  <PillarIcon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.title}</span>
                  <span className="flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
                    <TypeIcon className="size-3 shrink-0" aria-hidden />
                    {item.pillar}
                    {item.channel ? ` · ${item.channel}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-brand-label">
                  {meta.verb}
                  <ArrowRight className="size-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-1 motion-reduce:transition-none" />
                </span>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
