"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Loader2, MessageSquare, SmilePlus, Users, X } from "lucide-react";
import {
  linkedInContentApi,
  type EngagerScore,
  type LinkedInAuthor,
  type LinkedInIdentity,
  type LinkedInReactionType,
} from "@/lib/api/linkedin-content";
import { useLinkedInIdentity } from "./post-composer";
import { RetentionFootnote } from "./retention-footnote";

const COMMENT_MAX = 1250; // LinkedIn comment cap (mirrors the api route)
const HAS_ORG_SCOPE = "w_organization_social";

/** The reactions LinkedIn accepts (MAYBE is deprecated → excluded), with the
 *  UI label/emoji LinkedIn shows for each. */
const REACTIONS: ReadonlyArray<{ type: LinkedInReactionType; label: string; emoji: string }> = [
  { type: "LIKE", label: "Like", emoji: "👍" },
  { type: "PRAISE", label: "Celebrate", emoji: "👏" },
  { type: "EMPATHY", label: "Love", emoji: "❤️" },
  { type: "INTEREST", label: "Insightful", emoji: "💡" },
  { type: "APPRECIATION", label: "Support", emoji: "🙌" },
  { type: "ENTERTAINMENT", label: "Funny", emoji: "😄" },
];
const REACTION_LABEL: Record<LinkedInReactionType, string> = Object.fromEntries(
  REACTIONS.map((r) => [r.type, r.label]),
) as Record<LinkedInReactionType, string>;

/** An "engage as" choice — the member, or a managed org page. */
export interface EngageAsOption {
  key: string;
  label: string;
  author: LinkedInAuthor;
}

/**
 * Build the "engage as" options + the default key for an engager — pure +
 * tested. Always offers the member ("You"); adds each managed org page when the
 * connection holds `w_organization_social`. Defaults to the brand page that
 * AUTHORED the post the engager commented on (so replying/reacting defaults to
 * the brand on the brand's own post), falling back to the member otherwise.
 */
export function buildEngageAsOptions(
  identity:
    | {
        scopes: string[];
        person: { name: string | null };
        pages: ReadonlyArray<{ id: string; name: string }>;
      }
    | undefined,
  postAuthorUrn: string,
): { options: EngageAsOption[]; defaultKey: string } {
  const options: EngageAsOption[] = [
    {
      key: "person",
      label: identity?.person.name ? `You (${identity.person.name})` : "You",
      author: { type: "person" },
    },
  ];
  const hasOrgScope = identity?.scopes.includes(HAS_ORG_SCOPE) ?? false;
  if (hasOrgScope && identity) {
    for (const p of identity.pages) {
      options.push({
        key: `org:${p.id}`,
        label: p.name || `Page ${p.id}`,
        author: { type: "org", pageId: p.id },
      });
    }
  }

  let defaultKey = "person";
  const m = /^urn:li:organization:(\d+)$/.exec(postAuthorUrn);
  if (m && hasOrgScope && options.some((o) => o.key === `org:${m[1]}`)) {
    defaultKey = `org:${m[1]}`;
  }
  return { options, defaultKey };
}

/** Map an engagement-write failure to friendly toast copy — never leak the raw
 *  LinkedIn/transport string. 403 RECONNECT_REQUIRED nudges the reconnect.
 *  Exported for unit testing. */
export function engageErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "RECONNECT_REQUIRED" || err.code === "NOT_CONNECTED" || err.status === 403) {
      return "Reconnect LinkedIn to reply and react (it needs the latest permissions).";
    }
    if (err.status === 429) return "LinkedIn is rate-limiting — try again in a moment.";
  }
  return "Couldn't reach LinkedIn. Please try again.";
}

