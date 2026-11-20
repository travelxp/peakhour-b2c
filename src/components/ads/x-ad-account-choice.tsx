"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { AdAccountChoice } from "@/components/ads/ad-account-choice";
import { xAdsApi } from "@/lib/api/x-ads";

/**
 * The X Ads card's "Ad accounts Peakhour may use" (MR-G3): the neutral checklist, plus one read of X's own list when the
 * connection has none stored (the connect-time read failed, so there is nothing to tick yet). That read is
 * `GET /v1/x/ads/ad-accounts`, which stores the list it hears, so the card then reloads and shows it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function XAdAccountChoice({ extra, onChanged }: { extra: Record<string, any>; onChanged?: () => void | Promise<unknown> }) {
  const hasList = Array.isArray(extra.adAccounts) && extra.adAccounts.length > 0;
  const live = useQuery({
    queryKey: ["x-ads-accounts"],
    queryFn: () => xAdsApi.listAccounts(),
    enabled: !hasList,
    retry: false,
    staleTime: 60_000,
  });
  const found = !hasList && live.isSuccess && live.data.length > 0;
  useEffect(() => {
    if (found) void onChanged?.();
    // Once per arrival of the list; `onChanged` is the card's own reload and changes identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found]);
  return <AdAccountChoice provider="x_ads" extra={extra} onChanged={onChanged} />;
}
