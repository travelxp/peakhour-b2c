"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/molecules/empty-state";
import { MessageCircle, Send, Inbox, MessageSquare, RefreshCw } from "lucide-react";
import { xApi, type XTweet } from "@/lib/api/x";
import { TweetComposer } from "./_components/tweet-composer";
import { TweetCard } from "./_components/tweet-card";

interface ApiIntegration {
  provider: string;
  connected?: boolean;
  status?: string;
}

const RECENT_TWEET_COUNT = 20;

export default function XContentDashboardPage() {
  const queryClient = useQueryClient();

  const integrations = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () =>
      api.get<{ integrations: ApiIntegration[] }>("/v1/integrations"),
    staleTime: 30_000,
  });

  const xConnection = useMemo(
    () => integrations.data?.integrations.find((i) => i.provider === "x"),
    [integrations.data]
  );
  const isConnected = xConnection?.connected === true;

  const tweets = useQuery({
    queryKey: ["x-tweets", RECENT_TWEET_COUNT],
    queryFn: () => xApi.listTweets(RECENT_TWEET_COUNT),
    enabled: isConnected,
  });

  const stats = useMemo(() => {
    const list = tweets.data ?? [];
    if (list.length === 0) return null;
    const totals = list.reduce(
      (acc, t) => {
        const m = t.publicMetrics;
        if (!m) return acc;
        acc.impressions += m.impressionCount;
        acc.engagements +=
          m.likeCount + m.replyCount + m.retweetCount + m.quoteCount;
        acc.measured++;
        return acc;
      },
      { impressions: 0, engagements: 0, measured: 0 }
    );
    return {
      total: list.length,
      avgImpressions: totals.measured ? Math.round(totals.impressions / totals.measured) : 0,
      avgEngagements: totals.measured ? Math.round(totals.engagements / totals.measured) : 0,
    };
  }, [tweets.data]);

  async function refreshMetrics() {
    const ids = (tweets.data ?? []).map((t) => t.id);
    if (ids.length === 0) return;
    await xApi.refreshMetrics(ids);
    queryClient.invalidateQueries({ queryKey: ["x-tweets"] });
  }

  if (integrations.isLoading) {
    return <PageShell loading />;
  }

  if (!isConnected) {
    return (
      <PageShell>
        <EmptyState
          icon={MessageCircle}
          title="Connect X (Twitter) to get started"
          description="Once connected, you can publish tweets, track engagement, and manage your mentions inbox from here."
          action={{ label: "Connect X", href: "/dashboard/integrations" }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard title="Tweets shown" value={stats?.total} loading={tweets.isLoading} />
        <KpiCard
          title="Avg impressions"
          value={stats ? compact(stats.avgImpressions) : undefined}
          loading={tweets.isLoading}
        />
        <KpiCard
          title="Avg engagements"
          value={stats ? compact(stats.avgEngagements) : undefined}
          subtitle="likes + replies + retweets + quotes"
          loading={tweets.isLoading}
        />
      </div>

      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose" className="gap-1.5">
            <Send className="size-4" /> Compose
          </TabsTrigger>
          <TabsTrigger value="recent" className="gap-1.5">
            <MessageSquare className="size-4" /> Recent
          </TabsTrigger>
          <TabsTrigger value="mentions" className="gap-1.5">
            <Inbox className="size-4" /> Mentions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-4">
          <Card>
            <CardContent className="p-5">
              <TweetComposer />
            </CardContent>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            Text-only for now — media upload, threads, and scheduling are coming.
          </p>
        </TabsContent>

        <TabsContent value="recent" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Last {RECENT_TWEET_COUNT} tweets from your account.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshMetrics}
              disabled={tweets.isLoading || (tweets.data ?? []).length === 0}
            >
              <RefreshCw className="size-3.5 mr-1.5" />
              Refresh metrics
            </Button>
          </div>

          {tweets.isLoading ? (
            <RecentSkeleton />
          ) : tweets.isError ? (
            <p className="text-sm text-destructive">
              Couldn&apos;t load tweets. Try refreshing.
            </p>
          ) : (tweets.data ?? []).length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No tweets yet"
              description="Publish your first tweet from the Compose tab and it'll appear here."
            />
          ) : (
            <div className="space-y-3">
              {(tweets.data ?? []).map((t: XTweet) => (
                <TweetCard key={t.id} tweet={t} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mentions" className="mt-4">
          <Card>
            <CardContent className="p-8 text-center space-y-2">
              <Inbox className="size-8 text-muted-foreground mx-auto" />
              <h3 className="font-semibold">Mentions inbox is warming up</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                The mentions sync runs every 10 minutes. Replies, quotes and
                @-mentions will appear here once they&apos;re ingested.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function PageShell({ children, loading }: { children?: React.ReactNode; loading?: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">X (Twitter)</h2>
        <p className="text-muted-foreground">
          Publish tweets, track engagement, and manage your mentions inbox.
        </p>
      </div>
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  loading,
}: {
  title: string;
  value?: string | number;
  subtitle?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{value ?? "—"}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RecentSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
