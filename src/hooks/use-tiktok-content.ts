"use client";

import { useQuery } from "@tanstack/react-query";
import { contentHubIntegrationsQuery } from "@/lib/nav-queries";
import { tiktokContentApi } from "@/lib/api/tiktok-content";
import { scheduler } from "@/lib/scheduler/client";
import { TIKTOK_CHANNEL, tiktokAvailable } from "@/lib/tiktok-content-view";

/** Whether the Content engine shows TikTok to this org: the api's `tiktok` row says `available` (a preview org). Everyone else keeps the coming-soon card. */
export function useTikTokAvailable(): { available: boolean; loading: boolean; error: boolean; refetch: () => void } {
  const q = useQuery(contentHubIntegrationsQuery);
  return { available: tiktokAvailable(q.data?.integrations), loading: q.isLoading, error: q.isError && !q.data, refetch: () => void q.refetch() };
}

/** The connected TikTok account and what it may post. ONE hook for the page and the post sheet, so both read the same cache entry. */
export function useTikTokCreatorInfo() {
  return useQuery({
    queryKey: ["tiktok", "creator-info"],
    queryFn: () => tiktokContentApi.creatorInfo(),
    staleTime: 60_000,
    retry: false,
  });
}

/** The key the TikTok items live under. The compose and post sheets invalidate it. */
export const TIKTOK_ITEMS_KEY = ["scheduler:items", "tiktok"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Every TikTok item the scheduler holds for this business, from the last 90 days to a year ahead. */
export function useTikTokItems(enabled: boolean) {
  return useQuery({
    queryKey: TIKTOK_ITEMS_KEY,
    enabled,
    queryFn: () => {
      const now = Date.now();
      return scheduler.listItems({
        channel: TIKTOK_CHANNEL,
        from: new Date(now - 90 * DAY_MS),
        to: new Date(now + 365 * DAY_MS),
        limit: 100,
      });
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