/**
 * AudiencePanel — surfaces the AQS Tier C ranking of recent LinkedIn
 * engagers (people who commented on the business's posts).
 *
 * Tier C is the deterministic floor — frequency × recency × reactions
 * — that ships without LinkedIn People Search enrichment. The badge
 * shows "AQS · rules" so the user can tell when the score is the
 * deterministic floor; when Tier B (profile enrichment) lands, the
 * badge will read "AQS · enriched" without any code change to this
 * panel beyond rendering the resolved name/title instead of the URN.
 *
 * No deep-link to the engager's LinkedIn profile yet — the raw URN's
 * id-portion isn't a vanity handle, so a constructed link would land
 * on a "not found" most of the time. The link unlocks with Tier B
 * enrichment (which returns the public profile URL alongside the
 * name).
 */
export function AudiencePanel() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["linkedin-engagers"],
    queryFn: () => linkedInContentApi.engagers(),
    retry: (failureCount, err) => {
      // 403 (no business selected) is expected — render the empty
      // state. Transient errors get the default retry.
      if (err instanceof ApiError && err.status === 403) return false;
      return failureCount < 2;
    },
    staleTime: 5 * 60_000,
    // The engagers endpoint runs a Mongo aggregation per call. Match
    // the heavier insights panels' convention: don't auto-refetch on
    // tab refocus or component remount — the 5min staleTime is the
    // honest refresh cadence here, and the user can hard-refresh if
    // they want a fresher view.
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Identity (member + managed pages) for the "engage as" picker. Shares the
  // cached ["linkedin-me"] query with the composer, so no extra round-trip.
  // `undefined` while loading → rows fall back to person-only.
  const { data: identity } = useLinkedInIdentity();

  // Surface transient errors in the dev console so we can debug
  // network/parse failures (raw TypeError from fetch, PARSE_ERROR from
  // a 500 with non-JSON body). The user-facing toast intentionally
  // doesn't echo err.message — provider/network strings leak internals.
  if (isError && !(error instanceof ApiError && error.status === 403)) {
    console.error("[AudiencePanel] engagers query failed:", error);
  }

  if (isLoading) {
    return <AudiencePanelSkeleton />;
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <PanelShell>
          <EmptyBody
            title="Pick a business to see your top engagers"
            body="Once a business is selected, we'll rank the people who've been commenting on its LinkedIn posts."
          />
        </PanelShell>
      );
    }
    return (
      <PanelShell>
        <EmptyBody
          title="Couldn't load engagers"
          body="Try refreshing in a moment. If the problem persists, check your LinkedIn connection."
        />
      </PanelShell>
    );
  }

  if (!data || data.engagers.length === 0) {
    return (
      <PanelShell>
        <EmptyBody
          title="No engagers yet"
          body="Once your LinkedIn posts attract comments, we'll surface your top engagers here, ranked by how often and how recently they engage."
        />
      </PanelShell>
    );
  }

  return (
    <PanelShell
      summary={`${data.totalComments} comment${data.totalComments === 1 ? "" : "s"} across ${data.distinctActors} engager${data.distinctActors === 1 ? "" : "s"} in the last ${formatLookback(data.lookbackDays)}`}
    >
      <ol className="divide-y">
        {data.engagers.map((engager, i) => (
          <EngagerRow key={engager.actorUrn} engager={engager} rank={i + 1} identity={identity} />
        ))}
      </ol>
      <RetentionFootnote>
        Comments are scored over the lookback window LinkedIn permits (48
        hours by default).
      </RetentionFootnote>
    </PanelShell>
  );
}

/** Render lookbackDays in the form a non-technical user reasons about.
 *  2 = "48 hours" (the post-R1.2 default aligned with LinkedIn's 48h
 *  Members' Social Activity ceiling); 1 is rendered as "24 hours" for
 *  the corner case where ops overrides `?days=1`; everything else falls
 *  through to "N days". Keeps the summary readable while letting ops
 *  override the window without the UI claiming a different number. */
function formatLookback(days: number): string {
  if (days === 2) return "48 hours";
  if (days === 1) return "24 hours";
  return `${days} days`;
}

