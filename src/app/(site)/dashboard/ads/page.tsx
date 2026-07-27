"use client";

/**
 * Ads hub — ONE surface for every ad channel, selected with a tab filter
 * rather than a route per platform (`?channel=linkedin|x`). Each channel
 * contributes a panel under `_components/` and an entry in
 * `ads-channels.ts`; the Content hub's "Manage" deep-links here with the
 * channel pre-selected.
 *
 * The hub owns the header, the selector, and the CronToolbar. Each panel
 * owns its own connection gate and empty states, because "connected" means
 * something different per channel (LinkedIn Ads stays usable while
 * needs_reauth; X Ads additionally needs an ad account).
 */

import { Suspense, useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { LinkedInAdsPanel } from "./_components/linkedin-ads-panel";
import { XAdsPanel } from "./_components/x-ads-panel";
import {
  ADS_CHANNELS,
  ADS_CHANNEL_PARAM,
  getAdsChannel,
  isAdsChannelKey,
  resolveAdsChannel,
  type AdsChannelKey,
} from "./ads-channels";

interface ApiIntegration {
  provider: string;
  connected?: boolean;
  status?: string;
}

/**
 * Panel per channel. Typed as a total Record so adding a key to
 * ADS_CHANNELS without a panel is a compile error, not a blank tab.
 */
const PANELS: Record<AdsChannelKey, () => React.JSX.Element> = {
  linkedin: LinkedInAdsPanel,
  x: XAdsPanel,
};

export default function AdsHubPage() {
  // useSearchParams needs a Suspense boundary or the route bails out of
  // static rendering at build time. The fallback carries the header so
  // hydration doesn't shift the page down.
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <HubHeader />
          <HubSkeleton />
        </div>
      }
    >
      <AdsHub />
    </Suspense>
  );
}

function AdsHub() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryClient = useQueryClient();

  const integrations = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () => api.get<{ integrations: ApiIntegration[] }>("/v1/integrations"),
    staleTime: 30_000,
  });

  // needs_reauth counts as connected for channel-picking: the connection
  // exists, and the panel shows a reconnect banner rather than a dead end.
  const integrationList = integrations.data?.integrations;
  const connectedProviderKeys = useMemo(() => {
    const set = new Set<string>();
    for (const i of integrationList ?? []) {
      if (i.connected === true || i.status === "needs_reauth") set.add(i.provider);
    }
    return set;
  }, [integrationList]);

  // Errored (not merely pending) means we can't assert connected-ness either
  // way; `isPending` is false on error in TanStack v5, so check both.
  const connectionStateKnown = !integrations.isPending && !integrations.isError;

  const paramChannel = params.get(ADS_CHANNEL_PARAM);
  const hasExplicitChannel = isAdsChannelKey(paramChannel);
  // Without a valid `?channel=` the default depends on what's connected, so
  // hold the panel until connections resolve — picking early would render
  // LinkedIn for a second and then swap to X under the user. All precedence
  // lives in resolveAdsChannel; don't re-implement rule 1 here.
  const selected: AdsChannelKey | null =
    !hasExplicitChannel && integrations.isPending
      ? null
      : resolveAdsChannel(paramChannel, connectedProviderKeys);
  const channel = selected ? getAdsChannel(selected) : null;

  const changeChannel = useCallback(
    (next: string) => {
      if (!isAdsChannelKey(next)) return;
      const search = new URLSearchParams(params.toString());
      search.set(ADS_CHANNEL_PARAM, next);
      // Params owned by the channel we're leaving (X's ad-account id) mean
      // nothing to the next one — drop them, registry-driven so a new channel
      // doesn't need an edit here.
      for (const c of ADS_CHANNELS) {
        if (c.key === next) continue;
        for (const owned of c.ownedParams ?? []) search.delete(owned);
      }
      router.replace(`${pathname}?${search.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // Pin the resolved channel into the URL once. Three things this buys:
  // the panel can't silently switch under the user when a focus-refetch
  // changes connection state, an invalid `?channel=meta` gets normalised away
  // instead of lingering, and the tab highlight stops depending on a pending
  // router transition.
  useEffect(() => {
    if (!hasExplicitChannel && selected) changeChannel(selected);
  }, [hasExplicitChannel, selected, changeChannel]);

  return (
    <div className="space-y-6">
      {channel && channel.crons.length > 0 && (
        <CronToolbar
          crons={channel.crons}
          onTriggered={() => {
            for (const key of channel.invalidateQueryKeys) {
              queryClient.invalidateQueries({ queryKey: [...key] });
            }
          }}
        />
      )}

      <HubHeader description={channel?.description} />

      {/* <Tabs> renders only once a channel is known, so it stays controlled
          for its whole life — a value that starts undefined and later becomes
          defined trips React's uncontrolled→controlled warning. */}
      {selected === null ? (
        <HubSkeleton />
      ) : (
        <Tabs value={selected} onValueChange={changeChannel}>
          <TabsList>
            {ADS_CHANNELS.map((c) => (
              <TabsTrigger key={c.key} value={c.key} className="gap-2">
                {c.label}
                {/* Only claim "not connected" when connection state is actually
                    known — on a failed load we don't know either way. */}
                {connectionStateKnown && !connectedProviderKeys.has(c.providerKey) && (
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                    Not connected
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {/* Panels live in TabsContent so the ACTIVE trigger's aria-controls
              resolves to a real panel. Radix mounts only the active one, so
              inactive triggers' aria-controls dangle — its documented
              behaviour, and better than having no panel at all. */}
          {ADS_CHANNELS.map((c) => {
            const Panel = PANELS[c.key];
            return (
              <TabsContent key={c.key} value={c.key} className="mt-6">
                <Panel />
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}

/** Shared so the Suspense fallback and the resolved page agree on layout. */
function HubHeader({ description }: { description?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Ad campaigns</h2>
      <p className="text-muted-foreground">
        {description ?? "Manage paid campaigns across your connected ad channels."}
      </p>
    </div>
  );
}

/** Tab-row + panel placeholder. */
function HubSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
