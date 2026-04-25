"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollableTabsList } from "@/components/scrollable-tabslist";
import { flattenMetaIntegration } from "@/lib/integrations-meta";
import {
  CHANNELS,
  CHANNEL_CATEGORIES,
  LIVE_CHANNELS,
  type ChannelConfig,
} from "./channels.config";

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

export default function ContentChannelsHubPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?stay=1` lets the user (or our own "Back to channels" link) opt out of
  // the single-channel auto-redirect. Without it, navigating Back from the
  // Beehiiv library would bounce the user immediately back to Beehiiv.
  const stay = searchParams?.get("stay") === "1";
  const hasRedirected = useRef(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () => api.get<{ integrations: ApiIntegration[] }>("/v1/integrations"),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const connections = useMemo<ConnectionMap>(() => {
    const map: ConnectionMap = new Map();
    // Flatten Meta — one `facebook` connection becomes 4 virtual rows
    // (facebook_pages, instagram, meta_ads, whatsapp) so per-capability
    // connection state lights up independently in the hub.
    const flat = flattenMetaIntegration(data?.integrations ?? []);
    for (const integ of flat) {
      map.set(integ.provider, integ);
    }
    return map;
  }, [data]);

  // Determine redirect target synchronously so we can render a "redirecting"
  // stub on the same paint instead of flashing the full hub.
  const redirectTarget = useMemo(() => {
    if (isLoading || !data || stay || hasRedirected.current) return null;
    const liveConnected = LIVE_CHANNELS.filter(
      (c) => connections.get(c.providerKey)?.connected,
    );
    return liveConnected.length === 1 ? liveConnected[0]?.dashboardPath ?? null : null;
  }, [isLoading, data, stay, connections]);

  useEffect(() => {
    if (!redirectTarget) return;
    hasRedirected.current = true;
    router.replace(redirectTarget);
  }, [redirectTarget, router]);

  if (isLoading || redirectTarget) {
    return <HubSkeleton />;
  }

  return (
    <div className="container max-w-5xl py-8 space-y-6">
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
          {CHANNELS.map((channel) => (
            <ChannelRow
              key={channel.slug}
              channel={channel}
              integration={connections.get(channel.providerKey)}
            />
          ))}
        </TabsContent>

        {CHANNEL_CATEGORIES.map((category) => (
          <TabsContent key={category} value={category} className="mt-6 space-y-3">
            {CHANNELS.filter((c) => c.category === category).map((channel) => (
              <ChannelRow
                key={channel.slug}
                channel={channel}
                integration={connections.get(channel.providerKey)}
              />
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

interface ChannelRowProps {
  channel: ChannelConfig;
  integration: ApiIntegration | undefined;
}

function ChannelRow({ channel, integration }: ChannelRowProps) {
  const router = useRouter();
  const isConnected = integration?.connected === true && channel.status === "live";
  const lastSyncedLabel = useLastSyncedLabel(integration?.lastSyncAt);

  const handleAction = () => {
    if (channel.status === "coming_soon") return;
    if (isConnected && channel.dashboardPath) {
      router.push(channel.dashboardPath);
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
        variant={isConnected ? "outline" : channel.status === "coming_soon" ? "ghost" : "default"}
        size="sm"
        disabled={channel.status === "coming_soon"}
        onClick={handleAction}
      >
        {isConnected ? "Manage" : channel.status === "coming_soon" ? "Coming soon" : "Connect"}
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
  return useMemo(() => {
    if (!lastSyncAt) return undefined;
    const ts = new Date(lastSyncAt).getTime();
    if (Number.isNaN(ts)) return undefined;
    // Clamp to 0 — server/client clock skew can produce a small negative
    // diff right after a fresh sync; show "Just synced" instead of nothing.
    const diffMs = Math.max(0, Date.now() - ts);
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
  }, [lastSyncAt]);
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
