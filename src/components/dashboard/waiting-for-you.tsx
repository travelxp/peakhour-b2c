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
 * Backed by the `needsYou` rail on GET /v1/home/summary, which is now
 * cross-pillar: a failed post and an unread pricing recommendation sit in the
 * same queue because they ask the same thing of the same person.
 *
 * Each row carries its pillar, so the origin reads at a glance without the
 * label having to say it. Colour comes from --chart-*, the same tokens the
 * pillar series use in charts, so a row and a bar for one pillar agree.
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
        ) : rows.length === 0 ? (
          // The honest empty state: nothing is stuck, and the AI has not
          // stopped. "No items" alone reads like something failed to load.
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Queue clear. Your pillars keep working — new decisions land here.
          </p>
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
