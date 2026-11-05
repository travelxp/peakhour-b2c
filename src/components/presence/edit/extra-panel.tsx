"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangeCard } from "@/components/presence/edit/change-card";
import { useChangeOutcomes, useEditCapabilities, useListingChanges } from "@/hooks/use-presence-edit";
import { useExtra, useExtraMutations, useRefreshWhenSettled, type ExtraTarget } from "@/hooks/use-presence-extras";
import { useListingQuery } from "@/hooks/use-presence-listing";
import { errorWords, type CapabilitiesResponse, type ChangeCardData } from "@/lib/presence-edit";
import { capabilityOf, drawsPanel, extrasAccess, listedChanges, listView, withChangesKnown, type ExtraField, type ListView } from "@/lib/presence-extras";
import { outcomeOf, type PhotoAccess } from "@/lib/presence-photos";
import { fetchView, primaryEntry } from "@/lib/presence-panels";

/** What a panel's body is handed once its read has answered. */
export interface PanelContext<D> {
  data: D;
  label: string;
  network: string;
  listingId: string;
  access: PhotoAccess;
  view: Extract<ListView, { kind: "ready" | "empty" }>;
  changes: ChangeCardData[] | undefined;
  can: CapabilitiesResponse["can"] | undefined;
  busy: boolean;
  /** Prepares a change and answers with the words to show. Never "saved": the change waits for an approval. */
  submit: (value: unknown) => Promise<{ ok: boolean; message: string }>;
}

/**
 * The shell of the posts, services, details and links panels (PE-12): the listing, the capabilities, the read of what the network holds, the
 * states (loading, waiting for a connection, failed with Try again, a stale refresh), the switch-off notice, and the panel's own change cards.
 *
 * MARKUP ONLY. What is drawn is `lib/presence-extras.ts`. ★A panel is drawn ONLY for a network whose declaration offers it: this returns nothing
 * otherwise, not a disabled control. ★A submit prepares a change; nothing is sent until an admin approves it.
 */
