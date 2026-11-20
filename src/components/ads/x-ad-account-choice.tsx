"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { AdAccountChoice } from "@/components/ads/ad-account-choice";
import { Button } from "@/components/ui/button";
import { xAdsApi } from "@/lib/api/x-ads";

/**
 * The X Ads card's "Ad accounts Peakhour may use" (MR-G3): the neutral checklist, plus one read of X's own list when the
 * connection has none stored (the connect-time read failed, so there is nothing to tick yet). That read is
 * `GET /v1/x/ads/ad-accounts`, which stores the list it hears.
 *
 * ★THE CHECKLIST GETS THE LIVE LIST DIRECTLY (`{ ...extra, adAccounts }`), so it never depends on the store write or on the card
 * reloading. While the read runs the card says so; if it fails the card says that, with Retry, and NEVER "No ad accounts
 * found" (that is a claim about the login, not about a failed read). The read runs at most once per page visit: no refetch on
 * focus or mount, and `onChanged` fires once.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function XAdAccountChoice({ extra, onChanged }: { extra: Record<string, any>; onChanged?: () => void | Promise<unknown> }) {
  const hasList = Array.isArray(extra.adAccounts) && extra.adAccounts.length > 0;
  const live = useQuery({
    queryKey: ["x-ads-accounts"],
    queryFn: () => xAdsApi.listAccounts(),
    enabled: !hasList,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
  const found = !hasList && live.isSuccess && live.data.accounts.length > 0;
  const told = useRef(false);
  useEffect(() => {
    if (found && !told.current) {
      told.current = true;
      void onChanged?.();
    }
  }, [found, onChanged]);

  if (hasList) return <AdAccountChoice provider="x_ads" extra={extra} onChanged={onChanged} />;
  // ★`isPending` ONLY: a refresh after a save is a refetch, and must not unmount the checklist mid-save.
  if (live.isPending) {
    return <p className="text-micro text-muted-foreground">Loading your X ad accounts…</p>;
  }
  // ★AND AN ERROR ONLY WHEN THERE IS NOTHING TO SHOW: a failed background refetch keeps the accounts it already has.
  if (live.isError && !live.data) {
    return (
      <div className="space-y-1" aria-label="Ad accounts">
        <p className="text-micro text-muted-foreground">Couldn&apos;t read your X ad accounts.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void live.refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  return <AdAccountChoice provider="x_ads" extra={{ ...extra, adAccounts: live.data?.accounts ?? [] }} onChanged={onChanged} />;
}
