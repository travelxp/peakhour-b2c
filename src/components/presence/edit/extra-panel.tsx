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
import { capabilityOf, drawsPanel, extrasAccess, isListChanged, listedChanges, preparedWords, withChangesKnown, type ExtraField } from "@/lib/presence-extras";
import { outcomeOf, type PhotoAccess } from "@/lib/presence-photos";
import { fetchView, primaryEntry } from "@/lib/presence-panels";

/** What a panel's body is handed once its read has answered. */
export interface PanelContext<D> {
  data: D;
  label: string;
  network: string;
  access: PhotoAccess;
  changes: ChangeCardData[] | undefined;
  can: CapabilitiesResponse["can"] | undefined;
  busy: boolean;
  /**
   * Prepares a change and answers with the words to show. Never "saved": the change waits for an approval. `stale` is the api refusing a change
   * built on a list that has since changed: the panel has already reloaded, and the card drops its draft. `base` is the base the draft STARTED from.
   */
  submit: (value: unknown, base?: string) => Promise<{ ok: boolean; message: string; stale?: boolean }>;
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
  children,
}: {
  field: ExtraField;
  location?: string | undefined;
  network?: string | undefined;
  title: string;
  blurb: string;
  /** The plural noun the role sentences use ("posts", "services"). */
  what: string;
  children: (ctx: PanelContext<D>) => React.ReactNode;
}) {
  const listingQ = useListingQuery(location, chosenNetwork);
  const listing = listingQ.data?.listing ?? null;
  const entry = primaryEntry(listingQ.data);
  const network = entry?.network;
  const caps = useEditCapabilities();
  // WHETHER THE PANEL EXISTS IS DECIDED BY THE CHOSEN NETWORK'S DECLARATION FIRST, before the listing is read: a network with no such panel draws
  // nothing at all (no skeleton, no "could not load"). Until the capabilities have answered, nothing is drawn either; a read that failed or is paused
  // draws nothing too, because no declaration says this panel exists (the edit card above states that failure).
  const wanted = chosenNetwork ?? network;
  const drawn = drawsPanel(capabilityOf(caps.data, network), field);
  const declared = wanted ? drawsPanel(capabilityOf(caps.data, wanted), field) : !!caps.data?.items.some((c) => drawsPanel(c, field));
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

  if (!declared) return null;
  if (listingQ.isPending) {
    // The declaration says this panel exists; the listing says which place it is for. Until it answers, a skeleton.
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
  const readView = fetchView({ hasData: !!data, isPending: q.isPending, isError: q.isError, fetchStatus: q.fetchStatus });
  const stale = readView === "data_stale";
  // Drawn only once the capabilities have answered, so what this role can do is known.
  const access: PhotoAccess = withChangesKnown(extrasAccess(caps.data?.can, what), changesView, what);
  const items = changes.data?.items;

  async function submit(value: unknown, base?: string): Promise<{ ok: boolean; message: string; stale?: boolean }> {
    setBusy(true);
    try {
      // The base of the list the DRAFT started from (not the one the page holds now): the api refuses the change if the network's list is no longer that.
      const out = outcomeOf(await m.propose.mutateAsync({ ...target!, proposal: { field, value, ...(base ? { base } : {}) } }));
      // Only the change list is read again, and not waited for: the card has its answer.
      void m.refreshChanges(target!);
      if (out.kind === "prepared") return { ok: true, message: preparedWords(caps.data?.can, label, true) };
      if (out.kind === "not_checked") return { ok: true, message: preparedWords(caps.data?.can, label, false) };
      return { ok: false, message: out.message };
    } catch (err) {
      if (isListChanged(err)) {
        await m.refresh(target!);
        return { ok: false, stale: true, message: `${errorWords(err)} The list has been reloaded; make your change again from what is there now.` };
      }
      return { ok: false, message: errorWords(err) };
    } finally {
      setBusy(false);
    }
  }

  const body =
    readView === "loading" || readView === "paused" ? (
      <>
        <Skeleton className="h-16 w-full" />
        {readView === "paused" && <p className="text-xs text-muted-foreground">Waiting for a connection.</p>}
      </>
    ) : readView === "failed" || !data ? (
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
        {/* Whether changes are sent is said ONCE, by the publishing status above the panels (GBP Issue 1), never per panel. */}
        {stale && <p className="text-xs text-warning-on-tint">Could not refresh just now, so this may be out of date.</p>}
        {children({ data: data as unknown as D, label, network, access, changes: items, can: caps.data?.can, busy, submit })}
      </>
    );

  const list = listedChanges(items, network, field, 8);
  return (
    <Card className="gap-4 p-5">
      {header}
      {body}
      {access.mode === "view" && !data && <p className="text-xs text-muted-foreground">{access.why}</p>}

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
