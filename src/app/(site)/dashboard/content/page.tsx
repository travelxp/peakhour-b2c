"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, PenSquare } from "lucide-react";
import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelIconCompact } from "@/components/brand/channel-icon";
import { useHomeSummary } from "@/hooks/use-home-summary";
import {
  COMING_UP_DAYS,
  COMING_UP_GRACE_MS,
  COMING_UP_LIMIT,
  COMPOSE_HREF,
  comingUp,
  contentNeedsOk,
} from "@/lib/content-home";
import { CONTENT_CALENDAR, CONTENT_CREATE, CONTENT_RESULTS } from "@/lib/content-nav";
import { navLabel } from "@/lib/nav-copy";
import { scheduler } from "@/lib/scheduler/client";
import { channelDisplayName, detectTimezone, formatScheduleLabel } from "@/lib/scheduler/format";
import { NeedsOkBlock } from "./_components/needs-ok-block";

/**
 * The Content home: three blocks, in the order a merchant's day goes. What is
 * waiting for your OK, what is about to go out, and a way to start a post.
 * Planning, drafts, web pages and the channel pages live under the nav's other
 * items; the channel LIST is Connected accounts' (it moved there).
 */
export default function ContentHomePage() {
  const summary = useHomeSummary();
  const needsOk = summary.data ? contentNeedsOk(summary.data) : undefined;

  return (
    <PageShell>
      <PageHeader
        title="Content"
        description="What is waiting for you, what goes out this week, and where to start a post."
      />

      {summary.isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : !needsOk ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t check what is waiting for you. Nothing has changed.
            </p>
            <Button variant="outline" size="sm" onClick={() => void summary.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <NeedsOkBlock items={needsOk.top} count={needsOk.count} mayBeMore={needsOk.mayBeMore} />
      )}

      <ComingUp publishedThisWeek={summary.data?.kpis.publishedThisWeek} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Post something</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Write a post, pick where it goes and when, or let Peakhour suggest the time.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={COMPOSE_HREF}>
                <PenSquare className="size-4" /> Post something
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={CONTENT_CREATE}>More ways to create</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function ComingUp({ publishedThisWeek }: { publishedThisWeek: number | undefined }) {
  // "Now" is read after mount, never during render: Date.now() in render is
  // impure and would make the server and first client render disagree.
  const [now, setNow] = useState<Date | null>(null);
  const [tz, setTz] = useState("UTC");
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setNow(new Date());
      setTz(detectTimezone());
    });
    // A tab left open should not keep showing posts that have since gone out.
    const timer = setInterval(() => setNow(new Date()), 10 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // The key names the hour, not the millisecond, so the query is not re-run on every render.
  const hourKey = now ? now.toISOString().slice(0, 13) : null;
  const items = useQuery({
    queryKey: ["content-home:coming-up", hourKey],
    enabled: now !== null,
    queryFn: () =>
      scheduler.listItems({
        from: new Date((now as Date).getTime() - COMING_UP_GRACE_MS),
        to: new Date((now as Date).getTime() + COMING_UP_DAYS * 24 * 60 * 60 * 1000),
        limit: 100,
      }),
    staleTime: 60_000,
    // The key changes on the hour; keep the last list on screen rather than flash a skeleton.
    placeholderData: keepPreviousData,
  });

  const upcoming = items.data && now ? comingUp(items.data.items, now) : [];
  const shown = upcoming.slice(0, COMING_UP_LIMIT);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Coming up this week</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link href={CONTENT_CALENDAR}>
            Open {navLabel(CONTENT_CALENDAR).toLowerCase()} <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.isError ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">We couldn&apos;t load your schedule. Nothing has changed.</p>
            <Button variant="outline" size="sm" onClick={() => void items.refetch()}>
              Try again
            </Button>
          </div>
        ) : items.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : shown.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="size-4 shrink-0" aria-hidden />
            Nothing is scheduled for the next {COMING_UP_DAYS} days.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {shown.map((item) => (
              <li key={item._id} className="flex items-center gap-3 px-4 py-3">
                <ChannelIconCompact channel={item.channel} size={14} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.payload.text || "Post with no text"}</p>
                  <p className="text-xs text-muted-foreground">
                    {channelDisplayName(item.channel)} &middot; {formatScheduleLabel(item.scheduledAtUtc, tz)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {upcoming.length > shown.length && (
          <p className="text-xs text-muted-foreground">
            And {upcoming.length - shown.length} more on the {navLabel(CONTENT_CALENDAR).toLowerCase()}.
          </p>
        )}
        {typeof publishedThisWeek === "number" && (
          <p className="text-xs text-muted-foreground">
            {publishedThisWeek === 0
              ? "Nothing published in the last 7 days."
              : `${publishedThisWeek} published in the last 7 days.`}{" "}
            <Link href={CONTENT_RESULTS} className="font-medium text-foreground underline underline-offset-4">
              See {navLabel(CONTENT_RESULTS).toLowerCase()}
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
