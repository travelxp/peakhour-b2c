"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { contentHubIntegrationsQuery } from "@/lib/nav-queries";
import { scheduler } from "@/lib/scheduler/client";
import type { ScheduledItemDto } from "@/lib/scheduler/types";
import { TIKTOK_CHANNEL, readPostRequests, tiktokAvailable, tiktokStatusView } from "@/lib/tiktok-content-view";

/** Whether the Content engine shows TikTok to this org: the api's `tiktok` row says `available` (a preview org). Everyone else keeps the coming-soon card. */
export function useTikTokAvailable(): { available: boolean; loading: boolean } {
  const q = useQuery(contentHubIntegrationsQuery);
  return { available: tiktokAvailable(q.data?.integrations), loading: q.isLoading };
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

/** The ids whose Post button was pressed in this tab, read after mount (sessionStorage does not exist on the server). */
export function useTikTokRequests(): [ReadonlySet<string>, (id: string) => void] {
  const [requested, setRequested] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setRequested(readPostRequests());
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const add = useCallback((id: string) => setRequested((prev) => new Set(prev).add(id)), []);
  return [requested, add];
}

/** Approved TikTok items that still wait for the merchant to press Post, for "Needs your OK". Empty unless TikTok is available for this org. */
export function useTikTokWaiting(): ScheduledItemDto[] {
  const { available } = useTikTokAvailable();
  const items = useTikTokItems(available);
  const [requested] = useTikTokRequests();
  if (!available) return [];
  return (items.data?.items ?? []).filter((i) => tiktokStatusView(i, requested.has(i._id)).status === "approved");
}
