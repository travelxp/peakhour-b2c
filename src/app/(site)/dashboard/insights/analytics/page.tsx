"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Users,
  MousePointerClick,
  Target,
  Activity,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { useSetAskEntityIds } from "@/providers/ask-context-provider";
import { ASK_ENABLED } from "@/lib/flags";
import { TrendChart } from "@/components/ui/trend-chart";
import { ExplainCard } from "@/components/dashboard/explain-card";
import {
  useAnalyticsInsights,
  ANALYTICS_INSIGHTS_KEY,
  type AnalyticsInsightsResponse,
  type Ga4Digest,
} from "@/hooks/use-analytics-insights";
import { OAuthConnectResult } from "@/components/integrations/oauth-connect-result";
import { PageShell, PageHeader } from "@/components/dashboard/page-shell";
import { WhatCountsAsAWinDialog } from "@/components/growth/what-counts-as-a-win-dialog";
import { growthApi } from "@/lib/api/growth";
import { analyticsActions, type AnalyticsAction } from "@/lib/analytics-actions";

interface ConnectionStatus {
  provider: string;
  status?: "active" | "disconnected" | "expired" | "error";
  connectedAt?: string;
  lastSyncAt?: string;
  lastError?: string;
  account?: {
    externalId: string;
    name: string;
  };
}

interface CapabilitiesResponse {
  provider: string;
  capabilities: Record<string, unknown> | null;
  account?: {
    extra?: {
      properties?: Array<{
        propertyId: string;
        displayName: string;
        currencyCode?: string;
        timeZone?: string;
      }>;
    };
    [key: string]: unknown;
  };
}

