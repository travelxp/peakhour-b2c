"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * GET /v1/home/work — what Peakhour actually completed for this business, per
 * metric and per day.
 *
 * The api sends COUNTS ONLY, exactly as it does for /summary's activity ribbon.
 * The wording and the minutes-per-action estimate both live in the component
 * that renders them (`work-completed-card.tsx`), so a sentence has one home and
 * revising the estimate is not an api deploy.
 */

export type WorkMetric =
  | "actions_executed"
  | "published"
  | "drafted"
  | "leads_captured"
  | "conversations_resolved"
  | "reviews_replied";

export interface HomeWork {
  windowDays: number;
  since: string;
  totals: Record<WorkMetric, number>;
  /** Sparse, oldest-first — only days something happened. */
  days: { date: string; count: number }[];
  /** The server's "today" in UTC, so a client filling gaps agrees with it. */
  today: string;
}

export function useHomeWork(days = 14) {
  return useQuery({
    queryKey: ["home", "work", days],
    queryFn: () => api.get<HomeWork>("/v1/home/work", { days: String(days) }),
    // Cron-moved data. Matches the cadence useHomeSummary settled on rather
    // than inventing a second one — the two render side by side, and a card
    // that refreshed on a different beat would show a count the ribbon beside
    // it disagreed with.
    staleTime: 30_000,
  });
}
