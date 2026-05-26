"use client";

/**
 * Attention bell — top-bar surface for user-actionable alerts.
 *
 * Plan reference: webhook-health visibility workstream PR 4b.
 * Backed by GET /v1/attention (peakhour-api PR #345).
 *
 * UX choices:
 *   - Bell icon with count badge — standard SaaS pattern, no
 *     onboarding needed.
 *   - Hidden entirely when count is 0 (no visual noise on healthy
 *     accounts; users notice it appearing).
 *   - Popover (not Tooltip) so the action buttons are tappable on
 *     mobile and reachable by keyboard.
 *   - Each alert links to its destination — clicking dismisses the
 *     popover; the alert disappears on next refetch IF the underlying
 *     state recovered. No manual dismiss.
 *
 * Distinct from /dashboard/tasks: that pane shows SYSTEM work
 * progressing on the user's library. This bell surfaces USER work
 * that requires a click to resolve.
 */

import Link from "next/link";
import { Bell, ArrowRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAttention } from "@/hooks/use-attention";
import { useLocale } from "@/hooks/use-locale";

export function AttentionBell() {
  const { data, isLoading } = useAttention();
  const { formatRelativeTime } = useLocale();
  const alerts = data?.alerts ?? [];
  const count = data?.totalCount ?? 0;

  // Bell is hidden when nothing needs attention — no point pulsing an
  // empty surface at every user every session. Returns null silently
  // during the first load too so the layout doesn't flicker.
  if (isLoading || count === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${count} attention item${count === 1 ? "" : "s"}`}
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="h-4 w-4" />
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
          >
            {count > 9 ? "9+" : count}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-85 p-0"
      >
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">Needs your attention</p>
          <p className="text-[11px] text-muted-foreground">
            {count} item{count === 1 ? "" : "s"} need a quick fix. They&apos;ll clear automatically once resolved.
          </p>
        </div>
        <ul className="max-h-105 divide-y overflow-y-auto">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link
                href={alert.actionUrl}
                className="flex items-start gap-2 px-3 py-2.5 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    alert.severity === "red"
                      ? "bg-destructive"
                      : "bg-amber-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium truncate">{alert.title}</p>
                    {alert.count !== undefined && alert.count > 1 && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        × {alert.count}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                    {alert.description}
                  </p>
                  {alert.noticedAt && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      First noticed {formatRelativeTime(alert.noticedAt)}
                    </p>
                  )}
                </div>
                <div className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-primary shrink-0">
                  {alert.actionLabel}
                  <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
