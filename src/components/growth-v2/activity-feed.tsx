import Link from "next/link";
import { CheckCircle2, Eye, Lightbulb, PauseCircle, ShieldAlert, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";
import type { HomeResponse } from "@/lib/api/growth-v2";
import { formatDay } from "@/lib/growth-v2-figure";
import { cn } from "@/lib/utils";

/**
 * What the engine did, with the reason (from list-panel-list-activity-feed).
 *
 * The api sends one `text` per event. The first sentence is the headline and the
 * rest is the reason, so the list scans as a column of verbs.
 */
type FeedEvent = HomeResponse["feed"][number];

const KINDS: Record<string, { icon: LucideIcon; tone: string }> = {
  check: { icon: Eye, tone: "text-muted-foreground" },
  budget: { icon: TrendingUp, tone: "text-chart-4" },
  blocked: { icon: ShieldAlert, tone: "text-destructive-on-tint" },
  pause: { icon: PauseCircle, tone: "text-warning-on-tint" },
  creative: { icon: Sparkles, tone: "text-chart-2" },
  tripwire: { icon: CheckCircle2, tone: "text-success-on-tint" },
};
const FALLBACK = { icon: Lightbulb, tone: "text-muted-foreground" };

/** Split an event's text into its first sentence and the remainder. */
export function splitFeedText(text: string): { title: string; reason: string } {
  const i = text.search(/[.!?](\s|$)/);
  if (i === -1) return { title: text, reason: "" };
  return { title: text.slice(0, i + 1), reason: text.slice(i + 1).trim() };
}

export function ActivityFeed({ events, decisionsHref, className }: { events: FeedEvent[]; decisionsHref?: string; className?: string }) {
  if (events.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nothing yet. The engine will list every check, change and refusal here.</p>;
  }
  return (
    <ul className={cn("divide-y", className)}>
      {events.map((e, i) => {
        const k = KINDS[e.kind] ?? FALLBACK;
        const Icon = k.icon;
        const { title, reason } = splitFeedText(e.text);
        return (
          <li key={`${e.at}-${i}`} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3 py-2.5">
            <span className={cn("grid size-7 place-items-center rounded-lg bg-muted", k.tone)}>
              <Icon aria-hidden className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm">{title}</p>
              {reason ? <p className="text-xs text-muted-foreground">{reason}</p> : null}
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
