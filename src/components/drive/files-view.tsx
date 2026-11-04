"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, FolderPlus, Search, Sparkles, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileTile } from "@/components/drive/file-tile";
import { FileDetail } from "@/components/drive/file-detail";
import {
  bulkDeleteMedia,
  bulkMedia,
  createCollection,
  deleteMedia,
  formatBytes,
  listCollections,
  listMedia,
  updateMedia,
  type DriveCollection,
  type MediaItem,
  type MediaPatch,
} from "@/lib/api/media";
import { KIND_CHIPS, blockedText, channelLabel, trashFailureText } from "@/lib/drive/copy";
import { describePoller } from "@/lib/drive/describe-poller";
import {
  NO_FILTERS,
  applyDescribeRows,
  canChangeFile,
  isFiltered,
  toListParams,
  waitingIds,
  type FilesData,
  type FilesFilters,
} from "@/lib/drive/files-state";
import { cn } from "@/lib/utils";

/**
 * The Files tab (Main board): plain-word search on the server, filter chips, collections, the grid, bulk select and the file panel.
 * Everything that narrows the list is a request to the api, never a filter over what happens to be loaded.
 */

export const FILES_KEY = ["drive", "files"] as const;
export const COLLECTIONS_KEY = ["drive", "collections"] as const;

