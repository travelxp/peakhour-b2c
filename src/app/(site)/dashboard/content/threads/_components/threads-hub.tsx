"use client";

import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Unplug } from "lucide-react";
import { EmptyState } from "@/components/molecules/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { reconnectHref } from "@/lib/integrations-connect";
import { useLocale } from "@/hooks/use-locale";
import { threadsApi, type ThreadsPost, type ThreadsProfile } from "@/lib/api/threads";
import { postExcerpt, parseGraphTime } from "@/lib/meta-content-view";
import { threadsHubState, threadsThumbnail, threadsTypeLabel, threadsViewHref } from "@/lib/threads-view";

const PATH = "/dashboard/content/threads";
const PROVIDER = "threads";
/** The calendar's "Compose new" sheet; Threads is one of the channels it offers. */
const COMPOSE_HREF = "/dashboard/calendar?compose=1";

/** The body of the Threads hub. The route's page owns the shell and the h1. */
export function ThreadsHub() {
  const reconnect = reconnectHref(PATH, PROVIDER);
  const profileQ = useQuery({
    queryKey: ["threads", "profile"],
    queryFn: async () => (await threadsApi.profile()).profile,
    staleTime: 60_000,
    retry: false,
  });

  const state = threadsHubState({
    loading: profileQ.isLoading,
    error: profileQ.error instanceof ApiError ? profileQ.error : profileQ.error ? {} : null,
  });

  if (state === "loading") return <Skeleton className="h-64 w-full" />;
  if (state === "not_connected") {
    return (
      <EmptyState
        icon={Unplug}
        title="Connect Threads to see your profile"
        description="Once connected, you can see your profile and everything posted on it."
        action={{ label: "Connect Threads", href: reconnect }}
      />
    );
  }
  if (state === "needs_reauth" || state === "needs_permission") {
    return (
      <EmptyState
        icon={RefreshCw}
        title="Threads needs a quick reconnect"
        description={
          state === "needs_reauth"
            ? "Your Threads connection has expired. Reconnect to continue."
            : "We do not have permission to read your Threads profile. Reconnect and allow access to continue."
        }
        action={{ label: "Reconnect Threads", href: reconnect }}
      />
    );
  }
  if (state === "error") {
    return (
      <EmptyState
        icon={RefreshCw}
        title="We could not reach Threads"
        description="Something went wrong on our side or theirs. Try again in a moment."
        action={{ label: "Try again", onClick: () => void profileQ.refetch() }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ProfileCard profile={profileQ.data!} />
      <Posts reconnect={reconnect} />
    </div>
  );
}

export function ProfileCard({ profile }: { profile: ThreadsProfile }) {
  const handle = profile.username ? `@${profile.username}` : null;
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        {profile.pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Threads CDN picture, signed URL
          <img src={profile.pictureUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold" aria-hidden>
            {(profile.name ?? profile.username ?? "T").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{profile.name ?? handle ?? "Your Threads profile"}</p>
          {handle && profile.name ? <p className="truncate text-sm text-muted-foreground">{handle}</p> : null}
        </div>
        {profile.profileUrl ? (
          <Button asChild size="sm" variant="outline">
            <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer">
              View on Threads <ExternalLink className="size-3.5" />
            </a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Posts({ reconnect }: { reconnect: string }) {
  const { formatDate } = useLocale();
  const q = useInfiniteQuery({
    queryKey: ["threads", "posts"],
    queryFn: ({ pageParam }) => threadsApi.posts(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 60_000,
    retry: false,
  });

  if (q.isLoading) return <Skeleton className="h-48 w-full" />;
  if (q.isError) {
    const reauth = q.error instanceof ApiError && q.error.code === "NEEDS_REAUTH";
    return (
      <p className="text-sm text-muted-foreground">
        {reauth ? "Your connection has expired. " : "We could not load your posts right now. "}
        {reauth ? (
          <a href={reconnect} className="font-medium underline underline-offset-4">
            Reconnect
          </a>
        ) : (
          <button type="button" className="font-medium underline underline-offset-4" onClick={() => void q.refetch()}>
            Try again
          </button>
        )}
      </p>
    );
  }

  const posts: ThreadsPost[] = q.data?.pages.flatMap((p) => p.posts) ?? [];
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Unplug}
        title="No posts yet"
        description="Posts made on Threads, including ones from Peakhour, show up here."
        action={{ label: "Compose a post", href: COMPOSE_HREF }}
      />
    );
  }

  return (
    <section aria-label="Posts" className="space-y-3">
      <p className="text-xs text-muted-foreground">Your latest posts, newest first, including posts made outside Peakhour.</p>
      <ul className="space-y-3">
        {posts.map((p) => {
          const image = threadsThumbnail(p);
          const href = threadsViewHref(p);
          const label = threadsTypeLabel(p.mediaType);
          return (
            <li key={p.id}>
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex gap-3">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Threads CDN image, signed URL
                      <img src={image} alt="" className="size-16 shrink-0 rounded-md object-cover" loading="lazy" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{postExcerpt(p.text, 280)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {label ? `${label} · ` : ""}
                        {formatDate(parseGraphTime(p.timestamp), { dateStyle: "medium" })}
                      </p>
                    </div>
                  </div>
                  {href ? (
                    <Button asChild size="sm" variant="ghost">
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        View on Threads <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
      {q.hasNextPage ? (
        <Button variant="outline" size="sm" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
          {q.isFetchingNextPage ? "Loading..." : "Show more"}
        </Button>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Want to post something new?{" "}
        <Link href={COMPOSE_HREF} className="font-medium underline underline-offset-4">
          Compose a post
        </Link>
      </p>
    </section>
  );
}
