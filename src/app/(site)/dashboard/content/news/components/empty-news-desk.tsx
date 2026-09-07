"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Newspaper, Rss } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listSources } from "../../sources/api";

/**
 * The News Desk's empty state — why the queue is empty, and what to do.
 *
 * ── ★★"NO NEWS DRAFTS IN THE QUEUE" WAS TRUE AND USELESS
 *
 * The page it replaces stated the fact and then described the pipeline that
 * would eventually fill it ("as your sources are classified and corroborated…")
 * — a sentence that reads as reassurance and is, for most accounts, wrong. The
 * overwhelmingly common reason the News Desk is empty is that the business has
 * NO TRUSTED SOURCES, in which case nothing is being classified, nothing is
 * being corroborated, and no amount of waiting will produce a draft. The owner
 * was told to be patient about a process that was not running.
 *
 * ★So the state branches on the one fact that decides it: does this business
 * have active sources? The two answers need completely different things from
 * the reader — one needs an action, the other needs to know it is not broken —
 * and a single message cannot serve both.
 *
 * ── ★★IT READS SOURCES RATHER THAN A "WHY" FLAG
 *
 * There is no api that reports why the queue is empty, and inventing one would
 * mean a second place for this answer to live. `GET /v1/sources/trusted` is
 * already the page the CTA points at, so the check and the fix are the same
 * object — the count shown here is the count they will see when they land.
 *
 * The read is deliberately narrow (`status: "active"`, capped): suggested and
 * rejected sources do not feed the desk, so counting them would produce the
 * exact false reassurance this component exists to remove.
 */
export function EmptyNewsDesk() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["trusted-sources", { status: "active", limit: 1 }],
    // limit 1: the total is what decides the branch, not the rows. The listing
    // endpoint returns a count alongside them, so one row is enough to answer.
    queryFn: () => listSources({ status: "active", limit: 1 }),
    retry: false,
    staleTime: 60_000,
  });

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  // `rows.length` as the fallback: a listing response without a total is still
  // usable, and an error is treated as "we can't tell" — which lands on the
  // has-sources branch, because telling someone to add sources they already
  // have is the worse of the two mistakes.
  const activeCount = isError ? null : (data?.total ?? data?.rows?.length ?? 0);
  const hasSources = activeCount === null || activeCount > 0;

  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4 py-8 sm:flex-row sm:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted">
          {hasSources ? (
            <Newspaper className="size-5 text-muted-foreground" aria-hidden />
          ) : (
            <Rss className="size-5 text-muted-foreground" aria-hidden />
          )}
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          {hasSources ? (
            <>
              <p className="text-sm font-semibold">Nothing corroborated yet</p>
              <p className="text-sm text-muted-foreground">
                {activeCount === null
                  ? "We're reading your trusted sources."
                  : `We're reading your ${activeCount} trusted ${activeCount === 1 ? "source" : "sources"}.`}{" "}
                A story only becomes a draft once more than one of them reports it — so a quiet
                queue usually means a quiet news day, not a problem. Adding more sources, or ones
                that cover the same beat, is what makes corroboration happen sooner.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">Add a source and the desk starts working</p>
              <p className="text-sm text-muted-foreground">
                The News Desk writes from publications you trust — it reads them, cross-checks a
                story against more than one, and drafts it in your voice for approval. You
                haven&rsquo;t added any yet, so there is nothing for it to read.
              </p>
            </>
          )}
        </div>

        <Button asChild size="sm" className="shrink-0 gap-1.5">
          <Link href="/dashboard/content/sources">
            {hasSources ? "Manage sources" : "Add your first source"}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
