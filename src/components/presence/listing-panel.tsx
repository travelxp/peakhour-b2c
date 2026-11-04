"use client";

import { AlertTriangle, Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useListingQuery } from "@/hooks/use-presence-listing";
import { useLocale } from "@/hooks/use-locale";
import {
  DRIFT_LABEL,
  LISTING_ROWS,
  addressLines,
  driftStatus,
  fetchView,
  hoursLines,
  setupMessage,
  specialHoursText,
  staleSyncNote,
  verificationNote,
  type DriftStatus,
  type PresenceListing,
  type PresenceListingResponse,
} from "@/lib/presence-panels";

/**
 * The listing as we hold it, with a mark on each field Google shows differently.
 *
 * MARKUP ONLY. What each state says, and whether a field "matches" Google, come
 * from `lib/presence-panels.ts`. Nothing here edits anything: edit forms are a
 * later row, and no control is shown for a change that cannot be made.
 */
function DriftMark({ status }: { status: DriftStatus }) {
  if (status === "differs") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning-on-tint">
        <AlertTriangle className="size-3.5" aria-hidden />
        {DRIFT_LABEL.differs}
      </span>
    );
  }
  if (status === "matches") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Check className="size-3.5" aria-hidden />
        {DRIFT_LABEL.matches}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <Minus className="size-3.5" aria-hidden />
      {DRIFT_LABEL.not_checked}
    </span>
  );
}

const NOT_SET = <span className="text-muted-foreground">Not set</span>;

function Row({
  label,
  status,
  children,
}: {
  label: string;
  status: DriftStatus;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr_auto] sm:items-start sm:gap-4">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
      <div>
        <DriftMark status={status} />
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

export function ListingPanel() {
  const q = useListingQuery();
  const { formatDate, formatDateTime } = useLocale();
  const view = fetchView({
    hasData: !!q.data,
    isPending: q.isPending,
    isError: q.isError,
    fetchStatus: q.fetchStatus,
  });

  const header = (
    <div>
      <h2 className="font-medium">Your listing</h2>
      <p className="text-xs text-muted-foreground">
        As Peakhour has it from Google. Nothing here is edited from this page yet.
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
  const message = setupMessage(data.setup, !!data.listing, "listing");
  const note = staleSyncNote(data.setup);

  if (message || !data.listing) {
    const m = message ?? {
      headline: "Getting your listing from Google",
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
  const google = data.setup === "ready" ? data.google : null;
  const checked = !!google?.lastSyncedAt;
  const verification = verificationNote(data.verification?.state);

  return (
    <Card className="gap-3 p-5">
      {header}

      {view === "data_stale" && (
        <p className="text-xs text-warning-on-tint">
          Couldn&apos;t refresh just now, so this may be out of date.
        </p>
      )}
      {note && <p className="text-xs text-warning-on-tint">{note}</p>}
      {verification && <p className="text-xs text-warning-on-tint">{verification}</p>}

      <dl className="divide-y">
        {LISTING_ROWS.map((r) => (
          <Row key={r.key} label={r.label} status={driftStatus(r.compares, google)}>
            {rowValue(r.key, listing, formatDate)}
          </Row>
        ))}
      </dl>

      <p className="text-[11px] text-muted-foreground">
        {checked && google
          ? `Last compared with Google on ${formatDateTime(google.lastSyncedAt)}. Only some fields are compared; the rest say so.`
          : "We haven't compared this with Google recently."}
      </p>
    </Card>
  );
}
