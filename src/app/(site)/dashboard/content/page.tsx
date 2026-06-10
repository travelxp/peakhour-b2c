"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollableTabsList } from "@/components/scrollable-tabslist";
import { flattenMetaIntegration } from "@/lib/integrations-meta";
import type { ResolvedCatalog } from "@/lib/catalog";
import {
  CHANNELS,
  CHANNEL_CATEGORIES,
  type ChannelConfig,
} from "./channels.config";
import { mapCatalogToChannels } from "./channels-from-catalog";
import { resolveChannelCta } from "./channel-cta";

interface ApiIntegration {
  provider: string;
  connected?: boolean;
  status?: string;
  lastSyncAt?: string;
  lastError?: string;
  account?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extra?: Record<string, any>;
  };
}

type ConnectionMap = Map<string, ApiIntegration>;

const ALL_TAB = "All" as const;

// The hub is the landing page for /dashboard/content for everyone — including
// single-channel users. Earlier iterations auto-redirected single-channel
// users straight to their channel dashboard, but that made the hub unreachable:
// users could never browse the channel list to add a second channel.
// The extra click is worth a discoverable hub.

export default function ContentChannelsHubPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () => api.get<{ integrations: ApiIntegration[] }>("/v1/integrations"),
    staleTime: 30_000,
    // Default refetch behavior is fine here. We DON'T disable focus / reconnect
    // refetches: a user who connects Beehiiv in another tab and returns should
    // see fresh connection state. (Earlier code disabled these to keep the
    // auto-redirect from re-firing on tab focus, but that's gone now.)
  });

  // Bind `data?.integrations` to a local so the memo's source dep matches what
  // React Compiler infers (it widened `data?.integrations` to `data`). Stable
  // reference across refetches that return the same content → no map churn.
  // Channel list is now CMS-driven: resolved from the org-personalized platform
  // catalog. Falls back to the static channels.config.ts if the catalog can't
  // be loaded, so the hub never renders empty.
  const { data: catalog } = useQuery({
    queryKey: ["content-hub-catalog"],
    queryFn: () => api.get<ResolvedCatalog>("/v1/platform/catalog"),
    staleTime: 30_000,
  });
  const channels = useMemo<ChannelConfig[]>(
    () =>
      catalog?.integrations?.length
        ? mapCatalogToChannels(catalog.integrations)
        : [...CHANNELS],
    [catalog],
  );

  const integrations = data?.integrations;
  const connections = useMemo<ConnectionMap>(() => {
    const map: ConnectionMap = new Map();
    // Flatten Meta — one `facebook` connection becomes 4 virtual rows
    // (facebook_pages, instagram, meta_ads, whatsapp) so per-capability
    // connection state lights up independently in the hub.
    const flat = flattenMetaIntegration(
      Array.isArray(integrations) ? integrations : [],
    );
    for (const integ of flat) {
      map.set(integ.provider, integ);
    }
    return map;
  }, [integrations]);

  const cronToolbar = (
    <CronToolbar
      crons={[
        "beehiiv-sync",
        "linkedin-post-sync",
        "performance-sync",
        "x-metrics-sync",
        "x-ads-metrics-sync",
      ]}
      onTriggered={() =>
        queryClient.invalidateQueries({ queryKey: ["content-hub-integrations"] })
      }
    />
  );

  if (isLoading) {
    return (
      <div className="container max-w-5xl py-8 space-y-6">
        {cronToolbar}
        <HubSkeleton />
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      {cronToolbar}
      <header className="space-y-2 border-b pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Content channels</h1>
        <p className="text-sm text-muted-foreground">
          Connect content sources to ingest, repurpose, and publish across every channel.
        </p>
        {isError && (
          <p className="text-sm text-destructive">
            Couldn&rsquo;t load connection status. The list below shows availability only.
          </p>
        )}
      </header>

      <Tabs defaultValue={ALL_TAB}>
        <ScrollableTabsList className="rounded-none">
          <TabsList className="overflow-y-hidden">
            <TabsTrigger value={ALL_TAB}>All</TabsTrigger>
            {CHANNEL_CATEGORIES.map((category) => (
              <TabsTrigger key={category} value={category}>
                {category}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollableTabsList>

        <TabsContent value={ALL_TAB} className="mt-6 space-y-3">
          {channels.map((channel) => (
            <ChannelRow
              key={channel.slug}
              channel={channel}
              integration={connections.get(channel.providerKey)}
              connectionStateUnknown={isError && !data}
            />
          ))}
        </TabsContent>

        {CHANNEL_CATEGORIES.map((category) => {
          const inCategory = channels.filter((c) => c.category === category);
          return (
            <TabsContent key={category} value={category} className="mt-6 space-y-3">
              {inCategory.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No channels in this category yet.
                </p>
              ) : (
                inCategory.map((channel) => (
                  <ChannelRow
                    key={channel.slug}
                    channel={channel}
                    integration={connections.get(channel.providerKey)}
                    connectionStateUnknown={isError && !data}
                  />
                ))
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

interface ChannelRowProps {
  channel: ChannelConfig;
  integration: ApiIntegration | undefined;
  /** Connection state couldn't be loaded — disable CTAs to avoid sending the
   *  user to /dashboard/integrations for a channel they may already have. */
  connectionStateUnknown?: boolean;
}

function ChannelRow({ channel, integration, connectionStateUnknown }: ChannelRowProps) {
  const router = useRouter();
  // Connection state is INDEPENDENT of lifecycle, and "Manage" falls back to
  // the static dashboard path when the catalog row omits it — see
  // resolveChannelCta for the full rationale (this fixes a connected channel
  // rendering "Connect" when its catalog row lacks display.dashboardPath).
  const { isConnected, dashboardPath } = resolveChannelCta(channel, integration);
  const lastSyncedLabel = useLastSyncedLabel(integration?.lastSyncAt);

  const handleAction = () => {
    if (channel.status === "coming_soon" || connectionStateUnknown) return;
    // Channels that connect via their own in-app page (e.g. WhatsApp Embedded
    // Signup, status "available") route there for both connect and manage;
    // connected channels route to their dashboard. Everything else falls back
    // to the integrations OAuth grid.
    if (dashboardPath && (isConnected || channel.status === "available")) {
      router.push(dashboardPath);
    } else {
      router.push("/dashboard/integrations");
    }
  };

  return (
    <div className="flex items-start gap-4 rounded-lg border p-4">
      <ChannelLogo channel={channel} />

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{channel.name}</p>
          <StatusBadge channel={channel} isConnected={isConnected} />
        </div>
        <p className="text-sm text-muted-foreground">{channel.description}</p>
        {isConnected && integration?.lastError && (
          <p className="text-sm text-destructive">{integration.lastError}</p>
        )}
        {isConnected && !integration?.lastError && lastSyncedLabel && (
          <p className="text-xs text-muted-foreground">{lastSyncedLabel}</p>
        )}
      </div>

      <Button
        variant={
          isConnected
            ? "outline"
            : channel.status === "coming_soon" || connectionStateUnknown
              ? "ghost"
              : "default"
        }
        size="sm"
        disabled={channel.status === "coming_soon" || connectionStateUnknown}
        onClick={handleAction}
      >
        {connectionStateUnknown
          ? "Status unavailable"
          : isConnected
            ? "Manage"
            : channel.status === "coming_soon"
              ? "Coming soon"
              : "Connect"}
      </Button>
    </div>
  );
}

function StatusBadge({
  channel,
  isConnected,
}: {
  channel: ChannelConfig;
  isConnected: boolean;
}) {
  if (isConnected) {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-800">
        Connected
      </Badge>
    );
  }
  if (channel.status === "coming_soon") {
    return <Badge variant="outline">Coming soon</Badge>;
  }
  return <Badge variant="outline">Available</Badge>;
}

function ChannelLogo({ channel }: { channel: ChannelConfig }) {
  // Track CDN failures locally so a blocked / 404'd logo gracefully falls
  // back to the initial-circle without a broken-image icon.
  const [errored, setErrored] = useState(false);
  if (channel.logoUrl && !errored) {
    return (
      <Image
        src={channel.logoUrl}
        alt=""
        aria-hidden
        width={40}
        height={40}
        className={cn(
          "size-10 shrink-0 rounded",
          channel.logoInvertOnDark && "dark:invert",
        )}
        unoptimized
        loading="lazy"
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="size-10 shrink-0 rounded bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground"
    >
      {channel.name.charAt(0)}
    </div>
  );
}

/**
 * Format a "last synced N ago" line. Returns undefined when the connection
 * has no sync history yet (we don't want to render a misleading "just now"
 * for a brand-new connection that has never run).
 */
function useLastSyncedLabel(lastSyncAt: string | undefined): string | undefined {
  // Sample "now" in an effect, never during render: calling Date.now() /
  // new Date() during render is impure and defeats React Compiler memoization.
  // Null until mounted → no label flash and SSR-safe (server + first client
  // render agree on `undefined`).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Defer to a microtask so it's neither an impure render-time read nor a
    // synchronous effect setState (both are lint-flagged); guard unmount.
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setNow(Date.now());
    });
    return () => {
      cancelled = true;
    };
  }, [lastSyncAt]);

  return useMemo(() => {
    if (!lastSyncAt || now === null) return undefined;
    // Date.parse is pure (deterministic for a given string); new Date(str) is
    // flagged impure by the compiler.
    const ts = Date.parse(lastSyncAt);
    if (Number.isNaN(ts)) return undefined;
    // Clamp to 0 — server/client clock skew can produce a small negative
    // diff right after a fresh sync; show "Just synced" instead of nothing.
    const diffMs = Math.max(0, now - ts);
    if (diffMs < 30_000) return "Just synced";

    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < hour) {
      const mins = Math.max(1, Math.floor(diffMs / minute));
      return `Last synced ${mins} min${mins === 1 ? "" : "s"} ago`;
    }
    if (diffMs < day) {
      const hours = Math.floor(diffMs / hour);
      return `Last synced ${hours} hour${hours === 1 ? "" : "s"} ago`;
    }
    const days = Math.floor(diffMs / day);
    if (days > 7) {
      return `Last synced ${days} days ago — check connection`;
    }
    return `Last synced ${days} day${days === 1 ? "" : "s"} ago`;
  }, [lastSyncAt, now]);
}

function HubSkeleton() {
  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div className="space-y-2 border-b pb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 rounded-lg border p-4">
            <Skeleton className="size-10 shrink-0 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
