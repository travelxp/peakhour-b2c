"use client";

import Link from "next/link";
import {
  PlugZap,
  AlertCircle,
  CheckSquare,
  ChevronRight,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelIconCompact } from "@/components/ui/channel-icon";
import { cn } from "@/lib/utils";
import type { RailItem, RailItemType } from "@/hooks/use-home-summary";

/**
 * The "Needs you" rail — the hero of the Autopilot Home and the single
 * biggest driver of a return visit. It surfaces exactly what's waiting on
 * the human, in priority order (reconnect → failed → approve), each row a
 * one-click jump to the place the action gets done.
 *
 * This is intentionally an approval/attention surface, not a compose
 * console — it reflects the autopilot positioning: the engine did the
 * work, you just unblock it.
 */

const TYPE_META: Record<
  RailItemType,
  { icon: LucideIcon; verb: string; tone: string; iconColor: string }
> = {
  reconnect: {
    icon: PlugZap,
    verb: "Reconnect",
    tone: "border-l-rose-500",
    iconColor: "text-rose-500",
  },
  failed: {
    icon: AlertCircle,
    verb: "Fix",
    tone: "border-l-rose-500",
    iconColor: "text-rose-500",
  },
  approve: {
    icon: CheckSquare,
    verb: "Review",
    tone: "border-l-amber-500",
    iconColor: "text-amber-500",
  },
};

export function NeedsYouRail({
  items,
  totalCount,
}: {
  items: RailItem[];
  totalCount: number;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3 [.border-b]:pb-3">
        <CardTitle className="text-base">Needs you</CardTitle>
        {totalCount > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
            {totalCount}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
            <CheckCircle2 className="size-7 text-emerald-500" />
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground">
              Nothing needs your attention. The autopilot will surface work here
              as it comes up.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((item) => {
              const meta = TYPE_META[item.type];
              const Icon = meta.icon;
              return (
                <li key={`${item.type}-${item.refId}`}>
                  <Link
                    href={item.ctaHref}
                    className={cn(
                      "group flex items-center gap-3 border-l-2 px-4 py-3 transition-colors hover:bg-muted/50",
                      meta.tone,
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", meta.iconColor)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/70">
                          {meta.verb}
                        </span>
                        {item.channel && (
                          <>
                            <span aria-hidden>·</span>
                            <ChannelIconCompact channel={item.channel} size={12} />
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
