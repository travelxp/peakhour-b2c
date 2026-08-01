"use client";

/**
 * Ads hub — ONE surface for every ad channel, selected with a tab filter
 * rather than a route per platform (`?channel=linkedin|x`). Each channel
 * contributes a panel under `_components/` and an entry in
 * `ads-channels.ts`; the Content hub's "Manage" deep-links here with the
 * channel pre-selected.
 *
 * The hub owns the header, the selector, and the CronToolbar. Each panel owns
 * its own connection gate and empty states, because "connected" means something
 * different per channel: LinkedIn Ads lists local campaign rows and stays
 * usable while needs_reauth, whereas X Ads reads everything live from X and
 * additionally needs an ad account, so a stale connection lists nothing.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { OAuthConnectResult } from "@/components/integrations/oauth-connect-result";
import { AudienceProfilePanel } from "./_components/audience-profile-panel";
import { LinkedInAdsPanel } from "./_components/linkedin-ads-panel";
import { XAdsPanel } from "./_components/x-ads-panel";
import {
  ADS_CHANNELS,
  ADS_CHANNEL_PARAM,
  getAdsChannel,
  isAdsChannelKey,
  nextAdsHubSearch,
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
 * ADS_CHANNELS without a panel is a compile error, not a blank tab. Each
 * panel receives its own key rather than hardcoding it, so renaming a
 * channel can't silently break a panel's "am I the visible one?" check.
 */
const PANELS: Record<
  AdsChannelKey,
  (props: { channelKey: AdsChannelKey }) => React.JSX.Element
> = {
  linkedin: LinkedInAdsPanel,
  x: XAdsPanel,
};

/** Every channel's crons — used while the resolved channel isn't known yet. */
const ALL_CRONS: readonly string[] = Array.from(
  new Set(ADS_CHANNELS.flatMap((c) => [...c.crons])),
);

/** Union of every channel's invalidation keys, for the same unresolved state. */
const ALL_INVALIDATE_KEYS: readonly (readonly string[])[] = ADS_CHANNELS.flatMap((c) =>
  c.invalidateQueryKeys.map((k) => [...k]),
);

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

  // The channel the user just clicked, held until the URL catches up.
  // router.push/replace commit in a transition, during which useSearchParams
  // still returns the OLD params — so without this the outgoing panel stays
  // mounted for a beat and can write its own params back over the switch.
  const [pendingChannel, setPendingChannel] = useState<AdsChannelKey | null>(null);
  // Drop it the moment the URL agrees. Adjusted DURING RENDER, which is React's
  // documented pattern for state derived from changing inputs — a setState in an
  // effect body would cascade an extra render (and the compiler lint rejects it).
  // Equality is the only clearing rule needed: by the time a user can hit Back,
  // the navigation has long since committed and cleared this.
  if (pendingChannel !== null && paramChannel === pendingChannel) {
    setPendingChannel(null);
  }

  // Without a valid `?channel=` the default depends on what's connected, so
  // hold the panel until connections resolve — picking early would render
  // LinkedIn for a second and then swap to X under the user. All precedence
  // lives in resolveAdsChannel; don't re-implement rule 1 here.
  const selected: AdsChannelKey | null =
    pendingChannel ??
    (!hasExplicitChannel && integrations.isPending
      ? null
      : resolveAdsChannel(paramChannel, connectedProviderKeys));
  const channel = selected ? getAdsChannel(selected) : null;

  const navigate = useCallback(
    (next: AdsChannelKey, mode: "push" | "replace") => {
      const url = `${pathname}?${nextAdsHubSearch(params, next)}`;
      // A user gesture is history-worthy — Back returns to the previous tab.
      // Normalising the URL ourselves is not.
      if (mode === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [params, pathname, router],
  );

  // User gesture: record the optimistic pick, then navigate.
  const changeChannel = useCallback(
    (next: string) => {
      if (!isAdsChannelKey(next)) return;
      setPendingChannel(next);
      navigate(next, "push");
    },
    [navigate, setPendingChannel],
  );

  // Pin the resolved channel into the URL once connections are KNOWN. Buys
  // three things: the panel can't silently switch under the user when a
  // focus-refetch changes connection state, an invalid `?channel=meta` gets
  // normalised away instead of lingering, and the tab highlight stops depending
  // on a pending router transition.
  //
  // Gated on connectionStateKnown, not merely !isPending: isPending is false on
  // ERROR too, and pinning the fallback channel then would make one transient
  // 500 permanent — an X-only org would sit on the LinkedIn tab even after a
  // successful retry, because the URL had become explicit.
  // Navigates only — no setState, so this stays a pure "sync React state OUT to
  // an external system" effect. There's no optimistic pick to record either: the
  // pin makes the URL explicit for the channel already on screen.
  useEffect(() => {
    if (!hasExplicitChannel && selected && connectionStateKnown) {
      navigate(selected, "replace");
    }
  }, [hasExplicitChannel, selected, connectionStateKnown, navigate]);

  return (
    <div className="space-y-6">
      {/* Confirms a reconnect that started from this hub (its CTAs pass
          ?returnTo=/dashboard/ads?channel=linkedin) and strips the callback's
          params without disturbing ?channel=. */}
      <OAuthConnectResult />
      {/* CronToolbar is mandatory on a cron-backed page (see cron-toolbar.tsx),
          so it renders before a channel resolves too — with every channel's
          crons rather than none. */}
      <CronToolbar
        crons={channel ? channel.crons : ALL_CRONS}
        onTriggered={() => {
          const keys: readonly (readonly string[])[] = channel
            ? channel.invalidateQueryKeys
            : ALL_INVALIDATE_KEYS;
          for (const key of keys) {
            queryClient.invalidateQueries({ queryKey: [...key] });
          }
        }}
      />

      <HubHeader description={channel?.description} />

      {/* ★ABOVE THE CHANNEL TABS, ON PURPOSE. What we understand about a
          business is channel-NEUTRAL — the same profile decides who a LinkedIn
          campaign and an X campaign target — so putting it inside a channel
          panel would make it look like a LinkedIn setting and would need
          copying for every channel added afterwards. It lives here for the same
          reason the hub owns the header: one surface, channels select into it.
          Not a new route either (ads-hub-single-surface). */}
      <AudienceProfilePanel />

      {/* <Tabs> renders only once a channel is known, so it stays controlled
          for its whole life — a value that starts undefined and later becomes
          defined trips React's uncontrolled→controlled warning. */}
      {selected === null ? (
        <HubSkeleton />
      ) : (
        <Tabs
          value={selected}
          onValueChange={changeChannel}
          // Manual activation: with the default "automatic", arrowing across
          // the tab list selects on every focus move, and each selection is a
          // router.replace — arrow-key users would fire a navigation per
          // keypress. Now focus moves freely and Enter/Space commits.
          activationMode="manual"
        >
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
                <Panel channelKey={c.key} />
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
