"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangeCard } from "@/components/presence/edit/change-card";
import { FieldForm } from "@/components/presence/edit/field-form";
import { HolidayOffersCard } from "@/components/presence/edit/holiday-offers-card";
import { useChangeOutcomes, useEditCapabilities, useListingChanges, usePresenceEditMutations } from "@/hooks/use-presence-edit";
import { useListingQuery } from "@/hooks/use-presence-listing";
import { fetchView, primaryEntry } from "@/lib/presence-panels";
import { drawnExtraFields } from "@/lib/presence-extras";
import { capabilityFor, drawnSections, errorWords, formAccess, requestedForm, writesNote, type EditField } from "@/lib/presence-edit";

/** Another card asking for a field's form. A new object each time, so asking twice for one field opens it twice. */
export type EditRequest = { field: string };

/**
 * Change your listing (PE-07). Every control here is DRAWN FROM what the network declares it can write, and every submit makes a PROPOSAL.
 *
 * MARKUP ONLY. What is drawn, what each state says and what a role may press are in `lib/presence-edit.ts`.
 * ★A submit prepares a change. It is not saved, and nothing is sent, until a person approves it; whether it is then sent depends on the
 * operator's switch, which this card reports in plain words. Never "saved", never "live" before the engine says so.
 */
export function EditListingCard({
  location,
  network: chosenNetwork,
  request,
  photoChangesElsewhere = false,
}: {
  location?: string | undefined;
  network?: string | undefined;
  request?: EditRequest | null;
  /**
   * True when the photos card is drawn and lists this network's photo changes itself. Otherwise they are listed here, so a change is never out of
   * sight; and another network's photo changes always are (the photos card shows one network's).
   */
  photoChangesElsewhere?: boolean;
}) {
  const listingQ = useListingQuery(location, chosenNetwork);
  const caps = useEditCapabilities();
  const listing = listingQ.data?.listing ?? null;
  const network = primaryEntry(listingQ.data)?.network;
  const changes = useListingChanges(listing?.id);
  const outcomes = useChangeOutcomes(listing?.id, changes.data?.items, caps.data);
  const m = usePresenceEditMutations(listing?.id);
  const [open, setOpen] = useState<EditField | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Waits for the capabilities, then answers each request once, during render (React's way to adjust state when a prop changes).
  // Above the early returns, because a hook's order cannot change.
  const [answered, setAnswered] = useState<EditRequest | null>(null);
  if (request && request !== answered && caps.data && listing) {
    const answer = requestedForm(drawnSections(capabilityFor(caps.data, network)), formAccess(caps.data.can), request.field);
    setAnswered(request);
    setOpen(answer.open);
    setNotice(answer.notice);
  }

  const header = (
    <div>
      <h2 className="font-medium">Change your listing</h2>
      <p className="text-xs text-muted-foreground">Prepare a change, check it, and have it approved. Nothing is sent until it is approved.</p>
    </div>
  );

  // The listing first: with none to edit there is nothing to wait for, and a failed read is not "no listing".
  if (listingQ.isPending) {
    return (
      <Card className="gap-3 p-5">
        {header}
        <Skeleton className="h-16 w-full" />
        {listingQ.fetchStatus === "paused" && <p className="text-xs text-muted-foreground">Waiting for a connection.</p>}
      </Card>
    );
  }
  if (listingQ.isError && !listingQ.data) {
    return (
      <Card className="gap-3 p-5">
        {header}
        <p className="text-sm">We could not load your listing, so the forms are not available. This is a problem loading the page, not with your listing.</p>
        <Button size="sm" variant="outline" className="w-fit" onClick={() => listingQ.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }
  // No listing yet (not connected, importing): the listing card above already says why.
  if (!listing) return null;

  const view = fetchView({ hasData: !!caps.data, isPending: caps.isPending, isError: caps.isError, fetchStatus: caps.fetchStatus });
  if (view === "loading" || view === "paused") {
    return (
      <Card className="gap-3 p-5">
        {header}
        <Skeleton className="h-16 w-full" />
        {view === "paused" && <p className="text-xs text-muted-foreground">Waiting for a connection.</p>}
      </Card>
    );
  }
  if (view === "failed" || !caps.data) {
    return (
      <Card className="gap-3 p-5">
        {header}
        <p className="text-sm">We could not load what you can change. This is a problem loading the page, not with your listing.</p>
        <Button size="sm" variant="outline" className="w-fit" onClick={() => caps.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }
  // No listing yet (not connected, importing): the listing card above already says why.
  if (!listing) return null;

  const cap = capabilityFor(caps.data, network);
  const sections = drawnSections(cap);
  const access = formAccess(caps.data.can);
  if (!cap || sections.length === 0) {
    return (
      <Card className="gap-3 p-5">
        {header}
        <p className="text-sm text-muted-foreground">Changes to this listing cannot be made from Peakhour yet.</p>
      </Card>
    );
  }
  const switchNote = writesNote(cap);
  // A change is listed by its own panel when that panel is drawn (photos, posts, services, details, links), so it is never listed twice.
  const extraFields = new Set<string>(drawnExtraFields(cap));
  const listedElsewhere = (c: { field: string; network: string }) => c.network === network && ((photoChangesElsewhere && c.field === "media") || extraFields.has(c.field));
  const ordinary = sections.filter((s) => !s.risky);
  const risky = sections.filter((s) => s.risky);

  function submit(field: EditField, value: unknown) {
    setNotice(null);
    m.propose.mutate(
      { listingId: listing!.id, network: cap!.network, changes: [{ field, value }] },
      {
        onSuccess: (r) => {
          setOpen(null);
          setNotice(
            r.notChecked.length
              ? `Your change is prepared, but ${cap!.label} could not check it just now. It is waiting below.`
              : "Your change is prepared and checked. Review it below, then approve it.",
          );
        },
      },
    );
  }

  const row = (s: (typeof sections)[number]) => (
    <li key={s.field} className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{s.title}</p>
          <p className="text-xs text-muted-foreground">{s.blurb}</p>
        </div>
        {access.mode === "edit" && open !== s.field && (
          <Button size="sm" variant="outline" onClick={() => { setOpen(s.field); setNotice(null); m.propose.reset(); }}>
            Change
          </Button>
        )}
      </div>
      {open === s.field && (
        <>
          <FieldForm section={s} cap={cap} listing={listing} listingId={listing.id} submitting={m.propose.isPending} onSubmit={submit} onCancel={() => setOpen(null)} />
          {m.propose.isError && (
            <p role="alert" className="text-xs text-destructive">
              {errorWords(m.propose.error)}
            </p>
          )}
        </>
      )}
    </li>
  );

  return (
    <Card className="gap-4 p-5">
      {header}
      {switchNote && <p className="rounded-md border border-warning/40 p-3 text-xs text-warning-on-tint">{switchNote}</p>}
      {access.mode === "view" && <p className="text-xs text-muted-foreground">{access.why}</p>}
      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}

      {access.mode === "edit" && network && <HolidayOffersCard listingId={listing.id} network={network} label={cap.label} />}

      <ul className="divide-y">{ordinary.map(row)}</ul>
      {risky.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Needs extra care</p>
          <ul className="divide-y">{risky.map(row)}</ul>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Changes</h3>
        {changes.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : changes.isError && !changes.data ? (
          <div className="flex items-center gap-2">
            <p className="text-xs text-destructive">We could not load your changes just now.</p>
            <Button size="sm" variant="outline" onClick={() => changes.refetch()}>
              Try again
            </Button>
          </div>
        ) : changes.data && changes.data.items.some((c) => !listedElsewhere(c)) ? (
          <>
            {changes.isError && <p className="text-xs text-warning-on-tint">Could not refresh just now, so this may be out of date.</p>}
            {/* Photo changes are listed with the photos when that card is drawn; otherwise here. */}
            {changes.data.items.filter((c) => !listedElsewhere(c)).map((c) => (
              <ChangeCard key={c.id} change={c} label={cap.label} can={caps.data.can} m={m} outcome={outcomes.slotFor(c)} />
            ))}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No changes yet.</p>
        )}
      </div>
    </Card>
  );
}
