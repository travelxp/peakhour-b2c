"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, MessageSquare, RefreshCw, Unplug } from "lucide-react";
import { EmptyState } from "@/components/molecules/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  formatFigure,
  hubState,
  instagramOverviewTiles,
  mediaInsightTiles,
  mediaThumbnail,
  mediaTypeLabel,
  parseGraphTime,
  pageOverviewTiles,
  postExcerpt,
  postInsightTiles,
  windowFor,
  type InsightDays,
  type Tile,
} from "@/lib/meta-content-view";

/** The sidebar's current name for /dashboard/integrations (the retired-names test refuses the old one). */
const CONNECTED_ACCOUNTS = navLabel("/dashboard/integrations");

interface Subject {
  id: string;
  label: string;
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
        return activeFirst(r.pages.map((p: MetaPage) => ({ id: p.id, label: p.name })), r.activePageId);
      }
      const r = await metaContentApi.instagramAccounts();
      return activeFirst(
        r.accounts.map((a: MetaInstagramListed) => ({ id: a.id, label: a.username ? `@${a.username}` : (a.name ?? a.id) })),
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
        <Button asChild variant="outline" size="sm">
          <Link href={`${copy.path}/comments`}>
            <MessageSquare className="size-4" /> Comments
          </Link>
        </Button>
      </div>

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
          <Posts channel={channel} subjectId={subject.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t) => (
        <Card key={t.key}>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{t.label}</div>
            {t.value === null ? (
              <div className="mt-1 text-sm font-medium text-muted-foreground">Not available</div>
            ) : (
              <div className="mt-1 text-2xl font-semibold tabular-nums">{formatFigure(t.value)}</div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{t.value === null ? t.reason : t.help}</p>
          </CardContent>
        </Card>
      ))}
    </div>
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
  const q = useQuery({
    queryKey: ["meta-content", channel, "insights", subjectId, w.since, w.until],
    queryFn: () =>
      channel === "facebook"
        ? metaContentApi.pageInsights(subjectId, w).then((r) => pageOverviewTiles(r.insights))
        : metaContentApi.igInsights(subjectId, w).then((r) => instagramOverviewTiles(r.insights)),
    staleTime: 5 * 60_000,
    retry: false,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2" role="group" aria-label="Time range">
        {([7, 28] as const).map((d) => (
          <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => onDays(d)}>
            Last {d} days
          </Button>
        ))}
      </div>
      {q.isLoading ? <Skeleton className="h-40 w-full" /> : q.isError ? <ErrorLine error={q.error} what="these figures" reconnect={reconnectHref(COPY[channel].path, COPY[channel].provider)} /> : <TileGrid tiles={q.data!} />}
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

function Posts({ channel, subjectId }: { channel: MetaHubChannel; subjectId: string }) {
  const { formatDate } = useLocale();
  const q = useQuery({
    queryKey: ["meta-content", channel, "posts", subjectId],
    queryFn: () =>
      channel === "facebook"
        ? metaContentApi.pagePosts(subjectId).then((r) => r.posts.map(fbRow))
        : metaContentApi.igMedia(subjectId).then((r) => r.media.map(igRow)),
    staleTime: 60_000,
    retry: false,
  });
  const [open, setOpen] = useState<string | null>(null);

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.isError) return <ErrorLine error={q.error} what="your posts" reconnect={reconnectHref(COPY[channel].path, COPY[channel].provider)} />;
  const rows = q.data ?? [];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No posts yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
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
      ))}
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
