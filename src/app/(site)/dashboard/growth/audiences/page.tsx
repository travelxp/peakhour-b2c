"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/molecules/empty-state";
import { useAudienceSets } from "@/hooks/use-audience-library";
import { platformLabel, LIBRARY_CHANNELS } from "@/lib/audience-library-rules";
import type { AudienceSetsQuery } from "@/lib/api/audiences";
import { AudienceSetCard } from "./_components/audience-set-card";
import { ALL, MAX_OFFSET, PAGE_SIZE, SEARCH_MAX, SOURCES, STATUSES } from "./filters";

/**
 * The audience library (G1).
 *
 * ★THE WHOLE POINT OF THE PLAN THIS PR BELONGS TO. `biz_audience_sets` has held
 * named, reusable, per-channel audiences since B2 — planned portfolios, the
 * campaigns a business actually ran, scores, critiques, outcomes — and until
 * this page nothing rendered a single row of it. The standing rule is that
 * "built" means a caller can reach it.
 *
 * ★AND THE FILTERS ARE THE SERVER'S. A value it does not recognise is a 400
 * rather than a silently empty list, which is why the selects offer exactly the
 * enums the api takes: an accepted-then-ignored filter returns a list a
 * customer reads as "I have no audiences".
 */

/** Debounce a value. Same shape as the targeting dialog's, kept local rather
 *  than shared until a third caller wants it. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function AudienceLibraryPage() {
  const [q, setQ] = useState("");
  const [source, setSource] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [platform, setPlatform] = useState<string>(ALL);
  const [offset, setOffset] = useState(0);

  // ★DEBOUNCED, BECAUSE EVERY KEYSTROKE IS A COLLECTION SCAN. `GET /sets`
  // cannot use an index for `createdAt` ordering once a channel filter exists
  // (the api says so itself), and it pairs the page with a `countDocuments`.
  // Typing "enterprise travel" undebounced is seventeen double-scans of a
  // customer's library.
  const search = useDebounced(q.trim(), 350);

  const query: AudienceSetsQuery = {
    limit: PAGE_SIZE,
    offset,
    ...(search ? { q: search } : {}),
    ...(source !== ALL ? { source: source as AudienceSetsQuery["source"] } : {}),
    ...(status !== ALL ? { status: status as AudienceSetsQuery["status"] } : {}),
    ...(platform !== ALL ? { platform } : {}),
  };
  const sets = useAudienceSets(query);

  /** Any filter change returns to the first page. Leaving the offset would show
   *  "no audiences" for a filter that has plenty, three pages in. */
  function onFilterChange(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      setOffset(0);
    };
  }

  const rows = sets.data?.sets ?? [];
  const total = sets.data?.total ?? 0;
  const filtered = search !== "" || source !== ALL || status !== ALL || platform !== ALL;
  /** ★A PAGE PAST THE END IS A THIRD EMPTY STATE. A customer on page 3 whose
   *  library shrinks — a discard, a business switch — would otherwise be told
   *  "No audiences yet" with no way back, because the pagination lives in the
   *  branch the empty state replaces. */
  const pastTheEnd = rows.length === 0 && offset > 0;

  function clearFilters() {
    setQ("");
    setSource(ALL);
    setStatus(ALL);
    setPlatform(ALL);
    setOffset(0);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Audiences</h2>
        <p className="text-muted-foreground">
          Every audience we&apos;ve suggested, read off your past campaigns, or you&apos;ve
          built by hand — reusable on any campaign, on any channel.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value.slice(0, SEARCH_MAX));
            setOffset(0);
          }}
          maxLength={SEARCH_MAX}
          placeholder="Search names and descriptions…"
          className="w-full sm:max-w-xs"
          aria-label="Search audiences"
        />
        <Select value={source} onValueChange={onFilterChange(setSource)}>
          <SelectTrigger className="w-45" aria-label="Filter by where it came from">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Anywhere from</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={onFilterChange(setStatus)}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={platform} onValueChange={onFilterChange(setPlatform)}>
          <SelectTrigger className="w-40" aria-label="Filter by channel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* ★"WORKS ON THIS CHANNEL", NOT "WAS BORN ON IT". The api asks
                whether the audience carries a shape for the channel, so an
                idea planned on LinkedIn and since resolved for X appears under
                both — which is the whole point of a channel-neutral library. */}
            <SelectItem value={ALL}>Any channel</SelectItem>
            {LIBRARY_CHANNELS.map((p) => (
              <SelectItem key={p} value={p}>
                Works on {platformLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sets.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : sets.isError ? (
        // ★NOT EVERY FAILURE IS OURS, AND A RETRY BUTTON ON THE ONES THAT ARE
        // NOT IS A LOOP. `GET /sets` answers 403 FORBIDDEN when no business is
        // active — retrying never fixes that — and the api carries a sentence
        // of its own on every error. A first cut showed "that's on us, try
        // again" over both.
        <EmptyState
          icon={Users}
          title="We couldn't load your audiences"
          description={
            sets.error instanceof ApiError && sets.error.code === "FORBIDDEN"
              ? "Pick a business first — audiences belong to one business at a time."
              : sets.error instanceof ApiError && sets.error.message
                ? sets.error.message
                : "That's on us. Try again in a moment — nothing has been changed."
          }
          {...(sets.error instanceof ApiError && sets.error.code === "FORBIDDEN"
            ? {}
            : { action: { label: "Try again", onClick: () => void sets.refetch() } })}
        />
      ) : rows.length === 0 ? (
        // ★TWO DIFFERENT EMPTIES, AND THEY ARE NOT THE SAME SENTENCE. A filter
        // that matched nothing is not a library with nothing in it, and telling
        // a customer with forty audiences that they have none — because they
        // typed a word — is the accepted-then-ignored failure one layer up.
        <EmptyState
          icon={Users}
          title={
            pastTheEnd
              ? "Nothing on this page"
              : filtered
                ? "No audiences match that"
                : "No audiences yet"
          }
          description={
            pastTheEnd
              ? "There are fewer audiences than there were — something was discarded, or you switched business."
              : filtered
                ? "Try a different search, or clear the filters to see everything in your library."
                : "When Peakhour suggests an audience for a campaign, or reads the ones you've already run, they'll be kept here so you can use them again."
          }
          {...(pastTheEnd
            ? { action: { label: "Back to the start", onClick: () => setOffset(0) } }
            : filtered
              ? { action: { label: "Clear filters", onClick: clearFilters } }
              : {})}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {/* The api's own total, not the page length — a count that silently
                equals the page size is a number we did not source. */}
            {total} audience{total === 1 ? "" : "s"}
            {filtered ? (total === 1 ? " matches this filter" : " match this filter") : ""}
          </p>
          <div className="space-y-3">
            {rows.map((set) => (
              <AudienceSetCard key={set.id} set={set} />
            ))}
          </div>
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                // The api caps `offset` at 1000 and 400s past it, so the last
                // reachable page is the last one it will serve. Walking into
                // that would be a dead end wearing an error message.
                disabled={offset + PAGE_SIZE >= total || offset + PAGE_SIZE > MAX_OFFSET}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
