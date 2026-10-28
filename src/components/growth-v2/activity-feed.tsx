import Link from "next/link";
import { Eye, PauseCircle, ShieldAlert, SlidersHorizontal, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";
import type { HomeResponse } from "@/lib/api/growth-v2";
import { withSummitTm } from "@/lib/growth-v2-copy";
import { formatDay } from "@/lib/growth-v2-figure";
import { cn } from "@/lib/utils";

/**
 * What the engine did, with the reason (from list-panel-list-activity-feed).
 *
 * The api sends a `title` (what happened, as a verb) and a `detail` (why), so the
 * list scans as a column of verbs.
 */
type FeedEvent = HomeResponse["feed"][number];

const KINDS: Record<FeedEvent["kind"], { icon: LucideIcon; tone: string }> = {
  check: { icon: Eye, tone: "text-muted-foreground" },
  budget: { icon: TrendingUp, tone: "text-chart-4" },
  blocked: { icon: ShieldAlert, tone: "text-destructive-on-tint" },
  pause: { icon: PauseCircle, tone: "text-warning-on-tint" },
  creative: { icon: Sparkles, tone: "text-chart-2" },
  change: { icon: SlidersHorizontal, tone: "text-chart-1" },
};

export function ActivityFeed({ events, decisionsHref, className }: { events: FeedEvent[]; decisionsHref?: string; className?: string }) {
  if (events.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nothing yet. The engine will list every check, change and refusal here.</p>;
  }
  // The trademark sign goes on the first mention of Peakhour Summit on the screen (a change waiting for its review).
  const firstSummit = events.findIndex((x) => x.title.includes("Peakhour Summit"));
  return (
    <ul className={cn("divide-y", className)}>
      {events.map((e, i) => {
        const k = KINDS[e.kind] ?? KINDS.check;
        const Icon = k.icon;
        return (
          <li key={`${e.at}-${i}`} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3 py-2.5">
            <span className={cn("grid size-7 place-items-center rounded-lg bg-muted", k.tone)}>
              <Icon aria-hidden className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm">{i === firstSummit ? withSummitTm(e.title) : e.title}</p>
              {e.detail ? <p className="text-xs text-muted-foreground">{e.detail}</p> : null}
              {e.decisionId && decisionsHref ? (
                <Link href={decisionsHref} className="text-xs underline underline-offset-2">
                  See the decision
                </Link>
              ) : null}
            </div>
            <time dateTime={e.at} className="whitespace-nowrap text-xs text-muted-foreground">
              {formatDay(e.at)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
