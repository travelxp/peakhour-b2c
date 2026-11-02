"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeSubHref, type GrowthNavSub } from "@/lib/growth-v2-nav";
import { cn } from "@/lib/utils";

/**
 * The tab strip under Rules and Learning (plan 1, U0): the screen itself, then
 * the pages that predate Growth v2 and now live beside it. It scrolls sideways on
 * a narrow screen rather than wrapping.
 */
export function GrowthSubTabs({ tabs, label }: { tabs: GrowthNavSub[]; label: string }) {
  const pathname = usePathname();
  const active = activeSubHref(pathname ?? "", tabs);
  return (
    <nav aria-label={`${label} sections`} className="-mx-1 overflow-x-auto px-1">
      <ul className="flex w-max min-w-full gap-1 border-b">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={active === t.href ? "page" : undefined}
              className={cn(
                "-mb-px block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active === t.href ? "border-chart-1 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