export function ExtraPanel<D extends { label: string; writes: { notice: string | null } }>({
  field,
  location,
  network: chosenNetwork,
  title,
  blurb,
  what,
  itemCount,
  children,
}: {
  field: ExtraField;
  location?: string | undefined;
  network?: string | undefined;
  title: string;
  blurb: string;
  /** The plural noun the role sentences use ("posts", "services"). */
  what: string;
  itemCount: (d: D) => number;
  children: (ctx: PanelContext<D>) => React.ReactNode;
}) {
  const listingQ = useListingQuery(location, chosenNetwork);
  const listing = listingQ.data?.listing ?? null;
  const entry = primaryEntry(listingQ.data);
  const network = entry?.network;
  const caps = useEditCapabilities();
  const capsView = fetchView({ hasData: !!caps.data, isPending: caps.isPending, isError: caps.isError, fetchStatus: caps.fetchStatus });
  const drawn = drawsPanel(capabilityOf(caps.data, network), field);
  const target: ExtraTarget | null = listing && network ? { listingId: listing.id, network } : null;
  const q = useExtra(field, listing?.id, network, drawn);
  const changes = useListingChanges(drawn ? listing?.id : undefined);
  const outcomes = useChangeOutcomes(listing?.id, changes.data?.items, caps.data);
  const changesView = fetchView({ hasData: !!changes.data, isPending: changes.isPending, isError: changes.isError, fetchStatus: changes.fetchStatus });
  useRefreshWhenSettled(field, changes.data?.items, target);
  const m = useExtraMutations(field, target);
  const [busy, setBusy] = useState(false);

  const header = (
    <div>
      <h2 className="font-medium">{title}</h2>
      <p className="text-xs text-muted-foreground">{blurb} Nothing is sent until it is approved.</p>
    </div>
  );

  if (listingQ.isPending || (capsView === "loading" || capsView === "paused")) {
    // The listing and the capabilities decide whether the panel exists at all: until both have answered, a skeleton, never a flash of the panel.
    return (
      <Card className="gap-3 p-5">
        {header}
        <Skeleton className="h-16 w-full" />
        {(listingQ.fetchStatus === "paused" || capsView === "paused") && <p className="text-xs text-muted-foreground">Waiting for a connection.</p>}
      </Card>
    );
  }
  if (listingQ.isError && !listingQ.data) {
    return (
      <Card className="gap-3 p-5">
        {header}
        <p className="text-sm">We could not load your listing, so this is not available. This is a problem loading the page, not with your listing.</p>
        <Button size="sm" variant="outline" className="w-fit" onClick={() => listingQ.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }
  // A network that does not declare the panel draws nothing at all.
  if (!listing || !network || !target || !drawn) return null;

  const data = q.data;
  const label = data?.label ?? entry?.label ?? "the network";
  const view = listView(fetchView({ hasData: !!data, isPending: q.isPending, isError: q.isError, fetchStatus: q.fetchStatus }), data ? itemCount(data as unknown as D) : 0);
  const access: PhotoAccess = withChangesKnown(extrasAccess(capsView, caps.data?.can, what), changesView, what);
  const items = changes.data?.items;

  async function submit(value: unknown): Promise<{ ok: boolean; message: string }> {
    setBusy(true);
    try {
      const out = outcomeOf(await m.propose.mutateAsync({ ...target!, proposal: { field, value } }));
      await m.refresh(target!);
      if (out.kind === "prepared") return { ok: true, message: "Your change is prepared and checked. Review it below, then approve it." };
      if (out.kind === "not_checked") return { ok: true, message: `Your change is prepared, but ${label} could not check it just now. It is waiting below.` };
      return { ok: false, message: out.message };
    } catch (err) {
      return { ok: false, message: errorWords(err) };
    } finally {
      setBusy(false);
    }
  }

  const body =
    view.kind === "loading" || view.kind === "paused" ? (
      <>
        <Skeleton className="h-16 w-full" />
        {view.kind === "paused" && <p className="text-xs text-muted-foreground">Waiting for a connection.</p>}
      </>
    ) : view.kind === "failed" || !data ? (
      <>
        <p role="alert" className="text-sm">
          {errorWords(q.error)}
        </p>
        <Button size="sm" variant="outline" className="w-fit" onClick={() => q.refetch()}>
          Try again
        </Button>
      </>
    ) : (
      <>
        {data.writes.notice && (
          <p role="status" className="rounded-md border border-warning/40 p-3 text-xs text-warning-on-tint">
            {data.writes.notice}
          </p>
        )}
        {view.stale && <p className="text-xs text-warning-on-tint">Could not refresh just now, so this may be out of date.</p>}
        {children({ data: data as unknown as D, label, network, listingId: listing.id, access, view, changes: items, can: caps.data?.can, busy, submit })}
      </>
    );

  const list = listedChanges(items, network, field, 8);
  return (
    <Card className="gap-4 p-5">
      {header}
      {body}
      {access.mode === "view" && view.kind !== "ready" && view.kind !== "empty" && <p className="text-xs text-muted-foreground">{access.why}</p>}

      <div className="space-y-3">
        <h3 className="text-sm font-medium">{title} changes</h3>
        {changes.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : changes.isError && !changes.data ? (
          <div className="flex items-center gap-2">
            <p className="text-xs text-destructive">We could not load your changes just now.</p>
            <Button size="sm" variant="outline" onClick={() => changes.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            {changes.isError && <p className="text-xs text-warning-on-tint">Could not refresh just now, so these may be out of date.</p>}
            {list.length > 0 ? (
              list.map((c) => <ChangeCard key={c.id} change={c} label={label} can={caps.data?.can} m={m} outcome={outcomes.slotFor(c)} />)
            ) : (
              <p className="text-xs text-muted-foreground">No changes yet.</p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