function PanelShell({
  children,
  summary,
}: {
  children: React.ReactNode;
  summary?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base leading-none font-semibold">
            Top engagers
          </h3>
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wide"
            title="Tier C floor — frequency, recency, and comment reactions, scored over the lookback window LinkedIn's data-retention rules permit (48 hours by default). Profile enrichment (job title, seniority, ICP match) ships next."
          >
            AQS · rules
          </Badge>
        </div>
        {summary ? (
          <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function EmptyBody({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function EngagerRow({
  engager,
  rank,
  identity,
}: {
  engager: EngagerScore;
  rank: number;
  identity: LinkedInIdentity | undefined;
}) {
  const ActorIcon = engager.actorType === "org" ? Building2 : Users;
  const actorLabel =
    engager.actorType === "org" ? "Company page" : "Person";
  // URN tail is the LinkedIn-internal member/org id. Not a vanity
  // handle and not displayable as a name today — but a short suffix
  // gives the user something to distinguish duplicate "Person" rows
  // until Tier B enrichment lands with real names.
  const urnTail = engager.actorUrn.split(":").pop() ?? "";
  const shortId = urnTail.length > 12 ? `${urnTail.slice(0, 4)}…${urnTail.slice(-4)}` : urnTail;

  const recencyLabel = formatRecency(engager.signals.daysSinceLastComment);

  // Engage-back affordances (CMA B3). Reacting needs only the comment URN;
  // replying additionally needs the parent post URN.
  const commentUrn = engager.signals.lastCommentUrn;
  const parentPostUrn = engager.signals.lastParentPostUrn;
  const canReact = commentUrn.length > 0;
  const canReply = canReact && parentPostUrn.length > 0;

  // "Engage as" — the member, or a managed page (defaulting to the brand page
  // that authored the post). `authorKey === null` means "follow the default",
  // so it stays in sync if identity loads after first render; a user pick pins it.
  const { options: authorOptions, defaultKey } = useMemo(
    () => buildEngageAsOptions(identity, engager.signals.lastParentPostAuthorUrn),
    [identity, engager.signals.lastParentPostAuthorUrn],
  );
  const [authorKey, setAuthorKey] = useState<string | null>(null);
  const effectiveKey = authorKey ?? defaultKey;
  const selectedAuthor: LinkedInAuthor =
    (authorOptions.find((o) => o.key === effectiveKey) ?? authorOptions[0]).author;

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [reactOpen, setReactOpen] = useState(false);
  const [reactedType, setReactedType] = useState<LinkedInReactionType | null>(null);

  const react = useMutation({
    mutationFn: (reactionType: LinkedInReactionType) =>
      linkedInContentApi.createReaction(commentUrn, { author: selectedAuthor, reactionType }),
    onSuccess: (_data, reactionType) => {
      setReactedType(reactionType);
      setReactOpen(false);
      toast.success(`Reacted: ${REACTION_LABEL[reactionType]}`);
    },
    onError: (err) => toast.error(engageErrorMessage(err)),
  });

  const reply = useMutation({
    mutationFn: (text: string) =>
      linkedInContentApi.createComment(parentPostUrn, {
        author: selectedAuthor,
        text,
        parentCommentUrn: commentUrn,
      }),
    onSuccess: () => {
      setReplyOpen(false);
      setReplyText("");
      toast.success("Reply posted.");
    },
    onError: (err) => toast.error(engageErrorMessage(err)),
  });

  const trimmedReply = replyText.trim();
  const replyDisabled = reply.isPending || trimmedReply.length === 0 || trimmedReply.length > COMMENT_MAX;
  const showAuthorPicker = authorOptions.length > 1;

  return (
    <li className="flex items-start gap-3 py-3">
      <span className="w-6 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
        {rank}.
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <ActorIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium">{actorLabel}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            · {shortId}
          </span>
        </div>
        {engager.signals.lastCommentText ? (
          <p
            className="line-clamp-2 text-xs text-muted-foreground"
            title={engager.signals.lastCommentText}
          >
            “{engager.signals.lastCommentText}”
          </p>
        ) : null}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">
              {engager.signals.commentCount}
            </span>{" "}
            comment{engager.signals.commentCount === 1 ? "" : "s"}
          </span>
          {engager.signals.totalReactions > 0 ? (
            <span>
              <span className="font-medium text-foreground">
                {engager.signals.totalReactions}
              </span>{" "}
              reaction{engager.signals.totalReactions === 1 ? "" : "s"}
            </span>
          ) : null}
          <span>last · {recencyLabel}</span>
        </div>

        {/* Engage-back actions — only when we have the comment URN to act on. */}
        {canReact ? (
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <Popover open={reactOpen} onOpenChange={setReactOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs"
                  disabled={react.isPending}
                  aria-busy={react.isPending}
                >
                  {react.isPending ? (
                    <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <SmilePlus className="size-3.5" />
                  )}
                  {reactedType ? `Reacted · ${REACTION_LABEL[reactedType]}` : "React"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-1">
                <div className="flex gap-0.5">
                  {REACTIONS.map((r) => (
                    <button
                      key={r.type}
                      type="button"
                      onClick={() => react.mutate(r.type)}
                      className="flex flex-col items-center rounded-md px-2 py-1 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title={r.label}
                      aria-label={`React: ${r.label}`}
                    >
                      <span className="text-base leading-none">{r.emoji}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {canReply ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => setReplyOpen((o) => !o)}
                aria-expanded={replyOpen}
              >
                <MessageSquare className="size-3.5" />
                Reply
              </Button>
            ) : null}
            {showAuthorPicker ? (
              <Select value={effectiveKey} onValueChange={setAuthorKey}>
                <SelectTrigger
                  className="h-7 w-auto gap-1 border-none px-2 text-xs text-muted-foreground shadow-none"
                  aria-label="Engage as"
                >
                  <span className="text-[11px]">as</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {authorOptions.map((o) => (
                    <SelectItem key={o.key} value={o.key} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        ) : null}

        {replyOpen && canReply ? (
          <div className="space-y-1.5 pt-1">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              rows={2}
              maxLength={COMMENT_MAX}
              className="resize-none text-sm"
              aria-label="Reply to this comment"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {replyText.length}/{COMMENT_MAX}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setReplyOpen(false);
                    setReplyText("");
                  }}
                >
                  <X className="size-3.5 mr-1" /> Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => reply.mutate(trimmedReply)}
                  disabled={replyDisabled}
                  aria-busy={reply.isPending}
                >
                  {reply.isPending ? "Posting…" : "Reply"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <div
          className="font-mono text-base font-semibold tabular-nums"
          title={`Frequency ${engager.breakdown.frequency} / 40 · Recency ${engager.breakdown.recency} / 30 · Reactions ${engager.breakdown.reactions} / 30`}
        >
          {engager.score}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          / 100
        </div>
      </div>
    </li>
  );
}

/**
 * Friendly relative time for last-comment recency. Granularity matches
 * what the user reasons about ("3 days ago" not "73 hours ago"). The
 * server already gives us `daysSinceLastComment` so we don't re-derive
 * the wall clock here.
 */
function formatRecency(daysSinceLast: number): string {
  if (daysSinceLast <= 0) return "today";
  if (daysSinceLast === 1) return "yesterday";
  if (daysSinceLast < 7) return `${daysSinceLast}d ago`;
  if (daysSinceLast < 30) {
    const weeks = Math.floor(daysSinceLast / 7);
    return `${weeks}w ago`;
  }
  if (daysSinceLast < 365) {
    const months = Math.floor(daysSinceLast / 30);
    return `${months}mo ago`;
  }
  const years = Math.floor(daysSinceLast / 365);
  return `${years}y ago`;
}

function AudiencePanelSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="mt-2 h-3 w-64" />
      </CardHeader>
      <CardContent className="pt-0">
        <ol className="divide-y">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-start gap-3 py-3">
              <Skeleton className="h-4 w-4 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full max-w-md" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-10 w-10 shrink-0" />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
