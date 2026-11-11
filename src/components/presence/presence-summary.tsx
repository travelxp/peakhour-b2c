"use client";

import { useEditCapabilities, useListingChanges } from "@/hooks/use-presence-edit";
import { useListingQuery } from "@/hooks/use-presence-listing";
import { useListingScore } from "@/hooks/use-presence-score";
import { useNow } from "@/hooks/use-now";
import { primaryEntry } from "@/lib/presence-panels";
import { summaryLine } from "@/lib/presence-summary";

/**
 * GBP L7: the one line at the top of the page, for example "Listing 89/100 · Publishing on · 1 thing needs you". MARKUP ONLY: every part and
 * its target come from `summaryLine`. The reads are the ones the score card, the publishing status and the edit card already make (same query
 * keys), so this adds no request. Each part is a link to its place on the page, and says its whole sentence to a screen reader (hidden text, so what is read still starts with what is seen); the words
 * carry the meaning, never a colour.
 */
export function PresenceSummary({ location, network }: { location?: string | undefined; network?: string | undefined }) {
  const listingQ = useListingQuery(location, network);
  const caps = useEditCapabilities();
  const entry = primaryEntry(listingQ.data);
  const changes = useListingChanges(listingQ.data?.listing?.id);
  const score = useListingScore(location, network);
  const now = useNow();
  const parts = summaryLine({ score: score.data, entry, can: caps.data?.can, changes: changes.data?.items, now });
  if (parts.length === 0) return null;

  return (
    <div role="group" aria-label="Summary of your listing" className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-medium" data-testid="presence-summary">
      {parts.map((p, i) => (
        <span key={p.id} className="flex items-baseline gap-x-2">
          {i > 0 && (
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
          )}
          {p.href ? (
            <a href={p.href} className="underline underline-offset-4">
              <span aria-hidden>{p.text}</span>
              <span className="sr-only">{p.sentence}</span>
            </a>
          ) : (
            <span>
              <span aria-hidden>{p.text}</span>
              <span className="sr-only">{p.sentence}</span>
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
