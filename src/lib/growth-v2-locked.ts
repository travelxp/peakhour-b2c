import type { DraftLockedGoal, DraftNeed } from "@/lib/api/growth-v2";

/**
 * Locked goals (FR): the goals a business could plausibly have but cannot be measured on yet. The api words each need and says where it
 * leads; this only turns a target into this app's address. A locked goal is never a choice: nothing here builds an `offerKey`.
 */

/** Where a need's link goes in this app. Google's own help page carries its address. */
export function needHref(need: Pick<DraftNeed, "target" | "url">): string {
  if (need.target === "connected_accounts") return "/dashboard/integrations";
  if (need.target === "your_business") return "/dashboard/growth/rules/business";
  return need.url ?? "https://support.google.com/analytics/answer/9267568";
}

/** An address that leaves the app opens in a new tab; an in-app one does not. */
export const needIsExternal = (need: Pick<DraftNeed, "target">): boolean => need.target === "ga4_key_events_help";

/** The distinct needs of a list of locked goals, first need of each goal first, so the zero-offer message names each thing once. */
export function distinctNeeds(locked: readonly DraftLockedGoal[]): DraftNeed[] {
  const seen = new Set<string>();
  const out: DraftNeed[] = [];
  for (const l of locked) {
    for (const n of l.needs) {
      if (seen.has(n.need)) continue;
      seen.add(n.need);
      out.push(n);
    }
  }
  return out;
}
