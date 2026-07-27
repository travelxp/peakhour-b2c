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

import { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  // static rendering at build time.
  return (
    <Suspense fallback={<HubSkeleton />}>
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

  const paramChannel = params.get(ADS_CHANNEL_PARAM);
  const explicit = isAdsChannelKey(paramChannel) ? paramChannel : null;
  // Without an explicit channel the default depends on what's connected, so
  // hold the panel until connections resolve — picking early would render
  // LinkedIn for a second and then swap to X under the user.
  const selected: AdsChannelKey | null =
    explicit ??
    (integrations.isPending ? null : resolveAdsChannel(null, connectedProviderKeys));
  const channel = selected ? getAdsChannel(selected) : null;

  function changeChannel(next: string) {
    if (!isAdsChannelKey(next)) return;
    const search = new URLSearchParams(params.toString());
    search.set(ADS_CHANNEL_PARAM, next);
    // Channel-specific params from the previous panel (e.g. X's ad-account
    // id) don't apply to the next channel — drop them.
    search.delete("account");
    router.replace(`${pathname}?${search.toString()}`, { scroll: false });
  }

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

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ad campaigns</h2>
        <p className="text-muted-foreground">
          {channel?.description ?? "Manage paid campaigns across your connected ad channels."}
        </p>
      </div>

      <Tabs value={selected ?? undefined} onValueChange={changeChannel}>
        <TabsList>
          {ADS_CHANNELS.map((c) => (
            <TabsTrigger key={c.key} value={c.key} className="gap-2">
              {c.label}
              {!integrations.isPending && !connectedProviderKeys.has(c.providerKey) && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                  Not connected
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {selected === null ? <HubSkeleton /> : <SelectedPanel channelKey={selected} />}
    </div>
  );
}

function SelectedPanel({ channelKey }: { channelKey: AdsChannelKey }) {
  const Panel = PANELS[channelKey];
  // Distinct component types already force a remount on switch; the key just
  // makes that explicit — panels hold their own query and dialog state.
  return <Panel key={channelKey} />;
}

function HubSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
