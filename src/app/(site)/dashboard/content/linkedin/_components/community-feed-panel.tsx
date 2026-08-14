"use client";

/**
 * The Community Feed — one queue for everything that happened to the brand.
 *
 * ★WHY A QUEUE AND NOT MORE NUMBERS ON EACH POST. The engagement itself
 * already lives under every post in Library. What was missing is the
 * question a person actually opens the dashboard to answer: is anyone
 * waiting on us? Spreading that across fifty post cards means it can only
 * be answered by reading all fifty. One reverse-chronological list makes
 * the dashboard simpler while showing considerably more.
 *
 * ★And it is CHEAP. Every row arrived over the webhook and is read from
 * our own database, so this costs no LinkedIn budget and can be polled and
 * left open. The thread panel is where on-demand API calls happen.
 */

import { useEffect, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  MessageSquare,
  AtSign,
  Repeat2,
  Clock,
  CornerDownRight,
  BellOff,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  linkedInContentApi,
  type LinkedInAuthor,
  type LinkedInFeedCounts,
  type LinkedInInteraction,
} from "@/lib/api/linkedin-content";
import { ApiError } from "@/lib/api";
import { useLocale } from "@/hooks/use-locale";
import { RetentionFootnote } from "./retention-footnote";

const FILTERS = [
  { key: "needs_reply", label: "Needs reply" },
  { key: "new", label: "New" },
  { key: "mentions", label: "Mentions" },
  { key: "reposts", label: "Reposts" },
  { key: "all", label: "All" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const COMMENT_MAX_LEN = 1250;

export function CommunityFeedPanel({ author }: { author: LinkedInAuthor | null }) {
  const [filter, setFilter] = useState<FilterKey>("needs_reply");

  const query = useInfiniteQuery({
    queryKey: ["linkedin-interactions", filter],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      linkedInContentApi.interactions({
        filter,
        ...(pageParam ? { cursor: pageParam } : {}),
        limit: 25,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: (count, err) => !(err instanceof ApiError && err.status === 403) && count < 2,
  });

  const rows = query.data?.pages.flatMap((p) => p.rows) ?? [];
  const counts = query.data?.pages[0]?.counts;

  if (query.isLoading) return <FeedSkeleton />;
  if (query.isError) {
    return (
      <EmptyBody
        title="Couldn't load your community activity"
        body={
          query.error instanceof ApiError
            ? query.error.message
            : "Please try again in a moment."
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <FeedHeader counts={counts} />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            type="button"
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            className="h-7 px-2.5 text-xs"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {countFor(f.key, counts) !== null && (
              <span className="ml-1.5 tabular-nums opacity-70">
                {countFor(f.key, counts)}
              </span>
            )}
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyBody
          title={filter === "needs_reply" ? "Nothing waiting on you" : "Nothing here yet"}
          body={
            filter === "needs_reply"
              ? "Every comment on your posts has been answered."
              : "Comments, mentions and reposts of your Page will land here."
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <InteractionRow row={row} author={author} filter={filter} />
            </li>
          ))}
        </ul>
      )}

      {query.hasNextPage && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-full gap-1.5 text-xs"
          disabled={query.isFetchingNextPage}
          aria-busy={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage && (
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
          )}
          Load more
        </Button>
      )}

      <RetentionFootnote>
        LinkedIn lets us keep a comment&apos;s text for 48 hours. After that the
        item stays here — along with whether you replied — but the words are
        gone.
      </RetentionFootnote>
    </div>
  );
}

/**
 * The one number worth leading on.
 *
 * ★"Oldest unanswered: 14h" beats "5 need a reply". A count says how much
 * work there is; a duration says whether anyone is being let down, which
 * is the thing a business actually needs to know and the thing no other
 * dashboard tells them.
 */
function FeedHeader({ counts }: { counts?: LinkedInFeedCounts }) {
  if (!counts) return null;
  const waiting = counts.oldestUnansweredMs;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs">
      {waiting === null ? (
        <span className="text-muted-foreground">Nothing is waiting on a reply.</span>
      ) : (
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="text-muted-foreground">Oldest unanswered</span>
          <span className="font-medium tabular-nums">{formatDuration(waiting)}</span>
        </span>
      )}
      <span className="ml-auto text-muted-foreground tabular-nums">
        {counts.needsReply} awaiting reply
      </span>
    </div>
  );
}

