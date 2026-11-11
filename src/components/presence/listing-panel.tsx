"use client";

import { AlertTriangle, Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useListingQuery } from "@/hooks/use-presence-listing";
import { useLocale } from "@/hooks/use-locale";
import { ControlSection } from "@/components/presence/control-section";
import {
  LISTING_ROWS,
  addressLines,
  driftLabel,
  driftStatus,
  fetchView,
  hoursLines,
  networkLabel,
  primaryEntry,
  setupMessage,
  specialHoursText,
  staleSyncNote,
  type DriftStatus,
  type PresenceListing,
  type PresenceListingResponse,
} from "@/lib/presence-panels";

/**
 * The listing as we hold it, with a mark on each field the network shows differently.
 *
 * MARKUP ONLY. What each state says, and whether a field "matches" Google, come
 * from `lib/presence-panels.ts`. Nothing here edits anything: changes are made in
 * the edit card below (`edit/edit-listing-card.tsx`).
 */
function DriftMark({ status, label }: { status: DriftStatus; label: string | null }) {
  if (status === "differs") {
    return (
      <span className="inline-flex items-center gap-1 text-micro font-medium text-warning-on-tint">
        <AlertTriangle className="size-3.5" aria-hidden />
        {driftLabel("differs", label)}
      </span>
    );
  }
  if (status === "matches") {
    return (
      <span className="inline-flex items-center gap-1 text-micro text-muted-foreground">
        <Check className="size-3.5" aria-hidden />
        {driftLabel("matches", label)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-micro text-muted-foreground">
      <Minus className="size-3.5" aria-hidden />
      {driftLabel("not_checked", label)}
    </span>
  );
}

const NOT_SET = <span className="text-muted-foreground">Not set</span>;

function Row({
  label,
  status,
  networkName,
  children,
}: {
  label: string;
  status: DriftStatus;
  networkName: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr_auto] sm:items-start sm:gap-4">
      <dt className="text-micro font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
      <div>
        <DriftMark status={status} label={networkName} />
      </div>
    </div>
  );
}

function rowValue(
  key: string,
  l: PresenceListing,
  formatDate: (d: string, o?: Intl.DateTimeFormatOptions) => string,
): React.ReactNode {
  switch (key) {
    case "name":
      return l.name || NOT_SET;
    case "address": {
      const lines = addressLines(l.address);
      return lines.length ? (
        <>
          {lines.map((s, i) => (
            <span key={i} className="block">
              {s}
            </span>
          ))}
        </>
      ) : (
        NOT_SET
      );
    }
    case "phone":
      return l.contact?.phone || NOT_SET;
    case "website":
      return l.contact?.website || NOT_SET;
    case "category":
      return l.primaryCategory || NOT_SET;
    case "otherCategories":
      return l.additionalCategories.length ? l.additionalCategories.join(", ") : NOT_SET;
    case "hours": {
      const lines = hoursLines(l.regularHours);
      return lines.length ? (
        <ul className="space-y-0.5 tabular-nums">
          {lines.map((h) => (
            <li key={h.day} className="flex gap-3">
              <span className="w-24 shrink-0 text-muted-foreground">{h.day}</span>
              <span>{h.periods ? h.periods.join(", ") : "Closed"}</span>
            </li>
          ))}
        </ul>
      ) : (
        NOT_SET
      );
    }
    case "specialHours":
      return l.specialHours.length ? (
        <ul className="space-y-0.5 tabular-nums">
          {l.specialHours.map((s, i) => (
            <li key={`${s.date}-${i}`} className="flex flex-wrap gap-x-3">
              <span className="w-28 shrink-0 text-muted-foreground">
                {formatDate(s.date, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })}
              </span>
              <span>
                {specialHoursText(s)}
                {s.note ? `, ${s.note}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        NOT_SET
      );
    default:
      return null;
  }
}

export function ListingPanel({ location, network, label: labelFallback }: { location?: string; network?: string; label?: string | null }) {
  const q = useListingQuery(location, network);
  const { formatDate, formatDateTime } = useLocale();
  const view = fetchView({
    hasData: !!q.data,
    isPending: q.isPending,
    isError: q.isError,
    fetchStatus: q.fetchStatus,
  });

  const headerLabel = networkLabel(q.data, labelFallback);
  const header = (
    <div>
      <h2 className="font-medium">Your listing</h2>
      <p className="text-xs text-muted-foreground">
        {headerLabel ? `As Peakhour has it from ${headerLabel}.` : "As Peakhour has it."} To change something, use the card below.
      </p>
    </div>
  );

  if (view === "loading" || view === "paused") {
    return (
      <Card className="gap-3 p-5">
        {header}
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
        {view === "paused" && (
          <p className="text-center text-xs text-muted-foreground">
            Waiting for a connection. Your listing will load when you are back online.
          </p>
        )}
      </Card>
    );
  }

  if (view === "failed" || !q.data) {
    return (
      <Card className="gap-3 p-5">
        {header}
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <p className="text-sm font-medium">Couldn&apos;t load your listing</p>
          <p className="max-w-md text-xs text-muted-foreground">
            This is a problem loading the page, not a sign that your listing is missing. Try again
            in a moment.
          </p>
          <Button size="sm" variant="outline" onClick={() => q.refetch()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  const data: PresenceListingResponse = q.data;
  const label = networkLabel(data, labelFallback);
  const message = setupMessage(data.setup, !!data.listing, "listing", label);
  const note = staleSyncNote(data.setup, label);

  if (message || !data.listing) {
    const m = message ?? {
      headline: `Getting your listing from ${label ?? "the network"}`,
      body: "We have not received your listing yet.",
    };
    return (
      <Card className="gap-3 p-5">
        {header}
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm font-medium">{m.headline}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{m.body}</p>
        </div>
      </Card>
    );
  }

  const listing = data.listing;
  // A failing sync means nothing was compared recently, so no row may claim "same".
  const entry = data.setup === "ready" ? primaryEntry(data) : null;
  const checked = !!entry?.lastSyncedAt;

  return (
    <Card className="gap-3 p-5">
      {header}

      {view === "data_stale" && (
        <p className="text-xs text-warning-on-tint">
          Couldn&apos;t refresh just now, so this may be out of date.
        </p>
      )}
      {note && <p className="text-xs text-warning-on-tint">{note}</p>}

      <ControlSection key={`${entry?.network ?? ""}|${listing.id}`} entry={entry} listing={listing} formatDateTime={formatDateTime} />

      <dl className="divide-y">
        {LISTING_ROWS.map((r) => (
          <Row key={r.key} label={r.label} status={driftStatus(r.compares, entry)} networkName={label}>
            {rowValue(r.key, listing, formatDate)}
          </Row>
        ))}
      </dl>

      <p className="text-micro text-muted-foreground">
        {checked && entry
          ? `Last compared with ${label ?? "the network"} on ${formatDateTime(entry.lastSyncedAt)}. Only some fields are compared; the rest say so.`
          : `We haven't compared this with ${label ?? "the network"} recently.`}
      </p>
    </Card>
  );
}
