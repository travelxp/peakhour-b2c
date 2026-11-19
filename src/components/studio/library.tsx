"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { creativeApi, type LibraryItem, type ProductPhotoTile } from "@/lib/api/creative";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DrivePicker } from "@/components/drive/drive-picker";
import { driveAbilities } from "@/lib/drive/files-state";
import { downloadLink } from "@/lib/download";
import { useStudioPrefs } from "@/hooks/use-studio";
import { LIBRARY_KEYS, useImportStatus, useLibrary, useProductPhotos, useProductPhotosOne } from "@/hooks/use-studio-library";
import { bulkSummary, creativeHref, downloadChoices, filterQuery, itemTitle } from "@/lib/studio-library";
import { ideasFeedStatus } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { useAuth } from "@/providers/auth-provider";
import { BulkBar, CreativesView, ProductPhotoList, ProductPhotosView } from "./library-view";

const C = STUDIO_COPY.library;

export interface FilterValues {
  status: string;
  publish: string;
  channel: string;
  from: string;
  to: string;
}
export const NO_FILTERS: FilterValues = { status: "has_final", publish: "", channel: "", from: "", to: "" };

const selectClass = "h-11 w-full rounded-md border border-input bg-transparent px-3 text-base md:text-sm";

/** The search and filters for "Made in Studio". Pro tools adds them (UX spec S14): state, where it was sent, channel and date; labelled, 44 px tall, no hover-only parts. */
export function LibraryFilters({
  q,
  values,
  onQ,
  onChange,
}: {
  q: string;
  values: FilterValues;
  onQ: (v: string) => void;
  onChange: (next: Partial<FilterValues>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
        <Label htmlFor="studio-library-search">{C.searchLabel}</Label>
        <Input id="studio-library-search" type="search" className="h-11" value={q} placeholder={C.searchPlaceholder} onChange={(e) => onQ(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="studio-library-status">{C.statusLabel}</Label>
        <select id="studio-library-status" value={values.status} onChange={(e) => onChange({ status: e.target.value })} className={selectClass}>
          {Object.entries(C.statuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="studio-library-sent">{C.sentLabel}</Label>
        <select id="studio-library-sent" value={values.publish} onChange={(e) => onChange({ publish: e.target.value })} className={selectClass}>
          {Object.entries(C.sentOptions).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="studio-library-channel">{C.channelLabel}</Label>
        <select id="studio-library-channel" value={values.channel} onChange={(e) => onChange({ channel: e.target.value })} className={selectClass}>
          <option value="">{C.anyChannel}</option>
          {Object.entries(C.channels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="studio-library-from">{C.fromLabel}</Label>
        <Input id="studio-library-from" type="date" className="h-11" value={values.from} max={values.to || undefined} onChange={(e) => onChange({ from: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="studio-library-to">{C.toLabel}</Label>
        <Input id="studio-library-to" type="date" className="h-11" value={values.to} min={values.from || undefined} onChange={(e) => onChange({ to: e.target.value })} />
      </div>
    </div>
  );
}

/** "Add from..." (UX spec S14): the other import sources, shown as "Coming soon" until their rows ship. Nothing here calls anything. */
export function AddFromDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{C.addFrom.title}</DialogTitle>
          <DialogDescription>{C.addFrom.description}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {C.addFrom.sources.map((s) => (
            <li key={s} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span>{s}</span>
              <span className="text-muted-foreground">{STUDIO_COPY.comingSoon.chip}</span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            {C.addFrom.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What an api refusal says, in its own words, when it is one of the Studio's plain refusals (a state it will not change, or a file it will not use: 409 and
 * 422); anything else (a sign-in, a role, a rate limit, a malformed request) is the fallback, never the api's text.
 */
const plainError = (e: unknown, fallback: string): string => (e instanceof ApiError && (e.status === 409 || e.status === 422) && e.message ? e.message : fallback);

type Pending = { kind: "delete"; item: LibraryItem } | { kind: "bulk"; action: "delete" | "archive"; count: number } | null;

/**
 * The Library (UX spec S14): three tabs in the page, "Made in Studio" (default), "Product photos" and "Saved plans". Everything here is free: nothing asks
 * for Peaks or calls a model. A creative can be downloaded, made again (a new plan, no previews yet) or deleted (to the Drive's trash); Pro tools adds the
 * filters and bulk delete or put away.
 */
export function Library() {
  const qc = useQueryClient();
  const router = useRouter();
  const { proTools } = useStudioPrefs();
  const { org, orgs } = useAuth();
  const canChange = driveAbilities(orgs?.find((o) => o._id === org?._id)?.role).canEdit;
  const [tab, setTab] = useState("made");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filters, setFilters] = useState<FilterValues>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [plansPage, setPlansPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  // What the confirm dialog was last asked, kept while it closes so its words do not change under the closing animation.
  const [asked, setAsked] = useState<Pending>(null);
  const ask = (p: Pending) => {
    setAsked(p);
    setPending(p);
  };
  const [downloadFor, setDownloadFor] = useState<LibraryItem | null>(null);
  const [photosFor, setPhotosFor] = useState<ProductPhotoTile | null>(null);
  // The product whose photos the sheet last showed, kept while it slides closed so its title and list do not blank under the animation.
  const [photosShown, setPhotosShown] = useState<ProductPhotoTile | null>(null);
  const openPhotos = (t: ProductPhotoTile) => {
    setPhotosShown(t);
    setPhotosFor(t);
  };
  const [mainBusy, setMainBusy] = useState<string | null>(null);

  // The page goes back to 1 only when the search the list really uses has changed, never on mount or on an unrelated render.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = q.trim();
      if (next === debouncedQ) return;
      setDebouncedQ(next);
      setPage(1);
      setSelected(new Set());
    }, 300);
    return () => clearTimeout(t);
  }, [q, debouncedQ]);

  // Filters belong to Pro tools; with it off the list is the plain one whatever was typed before the flag changed.
  const activeQ = proTools ? debouncedQ : "";
  const active = proTools ? filters : NO_FILTERS;
  const query = proTools ? filterQuery(filters) : {};
  // Each tab reads only once it is open (a tab that was opened keeps its answer).
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set(["made"]));
  const made = useLibrary({ view: "made", q: activeQ, status: active.status, page, ...query });
  const plans = useLibrary({ view: "plans", page: plansPage, enabled: opened.has("plans") });
  const photos = useProductPhotos(opened.has("photos"));
  const refetchPhotos = photos.refetch;
  const importStatus = useImportStatus(opened.has("photos"));
  const photosOne = useProductPhotosOne(photosShown?.productId ?? null);
  const running = (importStatus.data?.imports ?? []).some((i) => i.status === "running");
  // When a running import finishes, read the photos again so the new ones show.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) void refetchPhotos();
    wasRunning.current = running;
  }, [running, refetchPhotos]);

  const tiles = useMemo(() => {
    const seen = new Set<string>();
    return (photos.data?.pages ?? []).flatMap((p) => p.items).filter((t) => (seen.has(t.productId) ? false : (seen.add(t.productId), true)));
  }, [photos.data]);
  const imports = importStatus.data?.imports ?? [];

  const filtered = activeQ !== "" || JSON.stringify(active) !== JSON.stringify(NO_FILTERS);
  const clear = () => {
    setQ("");
    setDebouncedQ("");
    setFilters(NO_FILTERS);
    setPage(1);
    setSelected(new Set());
  };
  const change = (next: Partial<FilterValues>) => {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
    setSelected(new Set());
  };
  // What is selected is what is on this page: a different page, search or filter starts a new selection (so "Delete selected" never acts on posts that are not on screen).
  const goPage = (p: number) => {
    setPage(p);
    setSelected(new Set());
  };
  const refreshCreatives = () => qc.invalidateQueries({ queryKey: [LIBRARY_KEYS.creatives] });
  const busy = (id: string, on: boolean) =>
    setBusyIds((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const download = async (item: LibraryItem, q: { finalId?: string; versionId?: string } = {}) => {
    busy(item.id, true);
    try {
      const link = await creativeApi.download(item.id, q);
      // the api's own signed link, checked as an http(s) address before it becomes an href (nothing is fetched here; it expires in minutes)
      if (!downloadLink(link.url, link.filename)) {
        toast.error(C.actions.downloadFailed);
        return;
      }
      setDownloadFor(null);
    } catch (e) {
      toast.error(plainError(e, C.actions.downloadFailed));
    } finally {
      busy(item.id, false);
    }
  };

  const newVersion = async (item: LibraryItem) => {
    busy(item.id, true);
    try {
      const r = await creativeApi.newVersion(item.id);
      void refreshCreatives(); // the new plan is in "Saved plans" (when previews are not available yet) and the list is not stale on the way back
      router.push(creativeHref(r.creativeId));
    } catch (e) {
      toast.error(plainError(e, C.actions.newVersionFailed));
      busy(item.id, false);
    }
  };

  const doDelete = async (item: LibraryItem) => {
    if (busyIds.has(item.id)) return; // one tap, one delete
    busy(item.id, true);
    try {
      await creativeApi.deleteCreative(item.id);
      toast(C.actions.deleted);
      void refreshCreatives();
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === "STILL_MAKING" ? C.actions.deleteBlocked : plainError(e, C.actions.deleteFailed));
    } finally {
      busy(item.id, false);
      setPending(null);
    }
  };

  const doBulk = async (action: "delete" | "archive") => {
    setBulkBusy(true);
    try {
      const r = await creativeApi.bulk(action, [...selected]);
      toast(bulkSummary(r));
      // The selection ends with the change: what was left as it was is still in the list (the toast says how many and why), ready to be chosen again.
      setSelected(new Set());
      void refreshCreatives();
    } catch {
      toast.error(C.bulk.failed);
    } finally {
      setBulkBusy(false);
      setPending(null);
    }
  };

  const link = async (tile: ProductPhotoTile, mediaId: string) => {
    try {
      const r = await creativeApi.linkProductPhoto(tile.productId, mediaId);
      toast(r.linked ? C.photoAdded : C.photoAlready);
      void qc.invalidateQueries({ queryKey: [LIBRARY_KEYS.photos] });
      void qc.invalidateQueries({ queryKey: [LIBRARY_KEYS.photosOne] });
    } catch (e) {
      toast.error(plainError(e, C.addPhotoFailed));
    }
  };

  const setMain = async (productId: string, mediaId: string) => {
    setMainBusy(mediaId);
    try {
      await creativeApi.setMainProductPhoto(productId, mediaId);
      toast(C.mainSet);
      void qc.invalidateQueries({ queryKey: [LIBRARY_KEYS.photos] });
      void qc.invalidateQueries({ queryKey: [LIBRARY_KEYS.photosOne] });
    } catch (e) {
      toast.error(plainError(e, C.mainFailed));
    } finally {
      setMainBusy(null);
    }
  };

  const tileActions = {
    canChange,
    selecting: selecting && proTools && canChange,
    selected,
    busyIds,
    onToggle: (id: string) =>
      setSelected((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    // A creative with sizes asks which; one with only its master saves that at once.
    onDownload: (item: LibraryItem) => (item.versions.length > 0 ? setDownloadFor(item) : void download(item, item.master ? { finalId: item.master.finalId } : {})),
    onNewVersion: (item: LibraryItem) => void newVersion(item),
    onDelete: (item: LibraryItem) => ask({ kind: "delete", item }),
  };
  const choices = downloadFor ? downloadChoices(downloadFor) : [];
  // The confirm is off while what it asked for is on its way (a bulk change, or this one post's delete).
  const confirmBusy = bulkBusy || (pending?.kind === "delete" && busyIds.has(pending.item.id));
  const plansActions = { canChange, busyIds, onDelete: tileActions.onDelete, onDownload: tileActions.onDownload };

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(t) => {
          setTab(t);
          setOpened((s) => new Set(s).add(t));
        }}
      >
        <TabsList aria-label={C.tabsLabel} className="h-11 w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="made" className="h-9">
            {C.tabs.made}
          </TabsTrigger>
          <TabsTrigger value="photos" className="h-9">
            {C.tabs.photos}
          </TabsTrigger>
          <TabsTrigger value="plans" className="h-9">
            {C.tabs.plans}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="made" className="space-y-4 pt-2">
          {proTools && <LibraryFilters q={q} values={filters} onQ={setQ} onChange={change} />}
          {proTools && canChange && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                aria-pressed={selecting}
                onClick={() => {
                  setSelecting((s) => !s);
                  setSelected(new Set());
                }}
              >
                {selecting ? C.bulk.done : C.bulk.select}
              </Button>
            </div>
          )}
          <CreativesView view="made" status={ideasFeedStatus(made)} data={made.data} filtered={filtered} onRetry={() => void made.refetch()} onClearFilters={clear} onPage={goPage} actions={tileActions} />
          {proTools && canChange && selecting && (
            <BulkBar count={selected.size} busy={bulkBusy} onDelete={() => ask({ kind: "bulk", action: "delete", count: selected.size })} onArchive={() => ask({ kind: "bulk", action: "archive", count: selected.size })} onClear={() => setSelected(new Set())} />
          )}
        </TabsContent>
        <TabsContent value="photos" className="space-y-4 pt-2">
          <div className="flex justify-end">
            <Button type="button" variant="outline" className="h-11" onClick={() => setAddOpen(true)}>
              {C.addFrom.button}
            </Button>
          </div>
          <ProductPhotosView
            status={ideasFeedStatus(photos)}
            tiles={tiles}
            imports={imports}
            hasMore={!!photos.hasNextPage}
            loadingMore={photos.isFetchingNextPage}
            onRetry={() => void photos.refetch()}
            onMore={() =>
              void photos.fetchNextPage().then((r) => {
                if (r.isError) toast.error(C.moreFailed);
              })
            }
            onOpen={openPhotos}
            renderAdd={
              canChange
                ? (t) => (
                    <DrivePicker
                      tabs={["drive", "upload"]}
                      kinds={["image"]}
                      maxSelection={1}
                      requirePublicUrl={false}
                      needUrl={false}
                      addLabel={C.addPhotoUse}
                      onSelect={(assets) => {
                        const a = assets[0];
                        if (a) void link(t, a.id);
                      }}
                      trigger={
                        <Button type="button" variant="outline" className="h-11" aria-label={C.addPhotoLabel(t.title)}>
                          {C.addPhoto}
                        </Button>
                      }
                    />
                  )
                : undefined
            }
          />
        </TabsContent>
        <TabsContent value="plans" className="space-y-4 pt-2">
          <CreativesView view="plans" status={ideasFeedStatus(plans)} data={plans.data} filtered={false} onRetry={() => void plans.refetch()} onClearFilters={() => undefined} onPage={setPlansPage} actions={plansActions} />
        </TabsContent>
      </Tabs>
      <AddFromDialog open={addOpen} onOpenChange={setAddOpen} />

      <Sheet open={photosFor !== null} onOpenChange={(o) => !o && setPhotosFor(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{photosShown ? C.photosOf(photosShown.title) : ""}</SheetTitle>
            <SheetDescription>{C.photosOfDescription}</SheetDescription>
          </SheetHeader>
          <div className="p-4">
            <ProductPhotoList
              status={ideasFeedStatus(photosOne)}
              data={photosOne.data}
              canChange={canChange}
              busyId={mainBusy}
              onRetry={() => void photosOne.refetch()}
              onSetMain={(mediaId) => photosShown && void setMain(photosShown.productId, mediaId)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={downloadFor !== null} onOpenChange={(o) => !o && setDownloadFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{C.actions.downloadTitle}</DialogTitle>
            <DialogDescription>{downloadFor ? `${itemTitle(downloadFor)}. ${C.actions.downloadDescription}` : C.actions.downloadDescription}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {choices.map((c) => (
              <li key={c.key}>
                <Button type="button" variant="outline" className="h-11 w-full justify-start" disabled={downloadFor ? busyIds.has(downloadFor.id) : false} onClick={() => downloadFor && void download(downloadFor, c.query)}>
                  {c.label}
                </Button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => setDownloadFor(null)}>
              {C.actions.downloadClose}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && !confirmBusy && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{asked?.kind === "delete" ? C.actions.deleteTitle : asked?.action === "archive" ? C.bulk.archiveTitle(asked.count) : C.bulk.deleteTitle(asked?.count ?? 0)}</AlertDialogTitle>
            <AlertDialogDescription>{asked?.kind === "delete" ? C.actions.deleteBody : asked?.action === "archive" ? C.bulk.archiveBody : C.bulk.deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmBusy}>{C.actions.deleteCancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmBusy}
              onClick={(e) => {
                e.preventDefault();
                if (pending?.kind === "delete") void doDelete(pending.item);
                else if (pending?.kind === "bulk") void doBulk(pending.action);
              }}
            >
              {asked?.kind === "bulk" && asked.action === "archive" ? C.bulk.archiveConfirm : C.actions.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
