"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Clock, Plus, RefreshCw, Unplug, Video } from "lucide-react";
import { EmptyState } from "@/components/molecules/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TikTokStatusList } from "@/components/tiktok/tiktok-status-list";
import { ApiError } from "@/lib/api";
import type { TikTokCreatorInfo } from "@/lib/api/tiktok-content";
import { reconnectHref } from "@/lib/integrations-connect";
import { useTikTokAvailable, useTikTokCreatorInfo, useTikTokItems } from "@/hooks/use-tiktok-content";
import { TIKTOK_PATH, TIKTOK_PROVIDER, tiktokAccountState, tiktokStatusView } from "@/lib/tiktok-content-view";
import type { ScheduledItemDto } from "@/lib/scheduler/types";

// Lazy: both sheets draw only after a click, and the route stays small.
const TikTokPostSheet = dynamic(() => import("@/components/tiktok/tiktok-post-sheet").then((m) => m.TikTokPostSheet), { ssr: false });
const TikTokNewPostSheet = dynamic(() => import("@/components/tiktok/tiktok-new-post-sheet").then((m) => m.TikTokNewPostSheet), { ssr: false });

/** The body of the TikTok page. The route's page owns the shell and the h1. Shown only for an org whose `tiktok` row is available. */
export function TikTokHub() {
  const { available, loading, error, refetch } = useTikTokAvailable();
  if (loading) return <Skeleton className="h-64 w-full" />;
  // A list that failed to load says nothing about whether TikTok is open: never answer it with "coming soon".
  if (error) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="We could not check TikTok"
        description="Something went wrong on our side. Nothing has changed. Try again in a moment."
        action={{ label: "Try again", onClick: refetch }}
      />
    );
  }
  if (!available) {
    return (
      <EmptyState
        icon={Clock}
        title="TikTok is coming soon"
        description="You will be able to prepare and post to TikTok from here once it opens for your account."
      />
    );
  }
  return <TikTokHubBody />;
}

function TikTokHubBody() {
  const reconnect = reconnectHref(TIKTOK_PATH, TIKTOK_PROVIDER);
  const creator = useTikTokCreatorInfo();
  const state = tiktokAccountState(creator.error instanceof ApiError ? creator.error : creator.error ? {} : null);

  if (creator.isLoading) return <Skeleton className="h-64 w-full" />;
  if (state === "not_connected") {
    return (
      <EmptyState
        icon={Unplug}
        title="Connect TikTok to get started"
        description="Once connected, you can prepare videos and photo posts here."
        action={{ label: "Connect TikTok", href: reconnect }}
      />
    );
  }
  if (state === "needs_reauth") {
    return (
      <EmptyState
        icon={RefreshCw}
        title="TikTok needs a quick reconnect"
        description="Your TikTok connection has expired. Reconnect to continue."
        action={{ label: "Reconnect TikTok", href: reconnect }}
      />
    );
  }
  if (state === "unavailable" || state === "error" || !creator.data) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="We could not reach TikTok"
        description="Something went wrong on our side or theirs. Try again in a moment."
        action={{ label: "Try again", onClick: () => void creator.refetch() }}
      />
    );
  }
  return <Ready creator={creator.data} />;
}

function Ready({ creator }: { creator: TikTokCreatorInfo }) {
  const params = useSearchParams();
  const [composing, setComposing] = useState(false);
  const [posting, setPosting] = useState<ScheduledItemDto | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const items = useTikTokItems(true);
  const wanted = params.get("post");
  const compose = params.get("compose") === "1";

  // The links into this page (?post=<id>, ?compose=1) are followed each time they CHANGE, so a second link while the page is open works too.
  // State follows the link during render (React's pattern for state that follows props), once per distinct value.
  const [handledPost, setHandledPost] = useState<string | null>(null);
  const [handledCompose, setHandledCompose] = useState(false);
  if (compose !== handledCompose) {
    setHandledCompose(compose);
    if (compose) setComposing(true);
  }
  if (wanted !== handledPost) {
    if (wanted === null) {
      setHandledPost(null);
      setHighlight(null);
    } else if (items.data) {
      setHandledPost(wanted);
      const target = items.data.items.find((i) => i._id === wanted);
      if (target) {
        // An item with something to do opens its sheet; one that is only waiting is scrolled to and outlined.
        if (tiktokStatusView(target).action !== null) setPosting(target);
        else setHighlight(target._id);
      }
    }
  }

  const list = items.data?.items ?? [];
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          {creator.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- TikTok CDN avatar, signed URL
            <img src={creator.avatarUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold" aria-hidden>
              {(creator.nickname ?? "T").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{creator.nickname ?? "Your TikTok account"}</p>
            <p className="text-sm text-muted-foreground">Connected TikTok account</p>
          </div>
          <Button type="button" size="sm" className="gap-1.5" onClick={() => setComposing(true)}>
            <Plus className="size-3.5" /> New TikTok post
          </Button>
        </CardContent>
      </Card>

      <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground" data-testid="tiktok-notice">
        Posting to TikTok opens once TikTok approves Peakhour. Until then, posts you choose to post are saved and wait for that approval.
      </p>

      <section aria-label="Your TikTok posts" className="space-y-3">
        <h2 className="text-sm font-semibold">Your TikTok posts</h2>
        {items.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : items.isError ? (
          <p className="text-sm text-muted-foreground">
            We could not load your TikTok posts.{" "}
            <button type="button" className="font-medium underline underline-offset-4" onClick={() => void items.refetch()}>
              Try again
            </button>
          </p>
        ) : list.length === 0 ? (
          <EmptyState icon={Video} title="No TikTok posts yet" description="Write a caption, add a video or photos, and approve it. It will show here.">
            <div className="mt-6">
              <Button type="button" size="sm" onClick={() => setComposing(true)}>
                New TikTok post
              </Button>
            </div>
          </EmptyState>
        ) : (
          <TikTokStatusList items={list} onPost={setPosting} highlightId={highlight} />
        )}
      </section>

      {composing ? <TikTokNewPostSheet open onOpenChange={setComposing} /> : null}
      <TikTokPostSheet item={posting} onOpenChange={(o) => !o && setPosting(null)} />
    </div>
  );
}
