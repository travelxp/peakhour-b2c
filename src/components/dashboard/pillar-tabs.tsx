"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { activeTab, nextTabIndex, type PillarTab } from "@/lib/pillar-tabs";

/**
 * PillarTabs: the in-page sub-navigation at the top of a multi-page pillar
 * (Content, Commerce, Growth, Insights, Settings). It scrolls sideways rather
 * than wrapping, underlines the current tab, marks it `aria-current="page"`,
 * scrolls it into view on load, and moves focus with the arrow keys, Home and
 * End. Every tab is a real link, so Tab, Enter and middle-click all work.
 *
 * A tab's one-line description (from nav-copy.ts) is its `title` tooltip only.
 * It is NOT printed under the strip: the page's own PageHeader prints its
 * description right below its h1, and two near-identical lines stacked there
 * read as a bug.
 */
export function PillarTabs({
  tabs,
  pathname,
  label,
  className,
}: {
  tabs: PillarTab[];
  pathname: string;
  /** Names the landmark, e.g. "Content". */
  label: string;
  className?: string;
}) {
  const active = activeTab(pathname, tabs);
  const listRef = useRef<HTMLUListElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Keep the lit tab visible on a narrow screen. Scrolls only the strip, never
  // the page, so it cannot move the content scroller under the reader.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const el = scroller?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!scroller || !el) return;
    const target = el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2;
    scroller.scrollTo({ left: Math.max(0, target) });
  }, [active?.href]);

  function onKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    const links = Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (current < 0) return;
    const next = nextTabIndex(current, links.length, e.key);
    if (next === undefined) return;
    e.preventDefault();
    links[next]?.focus();
  }

  return (
    <div className={cn("mx-auto mb-4 w-full max-w-360 sm:mb-6", className)} data-slot="pillar-tabs">
      <nav aria-label={`${label} sections`}>
        <div
          ref={scrollerRef}
          className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ul ref={listRef} onKeyDown={onKeyDown} className="flex w-max min-w-full gap-1 border-b">
            {tabs.map((t) => {
              const isActive = active?.href === t.href;
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    title={t.description}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "-mb-px block whitespace-nowrap rounded-t-md border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      isActive
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </div>
  );
}
