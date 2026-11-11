"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleSlash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequestsList } from "@/components/presence/requests-list";
import { useChangeOutcomes, useEditCapabilities, useListingChanges, usePresenceEditMutations } from "@/hooks/use-presence-edit";
import { useListingQuery } from "@/hooks/use-presence-listing";
import { primaryEntry } from "@/lib/presence-panels";
import { capabilityFor, publishingBanner, requestGroups, type PublishingBanner } from "@/lib/presence-edit";

const LOOK: Record<PublishingBanner["tone"], { box: string; head: string; icon: React.ReactNode }> = {
  good: { box: "border", head: "", icon: <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> },
  warn: { box: "border border-warning/40", head: "text-warning-on-tint", icon: <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-on-tint" aria-hidden /> },
  bad: { box: "border border-destructive/40", head: "text-destructive", icon: <CircleSlash className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> },
};

/** The time, read once and again every minute: a render must not read the clock, and an idle tab must still see a proposal run out. */
function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/**
 * GBP Issue 1: the ONE publishing status, above the listing panels. Can approved changes be sent, what stops them, and the one thing to press.
 * GBP L4: with it, "Your requests", where every request stands, so there is one place to look.
 *
 * MARKUP ONLY. Every word comes from `publishingBanner` and `requestStatus` in `lib/presence-edit.ts`. The reads are the ones the edit card
 * already makes (same query keys), so this adds no request. Nothing is drawn until the capabilities have answered, or when there is neither a
 * status nor a request to show: no status is better than a guessed one.
 */
export function PublishingStatus({
  location,
  network,
  onRedo,
  canRedo,
}: {
  location?: string | undefined;
  network?: string | undefined;
  /** Opens the editor for a field, so a failed or expired request can be made again. */
  onRedo?: (field: string) => void;
  /** Which fields have an editor to open on this page. Default: none, so no button is drawn that does nothing. */
  canRedo?: (field: string) => boolean;
}) {
  const listingQ = useListingQuery(location, network);
  const caps = useEditCapabilities();
  const listing = listingQ.data?.listing ?? null;
  const entry = primaryEntry(listingQ.data);
  const changes = useListingChanges(listing?.id);
  const m = usePresenceEditMutations(listing?.id);
  // The same request the change cards make (same key): a live row shows what followed it without a second fetch.
  const outcomes = useChangeOutcomes(listing?.id, changes.data?.items, caps.data);
  const banner = caps.data ? publishingBanner(entry, caps.data.can) : null;
  const now = useNow();
  const groups = caps.data && entry ? requestGroups(changes.data?.items, now) : { open: [], recent: [] };
  const hasRequests = groups.open.length + groups.recent.length > 0;
  if (!banner && !hasRequests) return null;
  const look = banner ? LOOK[banner.tone] : null;

  return (
    // A landmark, not a live region: it holds a heading and buttons, and a refetch must not re-announce it.
    <section aria-label="Publishing status" className={`space-y-4 rounded-lg ${look?.box ?? "border"} p-4`}>
      {banner && look && (
        <div className="flex gap-3">
          {look.icon}
          <div className="min-w-0 space-y-1">
            <h2 className={`text-sm font-medium ${look.head}`}>{banner.headline}</h2>
            {banner.lines.map((l) => (
              <p key={l} className="text-xs text-muted-foreground">
                {l}
              </p>
            ))}
            {banner.action && (
              <Button asChild size="sm" variant="outline" className="mt-2 w-fit">
                {banner.action.external ? (
                  <a href={banner.action.href} target="_blank" rel="noopener noreferrer">
                    {banner.action.label}
                  </a>
                ) : (
                  <Link href={banner.action.href}>{banner.action.label}</Link>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
      {entry && caps.data && (
        <RequestsList
          open={groups.open}
          recent={groups.recent}
          labelFor={(n) => capabilityFor(caps.data, n)?.label ?? entry.label}
          can={caps.data.can}
          publishing={entry.publishing ?? null}
          m={m}
          onRedo={(field) => onRedo?.(field)}
          outcomeFor={outcomes.slotFor}
          canRedo={(f) => !!onRedo && (canRedo?.(f) ?? false)}
        />
      )}
    </section>
  );
}