export default function AnalyticsInsightsPage() {
  const qc = useQueryClient();

  const statusQ = useQuery({
    queryKey: ["integration-status", "google_analytics"],
    queryFn: () =>
      api.get<ConnectionStatus>("/v1/integrations/google_analytics/status"),
    refetchOnWindowFocus: false,
  });

  const capQ = useQuery({
    queryKey: ["integration-cap", "google_analytics"],
    queryFn: () =>
      api.get<CapabilitiesResponse>(
        "/v1/integrations/google_analytics/capabilities",
      ),
    enabled: statusQ.data?.status === "active",
    refetchOnWindowFocus: false,
  });

  const syncMut = useMutation({
    mutationFn: () =>
      api.post("/v1/integrations/google_analytics/sync", {}),
    onSuccess: () => {
      toast.success("Sync started — funnel + top pages refreshing");
      qc.invalidateQueries({ queryKey: ["integration-status"] });
      qc.invalidateQueries({ queryKey: [ANALYTICS_INSIGHTS_KEY] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Sync failed"),
  });

  // Persist the chosen GA4 property to the connection (config.propertyId) —
  // the field the hourly performance-sync actually reads. Without this the
  // picker only ever changed a read-time query override, so the cron stayed
  // blind and the dashboard showed nothing. On success we kick a sync so data
  // for the newly-selected property lands right away.
  const setPropertyMut = useMutation({
    mutationFn: (propertyId: string) =>
      api.put("/v1/integrations/google_analytics/ga4-property", { propertyId }),
    onSuccess: () => {
      toast.success("Property selected — syncing analytics now");
      qc.invalidateQueries({ queryKey: ["integration-cap"] });
      qc.invalidateQueries({ queryKey: [ANALYTICS_INSIGHTS_KEY] });
      syncMut.mutate();
    },
    onError: (e: Error) =>
      toast.error(e.message ?? "Could not select property"),
  });

  const status = statusQ.data;
  const properties = capQ.data?.account?.extra?.properties ?? [];
  const selectedPropertyId = (capQ.data?.capabilities as Record<string, unknown> | undefined)
    ?.propertyId as string | undefined;

  // Publish the selected GA4 property so Ask Peakhour on this page pre-scopes its
  // tools to it (removed on unmount). Hook is called unconditionally (before any
  // early return) per the rules of hooks.
  useSetAskEntityIds({ propertyId: selectedPropertyId });

  // See search-console/page.tsx for the rationale: "error" still shows
  // the connected card so the user can retry; "expired" prompts reconnect.
  const isWorking = status?.status === "active" || status?.status === "error";
  const needsReconnect = status?.status === "expired";

  // Deterministic GA4 dashboard data (funnel + trend + channels + pages +
  // digest). Only fetched once the connection is working.
  const insightsQ = useAnalyticsInsights(selectedPropertyId, isWorking);

  // ★HAS ANYONE SAID WHAT A GOOD RESULT LOOKS LIKE? It decides whether this
  // page shows a conversions figure at all. A permanent "Conversions: 0" over
  // real traffic reads as a verdict on the customer's marketing when it is our
  // own missing setup step — the same rule Outcomes follows, reading the same
  // field so the two surfaces cannot disagree.
  const winQ = useQuery({
    queryKey: ["growth-win-options", "analytics"],
    queryFn: () => growthApi.winOptions(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  // ★UNKNOWN COUNTS AS CONFIGURED WHILE THE READ IS IN FLIGHT OR FAILED. The
  // alternative flashes "nothing is counting your outcomes" at a business that
  // has counted them for months, which is a worse lie than a briefly missing
  // prompt.
  const winConfigured = winQ.data ? winQ.data.current !== null : true;

  // Single toolbar instance survives the loading→loaded transition so
  // the dev trigger is reachable during the very query its data refreshes,
  // and so the toolbar's in-flight state isn't lost on remount.
  const cronToolbar = (
    <>
      {/* Google Analytics is the ONE provider whose callback lands here
          rather than on the returnTo surface (its property picker is a
          required post-OAuth step), and nothing on this page read
          ?integration=connected — so a GA connect was silent and the
          params lingered in the URL forever. */}
      <OAuthConnectResult />
      <CronToolbar
        crons={["performance-sync", "outcome-backfill"]}
        onTriggered={() => {
          qc.invalidateQueries({ queryKey: ["integration-status"] });
          qc.invalidateQueries({ queryKey: ["integration-cap"] });
          qc.invalidateQueries({ queryKey: [ANALYTICS_INSIGHTS_KEY] });
        }}
      />
    </>
  );

  if (statusQ.isLoading) {
    return (
      <PageShell width="wide">
        {cronToolbar}
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      {cronToolbar}
      <PageHeader
        icon={
          <div className="rounded-lg bg-[#E37400] p-2">
            <LineChart className="h-5 w-5 text-white" />
          </div>
        }
        title="Analytics 4"
        description="Conversion funnel + top page performance — drives Optimizer budget allocation and Strategist content suggestions."
      />

      {!isWorking ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {needsReconnect ? "Connection expired" : "Not connected"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {needsReconnect
                ? "Your Analytics 4 refresh token expired. Reconnect to resume syncing funnel and page metrics."
                : "Connect Google Analytics 4 to start syncing real conversion data into the autonomous engine. Universal Analytics is sunset and not supported — only GA4 properties (numeric ids) work."}
            </p>
            <Button asChild>
              <Link href="/dashboard/integrations">
                {needsReconnect ? "Reconnect" : "Go to integrations"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ★THE READING COMES FIRST AND THE PLUMBING COMES LAST. The property
              picker used to be the first card on this page: a settings screen —
              account id, Sync now, a "Use this" button per property — sitting
              above everything a customer actually came to read. It is a
              once-a-year job and it is now at the bottom, collapsed. */}
          <AnalyticsData query={insightsQ} winConfigured={winConfigured} />

          {ASK_ENABLED && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-primary" />
                  Ask Peakhour about your analytics
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Ask in plain language — answers are grounded in this property&apos;s real GA4 + Search Console
                  data (no made-up numbers).
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {[
                  "How's my website traffic and search doing?",
                  "What should I do to get more search traffic?",
                  "Which pages get the most visitors?",
                ].map((q) => (
                  <Button key={q} asChild variant="outline" size="sm">
                    <Link href={`/dashboard/ask?q=${encodeURIComponent(q)}`}>{q}</Link>
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          <details className="rounded-lg border">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
              <span className="inline-flex items-center gap-2">
                <LineChart className="size-4" aria-hidden="true" />
                Connection &amp; property
                <span className="font-normal text-muted-foreground">
                  {status.account?.name ?? status.account?.externalId}
                  {status.lastSyncAt
                    ? ` · synced ${new Date(status.lastSyncAt).toLocaleDateString()}`
                    : ""}
                </span>
              </span>
            </summary>
            <div className="border-t p-4">
              <ConnectionPanel
                status={status}
                properties={properties}
                selectedPropertyId={selectedPropertyId}
                syncMut={syncMut}
                setPropertyMut={setPropertyMut}
              />
            </div>
          </details>
        </>
      )}
    </PageShell>
  );
}

/** The GA4 connection and property picker. Unchanged in behaviour — only in
 *  where it sits, which is under a disclosure at the foot of the page. */
function ConnectionPanel({
  status,
  properties,
  selectedPropertyId,
  syncMut,
  setPropertyMut,
}: {
  status: ConnectionStatus;
  properties: Array<{ propertyId: string; displayName: string; currencyCode?: string }>;
  selectedPropertyId: string | undefined;
  syncMut: { isPending: boolean; mutate: () => void };
  setPropertyMut: { isPending: boolean; variables?: string; mutate: (id: string) => void };
}) {
  return (
    <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Connection</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {status.account?.name ?? status.account?.externalId}
                  {status.lastSyncAt && (
                    <span className="ml-2">
                      · Last sync {new Date(status.lastSyncAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={syncMut.isPending}
                onClick={() => syncMut.mutate()}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`}
                />
                Sync now
              </Button>
            </CardHeader>
            <CardContent>
              {status.lastError && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <strong>Last sync error:</strong> {status.lastError}
                </div>
              )}
              <div className="mt-2 text-sm">
                <strong className="block mb-1">GA4 properties</strong>
                {properties.length === 0 ? (
                  <p className="text-muted-foreground">
                    No GA4 properties found for this account.{" "}
                    <a
                      href="https://analytics.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Open Analytics
                      <ExternalLink className="inline ml-1 h-3 w-3" />
                    </a>
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {properties.map((p) => {
                      const isActive = selectedPropertyId === p.propertyId;
                      const isSetting =
                        setPropertyMut.isPending &&
                        setPropertyMut.variables === p.propertyId;
                      return (
                        <li
                          key={p.propertyId}
                          className="flex items-center justify-between rounded border px-2 py-1"
                        >
                          <div>
                            <span className="font-medium">{p.displayName}</span>
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              {p.propertyId}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {p.currencyCode && (
                              <Badge variant="outline" className="text-xs">
                                {p.currencyCode}
                              </Badge>
                            )}
                            {isActive ? (
                              <Badge className="text-xs">Active</Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs"
                                disabled={setPropertyMut.isPending}
                                onClick={() =>
                                  setPropertyMut.mutate(p.propertyId)
                                }
                              >
                                {isSetting ? "Selecting…" : "Use this"}
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
    </>
  );
}

// ── Deterministic GA4 data view ──────────────────────────────────────────────

function num(n: number): string {
  return n.toLocaleString();
}

/** WoW delta chip (percent). null delta → no chip. */
function DeltaChip({ deltaPct }: { deltaPct: number | null | undefined }) {
  if (deltaPct === null || deltaPct === undefined) return null;
  const up = deltaPct > 0;
  const down = deltaPct < 0;
  return (
    <span
      className={`flex items-center gap-0.5 text-xs font-medium ${
        up
          ? "text-emerald-600 dark:text-emerald-400"
          : down
            ? "text-red-600 dark:text-red-400"
            : "text-muted-foreground"
      }`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : down ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {Math.abs(deltaPct)}%
    </span>
  );
}

function FunnelTile({
  icon,
  label,
  value,
  deltaPct,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  deltaPct?: number | null;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">
          {num(value)}
          {suffix}
        </span>
        <DeltaChip deltaPct={deltaPct} />
      </div>
    </div>
  );
}

const ACTION_DOT: Record<AnalyticsAction["severity"], string> = {
  critical: "bg-red-500",
  attention: "bg-amber-500",
  opportunity: "bg-emerald-500",
};

const MOVEMENT_DOT: Record<Ga4Digest["movements"][number]["kind"], string> = {
  surging: "bg-emerald-500",
  new: "bg-emerald-500",
  dropping: "bg-red-500",
  lost: "bg-red-500",
};

function AnalyticsData({
  query,
  winConfigured,
}: {
  query: { data?: AnalyticsInsightsResponse; isLoading: boolean; isError: boolean };
  winConfigured: boolean;
}) {
  const { data, isLoading, isError } = query;
  const [winOpen, setWinOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Couldn&apos;t load your analytics right now — try a sync from Connection &amp;
          property below.
        </CardContent>
      </Card>
    );
  }
  if (!data.configured) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No GA4 property is selected yet. Pick one under Connection &amp; property below to
          start seeing your numbers.
        </CardContent>
      </Card>
    );
  }
  if (data.pending) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Data is still syncing — your funnel, trend and top pages will appear here shortly.
        </CardContent>
      </Card>
    );
  }

  const d = data.digest;
  const funnel = data.funnel;
  const channels = data.channels ?? [];
  const trend = data.trend ?? [];
  const funnelWindow = data.period ?? "last 30 days";
  const windowLabel = data.trendWindowDays ? `last ${data.trendWindowDays} days` : "recent";

  // What to do about all this — deterministic, from the data already here.
  const actions = analyticsActions(data, { winConfigured });

  return (
    <div className="space-y-6">
      {winOpen && <WhatCountsAsAWinDialog open={winOpen} onOpenChange={setWinOpen} />}

      {/* ── What's happening (week-over-week digest) ── */}
      {d && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What&apos;s happening</CardTitle>
            <p className="text-sm">{d.headline}</p>
          </CardHeader>
          {d.hasComparison && d.movements.length > 0 && (
            <CardContent>
              <ul className="space-y-1.5">
                {d.movements.map((m, i) => (
                  <li key={`${m.kind}-${m.entity}-${i}`} className="flex items-start gap-2 text-sm">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${MOVEMENT_DOT[m.kind]}`} aria-hidden />
                    <span className="text-muted-foreground">{m.detail}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── What to do next ────────────────────────────────────────────
          ★DETERMINISTIC AND FREE, ABOVE THE PAID GLOSS. The card below this is
          model-written and Peaks-metered, so a customer only ever sees it if
          they already suspected there was something worth reading. "What should
          I do next" is the one thing on an analytics screen that must not sit
          behind a spend, so it is computed from the numbers already on this
          response and shown to everybody. */}
      {actions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">What to do about it</h3>
          {actions.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full sm:mt-0 ${ACTION_DOT[a.severity]}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{a.detail}</p>
                </div>
                {a.opensWinDialog ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setWinOpen(true)}
                  >
                    {a.cta}
                  </Button>
                ) : a.href && a.cta ? (
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link href={a.href}>
                      {a.cta}
                      <ArrowRight className="ml-1.5 size-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Tier-2 "Explain this" (user-triggered, Peaks-metered) ── */}
      <ExplainCard surface="ga4" resource={data.property} />

      {/* ── Two numbers, not four ──────────────────────────────────────
          ★PEOPLE AND WHETHER THEY STAYED. Sessions-vs-users is a distinction
          only an analyst cares about, and raw event count is a diagnostic —
          both were tiles here and both are now behind the disclosure below.
          ★CONVERSIONS IS GONE UNLESS SOMETHING IS COUNTING. Quests' tile read a
          permanent 0 for ninety days because their property has no key event:
          our missing setup step, rendered as a verdict on their marketing. The
          action list above asks the question instead. */}
      {funnel && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Totals · {funnelWindow}</p>
          <div className="grid grid-cols-2 gap-3">
            <FunnelTile icon={<Users className="h-4 w-4" />} label="People" value={funnel.totalUsers} />
            <FunnelTile
              icon={<Activity className="h-4 w-4" />}
              label="Stayed and read something"
              value={funnel.engagementRatePct}
              suffix="%"
            />
            {winConfigured && funnel.conversions > 0 && (
              <FunnelTile
                icon={<Target className="h-4 w-4" />}
                label="Outcomes"
                value={funnel.conversions}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Sessions trend ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <LineChart className="h-4 w-4" />
            Sessions trend
          </CardTitle>
          <p className="text-xs text-muted-foreground">Daily sessions, {windowLabel}.</p>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={trend as unknown as Array<Record<string, string | number>>}
            series={[{ key: "sessions", label: "Sessions" }]}
          />
        </CardContent>
      </Card>

      {/* ── Channels + top pages ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MousePointerClick className="h-4 w-4" />
              Where traffic comes from
            </CardTitle>
          </CardHeader>
          <CardContent>
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No channel data yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {channels.map((ch) => (
                  <li key={ch.channel} className="flex items-center justify-between text-sm">
                    <span>{ch.channel}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {num(ch.sessions)} sessions
                      {ch.conversions > 0 && <span className="ml-2 text-foreground">· {num(ch.conversions)} conv</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top pages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No page data yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.pages.map((p) => (
                  <li key={p.pagePath} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-mono text-xs" title={p.pagePath}>
                      {p.pagePath}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{num(p.views)} views</span>
                  </li>
                ))}
              </ul>
            )}
            {data.lockedPages > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                {num(data.lockedPages)} more page{data.lockedPages === 1 ? "" : "s"} on the Content plan.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
