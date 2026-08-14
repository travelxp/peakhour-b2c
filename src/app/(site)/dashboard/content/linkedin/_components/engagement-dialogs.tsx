"use client";

/**
 * Engagement, opened from the number it belongs to.
 *
 * ── ★WHY THREE DIALOGS AND NOT ONE PANEL ─────────────────────────────
 * The first version of this put every kind of engagement behind a single
 * "View engagement" button beside the counts. That made the counts
 * decoration: you read "24 comments", then hunted for a separate control,
 * then picked a tab to get back to the thing you had already pointed at.
 * The number IS the affordance — clicking 24 comments opens the comments,
 * and nothing else has to be found first.
 *
 * Three separate dialogs rather than one with tabs, for the same reason:
 * a tab strip re-asks the question the click already answered.
 *
 * ── ★AND WHY EACH ONE COSTS SOMETHING TO OPEN ────────────────────────
 * Community Management Development tier allows ~500 requests/day for the
 * WHOLE app across every customer. Every dialog here fetches on open and
 * never before — `enabled: open` on each query is the mechanism. Do not
 * "warm" these on hover or on render: a Library page of 25 cards would
 * spend the entire day's budget on a scroll.
 *
 * The exception is Reposts, which reads our own Mongo (rows the webhook
 * delivered) and costs LinkedIn nothing.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, ExternalLink, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  linkedInContentApi,
  type LinkedInAuthor,
  type LinkedInInteraction,
} from "@/lib/api/linkedin-content";
import { useLocale } from "@/hooks/use-locale";
import { CommentsTab, ReactionsTab } from "./thread-panel";
import { RetentionFootnote } from "./retention-footnote";
import { engageErrorMessage } from "./engage-shared";

/** One dialog frame, so the three below cannot drift in size, scroll
 *  behaviour or footnote placement. */
function EngagementDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footnote,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  footnote: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">{children}</div>
        <RetentionFootnote>{footnote}</RetentionFootnote>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Who reacted, and with which reaction.
 *
 * ★Reaction TYPE is always known; the PERSON usually is not, and that is
 * LinkedIn's limit rather than ours. Decorations arrive only as the
 * `actor~` expansion on a COMMENTS read — the reactions finder offers no
 * equivalent and there is no profile lookup for another member — so a
 * reactor has a name here only if they also commented recently enough to
 * still be in the 24-hour cache. `ReactionsTab` says so in the body; the
 * description says it before the list, so nobody reads a screen of
 * "A member" as something being broken.
 */
export function ReactionsDialog({
  postUrn,
  open,
  onOpenChange,
}: {
  postUrn: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <EngagementDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reactions"
      description="Everyone who reacted to this post, grouped by reaction."
      footnote="Reactor names come from LinkedIn's 24-hour profile cache, so most people who only reacted show as “A member”."
    >
      <ReactionsTab postUrn={postUrn} open={open} />
    </EngagementDialog>
  );
}

/**
 * Who commented, who they are, and the reply box.
 *
 * The whole of `CommentsTab` — reply as the page or as you, six reaction
 * types, edit, delete, one level of nested replies, permissions and the
 * plain-language 403 — is reused rather than re-implemented. See the note
 * on its export.
 */
export function CommentsDialog({
  postUrn,
  author,
  ourActorUrn,
  open,
  onOpenChange,
}: {
  postUrn: string;
  /** Who we reply and react AS. Null when unresolvable — the dialog then
   *  reads but cannot write, which is better than guessing an author. */
  author: LinkedInAuthor | null;
  ourActorUrn: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <EngagementDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Comments"
      description="Reply, react and moderate without leaving Peakhour."
      footnote="Comment text is held for 48 hours and commenter names for 24, per LinkedIn's data rules."
    >
      <CommentsTab
        postUrn={postUrn}
        author={author}
        ourActorUrn={ourActorUrn}
        open={open}
      />
    </EngagementDialog>
  );
}

/**
 * Who reposted this, and anyone who mentioned it.
 *
 * ── ★THIS ONE READS OUR OWN DATABASE, NOT LINKEDIN ───────────────────
 * There is no "who reposted" endpoint. Reposts reach us exactly one way:
 * an `ORGANIZATION_SOCIAL_ACTION_NOTIFICATIONS` webhook with
 * `action:"SHARE"`, ingested into `soc_linkedin_interactions`. So this
 * dialog is a filtered read of the Feed's own rows, costs no LinkedIn
 * budget, and — importantly — shows nothing at all until webhook delivery
 * is live. The empty state says which of those it is, because "no reposts
 * yet" and "reposts cannot reach us yet" look identical and mean opposite
 * things.
 */
export function RepostsDialog({
  postUrn,
  open,
  onOpenChange,
}: {
  postUrn: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { formatRelativeTime } = useLocale();
  const query = useInfiniteQuery({
    queryKey: ["linkedin-post-reposts", postUrn],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      linkedInContentApi.interactions({
        postUrn,
        filter: "reposts",
        limit: 25,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Cheap (our Mongo, not LinkedIn) but still on-demand — there is no
    // reason to hold a subscription open for a dialog nobody opened.
    enabled: open,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const rows = query.data?.pages.flatMap((p) => p.rows) ?? [];

  return (
    <EngagementDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reposts"
      description="People who shared this post with their own network."
      footnote="Reposts arrive over LinkedIn's notification webhook. The member's words are held for 48 hours; that this happened is kept."
    >
      {query.isLoading ? (
        <RepostSkeleton />
      ) : query.isError ? (
        <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {engageErrorMessage(query.error)}
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border bg-muted/30 p-6 text-center">
          <p className="text-sm font-medium">No reposts recorded</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Reposts reach Peakhour over LinkedIn&apos;s notification webhook.
            If the counter above shows reposts but this list is empty, the
            webhook has not delivered them — reposts from before it was
            connected cannot be recovered beyond LinkedIn&apos;s 60-day
            replay window.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="flex gap-2.5">
              <span
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted"
                aria-hidden
              >
                <Repeat2 className="size-4 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className="text-sm font-medium">
                    {repostActorLabel(row)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.kind === "mention" ? "mentioned this" : "reposted this"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatRelativeTime(row.occurredAt ?? row.receivedAt)}
                  </span>
                </div>
                {/* Redacted is the NORMAL end state, not a failure: at 48h
                    the sweep takes the member's words and keeps the row. */}
                {row.redacted ? (
                  <p className="text-xs italic text-muted-foreground">
                    Their commentary is past LinkedIn&apos;s 48-hour window.
                  </p>
                ) : row.text ? (
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {row.text}
                  </p>
                ) : null}
                {row.actorUrn && (
                  <a
                    href={`https://www.linkedin.com/feed/update/${row.interactionUrn}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    View on LinkedIn <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {query.hasNextPage && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 h-7 w-full gap-1.5 text-xs"
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
    </EngagementDialog>
  );
}

/** A reposter's name, when we have one.
 *
 *  ★Reposts carry no `actor~` decoration — the notification gives a URN
 *  and nothing else — so this is "A member" far more often than a comment
 *  is. Rendering the raw URN instead would be worse than anonymous: it is
 *  unreadable AND it looks like a bug. */
function repostActorLabel(row: LinkedInInteraction): string {
  return row.actorProfile?.displayName ?? "A member";
}

function RepostSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-2.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
