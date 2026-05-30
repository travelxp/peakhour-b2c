"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  ExternalLink,
  Eye,
  Heart,
  Loader2,
  MessageSquare,
  Share2,
  User,
} from "lucide-react";
import {
  linkedInContentApi,
  type LinkedInFeedPost,
  type LinkedInFeedResponse,
} from "@/lib/api/linkedin-content";
import { RetentionFootnote } from "./retention-footnote";

/**
 * FeedPanel — the user's own PUBLISHED LinkedIn posts (personal + org),
 * newest first, read from soc_linkedin_posts via GET /v1/linkedin/
 * content/feed (the post-sync cron's output — no live LinkedIn API call
 * per load). Lazy-mounted from the LinkedIn dashboard tabs, same pattern
 * as Audience/Boost, so the feed query doesn't fire on every page load.
 *
 * Keyset pagination via useInfiniteQuery (cursor = previous page's
 * nextCursor). An author filter (All / You / Pages) maps to the
 * endpoint's authorType param.
 */

type AuthorFilter = "all" | "person" | "org";

const AUTHOR_FILTERS: { value: AuthorFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "person", label: "You" },
  { value: "org", label: "Pages" },
];

export function FeedPanel() {
  const [authorFilter, setAuthorFilter] = useState<AuthorFilter>("all");

  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery<LinkedInFeedResponse, Error>({
    queryKey: ["linkedin-feed", authorFilter],
    queryFn: ({ pageParam }) =>
      linkedInContentApi.feed({
        cursor: (pageParam as string | undefined) ?? undefined,
        ...(authorFilter !== "all" ? { authorType: authorFilter } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.status === 403) return false;
      return failureCount < 2;
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  if (isError && !(error instanceof ApiError && error.status === 403)) {
    // Surface non-403 errors in the console; never echo provider strings
    // to the user (same pattern as the other LinkedIn panels).
    console.error("[FeedPanel] feed query failed:", error);
  }

  const posts = data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <div className="space-y-4">
      {/* Author filter */}
      <div className="flex items-center gap-1">
        {AUTHOR_FILTERS.map((f) => (
          <Button
            key={f.value}
            type="button"
            size="sm"
            variant={authorFilter === f.value ? "secondary" : "ghost"}
            className="h-7 px-2.5 text-xs"
            onClick={() => setAuthorFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <FeedSkeleton />
      ) : isError && error instanceof ApiError && error.status === 403 ? (
        <EmptyBody
          title="Pick a business to see your feed"
          body="Once a business is selected, we'll show the LinkedIn posts we've synced for it."
        />
      ) : isError ? (
        <EmptyBody
          title="Couldn't load your feed"
          body="We hit a snag fetching your synced posts. Try again in a moment."
        />
      ) : posts.length === 0 ? (
        <EmptyBody
          title="No synced posts yet"
          body="Once you publish on LinkedIn (or the post-sync runs), your posts will appear here with their engagement. Personal posts are kept for 48 hours; company-page posts for 6 months."
        />
      ) : (
        <>
          <ul className="space-y-3">
            {posts.map((post) => (
              <FeedRow key={post.id} post={post} />
            ))}
          </ul>
          {hasNextPage && (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="gap-1.5"
              >
                {isFetchingNextPage && (
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                )}
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}

      <RetentionFootnote>
        We sync your published posts from LinkedIn. Personal-feed posts are
        retained for 48h under LinkedIn&apos;s Members&apos; Social Activity
        rule; Company-Page posts for 6 months.
      </RetentionFootnote>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────

function FeedRow({ post }: { post: LinkedInFeedPost }) {
  const url = linkedInPostUrl(post.linkedInPostId);
  return (
    <li>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            {post.authorType === "org" ? (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Building2 className="size-3" /> Company page
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <User className="size-3" /> Personal
              </Badge>
            )}
            {post.publishedAt && (
              <span className="text-xs text-muted-foreground">{formatRelativeTime(post.publishedAt)}</span>
            )}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                View on LinkedIn <ExternalLink className="size-3" />
              </a>
            )}
          </div>

          <p className="whitespace-pre-line text-sm leading-relaxed line-clamp-6">
            {post.content}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
            <Metric icon={Eye} label="impressions" value={post.performance.impressions} />
            <Metric icon={Heart} label="likes" value={post.performance.likes} />
            <Metric icon={MessageSquare} label="comments" value={post.performance.comments} />
            <Metric icon={Share2} label="shares" value={post.performance.shares} />
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
}) {
  return (
    <span
      className="flex items-center gap-1"
      aria-label={`${value.toLocaleString()} ${label}`}
      title={`${value.toLocaleString()} ${label}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {formatCount(value)}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────

/** Build a "View on LinkedIn" URL only when we have a real URN — a bare
 *  id can't be turned into a reliable permalink, so we omit the link
 *  rather than render a broken one. */
function linkedInPostUrl(linkedInPostId: string | null): string | null {
  if (!linkedInPostId) return null;
  if (!linkedInPostId.includes("urn:li:")) return null;
  // Keep RAW colons (no encodeURIComponent) + no trailing slash to match
  // the backend's permalink convention (peakhour-api adapters/publisher/
  // linkedin.ts): encoding produces %3A%3A URLs some browser caches
  // mishandle.
  return `https://www.linkedin.com/feed/update/${linkedInPostId}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Sub-components ────────────────────────────────────────

function EmptyBody({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-6 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i}>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-16 w-full" />
              <div className="flex gap-4">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
