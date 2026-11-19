"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { getMediaUrl, type ProductImageItem } from "@/lib/api/media";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStudioPrefs } from "@/hooks/use-studio";
import { useImportStatus, useLibrary, useProductPhotos } from "@/hooks/use-studio-library";
import { mergeProductPages } from "@/lib/studio-library";
import { ideasFeedStatus } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { CreativesView, ProductPhotosView } from "./library-view";

const C = STUDIO_COPY.library;

/** The search and status filter for "Made in Studio". Pro tools adds them (UX spec S14); labelled, 44 px tall, no hover-only parts. */
export function LibraryFilters({
  q,
  status,
  onQ,
  onStatus,
}: {
  q: string;
  status: string;
  onQ: (v: string) => void;
  onStatus: (v: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <div className="space-y-1.5">
        <Label htmlFor="studio-library-search">{C.searchLabel}</Label>
        <Input id="studio-library-search" type="search" className="h-11" value={q} placeholder={C.searchPlaceholder} onChange={(e) => onQ(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="studio-library-status">{C.statusLabel}</Label>
        <select
          id="studio-library-status"
          value={status}
          onChange={(e) => onStatus(e.target.value)}
          className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-base md:text-sm"
        >
          {Object.entries(C.statuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
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

/** A private photo's short-lived link, asked for only when its tile is drawn. A failure shows the same quiet fallback as no link. */
function PrivatePhoto({ media, alt }: { media: ProductImageItem["media"]; alt: string }) {
  const q = useQuery({ queryKey: ["studio-photo-url", media.id], queryFn: () => getMediaUrl(media.id), staleTime: 10 * 60_000, retry: 1 });
  if (!q.data?.url) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
        <ImageOff aria-hidden="true" className="size-6" />
        <span className="text-xs">{C.noPhotoPreview}</span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- a signed Drive link; see MediaImage for why this stays off the optimiser
  return <img src={q.data.url} alt={alt} loading="lazy" decoding="async" className="size-full object-cover" />;
}

/**
 * The Library (UX spec S14): three tabs in the page, "Made in Studio" (default), "Product photos" and "Saved plans". Everything here is a
 * free read; nothing asks for Peaks or calls a model.
 */
export function Library() {
  const { proTools } = useStudioPrefs();
  const [tab, setTab] = useState("made");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("has_final");
  const [page, setPage] = useState(1);
  const [plansPage, setPlansPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);

  // The page goes back to 1 only when the search the list really uses has changed, never on mount or on an unrelated render.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = q.trim();
      setDebouncedQ((prev) => {
        if (prev !== next) setPage(1);
        return next;
      });
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // Filters belong to Pro tools; with it off the list is the plain one whatever was typed before the flag changed.
  const activeQ = proTools ? debouncedQ : "";
  const activeStatus = proTools ? status : "has_final";
  const made = useLibrary({ view: "made", q: activeQ, status: activeStatus, page });
  const plans = useLibrary({ view: "plans", page: plansPage });
  const photos = useProductPhotos();
  const refetchPhotos = photos.refetch;
  const importStatus = useImportStatus();
  const running = (importStatus.data?.imports ?? []).some((i) => i.status === "running");
  // When a running import finishes, read the photos again so the new ones show.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) void refetchPhotos();
    wasRunning.current = running;
  }, [running, refetchPhotos]);

  const photoItems = useMemo(() => mergeProductPages(photos.data?.pages ?? []), [photos.data]);
  const imports = importStatus.data?.imports ?? photos.data?.pages[0]?.imports ?? [];

  const filtered = activeQ !== "" || activeStatus !== "has_final";
  const clear = () => {
    setQ("");
    setDebouncedQ("");
    setStatus("has_final");
    setPage(1);
  };

  return (
    <>
      <Tabs value={tab} onValueChange={setTab}>
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
          {proTools && <LibraryFilters q={q} status={status} onQ={setQ} onStatus={(v) => (setStatus(v), setPage(1))} />}
          <CreativesView
            view="made"
            status={ideasFeedStatus(made)}
            data={made.data}
            filtered={filtered}
            onRetry={() => void made.refetch()}
            onClearFilters={clear}
            onPage={setPage}
          />
        </TabsContent>
        <TabsContent value="photos" className="space-y-4 pt-2">
          <div className="flex justify-end">
            <Button type="button" variant="outline" className="h-11" onClick={() => setAddOpen(true)}>
              {C.addFrom.button}
            </Button>
          </div>
          <ProductPhotosView
            status={ideasFeedStatus(photos)}
            items={photoItems}
            imports={imports}
            hasMore={!!photos.hasNextPage}
            loadingMore={photos.isFetchingNextPage}
            onRetry={() => void photos.refetch()}
            onMore={() => void photos.fetchNextPage()}
            renderPrivate={(media, alt) => <PrivatePhoto media={media} alt={alt} />}
          />
        </TabsContent>
        <TabsContent value="plans" className="space-y-4 pt-2">
          <CreativesView
            view="plans"
            status={ideasFeedStatus(plans)}
            data={plans.data}
            filtered={false}
            onRetry={() => void plans.refetch()}
            onClearFilters={() => undefined}
            onPage={setPlansPage}
          />
        </TabsContent>
      </Tabs>
      <AddFromDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
