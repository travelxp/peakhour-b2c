"use client";

import { useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { EyeOff, Eye, MessageSquare, Trash2, Reply, ExternalLink } from "lucide-react";
import { engagementFor, type MetaComment, type MetaCommentPage } from "@/lib/api/meta-engagement";
import {
  ADMIN_ONLY,
  appendReplies,
  authorLabel,
  canDelete,
  canHide,
  commentsErrorMessage,
  countComments,
  DELETE_WARNING,
  hasUnloadedReplies,
  hiddenCount,
  hideLabel,
  loadFailure,
  patchHidden,
  postLabel,
  removeComment,
  replyBlocker,
  type MetaCommentsPlatform,
} from "@/lib/meta-comments-view";
import { canManageDesk } from "@/lib/inbox-desk";
import { navLabel } from "@/lib/nav-copy";
import { useAuth } from "@/providers/auth-provider";
import { useLocale } from "@/hooks/use-locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/molecules/empty-state";
import { cn } from "@/lib/utils";

/**
 * The comments screen for one Meta platform: an account picker, that account's recent posts on the left, the comments on the
 * chosen post on the right. Reply, Hide or Unhide, and Delete (after a confirm), for an owner or admin. Live from Meta,
 * nothing is saved here.
 *
 * Commenter names are personal data: they are drawn on screen and go nowhere else (no logging, no analytics).
 */

const INTEGRATIONS = navLabel("/dashboard/integrations");
const NONE = {
  facebook: "No Facebook Page is connected yet.",
  instagram: "No Instagram account is linked to your Pages yet.",
} as const;

export function CommentsWorkspace({ platform }: { platform: MetaCommentsPlatform }) {
  const eng = engagementFor(platform);
  const { formatDateTime } = useLocale();
  const { org, orgs } = useAuth();
  const role = orgs.find((o) => o._id === org?._id)?.role ?? null;
  const canModerate = canManageDesk(role);

  // The pick remembers which account it was made under, so it is dropped on its own when that account goes away.
  const [pick, setPick] = useState<{ ownerId: string; postId: string }>({ ownerId: "", postId: "" });

  const owners = useQuery({
    queryKey: ["meta-comments", platform, "owners"],
    queryFn: () => eng.owners(),
    staleTime: 60_000,
    retry: false,
  });
  // The first account until the merchant picks another (and the first again if the picked one is gone).
  const ownerId = owners.data?.find((o) => o.id === pick.ownerId)?.id ?? owners.data?.[0]?.id ?? "";
  const postId = pick.ownerId === ownerId ? pick.postId : "";

  const posts = useQuery({
    queryKey: ["meta-comments", platform, "posts", ownerId],
    enabled: !!ownerId,
    queryFn: () => eng.posts(ownerId),
    retry: false,
  });

  if (owners.isLoading) return <Skeleton className="h-96 w-full" />;
  if (owners.isError) {
    const f = loadFailure(owners.error, "your accounts");
    return (
      <EmptyState
        icon={MessageSquare}
        title={f.title}
        description={f.description}
        action={f.reconnect ? { label: `Open ${INTEGRATIONS}`, href: "/dashboard/integrations" } : { label: "Try again", onClick: () => void owners.refetch() }}
      />
    );
  }
  if (!owners.data?.length) {
    return (
      <EmptyState
        icon={MessageSquare}
        title={NONE[platform]}
        description={`Connect it in ${INTEGRATIONS}, then come back to answer comments.`}
        action={{ label: `Open ${INTEGRATIONS}`, href: "/dashboard/integrations" }}
      />
    );
  }

  const selected = posts.data?.find((p) => p.id === postId);
  return (
    <div className="space-y-4">
      {owners.data.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{platform === "facebook" ? "Page" : "Instagram account"}</span>
          <select
            className="h-9 rounded-md border bg-background px-3"
            value={ownerId}
            onChange={(e) => setPick({ ownerId: e.target.value, postId: "" })}
          >
            {owners.data.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {!canModerate && <p className="text-sm text-muted-foreground">{ADMIN_ONLY}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Card>
          <CardContent className="p-2">
            <h2 className="px-2 py-2 text-sm font-medium">Recent posts</h2>
            {posts.isLoading && <Skeleton className="h-48 w-full" />}
            {posts.isError && <LoadFailure error={posts.error} what="your posts" onRetry={() => void posts.refetch()} />}
            {posts.data?.length === 0 && <p className="p-2 text-sm text-muted-foreground">No posts yet.</p>}
            <ul className="space-y-1">
              {posts.data?.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setPick({ ownerId, postId: p.id })}
                    aria-current={p.id === postId}
                    className={cn("w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted", p.id === postId && "bg-muted")}
                  >
                    <span className="line-clamp-2">{postLabel(p.text, "Post")}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatDateTime(p.createdTime)}
                      {p.commentCount !== undefined && ` · ${p.commentCount} comments`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            {postId ? (
              <>
                {selected?.link && (
                  <a
                    href={selected.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
                  >
                    View on {eng.name} <ExternalLink className="size-3.5" />
                  </a>
                )}
                <Thread key={`${ownerId}:${postId}`} platform={platform} ownerId={ownerId} postId={postId} canModerate={canModerate} />
              </>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">Pick a post to see its comments.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoadFailure({ error, what, onRetry }: { error: unknown; what: string; onRetry: () => void }) {
  const f = loadFailure(error, what);
  return (
    <div className="space-y-2 p-2">
      <p className="text-sm text-muted-foreground">{f.description}</p>
      {f.reconnect ? (
        <Button size="sm" variant="outline" asChild>
          <Link href="/dashboard/integrations">Open {INTEGRATIONS}</Link>
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

type ThreadData = InfiniteData<MetaCommentPage, string | undefined>;

function Thread({
  platform,
  ownerId,
  postId,
  canModerate,
}: {
  platform: MetaCommentsPlatform;
  ownerId: string;
  postId: string;
  canModerate: boolean;
}) {
  const eng = engagementFor(platform);
  const qc = useQueryClient();
  const key = ["meta-comments", platform, "thread", ownerId, postId];
  const thread = useInfiniteQuery({
    queryKey: key,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => eng.comments(ownerId, postId, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: false,
  });
  const patch = (fn: (pages: MetaCommentPage[]) => MetaCommentPage[]) =>
    qc.setQueryData<ThreadData>(key, (d) => (d ? { ...d, pages: fn(d.pages) } : d));
  const fail = (fallback: string) => (err: unknown) => toast.error(commentsErrorMessage(err, fallback));

  const reply = useMutation({
    mutationFn: (v: { commentId: string; message: string }) => eng.reply(ownerId, postId, v.commentId, v.message),
    onSuccess: () => {
      toast.success("Reply sent.");
      // The new reply has an id and an author only Meta knows, so this one reads the thread again.
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: fail("We could not send your reply. Try again."),
  });
  const hide = useMutation({
    mutationFn: ({ commentId, hidden }: { commentId: string; hidden: boolean }) => eng.hide(ownerId, postId, commentId, hidden),
    onSuccess: (_r, v) => {
      patch((pages) => patchHidden(pages, v.commentId, v.hidden));
      toast.success(v.hidden ? "Comment hidden." : "Comment is visible again.");
    },
    onError: fail("We could not change that comment. Try again."),
  });
  const remove = useMutation({
    mutationFn: (commentId: string) => eng.remove(ownerId, postId, commentId),
    onSuccess: (_r, commentId) => {
      patch((pages) => removeComment(pages, commentId));
      toast.success("Comment deleted.");
    },
    onError: fail("We could not delete that comment. Try again."),
  });
  const moreReplies = useMutation({
    mutationFn: async (c: MetaComment) => ({ id: c.id, page: await eng.replies(ownerId, postId, c.id, c.repliesCursor!) }),
    onSuccess: ({ id, page }) => patch((pages) => appendReplies(pages, id, page.comments, page.nextCursor)),
    onError: fail("We could not load more replies. Try again."),
  });

  const [toDelete, setToDelete] = useState<MetaComment | null>(null);

  if (thread.isLoading) return <Skeleton className="h-48 w-full" />;
  if (thread.isError) return <LoadFailure error={thread.error} what="these comments" onRetry={() => void thread.refetch()} />;
  const list = thread.data?.pages.flatMap((p) => p.comments) ?? [];
  if (list.length === 0) return <p className="py-12 text-center text-sm text-muted-foreground">No comments on this post yet.</p>;

  const hidden = hiddenCount(list);
  const partial = thread.hasNextPage || hasUnloadedReplies(list);
  const busy = reply.isPending || hide.isPending || remove.isPending;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {countComments(list)} comments{hidden > 0 && ` · ${hidden} hidden`}
        {partial && " so far"}
      </p>
      <ul className="space-y-4">
        {list.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            platform={platform}
            canModerate={canModerate}
            busy={busy}
            loadingReplies={moreReplies.isPending && moreReplies.variables?.id === c.id}
            onReply={(commentId, message) => reply.mutateAsync({ commentId, message })}
            onHide={(commentId, hide_) => hide.mutate({ commentId, hidden: hide_ })}
            onDelete={setToDelete}
            onMoreReplies={(target) => moreReplies.mutate(target)}
            moreRepliesBusy={moreReplies.isPending}
          />
        ))}
      </ul>
      {thread.hasNextPage && (
        <Button variant="outline" size="sm" disabled={thread.isFetchingNextPage} onClick={() => void thread.fetchNextPage()}>
          {thread.isFetchingNextPage ? "Loading" : "Load more comments"}
        </Button>
      )}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>{DELETE_WARNING}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) remove.mutate(toDelete.id);
                setToDelete(null);
              }}
            >
              Delete comment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CommentItem({
  comment: c,
  platform,
  canModerate,
  busy,
  loadingReplies,
  moreRepliesBusy,
  onReply,
  onHide,
  onDelete,
  onMoreReplies,
  nested,
}: {
  comment: MetaComment;
  platform: MetaCommentsPlatform;
  canModerate: boolean;
  busy: boolean;
  loadingReplies: boolean;
  moreRepliesBusy: boolean;
  onReply: (commentId: string, message: string) => Promise<unknown>;
  onHide: (commentId: string, hidden: boolean) => void;
  onDelete: (c: MetaComment) => void;
  onMoreReplies: (c: MetaComment) => void;
  nested?: boolean;
}) {
  const { formatDateTime } = useLocale();
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const blocker = replyBlocker(text, platform);

  return (
    <li className={cn(nested && "ml-6 border-l pl-4")}>
      <div className={cn("space-y-1", c.isHidden && "opacity-60")}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{authorLabel(c)}</span>
          <span className="text-xs text-muted-foreground">{formatDateTime(c.createdTime)}</span>
          {c.isHidden && <Badge variant="secondary">Hidden</Badge>}
          {c.permalink && (
            <a href={c.permalink} target="_blank" rel="noreferrer" aria-label="Open on Meta" className="text-muted-foreground">
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm">{c.text}</p>
        {canModerate && (
          <div className="flex flex-wrap gap-1 pt-1">
            {!nested && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setReplying((v) => !v)}>
                <Reply className="size-4" /> Reply
              </Button>
            )}
            {canHide(c) && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onHide(c.id, !c.isHidden)}>
                {c.isHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />} {hideLabel(c)}
              </Button>
            )}
            {canDelete(c) && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDelete(c)}>
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
          </div>
        )}
      </div>
      {canModerate && replying && (
        <div className="mt-2 space-y-2">
          <Textarea aria-label="Your reply" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply" />
          {text && blocker && <p className="text-xs text-muted-foreground">{blocker}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || !!blocker}
              onClick={async () => {
                try {
                  await onReply(c.id, text.trim());
                  setText("");
                  setReplying(false);
                } catch {
                  /* the toast already says why; keep the text so nothing is lost */
                }
              }}
            >
              Send reply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {(c.replies.length > 0 || c.repliesCursor !== null) && (
        <ul className="mt-3 space-y-3">
          {c.replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              platform={platform}
              canModerate={canModerate}
              busy={busy}
              loadingReplies={false}
              moreRepliesBusy={moreRepliesBusy}
              onReply={onReply}
              onHide={onHide}
              onDelete={onDelete}
              onMoreReplies={onMoreReplies}
              nested
            />
          ))}
          {c.repliesCursor !== null && (
            <li className="ml-6 pl-4">
              <Button size="sm" variant="outline" disabled={moreRepliesBusy} onClick={() => onMoreReplies(c)}>
                {loadingReplies ? "Loading" : "Show more replies"}
              </Button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}
