"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, RefreshCw, ExternalLink, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { useSetAskEntityIds } from "@/providers/ask-context-provider";
import { ASK_ENABLED } from "@/lib/flags";

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

  // Single toolbar instance survives the loading→loaded transition so
  // the dev trigger is reachable during the very query its data refreshes,
  // and so the toolbar's in-flight state isn't lost on remount.
  const cronToolbar = (
    <CronToolbar
      crons={["performance-sync", "outcome-backfill"]}
      onTriggered={() => {
        qc.invalidateQueries({ queryKey: ["integration-status"] });
        qc.invalidateQueries({ queryKey: ["integration-cap"] });
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

          {ASK_ENABLED ? (
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
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Funnel + top pages</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Each sync writes funnel totals + top-25 pages + acquisition channels to{" "}
                  <code>ana_performance_snapshots</code> (platform=&quot;google_analytics&quot;).
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Run a sync above to keep your analytics fresh.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
