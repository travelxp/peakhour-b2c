"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { edgeFades, fadeMask, scrollTargetFor, type EdgeFades } from "@/lib/scroll-edges";
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

  const [fades, setFades] = useState<EdgeFades>({ start: false, end: false });

  const updateFades = useCallback(() => {
    const s = scrollerRef.current;
    if (!s) return;
    const next = edgeFades(s.scrollLeft, s.scrollWidth, s.clientWidth);
    setFades((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);

  // Keep the lit tab visible, with a margin so it is not flush against an
  // edge. Scrolls only the strip, never the page, so it cannot move the content
  // scroller under the reader. Smooth unless the user prefers reduced motion.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const el = scroller?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!scroller || !el) return;
    const left = scrollTargetFor(
      el.offsetLeft,
      el.offsetWidth,
      scroller.scrollLeft,
      scroller.clientWidth,
      scroller.scrollWidth,
    );
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
    updateFades();
  }, [active?.href, updateFades]);

  // Fades follow scrolling and any resize of the strip or its tabs.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    updateFades();
    scroller.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateFades) : undefined;
    ro?.observe(scroller);
    if (listRef.current) ro?.observe(listRef.current);
    return () => {
      scroller.removeEventListener("scroll", updateFades);
      window.removeEventListener("resize", updateFades);
      ro?.disconnect();
    };
  }, [updateFades]);

  const mask = fadeMask(fades);

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
          style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
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
