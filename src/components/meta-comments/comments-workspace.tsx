"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EyeOff, Eye, MessageSquare, Trash2, Reply, ExternalLink } from "lucide-react";
import { metaEngagementApi, type MetaComment } from "@/lib/api/meta-engagement";
import {
  authorLabel,
  canDelete,
  canHide,
  commentsErrorMessage,
  countComments,
  DELETE_WARNING,
  hiddenCount,
  hideLabel,
  postLabel,
  replyBlocker,
  type MetaCommentsPlatform,
} from "@/lib/meta-comments-view";
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
import { navLabel } from "@/lib/nav-copy";

const INTEGRATIONS = navLabel("/dashboard/integrations");

/**
 * The comments screen for one Meta platform: an account picker, that account's recent posts on the left, the comments on the
 * chosen post on the right. Reply, Hide or Unhide, and Delete (after a confirm). Live from Meta, nothing is saved here.
 *
 * Commenter names are personal data: they are drawn on screen and go nowhere else (no logging, no analytics).
 */

interface Owner {
  id: string;
  label: string;
}
interface PostRow {
  id: string;
  title: string;
  when: string;
  commentCount?: number;
  link?: string;
}

const COPY = {
  facebook: { noun: "Post", owner: "Page", none: "No Facebook Page is connected yet." },
  instagram: { noun: "Post", owner: "Instagram account", none: "No Instagram account is linked to your Pages yet." },
} as const;

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

