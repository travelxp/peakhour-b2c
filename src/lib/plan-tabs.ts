import { PLAN_HREFS } from "@/lib/content-nav";
import { SUB_COPY } from "@/lib/nav-copy";
import type { PillarTab } from "@/lib/pillar-tabs";

/** The Plan strip's tabs, in the group's order, in nav-copy's words. */
export function planTabs(): PillarTab[] {
  return PLAN_HREFS.map((href) => ({
    href,
    label: SUB_COPY[href].label,
    description: SUB_COPY[href].description,
  }));
}
