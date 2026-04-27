"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, RefreshCw, ExternalLink, AlertTriangle, ArrowRight } from "lucide-react";

interface ConnectionStatus {
  provider: string;
  status?: "active" | "disconnected" | "expired" | "error";
  connectedAt?: string;
  lastSyncAt?: string;
  lastError?: string;
  account?: {
    externalId: string;
    name: string;
    profileUrl?: string;
  };
}

interface CapabilitiesResponse {
  provider: string;
  capabilities: Record<string, unknown> | null;
  account?: {
    extra?: {
      sites?: Array<{ siteUrl: string; permissionLevel: string }>;
    };
    [key: string]: unknown;
  };
}

export default function SearchConsoleInsightsPage() {
  const qc = useQueryClient();

  const statusQ = useQuery({
    queryKey: ["integration-status", "google_search_console"],
    queryFn: () =>
      api.get<ConnectionStatus>("/v1/integrations/google_search_console/status"),
    refetchOnWindowFocus: false,
  });

  const capQ = useQuery({
    queryKey: ["integration-cap", "google_search_console"],
    queryFn: () =>
      api.get<CapabilitiesResponse>(
        "/v1/integrations/google_search_console/capabilities",
      ),
    enabled: statusQ.data?.status === "active",
    refetchOnWindowFocus: false,
  });

  const syncMut = useMutation({
    mutationFn: () =>
      api.post("/v1/integrations/google_search_console/sync", {}),
    onSuccess: () => {
      toast.success("Sync started — top queries refreshing");
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
  const sites = capQ.data?.account?.extra?.sites ?? [];
  const selectedSite = (capQ.data?.capabilities as Record<string, unknown> | undefined)?.siteUrl as
    | string
    | undefined;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#458CF7] p-2">
            <Search className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Search Console</h1>
            <p className="text-sm text-muted-foreground">
              Top queries from Google Search Console — feeds Strategist briefs and voice-card refinement.
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
              Connect Google Search Console to start syncing top queries into your content strategy and voice cards.
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
                <strong className="block mb-1">Verified sites</strong>
                {sites.length === 0 ? (
                  <p className="text-muted-foreground">
                    No verified Search Console properties found for this account.{" "}
                    <a
                      href="https://search.google.com/search-console"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Verify a domain
                      <ExternalLink className="inline ml-1 h-3 w-3" />
                    </a>
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {sites.map((s) => (
                      <li
                        key={s.siteUrl}
                        className="flex items-center justify-between rounded border px-2 py-1"
                      >
                        <span className="font-mono text-xs">{s.siteUrl}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {s.permissionLevel}
                          </Badge>
                          {selectedSite === s.siteUrl && (
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
              <CardTitle className="text-base">Top queries</CardTitle>
              <p className="text-xs text-muted-foreground">
                Queries are written to the <code>ana_search_queries</code> collection on each sync and projected into voice cards weekly. Top-queries table UI ships in a follow-up.
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Run a sync above, then check the search-console-performance skill in the Strategist for query-driven content briefs.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
