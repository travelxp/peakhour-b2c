"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, MessageSquare, RefreshCw, Share2, Unplug } from "lucide-react";
import { EmptyState } from "@/components/molecules/empty-state";
import { Button } from "@/components/ui/button";
import { NewPostButton } from "@/components/compose/new-post-button";
import { DraftThisPostButton } from "@/components/compose/draft-this-post-button";
import { WhatChangedCard } from "@/components/content/what-changed-card";
import dynamic from "next/dynamic";

// Its own chunk, like the compose sheet: the Repurpose sheet and its writers' price hooks are not part of the hub's first-load JS
// (the hub's bundle budget allows 10% growth). It stays mounted (closed) so a failed posts refetch cannot unmount it mid-flow.
const RepurposeSheet = dynamic(() => import("@/components/repurpose/repurpose-sheet").then((mod) => mod.RepurposeSheet));
import type { RepurposeSource } from "@/lib/api/repurpose";
import { ComposeSheetProvider } from "@/components/compose/compose-sheet-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeltaChip } from "@/components/viz/delta-chip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api";
import { reconnectHref } from "@/lib/integrations-connect";
import { useLocale } from "@/hooks/use-locale";
import { navLabel } from "@/lib/nav-copy";
import {
  metaContentApi,
  type MetaInstagramListed,
  type MetaInstagramMedia,
  type MetaPage,
  type MetaPagePost,
} from "@/lib/api/meta-content";
import {
  activeFirst,
  countRecentPosts,
  formatFigure,
  hubState,
  instagramOverviewTiles,
  mediaInsightTiles,
  mediaThumbnail,
  mediaTypeLabel,
  metaInsightActions,
  parseGraphTime,
  pageOverviewTiles,
  postExcerpt,
  postInsightTiles,
  previousPeriodPhrase,
  previousWindow,
  tileChange,
  windowFor,
  type InsightDays,
  type MetaInsightLine,
  type Tile,
} from "@/lib/meta-content-view";

/** The sidebar's current name for /dashboard/integrations (the retired-names test refuses the old one). */
const CONNECTED_ACCOUNTS = navLabel("/dashboard/integrations");

interface Subject {
  id: string;
  label: string;
  /** The Page (or Instagram account) the publisher posts to: the saved one, else the first. */
  saved: boolean;
}

/** Marks the one the publisher posts to: the saved Page (or account) while it is still listed, else the first. */
function markSaved(list: { id: string; label: string }[], activeId: string | null | undefined): Subject[] {
  const savedId = list.find((x) => x.id === activeId)?.id ?? list[0]?.id;
  return list.map((x) => ({ ...x, saved: x.id === savedId }));
}

/** When the Page on screen is not the one posts go to, the New post buttons say so instead of pretending. */
interface PostTarget {
  saved: Subject;
  selected: Subject;
}

export type MetaHubChannel = "facebook" | "instagram";

const COPY = {
  facebook: {
    name: "Facebook",
    path: "/dashboard/content/facebook",
    provider: "facebook_pages",
    connectTitle: "Connect Facebook to see your Page",
    connectBody: "Once connected, you can see how your Page is doing and everything posted on it.",
    postsHelp: "Your latest 25 posts, newest first, including posts made outside Peakhour.",
  },
  instagram: {
    name: "Instagram",
    path: "/dashboard/content/instagram",
    provider: "instagram",
    connectTitle: "Connect Instagram to see your account",
    connectBody: "Once connected, you can see how your account is doing and everything posted on it.",
    postsHelp: "Your latest 25 posts, newest first, including posts made outside Peakhour.",
  },
} as const;

/** The body of the Facebook and Instagram hubs. The route's page owns the shell and the h1. */
export function MetaHub({ channel }: { channel: MetaHubChannel }) {
  return (
    <ComposeSheetProvider>
      <MetaHubBody channel={channel} />
    </ComposeSheetProvider>
  );
}

