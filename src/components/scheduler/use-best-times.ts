"use client";

/**
 * useBestTimes: the business's best time to post on each of the selected channels (GET /v1/content/best-times), keyed by channel. A failed read is no data, never an error on the
 * composer: the line simply does not show.
 */
import { useQuery } from "@tanstack/react-query";
import { bestTimes, type BestTimeView } from "@/lib/scheduler/best-times";

export function useBestTimes(channels: readonly string[]): Record<string, BestTimeView> {
  const key = [...new Set(channels)].sort();
  const { data } = useQuery({
    queryKey: ["content:best-times", key],
    queryFn: () => bestTimes.get(key),
    enabled: key.length > 0,
    // the api rewrites it once a week
    staleTime: 10 * 60_000,
    retry: 1,
  });
  return Object.fromEntries((data?.channels ?? []).map((v) => [v.channel, v]));
}
