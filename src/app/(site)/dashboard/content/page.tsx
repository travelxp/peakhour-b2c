"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { api } from "@/lib/api";
import { resolveBrandLogo } from "@/lib/brand-logos";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
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
import { filterChannels, groupChannels, type ChannelGroup } from "./channel-groups";
import { PageShell } from "@/components/dashboard/page-shell";

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

  // Search is local state, not URL-synced. This is a within-page find rather
  // than a filter worth linking to or coming back to — nobody bookmarks a
  // channel-list search — and a URL round-trip per keystroke would make the
  // input feel heavier than the list it is filtering.
  const [search, setSearch] = useState("");

  /**
   * The three groups, per tab.
   *
   * Memoised on the resolved connection map rather than on the raw response, so
   * a refetch that returns identical connection state does not re-bucket the
   * whole list. `resolveChannelCta` is the SAME call each row makes for its own
   * CTA, so a row can never sit in a bucket that disagrees with its button.
   */
  const groupsFor = useMemo(
    () => (list: ChannelConfig[]): ChannelGroup[] =>
      groupChannels(filterChannels(list, search), (channel) =>
        resolveChannelCta(channel, connections.get(channel.providerKey)),
      ),
    [connections, search],
  );

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
      <PageShell>
        {cronToolbar}
        <HubSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {cronToolbar}
      <header className="space-y-2 border-b pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Content channels</h1>
            <p className="text-sm text-muted-foreground">
              Connect content sources to ingest, repurpose, and publish across every channel.
            </p>
          </div>
          {/* Top-right, and `type="search"` so the browser offers its own clear
              affordance rather than us shipping a second one. `shrink-0` keeps
              it from being squeezed by a long heading at tablet widths. */}
          <div className="relative w-full shrink-0 sm:w-64">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search channels"
              aria-label="Search channels"
              className="pl-8"
            />
          </div>
        </div>
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

        <TabsContent value={ALL_TAB} className="mt-6">
          <ChannelGroups
            groups={groupsFor(channels)}
            connections={connections}
            connectionStateUnknown={isError && !data}
            search={search}
          />
        </TabsContent>

        {CHANNEL_CATEGORIES.map((category) => (
          <TabsContent key={category} value={category} className="mt-6">
            <ChannelGroups
              groups={groupsFor(channels.filter((c) => c.category === category))}
              connections={connections}
              connectionStateUnknown={isError && !data}
              search={search}
              emptyLabel="No channels in this category yet."
            />
          </TabsContent>
        ))}
      </Tabs>
    </PageShell>
  );
}

/**
 * The three groups, rendered in order with their headings.
 *
 * ★AN EMPTY GROUP KEEPS ITS HEADING, WITH ONE EXCEPTION. "Connected — nothing
 * connected yet" is the single most useful line on this page for a new
 * merchant, and dropping it would leave them looking at a list of thirty
 * options with nothing telling them where they stand. The exception is a
 * SEARCH: while filtering, an empty group is an artefact of the query rather
 * than a fact about the account, so the headings collapse and one "no matches"
 * line takes their place.
 */
