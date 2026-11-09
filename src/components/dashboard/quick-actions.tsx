"use client";

import Link from "next/link";
import {
  PenSquare,
  Sparkles,
  Megaphone,
  BarChart3,
  Plug,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Quick actions — the five things an owner comes to the dashboard to START,
 * as one row at the bottom of the Overview.
 *
 * ★AT THE BOTTOM, DELIBERATELY. Everything above this line is the product
 * REPORTING: what happened overnight, what is waiting, how the business stands.
 * This is the only block that is purely outbound, and putting a row of buttons
 * near the top would have the page open by asking the owner to do work before
 * it has told them anything.
 *
 * ★AND THEY ARE LINKS, NOT BUTTONS. Every one lands on a real screen with the
 * relevant surface already open — "Create a post" opens the composer via
 * `?compose=1` rather than dropping the user on the calendar to hunt for it.
 * A quick action that gets you NEAR the thing is not quick.
 *
 * ★NOTHING IS GATED HERE. A locked tile in a row called "quick actions" is a
 * contradiction; pillars the org is not entitled to are already surfaced as
 * locked nav items with their own upsell. These five are available to every
 * plan.
 */

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const ACTIONS: QuickAction[] = [
  {
    label: "Create a post",
    description: "Write and schedule",
    // Opens the calendar's composer directly — see the ?compose=1 handler in
    // the calendar page.
    href: "/dashboard/calendar?compose=1",
    icon: PenSquare,
  },
  {
    label: "Write with AI",
    description: "Ask Peakhour to draft it",
    href: "/dashboard/ask",
    icon: Sparkles,
  },
  {
    label: "Create campaign",
    description: "Put budget behind it",
    href: "/dashboard/ads",
    icon: Megaphone,
  },
  {
    label: "View reports",
    description: "Traffic and search",
    href: "/dashboard/insights/analytics",
    icon: BarChart3,
  },
  {
    label: "Connect channel",
    description: "Add a place to publish",
    href: "/dashboard/integrations",
    icon: Plug,
  },
];

export function QuickActions({ className }: { className?: string }) {
  return (
    <section aria-labelledby="quick-actions-heading" className={cn("space-y-3", className)}>
      <h2 id="quick-actions-heading" className="text-base font-semibold">
        Quick actions
      </h2>
      {/* Five items, so no column count divides evenly at every width. The grid
          steps 2 → 3 → 5 rather than 2 → 4 → 5: at four columns the fifth tile
          sits alone on a second row at double width, which reads as a mistake. */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group u-lift flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-brand/12 group-hover:text-brand-label">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{action.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {action.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
