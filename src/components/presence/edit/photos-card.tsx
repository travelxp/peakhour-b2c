"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DrivePicker } from "@/components/drive/drive-picker";
import { ChangeCard } from "@/components/presence/edit/change-card";
import { useEditCapabilities, useListingChanges } from "@/hooks/use-presence-edit";
import { usePhotoMutations, usePhotos } from "@/hooks/use-presence-photos";
import { useListingQuery } from "@/hooks/use-presence-listing";
import { fetchView, primaryEntry } from "@/lib/presence-panels";
import { errorWords } from "@/lib/presence-edit";
import { canAddPhoto, categoryLabel, limitsSentence, photoControls, photosView, unusableReason } from "@/lib/presence-photos";

/**
 * Your photos (PE-11): pick photos from Peakhour Drive, see what is on the listing, remove one. Customer photos are shown and never deletable.
 *
 * MARKUP ONLY. What is drawn, what each state says and what a role may press are in `lib/presence-photos.ts`, and every word about a network
 * comes from the api (the adapter's label and declaration). This card is drawn only for a network that declares photos.
 * ★Adding or removing a photo PREPARES a change. Nothing is sent until an admin approves it, and the change's own notes (that a private
 * photo is made reachable for a few minutes and then shows on the listing; whether a removal can be brought back) sit above Approve.
 * ★No AI and no charge: the Generate tab of the picker is left out, and syncing and approved edits are free.
 */
export function PhotosCard({ location, network: chosenNetwork }: { location?: string | undefined; network?: string | undefined }) {
  const listingQ = useListingQuery(location, chosenNetwork);
  const listing = listingQ.data?.listing ?? null;
  const network = primaryEntry(listingQ.data)?.network;
  const caps = useEditCapabilities();
  const photosQ = usePhotos(listing?.id, network);
  const changes = useListingChanges(listing?.id);
  const m = usePhotoMutations(listing?.id, network);
  const [category, setCategory] = useState("");

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
  if (!listing || !network) return null;

  const view = photosView(
    fetchView({ hasData: !!photosQ.data, isPending: photosQ.isPending, isError: photosQ.isError, fetchStatus: photosQ.fetchStatus }),
    photosQ.data?.items.length ?? 0,
  );
  if (view.kind === "loading" || view.kind === "paused") {
    return (
      <Card className="gap-3 p-5">
        {header}
        <Skeleton className="h-24 w-full" />
        {view.kind === "paused" && <p className="text-xs text-muted-foreground">Waiting for a connection.</p>}
      </Card>
    );
  }
  const data = photosQ.data;
  if (view.kind === "failed" || !data) {
    return (
      <Card className="gap-3 p-5">
        {header}
        <p role="alert" className="text-sm">
          {errorWords(photosQ.error)}
        </p>
        <Button size="sm" variant="outline" className="w-fit" onClick={() => photosQ.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }

  const can = caps.data?.can;
  const add = canAddPhoto(can, data);
  const waiting = data.waiting.length > 0;
  const photoChanges = (changes.data?.items ?? []).filter((c) => c.field === "media").slice(0, 5);
  const label = data.label;

  return (
    <Card className="gap-4 p-5" id="photos-card">
      {header}
      {data.writes.notice && (
        <p role="status" className="rounded-md border border-warning/40 p-3 text-xs text-warning-on-tint">
          {data.writes.notice}
        </p>
      )}
      {view.stale && <p className="text-xs text-warning-on-tint">Could not refresh just now, so this may be out of date.</p>}
      <p className="text-xs text-muted-foreground">{limitsSentence(data.declaration.limits, label)}</p>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Add a photo</h3>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="photo-category">
            Category
          </label>
          <select
            id="photo-category"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={category}
            disabled={!add.ok}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Choose a category</option>
            {data.declaration.categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
          <DrivePicker
            trigger={
              <Button size="sm" variant="outline" disabled={!add.ok || !category || m.propose.isPending}>
                {m.propose.isPending ? "Preparing..." : "Choose from Drive"}
              </Button>
            }
            kinds={["image"]}
            maxSelection={1}
            tabs={["drive", "upload"]}
            requirePublicUrl={false}
            needUrl={false}
            uploadAs="private"
            addLabel="Use this photo"
            unusable={(f) => unusableReason(f, data.declaration.limits)}
            onSelect={(assets) => {
              const first = assets[0];
              if (first && category) m.propose.mutate({ op: "add", mediaId: first.id, category });
            }}
          />
        </div>
        {add.why && <p className="text-xs text-muted-foreground">{add.why}</p>}
        {m.propose.isError && (
          <p role="alert" className="text-xs text-destructive">
            {errorWords(m.propose.error)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">On your listing</h3>
        {view.empty ? (
          <p className="text-xs text-muted-foreground">There are no photos on {label} yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((p) => {
              const ctl = photoControls(can, p, waiting);
              const src = p.thumbnailUrl ?? p.url;
              return (
                <li key={p.ref} className="space-y-2 rounded-lg border p-3">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={p.category ? `${categoryLabel(p.category)} photo` : "A photo on your listing"} className="aspect-video w-full rounded-md bg-muted object-cover" />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">No preview</div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {p.category && <span className="text-xs text-muted-foreground">{categoryLabel(p.category)}</span>}
                    {p.source === "customer" && <Badge variant="secondary">Added by a customer</Badge>}
                  </div>
                  {p.source === "customer" ? (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {p.attribution?.name && <p>Credited to {p.attribution.name}</p>}
                      <p>{p.notRemovableBecause}</p>
                      {p.attribution?.reportUrl && (
                        <a className="underline" href={p.attribution.reportUrl} target="_blank" rel="noreferrer noopener">
                          Report this photo to {label}
                        </a>
                      )}
                    </div>
                  ) : ctl.remove ? (
                    <Button size="sm" variant="outline" disabled={m.propose.isPending} onClick={() => m.propose.mutate({ op: "remove", ref: p.ref })}>
                      Remove
                    </Button>
                  ) : ctl.whyNot ? (
                    <p className="text-xs text-muted-foreground">{ctl.whyNot}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Photo changes</h3>
        {changes.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : changes.isError && !changes.data ? (
          <div className="flex items-center gap-2">
            <p className="text-xs text-destructive">We could not load your photo changes just now.</p>
            <Button size="sm" variant="outline" onClick={() => changes.refetch()}>
              Try again
            </Button>
          </div>
        ) : photoChanges.length > 0 ? (
          photoChanges.map((c) => <ChangeCard key={c.id} change={c} label={label} can={caps.data?.can} m={m} />)
        ) : (
          <p className="text-xs text-muted-foreground">No photo changes yet.</p>
        )}
      </div>
    </Card>
  );
}