/** What the list query is doing, in the words the page needs. A PAUSED query is neither loading nor failed: the browser is offline. */
export function listState(q: { isPending: boolean; isError: boolean; fetchStatus: "fetching" | "paused" | "idle" }): "ready" | "loading" | "offline" | "error" {
  if (q.isError) return "error";
  if (q.isPending) return q.fetchStatus === "paused" ? "offline" : "loading";
  return "ready";
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const ALL_FILES = "all-files";

export function NewCollectionButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const make = useMutation({
    mutationFn: () => createCollection({ name: name.trim() }),
    onSuccess: (c) => {
      toast.success(`Collection "${c.name}" is ready. Add files to it from the file panel or by selecting several.`);
      setOpen(false);
      setName("");
      void qc.invalidateQueries({ queryKey: COLLECTIONS_KEY });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "That collection could not be made."),
  });
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <FolderPlus aria-hidden className="size-4" />
        New collection
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New collection</DialogTitle>
            <DialogDescription>A collection groups files for one purpose, like a campaign. A file can be in several.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) make.mutate();
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Collection name" placeholder="Diwali 2026" maxLength={100} autoFocus />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || make.isPending}>
                {make.isPending ? "Making…" : "Make collection"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FilesView({ abilities }: { abilities: { canEdit: boolean; isAdmin: boolean } }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<FilesFilters>(NO_FILTERS);
  const [typed, setTyped] = useState("");
  const q = useDebounced(typed, 300);
  const effective = useMemo(() => ({ ...filters, q }), [filters, q]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [tagDraft, setTagDraft] = useState("");

  const collections = useQuery({ queryKey: COLLECTIONS_KEY, queryFn: listCollections, staleTime: 30_000 });
  const live = collections.data?.collections.find((c) => c.preset === "used_in_live_ads");
  const withLive = useMemo(() => ({ ...effective, liveCollectionId: live?.id ?? null }), [effective, live?.id]);

  const list = useInfiniteQuery({
    queryKey: [...FILES_KEY, toListParams(withLive, 1)],
    queryFn: ({ pageParam }) => listMedia(toListParams(withLive, pageParam)),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
    // "Live in ads" with no such collection yet has nothing to show, and must not show everything.
    enabled: !(withLive.kind === "live" && !live),
  });

  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  // The clock is the moment the list was last fetched or changed by the describing poll: the shimmer window is minutes wide, and a clock
  // that moved on every render would make a tile blink out of its shimmer between two answers.
  const now = useMemo(() => new Date(list.dataUpdatedAt), [list.dataUpdatedAt]);

  // ── the describing poll: only while a file on screen is waiting to be named ──
  const waiting = useMemo(() => waitingIds(items, now), [items, now]);
  const waitKey = waiting.join(",");
  useEffect(() => {
    describePoller.watch("files", waitKey ? waitKey.split(",") : []);
    return () => describePoller.unwatch("files");
  }, [waitKey]);
  useEffect(
    () =>
      describePoller.subscribe((rows) => {
        qc.setQueriesData<InfiniteData<unknown> | undefined>({ queryKey: FILES_KEY }, (old) => applyDescribeRows(old as unknown as FilesData | undefined, rows) as unknown as InfiniteData<unknown> | undefined);
      }),
    [qc],
  );

  const open = items.find((i) => i.id === openId) ?? null;
  const state = listState(list);

  const patch = async (id: string, p: MediaPatch) => {
    const updated = await updateMedia(id, p);
    qc.setQueriesData<InfiniteData<{ items: MediaItem[] }> | undefined>({ queryKey: FILES_KEY }, (old) =>
      old ? { ...old, pages: old.pages.map((pg) => ({ ...pg, items: pg.items.map((it) => (it.id === id ? { ...it, ...updated } : it)) })) } : old,
    );
    void qc.invalidateQueries({ queryKey: COLLECTIONS_KEY });
  };

  const refresh = (): Promise<void> => {
    const files = qc.invalidateQueries({ queryKey: FILES_KEY });
    void qc.invalidateQueries({ queryKey: COLLECTIONS_KEY });
    void qc.invalidateQueries({ queryKey: ["storage-usage"] });
    void qc.invalidateQueries({ queryKey: ["drive", "cleanup"] });
    void qc.invalidateQueries({ queryKey: ["drive", "trash"] });
    return files;
  };

  const trashOne = useMutation({
    mutationFn: (id: string) => deleteMedia(id),
    onSuccess: (r) => {
      toast.success(`Moved to Trash. ${formatBytes(r.freedBytes)} freed. You can restore it for 30 days.`);
      setOpenId(null);
      refresh();
    },
    onError: (err) => toast.error(trashFailureText(err)),
  });

  const ids = [...checked];
  const bulk = useMutation({
    mutationFn: async (job: { kind: "tag"; tag: string } | { kind: "collection"; collectionId: string } | { kind: "trash" }) => {
      if (job.kind === "tag") return { text: "tagged", r: await bulkMedia({ action: "add_tags", mediaIds: ids, tags: [job.tag] }) };
      if (job.kind === "collection") return { text: "added to the collection", r: await bulkMedia({ action: "add_to_collection", mediaIds: ids, collectionId: job.collectionId }) };
      let deleted = 0;
      let forbidden = 0;
      let blocked = 0;
      let stopped = false;
      for (let i = 0; i < ids.length; i += 200) {
        try {
          const r = await bulkDeleteMedia(ids.slice(i, i + 200));
          deleted += r.deletedCount;
          forbidden += r.forbidden ?? 0;
          blocked += r.blocked ?? 0;
        } catch (err) {
          // Earlier chunks are already in Trash: say so, and refresh, rather than claim nothing changed.
          if (deleted === 0) throw err;
          stopped = true;
          break;
        }
      }
      return { partial: stopped, text: stopped ? "moved to Trash. The connection failed before the rest. Select the others and try again" : "moved to Trash", r: { changed: deleted, forbidden, blocked, skipped: 0, requested: ids.length, notFound: 0 } };
    },
    onSuccess: ({ text, r, partial }) => {
      const extra = (r.forbidden > 0 ? ` ${r.forbidden} ${r.forbidden === 1 ? "is" : "are"} shared across your organisation and need an admin.` : "") + blockedText(r.blocked ?? 0);
      (partial ? toast.warning : toast.success)(`${r.changed} ${r.changed === 1 ? "file" : "files"} ${text}.${extra}`);
      setChecked(new Set());
      setTagDraft("");
      refresh();
    },
    onError: () => toast.error("That did not go through. Nothing was changed. Try again."),
  });

  const set = <K extends keyof FilesFilters>(k: K, v: FilesFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const chooseKind = async (kind: FilesFilters["kind"]) => {
    if (kind === "live" && !live) {
      try {
        const made = await createCollection({ preset: "used_in_live_ads" });
        await qc.invalidateQueries({ queryKey: COLLECTIONS_KEY });
        setFilters((f) => ({ ...f, kind, collectionId: null, liveCollectionId: made.id }));
      } catch {
        toast.error("That view could not be opened. Try again.");
      }
      return;
    }
    setFilters((f) => ({ ...f, kind, collectionId: kind === "live" ? null : f.collectionId }));
  };

  const filtered = isFiltered(effective);
  const manual = collections.data?.collections ?? [];
  const presets = collections.data?.availablePresets ?? [];

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[999_1_28rem] flex-col gap-4">
        <label className="flex min-h-11 items-center gap-2.5 rounded-lg border bg-card px-3.5">
          <Search aria-hidden className="size-4 text-muted-foreground" />
          <span className="sr-only">Search Drive</span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Search in plain words, like “diwali reel with the blue tin”"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Kind of file">
          {KIND_CHIPS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={filters.kind === k.id}
              onClick={() => void chooseKind(k.id)}
              className={cn("min-h-9 rounded-full border px-3.5 text-[13px] transition-colors", filters.kind === k.id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-accent")}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="More ways to narrow it down">
          <Select value={filters.channel || "any"} onValueChange={(v) => set("channel", v === "any" ? "" : v)}>
            <SelectTrigger className="w-44" aria-label="Fits a channel">
              <SelectValue placeholder="Fits any channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Fits any channel</SelectItem>
              {["instagram", "facebook", "linkedin", "x", "threads", "newsletter", "googlebusiness", "wordpress", "shopify"].map((c) => (
                <SelectItem key={c} value={c}>
                  Fits {channelLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.used} onValueChange={(v) => set("used", v as FilesFilters["used"])}>
            <SelectTrigger className="w-40" aria-label="Used or not">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Used or not</SelectItem>
              <SelectItem value="used">In use</SelectItem>
              <SelectItem value="unused">Not used yet</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.source} onValueChange={(v) => set("source", v as FilesFilters["source"])}>
            <SelectTrigger className="w-44" aria-label="Who made it">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Added or made</SelectItem>
              <SelectItem value="uploaded">Added by us</SelectItem>
              <SelectItem value="ai_generated">Made by Peakhour</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.visibility} onValueChange={(v) => set("visibility", v as FilesFilters["visibility"])}>
            <SelectTrigger className="w-40" aria-label="Published or private">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Published or private</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.sort} onValueChange={(v) => set("sort", v as FilesFilters["sort"])}>
            <SelectTrigger className="w-36" aria-label="Order">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="name">By name</SelectItem>
              <SelectItem value="largest">Largest first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(manual.length > 0 || presets.length > 0) && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Collections">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">Collections</span>
            <CollectionChip name="All files" active={filters.collectionId === null} onClick={() => set("collectionId", null)} id={ALL_FILES} />
            {manual.map((c: DriveCollection) => (
              <CollectionChip key={c.id} id={c.id} name={c.name} count={c.count} smart={c.kind === "smart"} active={filters.collectionId === c.id} onClick={() => setFilters((f) => ({ ...f, collectionId: c.id, kind: f.kind === "live" ? "all" : f.kind }))} />
            ))}
            {presets.map((p) => (
              <button
                key={p.preset}
                type="button"
                onClick={() => void createCollection({ preset: p.preset }).then(() => qc.invalidateQueries({ queryKey: COLLECTIONS_KEY })).catch(() => toast.error("That collection could not be added."))}
                className="inline-flex min-h-8 items-center gap-1 rounded-full border border-dashed px-3 text-xs text-muted-foreground hover:bg-accent"
              >
                <Sparkles aria-hidden className="size-3" />
                Add {p.name}
              </button>
            ))}
          </div>
        )}

        {checked.size > 0 && abilities.canEdit && (
          <div role="region" aria-label="Selected files" className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
            <span className="text-sm font-medium">{checked.size} selected</span>
            <Input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} aria-label="Tag to add" placeholder="Tag to add" className="h-8 w-36" />
            <Button type="button" size="sm" variant="outline" disabled={!tagDraft.trim() || bulk.isPending} onClick={() => bulk.mutate({ kind: "tag", tag: tagDraft.trim() })}>
              Add tag
            </Button>
            {manual.some((c) => c.kind === "manual") && (
              <Select onValueChange={(v) => bulk.mutate({ kind: "collection", collectionId: v })} disabled={bulk.isPending}>
                <SelectTrigger className="h-8 w-44" aria-label="Add to a collection">
                  <SelectValue placeholder="Add to collection" />
                </SelectTrigger>
                <SelectContent>
                  {manual
                    .filter((c) => c.kind === "manual")
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            <ConfirmDialog
              trigger={
                <Button type="button" size="sm" variant="outline" disabled={bulk.isPending}>
                  Move to Trash
                </Button>
              }
              title={`Move ${checked.size} ${checked.size === 1 ? "file" : "files"} to Trash?`}
              description="They stay in Trash for 30 days and you can restore them. They stop counting against your storage now."
              confirmLabel="Move to Trash"
              onConfirm={() => bulk.mutate({ kind: "trash" })}
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => setChecked(new Set())}>
              Clear
            </Button>
          </div>
        )}

        {state === "loading" && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3.5" aria-busy="true" aria-label="Loading your files">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        )}
        {state === "offline" && <EmptyState icon={WifiOff} title="You look to be offline" description="Your files will load as soon as the connection is back." />}
        {state === "error" && <EmptyState icon={AlertTriangle} title="Your files did not load" description="Something went wrong on our side. Nothing was changed." action={{ label: "Try again", onClick: () => void list.refetch() }} />}
        {state === "ready" && items.length === 0 && (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            {filtered ? "Nothing matches that. Try different words, or clear the filters." : "No files yet. Drop files anywhere on this page, or press Upload."}
          </div>
        )}
        {state === "ready" && items.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3.5">
            {items.map((it) => (
              <FileTile
                key={it.id}
                item={it}
                now={now}
                open={openId === it.id}
                checked={checked.has(it.id)}
                canSelect={abilities.canEdit}
                onOpen={() => setOpenId(it.id)}
                onCheck={(on) =>
                  setChecked((prev) => {
                    const next = new Set(prev);
                    if (on) next.add(it.id);
                    else next.delete(it.id);
                    return next;
                  })
                }
              />
            ))}
          </div>
        )}
        {list.hasNextPage && (
          <div className="flex justify-center">
            <Button type="button" variant="outline" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
              {list.isFetchingNextPage ? "Loading…" : "Show more"}
            </Button>
          </div>
        )}
      </div>

      {open && (
        <div className="min-w-0 max-w-sm flex-[1_1_18rem]">
          <FileDetail item={open} now={now} canEdit={canChangeFile(open, abilities)} onPatch={(p) => patch(open.id, p)} onTrash={() => trashOne.mutate(open.id)} trashing={trashOne.isPending} onReplaced={(id) => { void refresh().then(() => id && setOpenId(id)); }} />
        </div>
      )}
    </div>
  );
}

function CollectionChip({ id, name, count, smart, active, onClick }: { id: string; name: string; count?: number; smart?: boolean; active: boolean; onClick: () => void }) {
  return (
    <button
      key={id}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn("inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-xs transition-colors", active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-accent")}
    >
      {smart && <Sparkles aria-hidden className="size-3" />}
      {name}
      {count !== undefined && <span className={active ? "opacity-70" : "text-muted-foreground"}>{count}</span>}
    </button>
  );
}