function ChannelGroups({
  groups,
  connections,
  connectionStateUnknown,
  search,
  emptyLabel = "No channels here yet.",
}: {
  groups: ChannelGroup[];
  connections: ConnectionMap;
  connectionStateUnknown: boolean;
  search: string;
  emptyLabel?: string;
}) {
  const searching = search.trim().length > 0;
  const total = groups.reduce((n, g) => n + g.channels.length, 0);

  if (total === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        {searching ? `No channels match "${search.trim()}".` : emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        if (searching && group.channels.length === 0) return null;
        return (
          <section key={group.key} className="space-y-3">
            <h2 className="flex items-baseline gap-2 text-sm font-semibold">
              {group.title}
              {group.channels.length > 0 && (
                <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">
                  {group.channels.length}
                </span>
              )}
            </h2>
            {group.channels.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                {group.empty}
              </p>
            ) : (
              <div className="space-y-3">
                {group.channels.map((channel) => (
                  <ChannelRow
                    key={channel.slug}
                    channel={channel}
                    integration={connections.get(channel.providerKey)}
                    connectionStateUnknown={connectionStateUnknown}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
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
  const { isConnected, showsComingSoon, dashboardPath, manageViaIntegrations, configGap } =
    resolveChannelCta(channel, integration);
  const lastSyncedLabel = useLastSyncedLabel(integration?.lastSyncAt);
  // ★`showsComingSoon`, never `channel.status === "coming_soon"`. A row whose
  // org holds a connection — active OR broken — must stay reachable, because
  // /dashboard/integrations is where the merchant fixes it. Deriving it in
  // resolveChannelCta rather than here is what lets it be tested; an earlier
  // cut of this fix re-derived it inline and silently covered only the ACTIVE
  // case, leaving a needs_reauth merchant with a disabled "Coming soon" row.
  const actionDisabled = showsComingSoon || connectionStateUnknown === true;

  // A connectable channel with no dashboardPath, that isn't one of the
  // known integrations-managed providers, is a catalog/config gap — the exact
  // linkedin_ads failure. Loud in dev, because the user-facing fallback
  // ("Manage connection" → the integrations grid) is deliberately plausible and
  // would otherwise hide a recurrence. Not gated on connectedness: the gap
  // exists whether or not this org has connected yet.
  useEffect(() => {
    if (configGap && process.env.NODE_ENV !== "production") {
      console.error(
        `[content-hub] "${channel.providerKey}" is connectable but has no dashboardPath ` +
          `(catalog display.dashboardPath or channels.config.ts) — its Manage falls back ` +
          `to /dashboard/integrations. Add a path, or add the provider to ` +
          `INTEGRATIONS_MANAGED_PROVIDERS if that grid really is its manage surface.`,
      );
    }
  }, [configGap, channel.providerKey]);

  const handleAction = () => {
    if (actionDisabled) return;
    // Channels that connect via their own in-app page (e.g. WhatsApp Embedded
    // Signup — "available" comes from IN_APP_CONNECT_KEYS in
    // channels-from-catalog.ts, not from channels.config.ts, where WhatsApp is
    // "live") route there for both connect and manage; connected channels route
    // to their dashboard. Everything else falls back to the integrations OAuth
    // grid — which for the Meta capability rows and wordpress IS the manage
    // surface, hence the "Manage connection" label below.
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
          <StatusBadge
            isConnected={isConnected}
            showsComingSoon={showsComingSoon}
          />
        </div>
        <p className="text-sm text-muted-foreground">{channel.description}</p>
        {isConnected && integration?.lastError && (
          <p className="text-sm text-destructive">{integration.lastError}</p>
        )}
        {isConnected && !integration?.lastError && lastSyncedLabel && (
          <p className="text-xs text-muted-foreground">{lastSyncedLabel}</p>
        )}
        {manageViaIntegrations && (
          <p className="text-xs text-muted-foreground">
            Managed from Integrations — this channel has no screen of its own.
          </p>
        )}
      </div>

      <Button
        variant={
          isConnected
            ? "outline"
            : showsComingSoon || connectionStateUnknown
              ? "ghost"
              : "default"
        }
        size="sm"
        disabled={actionDisabled}
        onClick={handleAction}
      >
        {connectionStateUnknown
          ? "Status unavailable"
          : isConnected
            ? // Name the real destination rather than promising a channel
              // screen that doesn't exist.
              manageViaIntegrations
              ? "Manage connection"
              : "Manage"
            : showsComingSoon
              ? "Coming soon"
              : "Connect"}
      </Button>
    </div>
  );
}

function StatusBadge({
  isConnected,
  showsComingSoon,
}: {
  isConnected: boolean;
  /** From resolveChannelCta — NOT `channel.status === "coming_soon"`. A row
   *  whose org holds a broken connection is neither Connected nor Coming
   *  soon; badging it "Coming soon" is what hid the failure. */
  showsComingSoon: boolean;
}) {
  if (isConnected) {
    return (
      <Badge variant="secondary" className="bg-success/15 text-success-on-tint">
        Connected
      </Badge>
    );
  }
  if (showsComingSoon) {
    return <Badge variant="outline">Coming soon</Badge>;
  }
  return <Badge variant="outline">Available</Badge>;
}

function ChannelLogo({ channel }: { channel: ChannelConfig }) {
  // Track CDN failures locally so a blocked / 404'd logo gracefully falls
  // back to the initial-circle without a broken-image icon.
  const [errored, setErrored] = useState(false);
  // Resolve again here (not just in channels-from-catalog) so the hardcoded
  // channels.config fallback list — used when the catalog API is unreachable —
  // gets the same self-hosted marks instead of first-letter squares.
  const logoUrl = resolveBrandLogo(channel.providerKey, channel.logoUrl);
  if (logoUrl && !errored) {
    return (
      <Image
        src={logoUrl}
        alt=""
        aria-hidden
        width={40}
        height={40}
        className={cn(
          // object-contain: not every official mark is square (the Woo swoosh
          // is ~2:1) and a fixed 40×40 box would otherwise distort it.
          "size-10 shrink-0 rounded object-contain",
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

/**
 * Rendered INSIDE the page-level <PageShell> (the loading branch), so it must
 * not open one of its own — nested page shells double the measure wrapper and
 * break the "one per route" contract the primitive documents.
 */
function HubSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-2 border-b pb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      {/* Stands in for the category TabsList in the loaded branch. Without it
          every channel row jumped down by the strip height plus its margin
          the moment data arrived. */}
      <Skeleton className="h-9 w-72" />
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
