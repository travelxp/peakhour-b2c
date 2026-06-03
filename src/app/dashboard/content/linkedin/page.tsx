"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/molecules/empty-state";
import { MessageSquare, Newspaper, RefreshCw, Rocket, Send, Users } from "lucide-react";
import {
  PostComposer,
  PostComposerSkeleton,
  useLinkedInIdentity,
} from "./_components/post-composer";
import { AudiencePanel } from "./_components/audience-panel";
import { BoostCandidatesPanel } from "./_components/boost-candidates-panel";
import { FeedPanel } from "./_components/feed-panel";
import { SuggestedDraftsPanel } from "./_components/suggested-drafts-panel";

interface ApiIntegration {
  provider: string;
  connected?: boolean;
  status?: string;
}

export default function LinkedInDashboardPage() {
  // Mirror the X hub's pattern — read /v1/integrations once for the
  // top-level connect gate, then defer to /linkedin/content/me for
  // the picker data. Two queries because the integrations endpoint
  // gives us the lifecycle truth that lets us render an EmptyState
  // before /me would 404.
  const integrations = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () =>
      api.get<{ integrations: ApiIntegration[] }>("/v1/integrations"),
    staleTime: 30_000,
  });

  const linkedInConnection = useMemo(
    () => integrations.data?.integrations.find((i) => i.provider === "linkedin_content"),
    [integrations.data]
  );
  // Treat `needs_reauth` as "set up, just stale" — the composer
  // renders + surfaces the in-page banner. Without this, /v1/integrations'
  // strict `connected = status === "active"` would bounce stale-scope
  // users to the EmptyState, hiding the very banner that tells them to
  // reconnect.
  const isConnected =
    linkedInConnection?.connected === true ||
    linkedInConnection?.status === "needs_reauth";

  const identity = useLinkedInIdentity();
  const enabledIdentity = isConnected ? identity : null;

  if (integrations.isLoading) {
    return <PageShell loading />;
  }

  if (!isConnected) {
    return (
      <PageShell>
        <EmptyState
          icon={MessageSquare}
          title="Connect LinkedIn to get started"
          description="Once connected, you can publish to your personal feed or any company page you administer, all from here."
          action={{ label: "Connect LinkedIn", href: "/dashboard/integrations" }}
        />
      </PageShell>
    );
  }

  // Identity errors that aren't NOT_CONNECTED — surface a Reconnect prompt.
  // (NOT_CONNECTED itself can't happen here: isConnected gated us in.)
  if (identity.isError) {
    const err = identity.error;
    const code = err instanceof ApiError ? err.code : "UNKNOWN";
    return (
      <PageShell>
        <EmptyState
          icon={RefreshCw}
          title="LinkedIn needs a quick reconnect"
          description={
            code === "NO_ACCOUNT"
              ? "We're missing your LinkedIn member identity. Reconnect to repair the integration."
              : "We couldn't read your LinkedIn identity. Reconnect to continue posting."
          }
          action={{ label: "Reconnect LinkedIn", href: "/dashboard/integrations" }}
        />
      </PageShell>
    );
  }

  const needsReauth =
    enabledIdentity?.data && enabledIdentity.data.status !== "active";

  return (
    <PageShell>
      {needsReauth && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="flex items-center justify-between gap-4 p-4 text-sm">
            <span>
              Your LinkedIn connection is{" "}
              <span className="font-medium">{enabledIdentity?.data?.status}</span>.
              Reconnect to keep publishing.
            </span>
            <a
              href="/dashboard/integrations"
              className="font-medium text-amber-900 underline underline-offset-4 dark:text-amber-200"
            >
              Reconnect
            </a>
          </CardContent>
        </Card>
      )}

      <LinkedInTabs identity={identity} enabledIdentity={enabledIdentity} />
    </PageShell>
  );
}

/**
 * Tabs shell — lifts the Tabs state into React so we can lazy-mount
 * the Audience tab. Radix's <TabsContent> eagerly mounts every child
 * (just toggles `hidden`), which would fire the engagers query on
 * every page load even for users who never open the tab. Tracking
 * "has the user ever opened Audience" in state lets us skip the
 * mount until the user actually asks for it; on subsequent switches
 * the mounted-once component handles its own visibility (and TanStack
 * Query keeps the data warm via staleTime).
 */
