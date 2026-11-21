"use client";

import { usePathname } from "next/navigation";
import { PillarTabs } from "@/components/dashboard/pillar-tabs";
import { PLAN_COPY } from "@/lib/nav-copy";
import { planTabs } from "@/lib/plan-tabs";

/**
 * The strip the four planning pages share (Content plan, Industry news,
 * Holidays & events, Content sources). The sidebar's Content tabs show them as
 * one item, "Plan"; this is how a merchant moves between them. It is the same
 * PillarTabs the layout draws, fed the Plan group's own list.
 */
export function PlanTabs() {
  const pathname = usePathname() ?? "";
  return <PillarTabs tabs={planTabs()} pathname={pathname} label={PLAN_COPY.label} className="mb-0 sm:mb-0" />;
}
