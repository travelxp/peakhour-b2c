"use client";

/**
 * The thread panel — the surface that makes a comment visible.
 *
 * Until this shipped, LinkedIn Content could POST a comment it could not
 * SHOW you: the write path landed with the engager panel and the read path
 * never did. This is the read path, plus the actions that belong beside it.
 *
 * ★Everything here is fetched only when a person opens the sheet.
 * Community Management Development tier allows ~500 requests/day for the
 * whole app across every customer, so a thread is loaded on demand and
 * never prefetched for a list of posts. `enabled: open` on both queries is
 * the mechanism; do not replace it with an eager fetch.
 */

import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  MessageSquare,
  Heart,
  Trash2,
  CornerDownRight,
  Pencil,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  linkedInContentApi,
  type LinkedInActorProfile,
  type LinkedInAuthor,
  type LinkedInCommentDetail,
  type LinkedInReaction,
  type LinkedInReactionType,
} from "@/lib/api/linkedin-content";
import { ApiError } from "@/lib/api";
import { useLocale } from "@/hooks/use-locale";
import { RetentionFootnote } from "./retention-footnote";

/** Reaction types we may WRITE. `MAYBE` is deprecated by LinkedIn and 400s
 *  on create, so it is absent here even though a read can surface it. */
const REACTIONS: Array<{ type: LinkedInReactionType; emoji: string; label: string }> = [
  { type: "LIKE", emoji: "👍", label: "Like" },
  { type: "PRAISE", emoji: "🎉", label: "Celebrate" },
  { type: "EMPATHY", emoji: "❤️", label: "Love" },
  { type: "INTEREST", emoji: "💡", label: "Insightful" },
  { type: "APPRECIATION", emoji: "🙌", label: "Support" },
  { type: "ENTERTAINMENT", emoji: "😄", label: "Funny" },
];

/** Emoji for a reaction type we may not know — LinkedIn has added types
 *  before, and an unrecognised one must render as something rather than
 *  vanish from a list the user is counting. */
function reactionEmoji(type: string): string {
  return REACTIONS.find((r) => r.type === type)?.emoji ?? "•";
}

function reactionLabel(type: string): string {
  return REACTIONS.find((r) => r.type === type)?.label ?? type;
}

const COMMENT_MAX_LEN = 1250;

export function ThreadPanel({
  postUrn,
  author,
  open,
  onOpenChange,
}: {
  postUrn: string;
  /** The post's own author — who we reply and react AS. Null when we
   *  cannot resolve one, in which case the panel reads but cannot write. */
  author: LinkedInAuthor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Engagement</SheetTitle>
          <SheetDescription>
            Reply, react and moderate without leaving Peakhour.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="comments" className="mt-4 flex min-h-0 flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="comments" className="gap-1.5">
              <MessageSquare className="size-4" /> Comments
            </TabsTrigger>
            <TabsTrigger value="reactions" className="gap-1.5">
              <Heart className="size-4" /> Reactions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="mt-3 min-h-0 flex-1 overflow-y-auto">
            <CommentsTab postUrn={postUrn} author={author} open={open} />
          </TabsContent>
          <TabsContent value="reactions" className="mt-3 min-h-0 flex-1 overflow-y-auto">
            <ReactionsTab postUrn={postUrn} open={open} />
          </TabsContent>
        </Tabs>

        <RetentionFootnote>
          Comment text is held for 48 hours and commenter names for 24, per
          LinkedIn&apos;s data rules.
        </RetentionFootnote>
      </SheetContent>
    </Sheet>
  );
}

// ── Comments ──────────────────────────────────────────────

