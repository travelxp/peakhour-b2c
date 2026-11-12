"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DrivePicker } from "@/components/drive/drive-picker";
import { WaitingLine } from "@/components/presence/edit/waiting-line";
import { useEditCapabilities, useListingChanges } from "@/hooks/use-presence-edit";
import { usePhotoMutations, usePhotos, useRefreshPhotosWhenSettled, type PhotoTarget } from "@/hooks/use-presence-photos";
import { useListingQuery } from "@/hooks/use-presence-listing";
import { fetchView, primaryEntry } from "@/lib/presence-panels";
import { errorWords } from "@/lib/presence-edit";
import {
  batchSummary,
  canAddPhoto,
  categoryLabel,
  inFlightPhotoChanges,
  limitsSentence,
  openPhotoChanges,
  outcomeOf,
  pendingFor,
  pendingNote,
  photoAccess,
  photoControls,
  photosView,
  pickLimit,
  previewOf,
  unusableReason,
  withChangesKnown,
  type Batch,
} from "@/lib/presence-photos";
import type { MediaAsset } from "@/components/composer/types";

/**
 * Your photos (PE-11): pick photos from Peakhour Drive (several at once, each its own change), see what is on the listing, remove one. Customer
 * photos are shown and never deletable.
 *
 * MARKUP ONLY. What is drawn, what each state says and what a role may press are in `lib/presence-photos.ts`, and every word about a network
 * comes from the api (the adapter's label and declaration). This card is drawn only for a network that declares photos, and the page KEYS it by
 * place and network, so its state (a category chosen, a batch summary, a tile's error) never outlives the place it was about.
 * ★Adding or removing a photo PREPARES a change. Nothing is sent until an admin approves it, and the change's own notes (that a private
 * photo is made reachable for a few minutes and then shows on the listing; whether a removal can be brought back) sit above Approve.
 * ★What is WAITING comes from the change list (the one source, polled, every open change always in it), never from the photo read; adding and
 * removing wait until it has answered; and the photo changes are listed whatever the photo read did, so a change is never out of sight.
 * ★A proposal's ANSWER is read: a blocked row or one the network could not check is reported, never counted as prepared.
 * ★No AI and no charge: the Generate tab of the picker is left out, and syncing and approved edits are free.
 */
