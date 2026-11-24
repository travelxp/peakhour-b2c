"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Data hook for "Needs your OK": every piece of content waiting for a person, in one list.
 *
 * Backed by GET /v1/content/needs-ok, which reads the SAME module as Home's "Waiting for you" rail, so the two agree on how many rows wait.
 * The api keeps the shape; the words for each group and row come with it, so no source is named twice.
 */

export type NeedsOkSource =
  | "scheduled_posts"
  | "ideas"
  | "news"
  | "repurposed"
  | "plans"
  | "web_pages"
  | "linkedin_drafts"
  | "studio_shortlist"
  /** TikTok posts that need the merchant to choose how they post. */
  | "tiktok_choices"
  /** TikTok posts saved and waiting for TikTok to approve Peakhour. */
  | "tiktok_waiting";

export interface NeedsOkItem {
  source: NeedsOkSource;
  id: string;
  title: string;
  /** True when something will not go out until a person acts; false for a suggestion. */
  holdsWork: boolean;
  /** Why it waits (or what is needed), in the merchant's words. */
  why: string;
  /** ISO date the row was made, or null. */
  createdAt: string | null;
  /** ISO time a waiting automatic draft stops being approvable (it is closed unapproved after this), set only on a repurposed batch that has a deadline. */
  expiresAt?: string | null;
  /** Set when automatic writing made this draft: `label` is "Peakhour wrote this", `reason` says what for ("your weekly plan", "your new blog post <title>"). */
  autoWrite?: { job: string; label: string; reason: string };
  /** The screen where it is approved today. */
  href: string;
  channel: string;
}

export interface NeedsOkGroup {
  source: NeedsOkSource;
  label: string;
  /** True when the group holds work; false when it only suggests. */
  holdsWork: boolean;
  /** Every row that waits in this group, not only the ones listed. */
  count: number;
  items: NeedsOkItem[];
  /** True when the api could not read this group just now. */
  failed: boolean;
}

export interface NeedsOk {
  total: number;
  /** The rows that hold work (suggestions left out). */
  workTotal: number;
  sources: NeedsOkGroup[];
}

export const NEEDS_OK_PAGE_SIZE = 20;

export const needsOkKeys = {
  all: ["needs-ok"] as const,
};

/** The first page of every group, with a count per group. Polls gently: crons and teammates move these rows. */
export function useNeedsOk() {
  return useQuery({
    queryKey: needsOkKeys.all,
    queryFn: () => api.get<NeedsOk>("/v1/content/needs-ok", { limit: String(NEEDS_OK_PAGE_SIZE) }),
    refetchInterval: (q) => (q.state.error ? false : 60_000),
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}

/** The next page of one group (`skip` rows already shown). */
export function fetchNeedsOkPage(source: NeedsOkSource, skip: number) {
  return api.get<NeedsOk>("/v1/content/needs-ok", {
    source,
    skip: String(skip),
    limit: String(NEEDS_OK_PAGE_SIZE),
  });
}