function InteractionRow({
  row,
  author,
  filter,
}: {
  row: LinkedInInteraction;
  author: LinkedInAuthor | null;
  filter: FilterKey;
}) {
  const { formatRelativeTime } = useLocale();
  const qc = useQueryClient();
  const [replying, setReplying] = useState(false);

  // Marked seen when the row renders, not when it is clicked. The badge
  // asks "has anyone here looked at this", and it is on screen — but this
  // is deliberately NOT a status change, so it can never empty the reply
  // queue by scrolling.
  useEffect(() => {
    if (row.seenAt) return;
    const t = setTimeout(() => {
      linkedInContentApi.markInteractionsSeen([row.interactionUrn]).catch(() => {
        // A missed "seen" costs a badge, not data. Failing loudly here
        // would put an error toast on a page the user is only scrolling.
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [row.interactionUrn, row.seenAt]);

  const snooze = useMutation({
    mutationFn: () =>
      linkedInContentApi.updateInteraction(row.interactionUrn, {
        snoozedUntil: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      }),
    onSuccess: () => {
      toast.success("Snoozed for a day");
      void qc.invalidateQueries({ queryKey: ["linkedin-interactions"] });
    },
    onError: () => toast.error("Couldn't snooze that. Please try again."),
  });

  const canReply = author !== null && row.kind === "comment" && !row.redacted;

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <KindBadge kind={row.kind} />
          <StatusBadges row={row} />
          <span className="ml-auto text-xs text-muted-foreground">
            {formatRelativeTime(row.occurredAt ?? row.receivedAt)}
          </span>
        </div>

        {row.redacted ? (
          // The row survives its content on purpose: what we DID about it
          // is ours to keep, and is exactly what the response-time metrics
          // are built on. Saying so is better than showing a blank.
          <p className="text-sm italic text-muted-foreground">
            The text of this {row.kind} is no longer available — LinkedIn only
            lets us keep it for 48 hours.
          </p>
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed line-clamp-4">
            {row.text || <span className="text-muted-foreground">(no text)</span>}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1">
          <a
            href={`https://www.linkedin.com/feed/update/${row.parentPostUrn}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            View post <ExternalLink className="size-3" />
          </a>

          {canReply && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setReplying((v) => !v)}
            >
              <CornerDownRight className="size-3.5" /> Reply
            </Button>
          )}

          {filter === "needs_reply" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              disabled={snooze.isPending}
              aria-busy={snooze.isPending}
              onClick={() => snooze.mutate()}
            >
              {snooze.isPending ? (
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
              ) : (
                <BellOff className="size-3.5" />
              )}
              Snooze a day
            </Button>
          )}
        </div>

        {replying && author && (
          <ReplyBox
            postUrn={row.parentPostUrn}
            parentCommentUrn={row.interactionUrn}
            author={author}
            onClose={() => setReplying(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ReplyBox({
  postUrn,
  parentCommentUrn,
  author,
  onClose,
}: {
  postUrn: string;
  parentCommentUrn: string;
  author: LinkedInAuthor;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const send = useMutation({
    mutationFn: () =>
      linkedInContentApi.createComment(postUrn, {
        text: text.trim(),
        author,
        parentCommentUrn,
      }),
    onSuccess: () => {
      toast.success("Reply posted");
      onClose();
      // The server marks the interaction replied as part of the same
      // call, so refetching is what moves it out of the queue.
      void qc.invalidateQueries({ queryKey: ["linkedin-interactions"] });
    },
    onError: (err) =>
      toast.error(
        err instanceof ApiError ? err.message : "Couldn't post that reply.",
      ),
  });

  return (
    <div className="space-y-1.5 border-t pt-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX_LEN))}
        placeholder="Write a reply…"
        rows={2}
        className="text-sm"
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={!text.trim() || send.isPending}
          aria-busy={send.isPending}
          onClick={() => send.mutate()}
        >
          {send.isPending && (
            <Loader2 className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none" />
          )}
          Reply
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onClose}
        >
          Cancel
        </Button>
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          {text.length}/{COMMENT_MAX_LEN}
        </span>
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: LinkedInInteraction["kind"] }) {
  const map = {
    comment: { icon: MessageSquare, label: "Comment" },
    mention: { icon: AtSign, label: "Mention" },
    repost: { icon: Repeat2, label: "Repost" },
    reaction: { icon: MessageSquare, label: "Reaction" },
  } as const;
  const { icon: Icon, label } = map[kind];
  return (
    <Badge variant="outline" className="gap-1 text-[10px]">
      <Icon className="size-3" /> {label}
    </Badge>
  );
}

function StatusBadges({ row }: { row: LinkedInInteraction }) {
  return (
    <>
      {!row.seenAt && (
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          New
        </Badge>
      )}
      {row.status === "needs_reply" && (
        <Badge
          variant="outline"
          className="border-warning text-[10px] uppercase tracking-wide text-warning-on-tint"
        >
          Needs reply
        </Badge>
      )}
      {row.status === "replied" && (
        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
          Replied
          {typeof row.firstResponseMs === "number" && (
            <span className="ml-1 tabular-nums opacity-70">
              in {formatDuration(row.firstResponseMs)}
            </span>
          )}
        </Badge>
      )}
      {row.snoozedUntil && new Date(row.snoozedUntil) > new Date() && (
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          Snoozed
        </Badge>
      )}
    </>
  );
}

function countFor(key: FilterKey, counts?: LinkedInFeedCounts): number | null {
  if (!counts) return null;
  if (key === "needs_reply") return counts.needsReply;
  if (key === "new") return counts.unseen;
  if (key === "mentions") return counts.mentions;
  if (key === "reposts") return counts.reposts;
  return null;
}

/** Coarse on purpose. "14h" is the answer; "13h 47m" is noise, and a
 *  duration that changes every minute reads as a timer rather than a
 *  measure of how long someone has been kept waiting. */
function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function EmptyBody({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-7 w-64" />
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardContent className="space-y-2 p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
