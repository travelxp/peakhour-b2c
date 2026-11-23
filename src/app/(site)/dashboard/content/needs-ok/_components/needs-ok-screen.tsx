"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { QueryError } from "@/components/dashboard/query-error";
import { formatDateLabel, formatRelative } from "@/lib/scheduler/format";
import {
  fetchNeedsOkPage,
  useNeedsOk,
  type NeedsOkGroup,
  type NeedsOkItem,
} from "@/hooks/use-needs-ok";

/** Where "Post something" goes: the calendar's composer. */
export const POST_SOMETHING_HREF = "/dashboard/calendar?compose=1";

/**
 * Every piece of content waiting for the merchant's OK, grouped by where it came from, each row opening the screen that approves it today.
 *
 * ★NO APPROVE LOGIC HERE. A row is a link to the existing approve screen; this page only gathers what waits, so a decision is made in exactly
 * one place per kind of content. The api reads the same module as Home's "Waiting for you", so the numbers agree.
 *
 * ★A GROUP THAT COULD NOT BE READ IS NAMED, NOT HIDDEN. A quiet group and a broken one look the same if the broken one just vanishes.
 */
export function NeedsOkScreen() {
  const query = useNeedsOk();

  if (query.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <QueryError what="what is waiting for your OK" onRetry={() => void query.refetch()} />
    );
  }

  const groups = query.data.sources;
  const unreadable = groups.filter((g) => g.failed);
  const waiting = groups.filter((g) => g.count > 0);

  if (waiting.length === 0) {
    // ★NEVER "NOTHING WAITING" OVER A SOURCE WE COULD NOT READ: it would be a claim the page cannot back.
    if (unreadable.length > 0) return <UnreadableNotice groups={unreadable} />;
    return (
      <div className="space-y-4">
        <EmptyState
          icon={Check}
          title="Nothing is waiting for your OK"
          description="When Peakhour has a post, page or design ready for you, it shows up here."
          action={{ label: "Post something", href: POST_SOMETHING_HREF }}
        />
      </div>
    );
  }

  const work = waiting.filter((g) => g.holdsWork);
  const suggestions = waiting.filter((g) => !g.holdsWork);
  const workTotal = query.data.workTotal;

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        {workTotal > 0
          ? `${workTotal} ${workTotal === 1 ? "thing is" : "things are"} waiting for you. Open one to review it where you can approve, fix or change it.`
          : "Nothing is stuck waiting for you. There are a few suggestions below."}
      </p>
      {unreadable.length > 0 && <UnreadableNotice groups={unreadable} />}
      {work.map((group) => (
        <Group key={group.source} group={group} level={2} />
      ))}
      {suggestions.length > 0 && (
        <section aria-labelledby="needs-ok-suggestions" className="space-y-6">
          <div className="space-y-1">
            <h2 id="needs-ok-suggestions" className="text-base font-semibold">
              Suggestions
            </h2>
            <p className="text-sm text-muted-foreground">Nothing is stuck on these. Use them when you like.</p>
          </div>
          {suggestions.map((group) => (
            <Group key={group.source} group={group} level={3} />
          ))}
        </section>
      )}
    </div>
  );
}

function UnreadableNotice({ groups }: { groups: NeedsOkGroup[] }) {
  return (
    <p role="status" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 text-warning-on-tint px-4 py-3 text-sm">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        We couldn&apos;t check {groups.map((g) => g.label).join(", ")} just now, so those are not counted here. Refresh to try again.
      </span>
    </p>
  );
}

function Group({ group, level }: { group: NeedsOkGroup; level: 2 | 3 }) {
  const Heading = level === 2 ? "h2" : "h3";
  const [more, setMore] = useState<NeedsOkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // The page polls, so a row loaded by "Show more" may now also be in the first page: never list one twice.
  const items = [...new Map([...group.items, ...more].map((i) => [i.id, i])).values()];
  const remaining = group.count - items.length;

  async function showMore() {
    setLoading(true);
    setFailed(false);
    try {
      const next = await fetchNeedsOkPage(group.source, items.length);
      const page = next.sources.find((s) => s.source === group.source);
      if (!page || page.failed) setFailed(true);
      else setMore((prev) => [...prev, ...page.items]);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby={`needs-ok-${group.source}`} className="space-y-3">
      <Heading id={`needs-ok-${group.source}`} className="text-sm font-semibold text-muted-foreground">
        {group.label} ({group.count})
      </Heading>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={`${item.source}:${item.id}`}>
            <Row item={item} />
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={showMore} disabled={loading}>
            {loading ? "Loading…" : `Show ${Math.min(remaining, 20)} more`}
          </Button>
          {failed && <span className="text-xs text-destructive">Couldn&apos;t load more. Try again.</span>}
        </div>
      )}
    </section>
  );
}

/**
 * The day an automatic draft expires, on the VIEWER's own calendar (their browser's time zone), as `Mon, 1 Jun`. An automatic draft nobody approves is closed on
 * the api's schedule and never posted; this is the day the merchant can still act.
 */
export function expiresOn(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "soon";
  return formatDateLabel(d, Intl.DateTimeFormat().resolvedOptions().timeZone);
}

function Row({ item }: { item: NeedsOkItem }) {
  return (
    <Link
      href={item.href}
      className="group flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{item.title}</span>
        <span className="block text-sm text-muted-foreground">{item.why}</span>
        {item.createdAt && <span className="block text-xs text-muted-foreground">Made {formatRelative(item.createdAt)}</span>}
        {item.expiresAt && <span className="block text-xs text-muted-foreground">Expires {expiresOn(item.expiresAt)}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand-label">
        {item.holdsWork ? "Open" : "See"}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}
