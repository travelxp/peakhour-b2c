"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, RefreshCw, ExternalLink, AlertTriangle, ArrowRight } from "lucide-react";

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

  if (statusQ.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const status = statusQ.data;
  const properties = capQ.data?.account?.extra?.properties ?? [];
  const selectedPropertyId = (capQ.data?.capabilities as Record<string, unknown> | undefined)
    ?.propertyId as string | undefined;

  return (
    <div className="p-6 space-y-6">
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

      {status?.status !== "active" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Not connected
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect Google Analytics 4 to start syncing real conversion data into the autonomous engine. Universal Analytics is sunset and not supported — only GA4 properties (numeric ids) work.
            </p>
            <Button asChild>
              <Link href="/dashboard/integrations">
                Go to integrations
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funnel + top pages</CardTitle>
              <p className="text-xs text-muted-foreground">
                Each sync writes funnel totals + top-25 pages + acquisition channels to <code>ana_performance_snapshots</code> with platform=&quot;google_analytics&quot;. Funnel-chart UI ships in a follow-up.
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Run a sync above, then the GA4 skills (ga4_funnel_analysis, ga4_top_pages_brief, etc.) become active in their respective agents.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
