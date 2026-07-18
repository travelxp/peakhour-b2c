"use client";

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
import {
  useAnalyticsInsights,
  ANALYTICS_INSIGHTS_KEY,
  type AnalyticsInsightsResponse,
  type Ga4Digest,
} from "@/hooks/use-analytics-insights";

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

  // Single toolbar instance survives the loading→loaded transition so
  // the dev trigger is reachable during the very query its data refreshes,
  // and so the toolbar's in-flight state isn't lost on remount.
  const cronToolbar = (
    <CronToolbar
      crons={["performance-sync", "outcome-backfill"]}
      onTriggered={() => {
        qc.invalidateQueries({ queryKey: ["integration-status"] });
        qc.invalidateQueries({ queryKey: ["integration-cap"] });
        qc.invalidateQueries({ queryKey: [ANALYTICS_INSIGHTS_KEY] });
      }}
    />
  );

  if (statusQ.isLoading) {
    return (
      <div className="p-6 space-y-4">
        {cronToolbar}
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {cronToolbar}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#E37400] p-2">
            <LineChart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Analytics 4</h1>
            <p className="text-sm text-muted-foreground">
              Conversion funnel + top page performance — drives Optimizer budget allocation and Strategist content suggestions.
            </p>
          </div>
        </div>
      </div>

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
                    {properties.map((p) => (
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
                          {selectedPropertyId === p.propertyId && (
                            <Badge className="text-xs">Active</Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          <AnalyticsData query={insightsQ} />

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
        </>
      )}
    </div>
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

const MOVEMENT_DOT: Record<Ga4Digest["movements"][number]["kind"], string> = {
  surging: "bg-emerald-500",
  new: "bg-emerald-500",
  dropping: "bg-red-500",
  lost: "bg-red-500",
};

function AnalyticsData({
  query,
}: {
  query: { data?: AnalyticsInsightsResponse; isLoading: boolean; isError: boolean };
}) {
  const { data, isLoading, isError } = query;

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
          Couldn&apos;t load your analytics right now — try a sync above.
        </CardContent>
      </Card>
    );
  }
  if (!data.configured) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No GA4 property is selected yet. Pick one in the connection above to start seeing metrics.
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

  return (
    <div className="space-y-6">
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

      {/* ── Funnel top-line ── */}
      {/* Totals over the funnel window (30d). We deliberately DON'T show a WoW
          delta chip here: the digest is 7d-vs-7d, so pairing a 7d delta with a
          30d magnitude would misread ("45,000 ↑12%" implies the 45k grew 12%).
          The week-over-week story lives in the digest banner above. */}
      {funnel && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Totals · {funnelWindow}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FunnelTile icon={<Users className="h-4 w-4" />} label="Sessions" value={funnel.sessions} />
            <FunnelTile icon={<Users className="h-4 w-4" />} label="Users" value={funnel.totalUsers} />
            <FunnelTile icon={<Activity className="h-4 w-4" />} label="Engagement" value={funnel.engagementRatePct} suffix="%" />
            <FunnelTile icon={<Target className="h-4 w-4" />} label="Conversions" value={funnel.conversions} />
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
