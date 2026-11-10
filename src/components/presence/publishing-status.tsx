"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleSlash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditCapabilities } from "@/hooks/use-presence-edit";
import { useListingQuery } from "@/hooks/use-presence-listing";
import { primaryEntry } from "@/lib/presence-panels";
import { publishingBanner, type PublishingBanner } from "@/lib/presence-edit";

const LOOK: Record<PublishingBanner["tone"], { box: string; head: string; icon: React.ReactNode }> = {
  good: { box: "border", head: "", icon: <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> },
  warn: { box: "border border-warning/40", head: "text-warning-on-tint", icon: <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-on-tint" aria-hidden /> },
  bad: { box: "border border-destructive/40", head: "text-destructive", icon: <CircleSlash className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> },
};

/**
 * GBP Issue 1: the ONE publishing status, above the listing panels. Can approved changes be sent, what stops them, and the one thing to press.
 *
 * MARKUP ONLY. Every word comes from `publishingBanner` in `lib/presence-edit.ts`, built from the api's `publishing` (the send's own gates).
 * The two reads are the ones the edit card already makes, so this adds no request. Nothing is drawn until both have answered, or when the
 * network writes nothing: no status is better than a guessed one.
 */
export function PublishingStatus({ location, network }: { location?: string | undefined; network?: string | undefined }) {
  const listingQ = useListingQuery(location, network);
  const caps = useEditCapabilities();
  const banner = caps.data ? publishingBanner(primaryEntry(listingQ.data), caps.data.can) : null;
  if (!banner) return null;
  const look = LOOK[banner.tone];

  return (
    // A landmark, not a live region: it holds a heading and a button, and a refetch must not re-announce it.
    <section aria-label="Publishing status" className={`flex gap-3 rounded-lg ${look.box} p-4`}>
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
    </section>
  );
}
