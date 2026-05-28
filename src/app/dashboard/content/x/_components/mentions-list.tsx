"use client";

import { useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Quote,
  BarChart3,
  ExternalLink,
  Check,
  Inbox,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/molecules/empty-state";
import { formatDate } from "@/lib/locale";
import { xApi, type XMention, type MentionsFilter } from "@/lib/api/x";
import { ApiError } from "@/lib/api";
import { ReplyDrawer } from "./reply-drawer";

const PAGE_SIZE = 20;

/**
 * X mentions inbox (Phase 1 M-1). Loads soc_social_mentions for the
 * caller's business via /v1/x/content/mentions, with cursor-paged
 * infinite scroll and one-click mark-as-read.
 *
 * AttentionBell unread count (M-3) is a sibling consumer of the same
 * endpoint with filter=unread + limit=1; mutating readAt here triggers
 * the AttentionBell's react-query invalidation via the shared query key
 * prefix `x-mentions`.
 */
export function MentionsList() {
  const [filter, setFilter] = useState<MentionsFilter>("all");
  const [replyTarget, setReplyTarget] = useState<XMention | null>(null);
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["x-mentions", filter],
    queryFn: ({ pageParam }) =>
      xApi.listMentions({
        filter,
        limit: PAGE_SIZE,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => xApi.markMentionRead(id),
    onMutate: async (id) => {
      // Optimistic: stamp readAt on the current filter's cache only.
      // Scoping the write (and the rollback) to one query key prevents
      // a race where the user switches filter mid-mutation and the
      // rollback restores only one of two patched caches, leaving the
      // other stale. onSettled's invalidate covers the OTHER filter's
      // cache lazily — next time the user switches, it refetches.
      const queryKey = ["x-mentions", filter] as const;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const data = old as {
          pages: Array<{ mentions: XMention[]; nextCursor: string | null }>;
          pageParams: unknown[];
        };
        return {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            mentions: p.mentions.map((m) =>
              m.id === id
                ? { ...m, readAt: m.readAt ?? new Date().toISOString() }
                : m
            ),
          })),
        };
      });
      return { previous, queryKey };
    },
    onError: (err: unknown, _id, ctx) => {
      if (ctx?.previous && ctx?.queryKey) {
        queryClient.setQueryData(ctx.queryKey, ctx.previous);
      }
      const message =
        err instanceof ApiError ? err.message : "Couldn't mark as read.";
      toast.error(message);
    },
    onSettled: () => {
      // Re-fetch in the background so the other filter's cache (not
      // optimistically patched) gets the new readAt on next view, plus
      // any server-side state (e.g. urgency badges added by M-4) syncs.
      queryClient.invalidateQueries({ queryKey: ["x-mentions"] });
    },
  });

  if (query.isLoading) return <MentionsSkeleton />;

  if (query.isError) {
    const message =
      query.error instanceof ApiError
        ? query.error.message
        : "Couldn't load mentions.";
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-destructive">
          {message}
        </CardContent>
      </Card>
    );
  }

  const allMentions = query.data?.pages.flatMap((p) => p.mentions) ?? [];

  // Note: no inline unread-count badge here — the count would only
  // reflect mentions LOADED so far (page 1 = 20 items), so on a busy
  // inbox the badge would mislead ("3 unread" when there are really
  // 50+). M-3 will surface an authoritative server-side unread count
  // in the AttentionBell.

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v as MentionsFilter)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="unread">Unread</ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          Cron syncs every 10 min
        </p>
      </div>

      {allMentions.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            filter === "unread"
              ? "No unread mentions"
              : "No mentions yet"
          }
          description={
            filter === "unread"
              ? "You're all caught up. New mentions will appear here as they arrive."
              : "Replies, quotes and @-mentions will appear here once X has them indexed."
          }
        />
      ) : (
        <div className="space-y-3">
          {allMentions.map((m) => (
            <MentionCard
              key={m.id}
              mention={m}
              onMarkRead={() => markRead.mutate(m.id)}
              markPending={markRead.isPending && markRead.variables === m.id}
              onReply={() => setReplyTarget(m)}
            />
          ))}
          {query.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}

      <ReplyDrawer
        mention={replyTarget}
        open={replyTarget !== null}
        onOpenChange={(o) => {
          if (!o) setReplyTarget(null);
        }}
      />
    </div>
  );
}

function MentionCard({
  mention,
  onMarkRead,
  markPending,
  onReply,
}: {
  mention: XMention;
  onMarkRead: () => void;
  markPending: boolean;
  onReply: () => void;
}) {
  const m = mention.metrics;
  const isUnread = !mention.readAt;
  const handle = mention.author.handle ?? mention.author.id;
  const displayName = mention.author.name ?? handle;

  return (
    <Card className={isUnread ? "border-primary/40 bg-primary/5" : undefined}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-1">
              <span className="font-medium text-foreground">{displayName}</span>
              {mention.author.handle && (
                <span>@{mention.author.handle}</span>
              )}
              <span>·</span>
              <span>{formatDate(mention.mentionedAt, null)}</span>
              {isUnread && (
                <Badge variant="default" className="text-xs h-4 px-1.5">
                  New
                </Badge>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {mention.text || (
                <span className="italic text-muted-foreground">
                  (media-only mention)
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Button
              variant="default"
              size="sm"
              className="h-7 px-2 gap-1 text-xs"
              onClick={onReply}
            >
              <Sparkles className="size-3.5" />
              Suggest reply
            </Button>
            {mention.url && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                asChild
                aria-label="Open on X"
              >
                <a href={mention.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            )}
            {isUnread && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1 text-xs"
                onClick={onMarkRead}
                disabled={markPending}
              >
                <Check className="size-3.5" />
                Mark read
              </Button>
            )}
          </div>
        </div>

        {m && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Metric icon={Heart} label="Likes" value={m.likes} />
            <Metric icon={MessageCircle} label="Replies" value={m.replies} />
            <Metric icon={Repeat2} label="Reposts" value={m.reposts} />
            <Metric icon={Quote} label="Quotes" value={m.quotes} />
            <Metric icon={BarChart3} label="Impressions" value={m.impressions} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1" title={`${label}: ${value}`}>
      <Icon className="size-3.5" />
      <span className="tabular-nums">{compact(value)}</span>
    </span>
  );
}

function MentionsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
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