function CommentsTab({
  postUrn,
  author,
  open,
}: {
  postUrn: string;
  author: LinkedInAuthor | null;
  open: boolean;
}) {
  const query = useInfiniteQuery({
    queryKey: ["linkedin-thread", postUrn],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      linkedInContentApi.comments(postUrn, { count: 25, start: pageParam as number }),
    getNextPageParam: (last) => last.nextStart ?? undefined,
    // Loaded only while the sheet is open — see the file header on why.
    enabled: open,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => !(err instanceof ApiError && err.status === 403) && count < 2,
  });

  if (query.isLoading) return <ThreadSkeleton />;

  if (query.isError) {
    return <ErrorBody error={query.error} />;
  }

  const pages = query.data?.pages ?? [];
  const comments = pages.flatMap((p) => p.comments);
  // False means "we are not showing names", which is a different thing from
  // "nobody has a name" — worth saying rather than leaving people to guess
  // why every row says "A member".
  const identityEnabled = pages[0]?.identityEnabled ?? true;

  if (!comments.length) {
    return (
      <EmptyBody
        title="No comments yet"
        body="When someone comments on this post, it'll show up here and you can reply from Peakhour."
      />
    );
  }

  return (
    <div className="space-y-3">
      {!identityEnabled && (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Commenter names are turned off right now, so everyone shows as
          &ldquo;A member&rdquo;. Replies and reactions still work.
        </p>
      )}

      <ul className="space-y-3">
        {comments.map((comment) => (
          <li key={comment.commentUrn ?? comment.id}>
            <CommentRow comment={comment} postUrn={postUrn} author={author} />
          </li>
        ))}
      </ul>

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
          Load more comments
        </Button>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  postUrn,
  author,
  nested = false,
}: {
  comment: LinkedInCommentDetail;
  postUrn: string;
  author: LinkedInAuthor | null;
  nested?: boolean;
}) {
  const { formatRelativeTime } = useLocale();
  const qc = useQueryClient();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  // An org `agent` means a member acted on a page's behalf — i.e. this is
  // OUR comment. It is the only reliable "ours" signal on the payload, and
  // it gates edit, which LinkedIn permits only on your own comment.
  const isOurs = Boolean(comment.agent);
  // Actions that key on a comment need its composite URN. It is optional
  // because LinkedIn occasionally sends nothing to build one from — hide
  // the action rather than send a key that matches nothing.
  const canAct = Boolean(comment.commentUrn);

  const react = useMutation({
    mutationFn: (type: LinkedInReactionType) =>
      linkedInContentApi.createReaction(comment.commentUrn as string, {
        reactionType: type,
        author: author as LinkedInAuthor,
      }),
    onSuccess: () => toast.success("Reaction added"),
    onError: (err) => toast.error(engageErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () =>
      linkedInContentApi.deleteComment(
        postUrn,
        comment.commentUrn ?? comment.id,
        author ?? undefined,
      ),
    onSuccess: () => {
      toast.success("Comment deleted");
      void qc.invalidateQueries({ queryKey: ["linkedin-thread", postUrn] });
    },
    onError: (err) => toast.error(engageErrorMessage(err)),
  });

  return (
    <div className={nested ? "border-l pl-3" : ""}>
      <div className="flex gap-2.5">
        <ActorAvatar profile={comment.actorProfile} />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium">
              {comment.actorProfile?.displayName ?? "A member"}
            </span>
            {comment.actorProfile?.headline && (
              <span className="truncate text-xs text-muted-foreground">
                {comment.actorProfile.headline}
              </span>
            )}
            {isOurs && (
              <Badge variant="outline" className="text-[10px]">
                You
              </Badge>
            )}
            {comment.edited && (
              <span className="text-[10px] text-muted-foreground">edited</span>
            )}
            {comment.createdAt && (
              <span className="ml-auto text-xs text-muted-foreground">
                {formatRelativeTime(new Date(comment.createdAt).toISOString())}
              </span>
            )}
          </div>

          {editing && comment.commentUrn ? (
            <EditBox
              commentUrn={comment.commentUrn}
              postUrn={postUrn}
              initial={comment.message}
              author={author}
              onClose={() => setEditing(false)}
            />
          ) : (
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {comment.message || (
                <span className="text-muted-foreground">(image only)</span>
              )}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1">
            {comment.likeCount > 0 && (
              <span className="mr-1 text-xs tabular-nums text-muted-foreground">
                {comment.likeCount} {comment.likeCount === 1 ? "like" : "likes"}
              </span>
            )}

            {author && canAct && !nested && (
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

            {author && canAct && (
              <ReactionPicker
                pending={react.isPending}
                onPick={(type) => react.mutate(type)}
              />
            )}

            {isOurs && canAct && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => setEditing((v) => !v)}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
            )}

            {canAct && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"
                disabled={remove.isPending}
                aria-busy={remove.isPending}
                onClick={() => remove.mutate()}
              >
                {remove.isPending ? (
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Delete
              </Button>
            )}

            {comment.replyCount > 0 && !nested && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => setShowReplies((v) => !v)}
              >
                {showReplies ? "Hide" : "Show"} {comment.replyCount}{" "}
                {comment.replyCount === 1 ? "reply" : "replies"}
              </Button>
            )}
          </div>

          {replying && comment.commentUrn && author && (
            <ReplyBox
              postUrn={postUrn}
              parentCommentUrn={comment.commentUrn}
              author={author}
              onClose={() => setReplying(false)}
            />
          )}

          {showReplies && comment.commentUrn && (
            <RepliesList
              commentUrn={comment.commentUrn}
              postUrn={postUrn}
              author={author}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Replies load only when expanded — LinkedIn nests exactly one level, so
 *  this never recurses. */
function RepliesList({
  commentUrn,
  postUrn,
  author,
}: {
  commentUrn: string;
  postUrn: string;
  author: LinkedInAuthor | null;
}) {
  const query = useInfiniteQuery({
    queryKey: ["linkedin-replies", commentUrn],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      linkedInContentApi.commentReplies(commentUrn, {
        count: 25,
        start: pageParam as number,
      }),
    getNextPageParam: (last) => last.nextStart ?? undefined,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (query.isLoading) {
    return <Skeleton className="mt-2 h-12 w-full" />;
  }
  const replies = query.data?.pages.flatMap((p) => p.comments) ?? [];
  if (!replies.length) return null;

  return (
    <ul className="mt-2 space-y-3">
      {replies.map((reply) => (
        <li key={reply.commentUrn ?? reply.id}>
          <CommentRow comment={reply} postUrn={postUrn} author={author} nested />
        </li>
      ))}
    </ul>
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
      setText("");
      onClose();
      void qc.invalidateQueries({ queryKey: ["linkedin-replies", parentCommentUrn] });
      void qc.invalidateQueries({ queryKey: ["linkedin-thread", postUrn] });
    },
    onError: (err) => toast.error(engageErrorMessage(err)),
  });

  return (
    <div className="mt-2 space-y-1.5">
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

function EditBox({
  commentUrn,
  postUrn,
  initial,
  author,
  onClose,
}: {
  commentUrn: string;
  postUrn: string;
  initial: string;
  author: LinkedInAuthor | null;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      linkedInContentApi.editComment(commentUrn, {
        text: text.trim(),
        ...(author ? { author } : {}),
      }),
    onSuccess: () => {
      toast.success("Comment updated");
      onClose();
      void qc.invalidateQueries({ queryKey: ["linkedin-thread", postUrn] });
    },
    onError: (err) => toast.error(engageErrorMessage(err)),
  });

  return (
    <div className="space-y-1.5">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX_LEN))}
        rows={2}
        className="text-sm"
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={!text.trim() || text.trim() === initial || save.isPending}
          aria-busy={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending && (
            <Loader2 className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none" />
          )}
          Save
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
      </div>
    </div>
  );
}

function ReactionPicker({
  pending,
  onPick,
}: {
  pending: boolean;
  onPick: (type: LinkedInReactionType) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs"
        disabled={pending}
        aria-busy={pending}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
        ) : (
          <Heart className="size-3.5" />
        )}
        React
      </Button>
      {open && (
        <div className="absolute bottom-8 left-0 z-10 flex gap-0.5 rounded-md border bg-popover p-1 shadow-md">
          {REACTIONS.map((r) => (
            <button
              key={r.type}
              type="button"
              title={r.label}
              aria-label={r.label}
              className="rounded px-1.5 py-0.5 text-base hover:bg-accent"
              onClick={() => {
                setOpen(false);
                onPick(r.type);
              }}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reactions ─────────────────────────────────────────────

function ReactionsTab({ postUrn, open }: { postUrn: string; open: boolean }) {
  const query = useInfiniteQuery({
    queryKey: ["linkedin-reactions", postUrn],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      linkedInContentApi.reactions(postUrn, { count: 25, start: pageParam as number }),
    getNextPageParam: (last) => last.nextStart ?? undefined,
    enabled: open,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => !(err instanceof ApiError && err.status === 403) && count < 2,
  });

  if (query.isLoading) return <ThreadSkeleton />;
  if (query.isError) return <ErrorBody error={query.error} />;

  const reactions = query.data?.pages.flatMap((p) => p.reactions) ?? [];
  if (!reactions.length) {
    return (
      <EmptyBody
        title="No reactions yet"
        body="Reactions on this post will show up here, grouped by type."
      />
    );
  }

  // Grouped by type for scanning. This is the reactors we have LOADED, not
  // the post's totals — the authoritative per-type counts live on the
  // metric strip, which reads them from LinkedIn in one call.
  const groups = new Map<string, LinkedInReaction[]>();
  for (const r of reactions) {
    const list = groups.get(r.reactionType) ?? [];
    list.push(r);
    groups.set(r.reactionType, list);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Most people who only react stay anonymous — LinkedIn shares names for
        commenters, not reactors.
      </p>

      {[...groups.entries()].map(([type, list]) => (
        <div key={type} className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-base" aria-hidden>
              {reactionEmoji(type)}
            </span>
            <span className="text-xs font-medium">{reactionLabel(type)}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {list.length}
            </span>
          </div>
          <ul className="space-y-2">
            {list.map((r) => (
              <li key={r.id} className="flex items-center gap-2.5">
                <ActorAvatar profile={r.actorProfile} />
                <span className="text-sm">
                  {r.actorProfile?.displayName ?? "A member"}
                </span>
                {r.actorProfile?.vanityName && (
                  <a
                    href={`https://www.linkedin.com/in/${r.actorProfile.vanityName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="View profile on LinkedIn"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

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
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────

function ActorAvatar({ profile }: { profile?: LinkedInActorProfile }) {
  const name = profile?.displayName ?? "";
  const initials =
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "—";
  return (
    <Avatar className="size-8 shrink-0">
      {/* LinkedIn's image URLs carry their own expiry, often shorter than
          our cache — a broken image is normal, and AvatarFallback covers
          it without a retry. */}
      {profile?.pictureUrl && <AvatarImage src={profile.pictureUrl} alt="" />}
      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
    </Avatar>
  );
}

/** Map an engagement failure to something a person can act on. Never
 *  surfaces the raw provider string — it carries LinkedIn JSON and URNs.
 *
 *  ★A 403 does NOT promise a reconnect helps: an org post 403s on the
 *  pre-`_feed` grant, which reconnecting fixes, but a member-authored post
 *  403s on a permission LinkedIn grants to select developers only. The
 *  server already words this carefully; pass it through. */
function engageErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "NOT_CONNECTED") return "Reconnect LinkedIn to continue.";
    if (err.code === "CONFIRMATION_REQUIRED" || err.code === "VALIDATION_ERROR") {
      return err.message;
    }
    if (err.status === 403 || err.status === 404 || err.status === 429) {
      return err.message;
    }
  }
  return "That didn't work. Please try again.";
}

function ErrorBody({ error }: { error: unknown }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center">
      <p className="text-sm text-muted-foreground">{engageErrorMessage(error)}</p>
    </div>
  );
}

function EmptyBody({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-2.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