export function CommentsWorkspace({ platform }: { platform: MetaCommentsPlatform }) {
  const copy = COPY[platform];
  const [pickedOwner, setOwnerId] = useState<string>("");
  const [postId, setPostId] = useState<string>("");

  const owners = useQuery({
    queryKey: ["meta-comments", platform, "owners"],
    queryFn: async (): Promise<Owner[]> =>
      platform === "facebook"
        ? (await metaEngagementApi.facebookPages()).pages.map((p) => ({ id: p.id, label: p.name }))
        : (await metaEngagementApi.instagramAccounts()).accounts.map((a) => ({
            id: a.id,
            label: a.username ? `@${a.username}` : (a.name ?? a.pageName),
          })),
    staleTime: 60_000,
    retry: false,
  });

  // The first account until the merchant picks another.
  const ownerId = pickedOwner || owners.data?.[0]?.id || "";

  const posts = useQuery({
    queryKey: ["meta-comments", platform, "posts", ownerId],
    enabled: !!ownerId,
    queryFn: async (): Promise<PostRow[]> =>
      platform === "facebook"
        ? (await metaEngagementApi.facebookPosts(ownerId)).posts.map((p) => ({
            id: p.id,
            title: postLabel(p.message, copy.noun),
            when: when(p.createdTime),
            link: p.permalink,
          }))
        : (await metaEngagementApi.instagramMedia(ownerId)).media.map((m) => ({
            id: m.id,
            title: postLabel(m.caption, copy.noun),
            when: when(m.timestamp),
            commentCount: m.commentsCount,
            link: m.permalink,
          })),
  });

  if (owners.isLoading) return <Skeleton className="h-96 w-full" />;
  if (owners.isError) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Comments are not available yet"
        description={commentsErrorMessage(owners.error, "We could not load your accounts. Try again in a moment.")}
        action={{ label: `Open ${INTEGRATIONS}`, href: "/dashboard/integrations" }}
      />
    );
  }
  if (!owners.data?.length) {
    return (
      <EmptyState
        icon={MessageSquare}
        title={copy.none}
        description={`Connect it in ${INTEGRATIONS}, then come back to answer comments.`}
        action={{ label: `Open ${INTEGRATIONS}`, href: "/dashboard/integrations" }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {owners.data.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{copy.owner}</span>
          <select
            className="h-9 rounded-md border bg-background px-3"
            value={ownerId}
            onChange={(e) => {
              setOwnerId(e.target.value);
              setPostId("");
            }}
          >
            {owners.data.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Card>
          <CardContent className="p-2">
            <h2 className="px-2 py-2 text-sm font-medium">Recent posts</h2>
            {posts.isLoading && <Skeleton className="h-48 w-full" />}
            {posts.isError && (
              <p className="p-2 text-sm text-muted-foreground">
                {commentsErrorMessage(posts.error, "We could not load your posts. Try again in a moment.")}
              </p>
            )}
            {posts.data?.length === 0 && <p className="p-2 text-sm text-muted-foreground">No posts yet.</p>}
            <ul className="space-y-1">
              {posts.data?.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setPostId(p.id)}
                    aria-current={p.id === postId}
                    className={cn(
                      "w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
                      p.id === postId && "bg-muted",
                    )}
                  >
                    <span className="line-clamp-2">{p.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {p.when}
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
              <Thread key={postId} platform={platform} ownerId={ownerId} postId={postId} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">Pick a post to see its comments.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Thread({ platform, ownerId, postId }: { platform: MetaCommentsPlatform; ownerId: string; postId: string }) {
  const qc = useQueryClient();
  const key = ["meta-comments", platform, "thread", ownerId, postId];
  const thread = useQuery({
    queryKey: key,
    queryFn: () =>
      platform === "facebook"
        ? metaEngagementApi.facebookComments(ownerId, postId)
        : metaEngagementApi.instagramComments(ownerId, postId),
    retry: false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const fail = (fallback: string) => (err: unknown) => toast.error(commentsErrorMessage(err, fallback));

  const target = (commentId: string) =>
    platform === "facebook"
      ? { pageId: ownerId, postId, commentId }
      : { igUserId: ownerId, mediaId: postId, commentId };

  const reply = useMutation({
    mutationFn: (v: { commentId: string; message: string }) =>
      platform === "facebook"
        ? metaEngagementApi.facebookReply({ pageId: ownerId, postId, ...v })
        : metaEngagementApi.instagramReply({ igUserId: ownerId, mediaId: postId, ...v }),
    onSuccess: () => {
      toast.success("Reply sent.");
      refresh();
    },
    onError: fail("We could not send your reply. Try again."),
  });
  const hide = useMutation({
    mutationFn: (v: { commentId: string; hidden: boolean }) => {
      const t = target(v.commentId);
      return platform === "facebook"
        ? metaEngagementApi.facebookHide({ ...(t as { pageId: string; postId: string; commentId: string }), hidden: v.hidden })
        : metaEngagementApi.instagramHide({ ...(t as { igUserId: string; mediaId: string; commentId: string }), hidden: v.hidden });
    },
    onSuccess: (_r, v) => {
      toast.success(v.hidden ? "Comment hidden." : "Comment is visible again.");
      refresh();
    },
    onError: fail("We could not change that comment. Try again."),
  });
  const remove = useMutation({
    mutationFn: (commentId: string) => {
      const t = target(commentId);
      return platform === "facebook"
        ? metaEngagementApi.facebookDelete(t as { pageId: string; postId: string; commentId: string })
        : metaEngagementApi.instagramDelete(t as { igUserId: string; mediaId: string; commentId: string });
    },
    onSuccess: () => {
      toast.success("Comment deleted.");
      refresh();
    },
    onError: fail("We could not delete that comment. Try again."),
  });

  const [toDelete, setToDelete] = useState<MetaComment | null>(null);

  if (thread.isLoading) return <Skeleton className="h-48 w-full" />;
  if (thread.isError) {
    return <p className="text-sm text-muted-foreground">{commentsErrorMessage(thread.error, "We could not load these comments. Try again in a moment.")}</p>;
  }
  const list = thread.data?.comments ?? [];
  if (list.length === 0) return <p className="py-12 text-center text-sm text-muted-foreground">No comments on this post yet.</p>;

  const busy = reply.isPending || hide.isPending || remove.isPending;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {countComments(list)} comments{hiddenCount(list) > 0 && ` · ${hiddenCount(list)} hidden`}
      </p>
      <ul className="space-y-4">
        {list.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            platform={platform}
            busy={busy}
            onReply={(commentId, message) => reply.mutateAsync({ commentId, message })}
            onHide={(commentId, hidden) => hide.mutate({ commentId, hidden })}
            onDelete={setToDelete}
          />
        ))}
      </ul>
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
  busy,
  onReply,
  onHide,
  onDelete,
  nested,
}: {
  comment: MetaComment;
  platform: MetaCommentsPlatform;
  busy: boolean;
  onReply: (commentId: string, message: string) => Promise<unknown>;
  onHide: (commentId: string, hidden: boolean) => void;
  onDelete: (c: MetaComment) => void;
  nested?: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const blocker = replyBlocker(text, platform);

  return (
    <li className={cn(nested && "ml-6 border-l pl-4")}>
      <div className={cn("space-y-1", c.isHidden && "opacity-60")}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{authorLabel(c)}</span>
          <span className="text-xs text-muted-foreground">{when(c.createdTime)}</span>
          {c.isHidden && <Badge variant="secondary">Hidden</Badge>}
          {c.permalink && (
            <a href={c.permalink} target="_blank" rel="noreferrer" aria-label="Open on Meta" className="text-muted-foreground">
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm">{c.text}</p>
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
      </div>
      {replying && (
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
      {c.replies.length > 0 && (
        <ul className="mt-3 space-y-3">
          {c.replies.map((r) => (
            <CommentItem key={r.id} comment={r} platform={platform} busy={busy} onReply={onReply} onHide={onHide} onDelete={onDelete} nested />
          ))}
        </ul>
      )}
    </li>
  );
}
