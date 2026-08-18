"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { OAuthConnectResult } from "@/components/integrations/oauth-connect-result";
import { reconnectHref, LINKEDIN_CONTENT_PROVIDER } from "@/lib/integrations-connect";
import { invalidateLinkedInContentQueries } from "@/lib/linkedin-cache";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/molecules/empty-state";
import {
  CalendarClock,
  MessageSquare,
  Newspaper,
  RefreshCw,
  Rocket,
  Users,
} from "lucide-react";
import {
  PostComposer,
  PostComposerSkeleton,
  useLinkedInIdentity,
} from "./_components/post-composer";
import { AudiencePanel } from "./_components/audience-panel";
import { BoostCandidatesPanel } from "./_components/boost-candidates-panel";
import { LibraryPanel } from "./_components/library-panel";
import { CommunityFeedPanel } from "./_components/community-feed-panel";
import type {
  LinkedInAuthor,
  LinkedInIdentity,
} from "@/lib/api/linkedin-content";
import { SuggestedDraftsPanel } from "./_components/suggested-drafts-panel";
import { ScheduledPanel } from "./_components/scheduled-panel";
import { PageSwitcher } from "./_components/page-switcher";

/**
 * Who the Feed replies AS.
 *
 * A Feed row spans every Page a business administers, so unlike the
 * thread panel — which knows the post it belongs to — there is no
 * per-row author to infer. Defaults to the first enabled Company Page,
 * falling back to the member.
 *
 * ★A known simplification, and worth stating: replying to a comment on
 * the SECOND Page currently replies as the first. The server rejects an
 * author the business has not enabled, so this cannot post as a Page
 * nobody authorised — but it can post as the wrong one. The fix is to
 * carry the post's author on each interaction row, which needs the
 * ingest to record it; until then the thread panel in Library is the
 * correct surface for a multi-Page business.
 */
function feedAuthor(identity?: LinkedInIdentity): LinkedInAuthor | null {
  const page = identity?.pages?.[0];
  if (page) return { type: "org", pageId: page.id };
  return identity ? { type: "person" } : null;
}

