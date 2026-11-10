import { activeSubHref } from "@/lib/growth-v2-nav";

export interface PillarTab {
  href: string;
  label: string;
  description?: string;
  matches?: string[];
}

/**
 * Which tab is lit for a pathname: exactly one (the longest matching prefix of
 * its href or `matches`) or none. Same rule as the sidebar, so the two never
 * disagree: on /dashboard/settings/team it is Team, not General.
 */
export function activeTab<T extends PillarTab>(pathname: string, tabs: T[]): T | undefined {
  const href = activeSubHref(pathname, tabs);
  return tabs.find((t) => t.href === href);
}

/** Next focus target for arrow-key movement along the tab strip (wraps). */
export function nextTabIndex(current: number, count: number, key: string): number | undefined {
  if (count === 0) return undefined;
  if (key === "ArrowRight") return (current + 1) % count;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return undefined;
}
