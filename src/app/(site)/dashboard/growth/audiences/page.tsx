"use client";

import { useState } from "react";
import { Users } from "lucide-react";
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

/** `all` rather than an empty string: a Radix Select item may not have an empty
 *  value, and the query simply omits the key. */
const ALL = "all";

const SOURCES = [
  { value: "generated", label: "Peakhour suggested" },
  { value: "imported", label: "From past campaigns" },
  { value: "user_defined", label: "You built" },
] as const;

const STATUSES = [
  { value: "proposed", label: "Suggested" },
  { value: "applied", label: "On a campaign" },
  { value: "discarded", label: "Discarded" },
  { value: "superseded", label: "Replaced" },
] as const;

const PAGE_SIZE = 20;

export default function AudienceLibraryPage() {
  const [q, setQ] = useState("");
  const [source, setSource] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [platform, setPlatform] = useState<string>(ALL);
  const [offset, setOffset] = useState(0);

  const query: AudienceSetsQuery = {
    limit: PAGE_SIZE,
    offset,
    ...(q.trim() ? { q: q.trim() } : {}),
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
  const filtered = q.trim() !== "" || source !== ALL || status !== ALL || platform !== ALL;

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
            setQ(e.target.value);
            setOffset(0);
          }}
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
        <EmptyState
          icon={Users}
          title="We couldn't load your audiences"
          description="That's on us. Try again in a moment — nothing has been changed."
          action={{ label: "Try again", onClick: () => void sets.refetch() }}
        />
      ) : rows.length === 0 ? (
        // ★TWO DIFFERENT EMPTIES, AND THEY ARE NOT THE SAME SENTENCE. A filter
        // that matched nothing is not a library with nothing in it, and telling
        // a customer with forty audiences that they have none — because they
        // typed a word — is the accepted-then-ignored failure one layer up.
        <EmptyState
          icon={Users}
          title={filtered ? "No audiences match that" : "No audiences yet"}
          description={
            filtered
              ? "Try a different search, or clear the filters to see everything in your library."
              : "When Peakhour suggests an audience for a campaign, or reads the ones you've already run, they'll be kept here so you can use them again."
          }
          {...(filtered
            ? {
                action: {
                  label: "Clear filters",
                  onClick: () => {
                    setQ("");
                    setSource(ALL);
                    setStatus(ALL);
                    setPlatform(ALL);
                    setOffset(0);
                  },
                },
              }
            : {})}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {/* The api's own total, not the page length — a count that silently
                equals the page size is a number we did not source. */}
            {total} audience{total === 1 ? "" : "s"}
            {filtered ? " match this filter" : ""}
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
                disabled={offset + PAGE_SIZE >= total}
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