/** Reconnect round trips come back to this hub, not to Settings. */
const RECONNECT_HREF = reconnectHref("/dashboard/content/linkedin", LINKEDIN_CONTENT_PROVIDER);

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
    return <LinkedInPageShell loading />;
  }

  if (!isConnected) {
    return (
      <LinkedInPageShell>
        <EmptyState
          icon={MessageSquare}
          title="Connect LinkedIn to get started"
          description="Once connected, you can publish to your personal feed or any company page you administer, all from here."
          action={{ label: "Connect LinkedIn", href: RECONNECT_HREF }}
        />
      </LinkedInPageShell>
    );
  }

  // Identity errors that aren't NOT_CONNECTED — surface a Reconnect prompt.
  // (NOT_CONNECTED itself can't happen here: isConnected gated us in.)
  if (identity.isError) {
    const err = identity.error;
    const code = err instanceof ApiError ? err.code : "UNKNOWN";
    return (
      <LinkedInPageShell identity={identity.data}>
        <EmptyState
          icon={RefreshCw}
          title="LinkedIn needs a quick reconnect"
          description={
            code === "NO_ACCOUNT"
              ? "We're missing your LinkedIn member identity. Reconnect to repair the integration."
              : "We couldn't read your LinkedIn identity. Reconnect to continue posting."
          }
          action={{ label: "Reconnect LinkedIn", href: RECONNECT_HREF }}
        />
      </LinkedInPageShell>
    );
  }

  const needsReauth =
    enabledIdentity?.data && enabledIdentity.data.status !== "active";

  return (
    <LinkedInPageShell identity={enabledIdentity?.data}>
      {needsReauth && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-center justify-between gap-4 p-4 text-sm">
            <span>
              Your LinkedIn connection is{" "}
              <span className="font-medium">{enabledIdentity?.data?.status}</span>.
              Reconnect to keep publishing.
            </span>
            <a
              href={RECONNECT_HREF}
              className="font-medium text-warning-on-tint underline underline-offset-4"
            >
              Reconnect
            </a>
          </CardContent>
        </Card>
      )}

      <LinkedInTabs identity={identity} enabledIdentity={enabledIdentity} />
    </LinkedInPageShell>
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
  // ★Library · Scheduled · Feed · Audience · Boost is the settled shape.
  // Library holds drafting AND the published archive — you write the next post
  // from how the last one did, and splitting those across tabs meant navigating
  // in order to learn. Scheduled sits between them because it is the same
  // timeline's middle: written, not yet out. It was previously only reachable as
  // chips on /dashboard/calendar's month grid, which answers "when" but not
  // "what is queued, and can I change it".
  const [tab, setTab] = useState<
    "library" | "scheduled" | "feed" | "audience" | "boost"
  >("library");
  const [scheduledOpened, setScheduledOpened] = useState(false);
  const [feedOpened, setFeedOpened] = useState(false);
  const [audienceOpened, setAudienceOpened] = useState(false);
  const [boostOpened, setBoostOpened] = useState(false);
  // Composer seed text — set when the user clicks "Use this draft" on
  // the Suggested Drafts panel. PostComposer accepts this as a prop and
  // seeds its internal text state when the value changes (tracked via
  // ref inside the composer so re-renders don't blow away edits).
  const [composerSeed, setComposerSeed] = useState<string | undefined>(undefined);

  function handleTabChange(value: string) {
    if (
      value === "library" ||
      value === "scheduled" ||
      value === "feed" ||
      value === "audience" ||
      value === "boost"
    ) {
      setTab(value);
      if (value === "scheduled") setScheduledOpened(true);
      if (value === "feed") setFeedOpened(true);
      // Radix TabsContent mounts eagerly, so each non-default tab stays
      // gated on having been opened once. A tab that skips this fires its
      // query on every page load — which, against a ~500-requests/day
      // app-wide LinkedIn budget, is not a style preference.
      if (value === "audience") setAudienceOpened(true);
      if (value === "boost") setBoostOpened(true);
    }
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="library" className="gap-1.5">
          <Newspaper className="size-4" /> Library
        </TabsTrigger>
        <TabsTrigger value="scheduled" className="gap-1.5">
          <CalendarClock className="size-4" /> Scheduled
        </TabsTrigger>
        <TabsTrigger value="feed" className="gap-1.5">
          <MessageSquare className="size-4" /> Feed
        </TabsTrigger>
        <TabsTrigger value="audience" className="gap-1.5">
          <Users className="size-4" /> Audience
        </TabsTrigger>
        <TabsTrigger value="boost" className="gap-1.5">
          <Rocket className="size-4" /> Boost
        </TabsTrigger>
      </TabsList>

      <TabsContent value="library" className="mt-4 space-y-4">
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
          Compose with AI, schedule for later, publish now, or turn a longer write-up into a swipeable carousel. Image attachments are coming.
        </p>

        {/* The published archive sits directly under the composer, because
            what you write next is informed by how the last one landed and
            that only works if both are on one screen. Mounted with the tab
            rather than gated: it reads from Mongo (the post-sync cron's
            output), so it costs no LinkedIn budget. The per-post threads
            are the on-demand part. */}
        <LibraryPanel />
      </TabsContent>

      <TabsContent value="scheduled" className="mt-4">
        {/* Lazy-mounted like every other non-default tab. This one reads Mongo
            (scd_scheduled_items), so it costs no LinkedIn budget — but it still
            costs a round trip on a page nobody may open. */}
        {scheduledOpened ? <ScheduledPanel /> : null}
        <p className="mt-3 text-xs text-muted-foreground">
          Everything written but not yet published, soonest first. Open a post to
          rewrite it, swap its media, move it, publish it early, or call it off.
          Published posts move to Library.
        </p>
      </TabsContent>

      <TabsContent value="feed" className="mt-4">
        {/* Lazy-mounted like every other non-default tab. This one reads
            Mongo rather than LinkedIn so it costs no API budget — but it
            still costs a round trip on a page nobody may open. */}
        {feedOpened ? (
          <CommunityFeedPanel author={feedAuthor(enabledIdentity?.data)} />
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">
          Comments, mentions and reposts across your Pages, newest first. Replies
          you send here post straight to LinkedIn.
        </p>
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

/**
 * Page-local wrapper: cron toolbar + rhythm + loading state. Named for this
 * route specifically because it is NOT the shared layout primitive — that is
 * <PageShell> in @/components/dashboard/page-shell, which owns measure. This
 * was called `PageShell` too until the shared one landed and the collision
 * became a trap for anyone importing the real thing here.
 */
function LinkedInPageShell({
  children,
  loading,
  identity,
}: {
  children?: React.ReactNode;
  loading?: boolean;
  /** Passed so the switcher renders in the header on EVERY branch of this page,
   *  including the reconnect prompts. A control that vanished whenever the
   *  connection was unhealthy would hide the one thing that says which brand
   *  the screen is about. */
  identity?: LinkedInIdentity;
}) {
  const queryClient = useQueryClient();
  return (
    <div className="space-y-6">
      {/* Confirms a reconnect that started here (the Boost dialog's CTAs pass
          ?returnTo=/dashboard/content/linkedin) — in the shell so every branch
          of this page, including the empty states, announces it. */}
      <OAuthConnectResult />
      {/* jobs-runner is required AFTER linkedin-post-sync on dev: the sync cron
          ENQUEUES a linkedin_post_sync job (it doesn't drain inline), so click
          linkedin-post-sync first, then jobs-runner to actually run it and
          populate posts + KPIs. */}
      {/* ★`linkedin-subscription-reconcile` is the only way a LinkedIn
          subscription gets CREATED on dev — its seed phase arms connections
          that have none, and Vercel Cron fires only on production. Without
          it the Feed tab is permanently empty here, and empty is exactly
          what a quiet week looks like. */}
      <CronToolbar
        crons={[
          "linkedin-post-sync",
          "jobs-runner",
          "performance-sync",
          "linkedin-subscription-reconcile",
          // ★Must be pressed BEFORE retention-cleanup, always. The rollup
          // is what turns 48-hour member activity into the year-retainable
          // daily numbers the Audience tab reads; the cleanup is what
          // deletes the source. Run them the other way round on dev and
          // those days are gone for good.
          "linkedin-community-rollup",
          "linkedin-retention-cleanup",
        ]}
        // These crons write the very data every panel here renders — without
        // invalidating, a sync completes and the Boost / Audience / Feed tabs
        // keep serving their cached (often empty) result, so nothing visibly
        // changes. The panels also set refetchOnMount:false, which makes
        // invalidation the ONLY thing that refreshes them after a trigger.
        //
        // The key list is shared with the Integrations page's Page toggle (see
        // lib/linkedin-cache.ts) because both need every key and the failure
        // mode of missing one is invisible: the panel that forgot renders old
        // data, which looks exactly like a quiet week.
        onTriggered={() => invalidateLinkedInContentQueries(queryClient)}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {/* h1: this was the page's only heading and it was an h2, so the
              route had no page title in the document outline at all. */}
          <h1 className="text-2xl font-semibold tracking-tight">LinkedIn</h1>
          <p className="text-muted-foreground">
            Publish to your personal feed or any company page you administer.
          </p>
        </div>
        {/* ★In the HEADER, not in a tab. This governs every tab below it and
            the Growth pillar besides; a control sitting inside one tab would
            read as belonging to that tab alone. */}
        <PageSwitcher identity={identity} />
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