function MetaHubBody({ channel }: { channel: MetaHubChannel }) {
  const copy = COPY[channel];
  const reconnect = reconnectHref(copy.path, copy.provider);

  // ONE query per hub. Facebook reads the Pages (the `pages` capability); Instagram reads the linked
  // accounts in a single call (the `instagram` capability), so an org with Instagram on and Pages off
  // still works and there is no per-Page fan-out.
  const subjectsQ = useQuery({
    queryKey: ["meta-content", channel, "subjects"],
    // ★The saved Page (or its Instagram account) comes first, so the hub opens on the one the merchant
    // picked in Connected accounts and shows a change there as soon as the query is invalidated.
    queryFn: async (): Promise<Subject[]> => {
      if (channel === "facebook") {
        const r = await metaContentApi.pages();
        return markSaved(activeFirst(r.pages.map((p: MetaPage) => ({ id: p.id, label: p.name })), r.activePageId), r.activePageId);
      }
      const r = await metaContentApi.instagramAccounts();
      return markSaved(
        activeFirst(
          r.accounts.map((a: MetaInstagramListed) => ({ id: a.id, label: a.username ? `@${a.username}` : (a.name ?? a.id) })),
          r.activeAccountId,
        ),
        r.activeAccountId,
      );
    },
    staleTime: 60_000,
    retry: false,
  });
  const subjects = subjectsQ.data ?? [];

  const state = hubState({
    loading: subjectsQ.isLoading,
    error: subjectsQ.error instanceof ApiError ? subjectsQ.error : subjectsQ.error ? {} : null,
    count: subjects.length,
  });

  const [chosen, setChosen] = useState<string | null>(null);
  // Held here so the choice survives a trip to the Posts tab.
  const [days, setDays] = useState<InsightDays>(28);

  if (state === "loading") return <Skeleton className="h-64 w-full" />;

  if (state === "not_connected") {
    return (
      <EmptyState
        icon={Unplug}
        title={copy.connectTitle}
        description={copy.connectBody}
        action={{ label: `Connect ${copy.name}`, href: reconnect }}
      />
    );
  }
  if (state === "needs_reauth" || state === "needs_permission") {
    return (
      <EmptyState
        icon={RefreshCw}
        title={`${copy.name} needs a quick reconnect`}
        description={
          state === "needs_reauth"
            ? `Your ${copy.name} connection has expired. Reconnect to continue.`
            : `We do not have permission to read your ${copy.name} ${channel === "facebook" ? "Page" : "account"}. Reconnect and allow access to continue.`
        }
        action={{ label: `Reconnect ${copy.name}`, href: reconnect }}
      />
    );
  }
  if (state === "capability_off") {
    return (
      <EmptyState
        icon={Unplug}
        title={`${copy.name} is switched off`}
        description={`${channel === "facebook" ? "Pages" : "Instagram"} is turned off for your connection. Turn it on in ${CONNECTED_ACCOUNTS} to see your data here.`}
        action={{ label: `Open ${CONNECTED_ACCOUNTS}`, href: "/dashboard/integrations" }}
      />
    );
  }
  if (state === "error") {
    return (
      <EmptyState
        icon={RefreshCw}
        title={`We could not reach ${copy.name}`}
        description="Something went wrong on our side or theirs. Try again in a moment."
        action={{ label: "Try again", onClick: () => void subjectsQ.refetch() }}
      />
    );
  }
  if (state === "empty") {
    return channel === "facebook" ? (
      <EmptyState
        icon={Unplug}
        title="No Facebook Pages found"
        description="Your Facebook login does not manage any Pages. Reconnect and choose the Pages you want Peakhour to see."
        action={{ label: "Reconnect", href: reconnect }}
      />
    ) : (
      <EmptyState
        icon={Unplug}
        title="No Instagram account linked"
        description="Link an Instagram professional account to one of your Facebook Pages, then reconnect to see it here."
        action={{ label: "Reconnect", href: reconnect }}
      />
    );
  }

  // Ready. One selectable subject: a Page, or an Instagram account.
  const subject = subjects.find((x) => x.id === chosen) ?? subjects[0]!;
  const savedSubject = subjects.find((x) => x.saved) ?? subjects[0]!;
  const postTarget: PostTarget | null = savedSubject.id === subject.id ? null : { saved: savedSubject, selected: subject };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {subjects.length > 1 ? (
          <Select value={subject.id} onValueChange={setChosen}>
            <SelectTrigger className="w-64" aria-label={channel === "facebook" ? "Page" : "Instagram account"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm font-medium">{subject.label}</span>
        )}
        <div className="flex items-center gap-2">
          <NewPostButton channel={channel} disabled={postTarget !== null} />
          <Button asChild variant="outline" size="sm">
            <Link href={`${copy.path}/comments`}>
              <MessageSquare className="size-4" /> Comments
            </Link>
          </Button>
        </div>
      </div>

      {postTarget ? <PostTargetNote channel={channel} target={postTarget} /> : null}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <Overview channel={channel} subjectId={subject.id} days={days} onDays={setDays} />
        </TabsContent>
        <TabsContent value="posts" className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">{copy.postsHelp}</p>
          <Posts channel={channel} subjectId={subject.id} postTarget={postTarget} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TileGrid({ tiles, previous, days = 28 }: { tiles: Tile[]; previous?: Tile[]; days?: InsightDays }) {
  const prevByKey = new Map((previous ?? []).map((t) => [t.key, t.value]));
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t) => {
        const change = previous ? tileChange(t.key, t.value, prevByKey.get(t.key) ?? null) : null;
        return (
          <Card key={t.key}>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">{t.label}</div>
              {t.value === null ? (
                <div className="mt-1 text-sm font-medium text-muted-foreground">Not available</div>
              ) : (
                <div className="mt-1 text-2xl font-semibold tabular-nums">{formatFigure(t.value)}</div>
              )}
              {change ? (
                <DeltaChip
                  className="mt-1"
                  delta={change}
                  label={t.label}
                  vs={`vs previous ${days} days`}
                  comparedWith={previousPeriodPhrase(days)}
                />
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">{t.value === null ? t.reason : t.help}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const GROUP_TITLE: Record<MetaInsightLine["group"], string> = {
  improving: "Improving",
  declining: "Declining",
  attention: "Needs attention",
};

function WhatChanged({ lines, channel }: { lines: MetaInsightLine[]; channel: MetaHubChannel }) {
  if (lines.length === 0) return null;
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <h3 className="text-sm font-semibold">What changed</h3>
        <ul className="space-y-1.5">
          {lines.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{GROUP_TITLE[l.group]}: </span>
                {l.text}
              </span>
              <DraftThisPostButton channel={channel} brief={l.draft} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ErrorLine({ error, what, reconnect }: { error: unknown; what: string; reconnect: string }) {
  const code = error instanceof ApiError ? error.code : "";
  if (code === "NEEDS_REAUTH") {
    return (
      <p className="text-sm text-muted-foreground">
        Your connection has expired.{" "}
        <a href={reconnect} className="font-medium underline underline-offset-4">
          Reconnect
        </a>
      </p>
    );
  }
  const msg =
    code === "CAPABILITY_DISABLED"
      ? `This is switched off for your connection. Turn it on in ${CONNECTED_ACCOUNTS}.`
      : error instanceof ApiError && error.status === 403
        ? `We do not have permission to read ${what}. Reconnect to allow it.`
      : `We could not load ${what} right now.`;
  return <p className="text-sm text-muted-foreground">{msg}</p>;
}

function fetchTiles(channel: MetaHubChannel, subjectId: string, w: { since: string; until: string }): Promise<Tile[]> {
  return channel === "facebook"
    ? metaContentApi.pageInsights(subjectId, w).then((r) => pageOverviewTiles(r.insights))
    : metaContentApi.igInsights(subjectId, w).then((r) => instagramOverviewTiles(r.insights));
}

function Overview({
  channel,
  subjectId,
  days,
  onDays,
}: {
  channel: MetaHubChannel;
  subjectId: string;
  days: InsightDays;
  onDays: (d: InsightDays) => void;
}) {
  const w = windowFor(days);
  const pw = previousWindow(w);
  const q = useQuery({
    queryKey: ["meta-content", channel, "insights", subjectId, w.since, w.until],
    queryFn: () => fetchTiles(channel, subjectId, w),
    staleTime: 5 * 60_000,
    retry: false,
  });
  // A failed comparison leaves the tiles as they were, with no chips.
  const prevQ = useQuery({
    queryKey: ["meta-content", channel, "insights", subjectId, pw.since, pw.until],
    queryFn: () => fetchTiles(channel, subjectId, pw),
    enabled: q.isSuccess,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const postsQ = usePosts(channel, subjectId);
  const lines =
    q.data
      ? metaInsightActions({
          channel,
          days,
          current: q.data,
          previous: prevQ.data,
          recentPosts: postsQ.data ? countRecentPosts(postsQ.data.map((r) => r.date)) : null,
        })
      : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2" role="group" aria-label="Time range">
        {([7, 28] as const).map((d) => (
          <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => onDays(d)}>
            Last {d} days
          </Button>
        ))}
      </div>
      {q.isLoading ? <Skeleton className="h-40 w-full" /> : q.isError ? <ErrorLine error={q.error} what="these figures" reconnect={reconnectHref(COPY[channel].path, COPY[channel].provider)} /> : <><WhatChanged lines={lines} channel={channel} /><WhatChangedCard channel={channel} /><TileGrid tiles={q.data!} previous={prevQ.data} days={days} /></>}
    </div>
  );
}

interface Row {
  id: string;
  text: string | undefined;
  date: string;
  permalink: string | undefined;
  image: string | undefined;
  badge?: string;
}

const fbRow = (p: MetaPagePost): Row => ({ id: p.id, text: p.message, date: p.createdTime, permalink: p.permalink, image: p.fullPicture });
const igRow = (m: MetaInstagramMedia): Row => ({
  id: m.id,
  text: m.caption,
  date: m.timestamp,
  permalink: m.permalink,
  image: mediaThumbnail(m),
  badge: mediaTypeLabel(m.mediaType),
});

/** Shared by the Posts tab and the overview's "what changed" lines, so one request serves both. */
function usePosts(channel: MetaHubChannel, subjectId: string) {
  return useQuery({
    queryKey: ["meta-content", channel, "posts", subjectId],
    queryFn: () =>
      channel === "facebook"
        ? metaContentApi.pagePosts(subjectId).then((r) => r.posts.map(fbRow))
        : metaContentApi.igMedia(subjectId).then((r) => r.media.map(igRow)),
    staleTime: 60_000,
    retry: false,
  });
}

function PostTargetNote({ channel, target }: { channel: MetaHubChannel; target: PostTarget }) {
  const noun = channel === "facebook" ? "Page" : "account";
  return (
    <p className="text-xs text-muted-foreground">
      New posts go to {target.saved.label}. To post as {target.selected.label}, make it your {noun} under{" "}
      <Link href="/dashboard/integrations" className="font-medium underline underline-offset-4">
        {CONNECTED_ACCOUNTS}
      </Link>
      .
    </p>
  );
}

function Posts({ channel, subjectId, postTarget }: { channel: MetaHubChannel; subjectId: string; postTarget: PostTarget | null }) {
  // The post being turned into posts for other channels. Held in state so the object the sheet reads stays the same while it is open
  // (the sheet re-asks the recommender whenever its source changes). The sheet is rendered HERE, outside the list's loading and error
  // branches, so a refetch of the posts cannot unmount it mid-flow (while it is writing, or showing what was written).
  const [repurposeSource, setRepurposeSource] = useState<RepurposeSource | null>(null);
  const [repurposeOpen, setRepurposeOpen] = useState(false);
  return (
    <>
      <PostsList
        channel={channel}
        subjectId={subjectId}
        postTarget={postTarget}
        onRepurpose={(source) => {
          setRepurposeSource(source);
          setRepurposeOpen(true);
        }}
      />
      <RepurposeSheet open={repurposeOpen} onOpenChange={setRepurposeOpen} source={repurposeSource} />
    </>
  );
}

function PostsList({
  channel,
  subjectId,
  postTarget,
  onRepurpose,
}: {
  channel: MetaHubChannel;
  subjectId: string;
  postTarget: PostTarget | null;
  onRepurpose: (source: RepurposeSource) => void;
}) {
  const { formatDate } = useLocale();
  const q = usePosts(channel, subjectId);
  const [open, setOpen] = useState<string | null>(null);

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.isError) return <ErrorLine error={q.error} what="your posts" reconnect={reconnectHref(COPY[channel].path, COPY[channel].provider)} />;
  const rows = q.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No posts yet"
        description={`Posts made on ${COPY[channel].name}, including ones from Peakhour, show up here.`}
        className="min-h-0 py-12"
      >
        <div className="mt-6">
          <NewPostButton channel={channel} label="Create a post" disabled={postTarget !== null} />
        </div>
      </EmptyState>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        // A picture with no words has nothing to write from; the api refuses it too, before any price is shown.
        const hasText = !!r.text?.trim();
        return (
        <li key={r.id}>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex gap-3">
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Meta CDN thumbnails, signed URLs
                  <img src={r.image} alt="" className="size-16 shrink-0 rounded-md object-cover" loading="lazy" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{postExcerpt(r.text)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.badge ? `${r.badge} · ` : ""}
                    {formatDate(parseGraphTime(r.date), { dateStyle: "medium" })}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                  {open === r.id ? "Hide results" : "See results"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!hasText}
                  title={hasText ? undefined : "This post has no text to write from."}
                  onClick={() =>
                    onRepurpose(
                      channel === "facebook"
                        ? { type: "facebook_post", postId: r.id }
                        : { type: "instagram_media", mediaId: r.id, igUserId: subjectId },
                    )
                  }
                >
                  <Share2 className="size-3.5" /> Turn into posts for other channels
                </Button>
                {r.permalink ? (
                  <Button asChild size="sm" variant="ghost">
                    <a href={r.permalink} target="_blank" rel="noopener noreferrer">
                      View on {COPY[channel].name} <ExternalLink className="size-3.5" />
                    </a>
                  </Button>
                ) : null}
              </div>
              {open === r.id ? <PostResults channel={channel} id={r.id} igUserId={subjectId} /> : null}
            </CardContent>
          </Card>
        </li>
        );
      })}
    </ul>
  );
}

/** Mounted only when a post is opened, so a list of 25 posts costs no insight calls. */
function PostResults({ channel, id, igUserId }: { channel: MetaHubChannel; id: string; igUserId: string }) {
  const q = useQuery({
    queryKey: ["meta-content", channel, "post-insights", id],
    queryFn: () =>
      channel === "facebook"
        ? metaContentApi.postInsights(id).then((r) => postInsightTiles(r.insights))
        : metaContentApi.mediaInsights(id, igUserId).then((r) => mediaInsightTiles(r.insights)),
    staleTime: 5 * 60_000,
    retry: false,
  });
  if (q.isLoading) return <Skeleton className="h-24 w-full" />;
  if (q.isError) return <ErrorLine error={q.error} what="this post's results" reconnect={reconnectHref(COPY[channel].path, COPY[channel].provider)} />;
  return <TileGrid tiles={q.data!} />;
}