export function PhotosCard({ location, network: chosenNetwork }: { location?: string | undefined; network?: string | undefined }) {
  const listingQ = useListingQuery(location, chosenNetwork);
  const listing = listingQ.data?.listing ?? null;
  const entry = primaryEntry(listingQ.data);
  const network = entry?.network;
  const target: PhotoTarget | null = listing && network ? { listingId: listing.id, network } : null;
  const caps = useEditCapabilities();
  const capsView = fetchView({ hasData: !!caps.data, isPending: caps.isPending, isError: caps.isError, fetchStatus: caps.fetchStatus });
  const photosQ = usePhotos(listing?.id, network);
  const changes = useListingChanges(listing?.id);
  const changesView = fetchView({ hasData: !!changes.data, isPending: changes.isPending, isError: changes.isError, fetchStatus: changes.fetchStatus });
  useRefreshPhotosWhenSettled(changes.data?.items, target);
  const m = usePhotoMutations(target);
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [tileError, setTileError] = useState<{ ref: string; message: string } | null>(null);

  const header = (
    <div>
      <h2 className="font-medium">Your photos</h2>
      <p className="text-xs text-muted-foreground">Choose photos from your Drive, see what is on your listing, or remove one. Nothing is sent until it is approved.</p>
    </div>
  );

  if (listingQ.isPending) {
    return (
      <Card className="gap-3 p-5">
        {header}
        <Skeleton className="h-24 w-full" />
        {listingQ.fetchStatus === "paused" && <p className="text-xs text-muted-foreground">Waiting for a connection.</p>}
      </Card>
    );
  }
  if (listingQ.isError && !listingQ.data) {
    return (
      <Card className="gap-3 p-5">
        {header}
        <p className="text-sm">We could not load your listing, so your photos are not available. This is a problem loading the page, not with your listing.</p>
        <Button size="sm" variant="outline" className="w-fit" onClick={() => listingQ.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }
  if (!listing || !network || !target) return null;

  const data = photosQ.data;
  const label = data?.label ?? entry?.label ?? "the network";
  const view = photosView(
    fetchView({ hasData: !!data, isPending: photosQ.isPending, isError: photosQ.isError, fetchStatus: photosQ.fetchStatus }),
    data?.items.length ?? 0,
  );
  // The role first, then whether the waiting changes are known: either one withholds Remove and adding, with its own reason.
  const access = withChangesKnown(photoAccess(capsView, caps.data?.can), changesView);
  const items = changes.data?.items;
  const waitingAdds = inFlightPhotoChanges(items, network).filter((c) => (c.after as { op?: string } | null)?.op === "add").length;
  const openIds = new Set(openPhotoChanges(items, network).map((c) => c.id));

  async function addMany(assets: MediaAsset[]) {
    if (!category || assets.length === 0) return;
    setBusy(true);
    setBatch(null);
    const next: Batch = { prepared: [], failed: [], notChecked: [] };
    // One change per photo, one after another: each is checked on its own, and one refusal does not lose the others. Nothing is re-read between
    // them; the lists are refreshed ONCE, after the last.
    for (const a of assets) {
      const name = a.name ?? "A photo";
      try {
        const out = outcomeOf(await m.propose.mutateAsync({ ...target!, value: { op: "add", mediaId: a.id, category } }));
        if (out.kind === "prepared") next.prepared.push(out.id);
        else if (out.kind === "not_checked") next.notChecked.push({ name, message: out.message });
        else next.failed.push({ name, message: out.message });
      } catch (err) {
        next.failed.push({ name, message: errorWords(err) });
      }
    }
    await m.refresh(target!);
    setBusy(false);
    setBatch(next);
  }

  async function removeOne(ref: string) {
    setTileError(null);
    setBusy(true);
    try {
      const out = outcomeOf(await m.propose.mutateAsync({ ...target!, value: { op: "remove", ref } }));
      if (out.kind === "blocked") setTileError({ ref, message: out.message });
      else if (out.kind === "not_checked") setTileError({ ref, message: `It is prepared, but ${label} could not check it just now: ${out.message}` });
    } catch (err) {
      setTileError({ ref, message: errorWords(err) });
    }
    await m.refresh(target!);
    setBusy(false);
  }

  const body =
    view.kind === "loading" || view.kind === "paused" ? (
      <>
        <Skeleton className="h-24 w-full" />
        {view.kind === "paused" && <p className="text-xs text-muted-foreground">Waiting for a connection.</p>}
      </>
    ) : view.kind === "failed" || !data ? (
      <>
        <p role="alert" className="text-sm">
          {errorWords(photosQ.error)}
        </p>
        <Button size="sm" variant="outline" className="w-fit" onClick={() => photosQ.refetch()}>
          Try again
        </Button>
      </>
    ) : (
      <>
        {/* Whether changes are sent is said ONCE, by the publishing status above the panels (GBP Issue 1), never per panel. */}
        {view.stale && <p className="text-xs text-warning-on-tint">Could not refresh just now, so this may be out of date.</p>}
        {!data.complete && <p className="text-xs text-warning-on-tint">We could not read every one of your photos from {label} just now, so this list may be missing some.</p>}
        {data.customersComplete === false && <p className="text-xs text-warning-on-tint">We could not read the photos your customers added on {label} just now, so they may be missing here.</p>}
        <p className="text-xs text-muted-foreground">{limitsSentence(data.declaration.limits, label)}</p>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Add photos</h3>
          {(() => {
            const add = canAddPhoto(access, data, waitingAdds);
            const text = batchSummary(batch, openIds, caps.data?.can);
            return (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor="photo-category">
                    Category
                  </label>
                  <select id="photo-category" className="h-9 rounded-md border bg-background px-2 text-sm" value={category} disabled={!add.ok} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">Choose a category</option>
                    {data.declaration.categories.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel(c)}
                      </option>
                    ))}
                  </select>
                  <DrivePicker
                    trigger={
                      <Button size="sm" variant="outline" disabled={!add.ok || !category || busy}>
                        {busy ? "Preparing..." : "Choose from Drive"}
                      </Button>
                    }
                    kinds={["image"]}
                    maxSelection={pickLimit(data, waitingAdds)}
                    tabs={["drive", "upload"]}
                    requirePublicUrl={false}
                    needUrl={false}
                    uploadAs="private"
                    addLabel="Use these photos"
                    unusable={(f) => unusableReason(f, data.declaration.limits)}
                    onSelect={(assets) => void addMany(assets)}
                  />
                </div>
                {add.why && <p className="text-xs text-muted-foreground">{add.why}</p>}
                {text && (
                  <p role="status" className="text-xs text-muted-foreground">
                    {text}
                  </p>
                )}
              </>
            );
          })()}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">On your listing</h3>
          {view.empty ? (
            <p className="text-xs text-muted-foreground">There are no photos on {label} yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((p) => {
                const pending = pendingFor(items, network, p.ref);
                const ctl = photoControls(access, p, pending);
                const src = previewOf(p);
                return (
                  <li key={p.ref} className="space-y-2 rounded-lg border p-3">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} loading="lazy" alt={p.category ? `${categoryLabel(p.category)} photo` : "A photo on your listing"} className="aspect-video w-full rounded-md bg-muted object-cover" />
                    ) : (
                      <div className="flex aspect-video w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">{p.format === "photo" ? "No preview" : "No preview (not a photo)"}</div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {p.category && <span className="text-xs text-muted-foreground">{categoryLabel(p.category)}</span>}
                      {p.source === "customer" && <Badge variant="secondary">Added by a customer</Badge>}
                    </div>
                    {/* Anything that cannot be removed says why: a customer's photo, a video, whatever the api marks. */}
                    {!p.removable && (
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {p.source === "customer" && p.attribution?.name && <p>Credited to {p.attribution.name}</p>}
                        {p.notRemovableBecause && <p>{p.notRemovableBecause}</p>}
                        {p.source === "customer" && p.attribution?.reportUrl && (
                          <a className="underline" href={p.attribution.reportUrl} target="_blank" rel="noreferrer noopener">
                            Report this photo to {label}
                          </a>
                        )}
                      </div>
                    )}
                    {pending && <p className="text-xs text-muted-foreground">{pendingNote(pending.status, caps.data?.can)}</p>}
                    {ctl.remove && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void removeOne(p.ref)}>
                        Remove
                      </Button>
                    )}
                    {ctl.note && !pending && <p className="text-xs text-muted-foreground">{ctl.note}</p>}
                    {tileError?.ref === p.ref && (
                      <p role="alert" className="text-xs text-destructive">
                        {tileError.message}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </>
    );

  return (
    <Card className="gap-4 p-5">
      {header}
      {body}
      {access.mode === "view" && view.kind !== "ready" && <p className="text-xs text-muted-foreground">{access.why}</p>}
      {/* GBP L7: where a photo request stands lives in "Your requests", once. */}
      <WaitingLine changes={items} matches={(c) => c.field === "media" && c.network === network} />
    </Card>
  );
}