function LinkedInTabs({
  identity,
  enabledIdentity,
}: {
  identity: ReturnType<typeof useLinkedInIdentity>;
  enabledIdentity: ReturnType<typeof useLinkedInIdentity> | null;
}) {
  const [tab, setTab] = useState<"compose" | "feed" | "audience" | "boost">("compose");
  const [feedOpened, setFeedOpened] = useState(false);
  const [audienceOpened, setAudienceOpened] = useState(false);
  const [boostOpened, setBoostOpened] = useState(false);
  // Composer seed text — set when the user clicks "Use this draft" on
  // the Suggested Drafts panel. PostComposer accepts this as a prop and
  // seeds its internal text state when the value changes (tracked via
  // ref inside the composer so re-renders don't blow away edits).
  const [composerSeed, setComposerSeed] = useState<string | undefined>(undefined);

  function handleTabChange(value: string) {
    if (value === "compose" || value === "feed" || value === "audience" || value === "boost") {
      setTab(value);
      if (value === "feed") setFeedOpened(true);
      if (value === "audience") setAudienceOpened(true);
      if (value === "boost") setBoostOpened(true);
    }
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="compose" className="gap-1.5">
          <Send className="size-4" /> Compose
        </TabsTrigger>
        <TabsTrigger value="feed" className="gap-1.5">
          <Newspaper className="size-4" /> Feed
        </TabsTrigger>
        <TabsTrigger value="audience" className="gap-1.5">
          <Users className="size-4" /> Audience
        </TabsTrigger>
        <TabsTrigger value="boost" className="gap-1.5">
          <Rocket className="size-4" /> Boost
        </TabsTrigger>
      </TabsList>

      <TabsContent value="compose" className="mt-4 space-y-4">
        <SuggestedDraftsPanel onUseDraft={setComposerSeed} />
        <Card>
          <CardContent className="p-5">
            {identity.isLoading || !enabledIdentity?.data ? (
              <PostComposerSkeleton />
            ) : (
              <PostComposer
                identity={enabledIdentity.data}
                seedText={composerSeed}
              />
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          Compose with AI, schedule for later, or publish now. Carousels and media are coming.
        </p>
      </TabsContent>

      <TabsContent value="feed" className="mt-4">
        {feedOpened ? <FeedPanel /> : null}
      </TabsContent>

      <TabsContent value="audience" className="mt-4">
        {audienceOpened ? <AudiencePanel /> : null}
        <p className="mt-3 text-xs text-muted-foreground">
          We rank commenters on your LinkedIn posts by frequency, recency, and reactions. Names and titles will appear once profile enrichment lands.
        </p>
      </TabsContent>

      <TabsContent value="boost" className="mt-4">
        {boostOpened ? <BoostCandidatesPanel /> : null}
        <p className="mt-3 text-xs text-muted-foreground">
          We rank your recent posts by boost-worthiness — velocity, audience quality, hook strength, and freshness. Autonomous ad-spend ships in a follow-up; today this is a recommendation surface.
        </p>
      </TabsContent>
    </Tabs>
  );
}

function PageShell({ children, loading }: { children?: React.ReactNode; loading?: boolean }) {
  const queryClient = useQueryClient();
  return (
    <div className="space-y-6">
      {/* jobs-runner is required AFTER linkedin-post-sync on dev: the sync cron
          ENQUEUES a linkedin_post_sync job (it doesn't drain inline), so click
          linkedin-post-sync first, then jobs-runner to actually run it and
          populate posts + KPIs. */}
      <CronToolbar
        crons={["linkedin-post-sync", "jobs-runner", "performance-sync", "linkedin-retention-cleanup"]}
        onTriggered={() => {
          queryClient.invalidateQueries({ queryKey: ["content-hub-integrations"] });
          queryClient.invalidateQueries({ queryKey: ["linkedin-me"] });
          // The post-sync + retention crons write the very data these
          // panels render — without invalidating them, a sync completes
          // but the Boost / Audience tabs keep serving their cached
          // (often empty) result, so nothing visibly changes. Both panels
          // also set refetchOnMount:false, so invalidation is the only
          // thing that refreshes them after a manual trigger.
          queryClient.invalidateQueries({ queryKey: ["linkedin-boost-candidates"] });
          queryClient.invalidateQueries({ queryKey: ["linkedin-engagers"] });
          // post-sync writes the feed rows too — refresh the Feed tab.
          queryClient.invalidateQueries({ queryKey: ["linkedin-feed"] });
        }}
      />
      <div>
        <h2 className="text-2xl font-bold tracking-tight">LinkedIn</h2>
        <p className="text-muted-foreground">
          Publish to your personal feed or any company page you administer.
        </p>
      </div>
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}
