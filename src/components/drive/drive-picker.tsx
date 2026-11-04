"use client";

/**
 * <DrivePicker/> - the one place a file is chosen from Drive (row D7). Composer, Strategist, Ads, Inbox replies and every other screen
 * that needs an image, a video or a document opens this same sheet: Drive (search what you have), Upload (add something new) and
 * Generate (make something, where the screen can).
 *
 * WHAT IT SAYS, AND WHERE IT COMES FROM
 *  - When the screen names where the file is going (`target`), files that fit come first. The verdicts are the api's `channelFit`, built
 *    from the channel's own limits (size, shape, length, format) and a reading of the content; the picker never second-guesses them. A file
 *    nobody has judged yet is "Not checked yet", and the line above the grid says so rather than claiming an order it does not have.
 *  - A Private file has no public link. Where the screen needs one (`requirePublicUrl`, the default: posts, ads, pages) the tile is greyed
 *    out and says why. Where it does not (an Inbox reply sends the bytes), the file can be added and the picker fetches a short-lived signed
 *    link for it at the moment of adding.
 *
 * Mount this component's panel (`DrivePickerPanel`) directly to test it: the sheet is only the frame.
 */

import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Loader2, Lock, Search, Sparkles, Upload, Video, Check, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { PEAKS_ACTIONS } from "@/lib/api/peaks";
import { usePeaksQuote, quoteTokenFor } from "@/hooks/use-peaks-quote";
import { chargedTaskRefusal } from "@/hooks/use-audience-plan";
import { PriceLine } from "@/components/audience/discover-audiences-dialog";
import { generateImageToDrive } from "@/lib/drive/generate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { MediaAsset } from "@/components/composer/types";
import { getFileLink, listDriveFiles, type DriveFile, type DriveKind } from "@/lib/drive/files";
import { anyVerdict, fitNote, orderByFit, PRIVATE_NEEDS_PUBLIC } from "@/lib/drive/fit";
import { uploadErrorMessage, uploadToDrive, UploadAborted, type UploadedFile, type UploadOptions } from "@/lib/drive/upload-engine";

export type PickerTab = "drive" | "upload" | "generate";

export interface DriveTarget {
  /** The channel the file is going to (a scheduler or composer key: "instagram", "linkedin", "beehiiv"...). Drives the fit order. */
  channel?: string;
  /** In plain words, for the line above the grid: "an Instagram post". */
  label?: string;
}

export interface DrivePickerProps {
  trigger?: React.ReactNode;
  target?: DriveTarget;
  /** What the screen can use. Default: images. */
  kinds?: DriveKind[];
  maxSelection?: number;
  /** True (default): the file must have a public link, so a Private file cannot be added. False: a Private file is added with a short-lived signed link. */
  requirePublicUrl?: boolean;
  /** What a file uploaded here becomes. Default: Published where a public link is needed, else the file type's own default. An Inbox reply passes "private": a shopper's photo must not get a public address. */
  uploadAs?: "published" | "private";
  /** False when the screen takes only the file's id and reads the bytes itself (an Inbox reply): no link is fetched, so a Private file's `url` is "". Default true. */
  needUrl?: boolean;
  /** A reason this file cannot be used HERE (wrong type, too big), or null. Shown on the tile, which is greyed out. */
  unusable?: (file: DriveFile) => string | null;
  /** The button: "Add to post". Default "Add". */
  addLabel?: string;
  /**
   * Make something new. Returns the file to add, or nothing when the screen shows the result itself (the picker then closes).
   * Leave it off and, where the screen takes images, the Generate tab makes an image from the sentence and saves it to Drive
   * (`POST /v1/media/generate`, charged like the Strategist's image, the price shown first). `quoteToken` is the receipt for the price shown.
   */
  onGenerate?: (prompt: string, kind: "image" | "video", opts?: { quoteToken?: string }) => Promise<MediaAsset | void>;
  /** What the Generate box starts with (a brief the screen already holds). */
  generatePrompt?: string;
  /** False when Generate makes the file from `generatePrompt` alone (the box is read-only). Default true. */
  promptEditable?: boolean;
  onSelect: (assets: MediaAsset[]) => void;
}

const DEFAULT_KINDS: DriveKind[] = ["image"];

export function DrivePicker({ trigger, ...panel }: DrivePickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs">
            <ImageIcon className="size-3.5" />
            Drive
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="sr-only">
          <SheetTitle>Add from Drive</SheetTitle>
          <SheetDescription>Choose a file from Drive, upload a new one, or generate one.</SheetDescription>
        </SheetHeader>
        {open && (
          <DrivePickerPanel
            {...panel}
            onSelect={(assets) => {
              panel.onSelect(assets);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── The panel ────────────────────────────────────────────

export function DrivePickerPanel({
  target,
  kinds = DEFAULT_KINDS,
  maxSelection,
  requirePublicUrl = true,
  needUrl = true,
  uploadAs,
  unusable,
  addLabel = "Add",
  onGenerate,
  generatePrompt,
  promptEditable = true,
  onSelect,
  onClose,
  uploadOptions,
}: Omit<DrivePickerProps, "trigger"> & { onClose?: () => void; /** Test seam: the upload client's dependencies. */ uploadOptions?: Pick<UploadOptions, "deps"> }) {
  const [tab, setTab] = useState<PickerTab>("drive");
  const [text, setText] = useState("");
  const q = useDebounced(text.trim(), 250);
  const [selected, setSelected] = useState<Map<string, DriveFile>>(new Map());
  /** Files uploaded in this panel, shown first so they are there before the list refetches. */
  const [added, setAdded] = useState<DriveFile[]>([]);
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();

  const single = kinds.length === 1 ? kinds[0] : undefined;
  const query = useInfiniteQuery({
    queryKey: ["drive-picker", { q, kind: single ?? null }],
    queryFn: ({ pageParam }) => listDriveFiles({ q, kind: single, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: tab === "drive",
    staleTime: 15_000,
  });

  // keyed on the list's CONTENT: callers pass an inline array, which is a new reference every render
  const kindsKey = kinds.join(",");
  const files = useMemo(() => {
    const seen = new Set<string>();
    const all: DriveFile[] = [];
    for (const f of [...(q ? [] : added), ...(query.data?.pages.flatMap((p) => p.items) ?? [])]) {
      if (seen.has(f.id) || !kinds.includes(f.kind)) continue;
      seen.add(f.id);
      all.push(f);
    }
    return orderByFit(all, target?.channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `kinds` is read through kindsKey
  }, [query.data, added, q, kindsKey, target?.channel]);

  // With several kinds the api is asked for every kind and this list is filtered here, so a page can hold nothing this screen can use: keep
  // reading pages until something shows or Drive runs out, rather than call a Drive full of videos empty.
  const fetchNext = query.fetchNextPage;
  const readingOn = single === undefined && files.length === 0 && Boolean(query.hasNextPage);
  const pagesRead = query.data?.pages.length ?? 0;
  useEffect(() => {
    if (readingOn && !query.isFetchingNextPage) void fetchNext();
    // `pagesRead` re-runs this when a page lands, so a page that arrives with nothing showable asks for the next
  }, [readingOn, query.isFetchingNextPage, pagesRead, fetchNext]);

  function toggle(file: DriveFile) {
    if (selected.has(file.id)) {
      setSelected((prev) => {
        const next = new Map(prev);
        next.delete(file.id);
        return next;
      });
      return;
    }
    if (maxSelection !== undefined && selected.size >= maxSelection) {
      toast.info(`You can add up to ${maxSelection} ${maxSelection === 1 ? "file" : "files"} here.`);
      return;
    }
    setSelected((prev) => new Map(prev).set(file.id, file));
  }

  async function add() {
    setAdding(true);
    try {
      const assets: MediaAsset[] = [];
      for (const f of selected.values()) {
        const asset = await assetOf(f, requirePublicUrl, needUrl);
        if (!asset) {
          toast.error(`We couldn't get a link for "${f.name}".`, { description: f.visibility === "private" ? PRIVATE_NEEDS_PUBLIC : "Try again in a moment." });
          return;
        }
        assets.push(asset);
      }
      onSelect(assets);
    } finally {
      setAdding(false);
    }
  }

  const channel = target?.channel;
  const verdicts = anyVerdict(files, channel);
  const anyPrivateBlocked = requirePublicUrl && files.some((f) => f.visibility === "private");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background" data-testid="drive-picker">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 pr-12">
        <h2 className="text-base font-semibold">Add from Drive</h2>
        <div role="tablist" aria-label="Where to get the file" className="flex gap-1 text-sm">
          {(["drive", "upload", "generate"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-2.5 py-1.5 font-medium transition-colors motion-reduce:transition-none",
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {t === "drive" ? "Drive" : t === "upload" ? "Upload" : "Generate"}
            </button>
          ))}
        </div>
      </div>

      {tab === "drive" && (
        <>
          <div className="space-y-2 border-b px-4 py-3">
            <div className="relative">
              <Label htmlFor="drive-picker-search" className="sr-only">
                Search
              </Label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="drive-picker-search"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Search by name, tag or what's in it"
                className="h-10 pl-9"
              />
            </div>
            {channel && target?.label && files.length > 0 && (
              <p className="text-sm text-muted-foreground" data-testid="fit-line">
                {verdicts
                  ? `Showing what fits ${target.label} first.`
                  : `Fit checks for ${target.label} are still being worked out, so files are shown newest first.`}
              </p>
            )}
            {anyPrivateBlocked && (
              <p className="flex items-start gap-1.5 text-sm text-warning-on-tint" data-testid="private-line">
                <Lock className="mt-0.5 size-3.5 shrink-0" />
                <span>Private files are greyed out. They have no public link, and this needs one. Publish a file in Drive to use it here.</span>
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <FileGrid
              state={gridState(query, files.length, readingOn)}
              files={files}
              channel={channel}
              selected={selected}
              requirePublicUrl={requirePublicUrl}
              unusable={unusable}
              searching={q.length > 0}
              queryText={q}
              onToggle={toggle}
              onRetry={() => void query.refetch()}
              hasMore={Boolean(query.hasNextPage)}
              loadingMore={query.isFetchingNextPage}
              onMore={() => void query.fetchNextPage()}
              onUpload={() => setTab("upload")}
            />
          </div>
        </>
      )}

      {tab === "upload" && (
        <UploadTab
          kinds={kinds}
          requirePublicUrl={requirePublicUrl}
          visibility={uploadAs ?? (requirePublicUrl ? "published" : undefined)}
          uploadOptions={uploadOptions}
          onDone={(done) => {
            const files = done.map(fileOf);
            setAdded((prev) => [...files, ...prev]);
            setSelected((prev) => {
              const next = new Map(prev);
              for (const f of files) {
                if (maxSelection !== undefined && next.size >= maxSelection) break;
                if (kinds.includes(f.kind) && !unusable?.(f) && !(requirePublicUrl && f.visibility === "private")) next.set(f.id, f);
              }
              return next;
            });
            // marked stale, so the Drive tab (disabled while Upload is open) fetches afresh when it comes back
            void queryClient.invalidateQueries({ queryKey: ["drive-picker"] });
            setTab("drive");
          }}
        />
      )}

      {tab === "generate" && (
        <GenerateTab
          kinds={kinds}
          onGenerate={onGenerate}
          prompt={generatePrompt}
          editable={promptEditable}
          onMade={(asset) => {
            if (!asset) return onClose?.();
            onSelect([asset]);
          }}
        />
      )}

      <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3">
        <div className="text-sm text-muted-foreground" aria-live="polite">
          {selected.size === 0 ? "Nothing selected" : `${selected.size} selected`}
        </div>
        <div className="flex gap-2">
          {onClose && (
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button type="button" disabled={selected.size === 0 || adding} onClick={() => void add()} className="min-h-10">
            {adding && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />}
            {addLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Grid ─────────────────────────────────────────────────

type GridState = "loading" | "offline" | "error" | "empty" | "ready";

/**
 * The grid's state from the query. ★`isPending` (no data yet) and the FETCH status are read together: a query that cannot run because the
 * browser is offline is `pending` with `fetchStatus: "paused"`, which `isLoading` would call "not loading" and show an empty Drive.
 * An error with no data wins over "loading" so a failed first load is never a spinner forever; a refetch that clears it shows loading
 * again (react-query resets the error on each new fetch), which is the right thing to show while "Try again" runs.
 */
export function gridState(
  q: { isPending: boolean; isError: boolean; fetchStatus: "fetching" | "paused" | "idle" },
  fileCount: number,
  readingOn = false,
): GridState {
  if (fileCount > 0) return "ready";
  if (q.isError) return "error";
  if (readingOn) return "loading";
  if (q.isPending && q.fetchStatus === "paused") return "offline";
  if (q.isPending) return "loading";
  return "empty";
}

function FileGrid({
  state,
  files,
  channel,
  selected,
  requirePublicUrl,
  unusable,
  searching,
  queryText,
  onToggle,
  onRetry,
  hasMore,
  loadingMore,
  onMore,
  onUpload,
}: {
  state: GridState;
  files: DriveFile[];
  channel: string | undefined;
  selected: Map<string, DriveFile>;
  requirePublicUrl: boolean;
  unusable?: (file: DriveFile) => string | null;
  searching: boolean;
  queryText: string;
  onToggle: (f: DriveFile) => void;
  onRetry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onUpload: () => void;
}) {
  if (state === "loading") {
    return (
      <div className="grid grid-cols-3 gap-2.5" aria-busy="true" aria-label="Loading your files">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (state === "offline") {
    return <Notice title="You're offline" body="Your files will load as soon as you're back online." />;
  }
  if (state === "error") {
    return (
      <Notice
        title="We couldn't load your files"
        body="Check your connection and try again."
        action={
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  }
  if (state === "empty") {
    return searching ? (
      <Notice title={`Nothing matches "${queryText}"`} body="Try fewer words, or a different one." />
    ) : (
      <Notice
        title="Nothing in Drive yet"
        body="Upload a file to get started."
        action={
          <Button type="button" variant="outline" size="sm" onClick={onUpload}>
            Upload a file
          </Button>
        }
      />
    );
  }
  return (
    <>
      <ul className="grid grid-cols-3 gap-2.5">
        {files.map((f) => (
          <li key={f.id}>
            <Tile
              file={f}
              channel={channel}
              selected={selected.has(f.id)}
              blockedReason={blockedReason(f, requirePublicUrl, unusable)}
              onToggle={() => onToggle(f)}
            />
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="outline" size="sm" onClick={onMore} disabled={loadingMore}>
            {loadingMore && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />}
            Show more
          </Button>
        </div>
      )}
    </>
  );
}

/** Why a file cannot be added here, or null. A Private file where a public link is needed is the first reason. */
export function blockedReason(f: DriveFile, requirePublicUrl: boolean, unusable?: (file: DriveFile) => string | null): string | null {
  if (requirePublicUrl && f.visibility === "private") return "Private. No public link.";
  return unusable?.(f) ?? null;
}

function Tile({
  file,
  channel,
  selected,
  blockedReason: blocked,
  onToggle,
}: {
  file: DriveFile;
  channel: string | undefined;
  selected: boolean;
  blockedReason: string | null;
  onToggle: () => void;
}) {
  const fit = fitNote(file, channel);
  const note = blocked ?? fit.label;
  const tone = blocked ? "warn" : fit.tone;
  const detail = blocked ? (file.visibility === "private" ? PRIVATE_NEEDS_PUBLIC : blocked) : fit.reason;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={blocked !== null}
      aria-pressed={selected}
      aria-label={`${selected ? "Deselect" : "Select"} ${file.name}${note ? `. ${note}` : ""}${detail && !blocked ? `. ${detail}` : ""}`}
      title={detail}
      className={cn(
        "group relative block w-full overflow-hidden rounded-lg border bg-card text-left transition-colors motion-reduce:transition-none",
        selected ? "border-primary ring-2 ring-primary" : "border-border",
        blocked ? "cursor-not-allowed opacity-60" : "hover:border-primary/60",
      )}
    >
      <div className="relative flex h-24 items-center justify-center overflow-hidden bg-muted">
        <Thumb file={file} />
        {file.visibility === "private" && (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-sm bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
            <Lock className="size-2.5" /> Private
          </span>
        )}
        {selected && (
          <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3" />
          </span>
        )}
      </div>
      <div className="px-2 py-1.5 text-xs">
        <div className="truncate font-medium">{file.name}</div>
        {note && (
          <div className={cn("mt-0.5 truncate", tone === "good" && "text-success-on-tint", tone === "warn" && "text-warning-on-tint", tone === "muted" && "text-muted-foreground")}>
            {note}
          </div>
        )}
      </div>
    </button>
  );
}

function Thumb({ file }: { file: DriveFile }) {
  if (file.kind === "image" && file.publicUrl && file.visibility === "published") {
    // eslint-disable-next-line @next/next/no-img-element -- Drive files live on the media host, not in next/image's remotePatterns
    return <img src={file.publicUrl} alt={file.altText ?? ""} loading="lazy" className="h-full w-full object-cover" />;
  }
  if (file.kind === "video") return <Video className="size-7 text-muted-foreground" aria-hidden />;
  if (file.kind === "document") return <FileText className="size-7 text-muted-foreground" aria-hidden />;
  return <ImageIcon className="size-7 text-muted-foreground" aria-hidden />;
}

function Notice({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center" role="status">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Upload ───────────────────────────────────────────────

interface UploadRow {
  key: number;
  file: File;
  sent: number;
  status: "uploading" | "done" | "error";
  error?: string;
  result?: UploadedFile;
}

const ACCEPT: Record<DriveKind, string> = {
  image: "image/png,image/jpeg,image/webp,image/gif",
  video: "video/mp4,video/quicktime",
  document: "application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx",
  font: ".woff,.woff2,.ttf,.otf",
};

function UploadTab({
  kinds,
  requirePublicUrl,
  visibility,
  onDone,
  uploadOptions,
}: {
  kinds: DriveKind[];
  requirePublicUrl: boolean;
  visibility: "published" | "private" | undefined;
  onDone: (done: UploadedFile[]) => void;
  uploadOptions?: Pick<UploadOptions, "deps">;
}) {
  const inputId = useId();
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const controllers = useRef(new Map<number, AbortController>());
  const next = useRef(0);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Closing the picker (or leaving this tab) ends the upload in flight AND stops the queue behind it: its progress has nowhere to show.
  const stopped = useRef(false);
  useEffect(() => {
    stopped.current = false;
    const live = controllers.current;
    return () => {
      stopped.current = true;
      live.forEach((c) => c.abort());
    };
  }, []);

  const patch = (key: number, p: Partial<UploadRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  async function start(list: File[]) {
    if (list.length === 0) return;
    // A dropped file can be of any type (the input's `accept` does not apply to a drop): turn away what this screen cannot use, and say so.
    const usable = list.filter((f) => kinds.includes(kindOfMime(f.type)));
    const turnedAway: UploadRow[] = list
      .filter((f) => !usable.includes(f))
      .map((file) => ({ key: next.current++, file, sent: 0, status: "error" as const, error: "This screen can't use this kind of file." }));
    const fresh: UploadRow[] = usable.map((file) => ({ key: next.current++, file, sent: 0, status: "uploading" }));
    setRows((rs) => [...turnedAway, ...fresh, ...rs]);
    const done: UploadedFile[] = [];
    // One at a time: a quota refusal on the first file stops the rest cleanly, and the person sees which file it was.
    for (const row of fresh) {
      if (stopped.current) break;
      const ctl = new AbortController();
      controllers.current.set(row.key, ctl);
      try {
        const res = await uploadToDrive(row.file, {
          // A screen that needs a public link gets a Published file, whatever the type's own default is (a PDF defaults to Private).
          ...(visibility ? { visibility } : {}),
          signal: ctl.signal,
          onProgress: ({ sent }) => patch(row.key, { sent }),
          ...uploadOptions,
        });
        if (requirePublicUrl && res.visibility === "private") {
          // Drive already held this exact file as a Private one, so nothing new was made Published. Say so rather than add a tile that is greyed out.
          patch(row.key, { status: "error", error: "This file is already in Drive as a Private file, and this needs a public link. Publish it in Drive, then choose it here." });
          continue;
        }
        patch(row.key, { status: "done", sent: row.file.size, result: res });
        done.push({ ...res, mimeType: row.file.type });
      } catch (err) {
        patch(row.key, { status: "error", error: uploadErrorMessage(err) });
        if (err instanceof UploadAborted) continue;
      } finally {
        controllers.current.delete(row.key);
      }
    }
    if (done.length > 0 && !stopped.current) {
      toast.success(`Added ${done.length} ${done.length === 1 ? "file" : "files"} to Drive.`);
      onDoneRef.current(done);
    }
  }

  const accept = kinds.map((k) => ACCEPT[k]).join(",");
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div
        className={cn("flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 px-6 py-12 text-center transition-colors motion-reduce:transition-none", dragging && "border-primary bg-primary/5")}
        onDragOver={(e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          setDragging(false);
          void start(Array.from(e.dataTransfer.files));
        }}
      >
        <Upload className="size-6 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm font-medium">Drop files here, or choose them.</p>
        <p className="mt-1 text-xs text-muted-foreground">Large files are sent in pieces, and carry on if your connection drops.</p>
        <Label htmlFor={inputId} className="mt-4 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent">
          <Upload className="size-3.5" aria-hidden /> Choose files
        </Label>
        <input
          id={inputId}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            void start(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {rows.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="Uploads">
          {rows.map((r) => (
            <li key={r.key} className="rounded-md border p-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{r.file.name}</span>
                {r.status === "uploading" ? (
                  <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={`Cancel ${r.file.name}`} onClick={() => controllers.current.get(r.key)?.abort()}>
                    <X className="size-3.5" />
                  </Button>
                ) : (
                  <span className={cn("text-xs", r.status === "done" ? "text-success-on-tint" : "text-destructive-on-tint")}>{r.status === "done" ? "Added" : "Not added"}</span>
                )}
              </div>
              {r.status === "uploading" && (
                <>
                  <Progress value={r.file.size ? Math.round((r.sent / r.file.size) * 100) : 0} className="mt-2 h-1.5" aria-label={`Uploading ${r.file.name}`} />
                  <p className="mt-1 text-xs text-muted-foreground">{progressWords(r.sent, r.file.size)}</p>
                </>
              )}
              {r.status === "error" && <p className="mt-1 text-xs text-destructive-on-tint">{r.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Sending 12 of 48 MB". Whole numbers; the percentage is the bar's job. */
export function progressWords(sent: number, total: number): string {
  const mb = (n: number) => Math.max(0, Math.round(n / 1048576));
  return total < 1048576 ? "Sending…" : `Sending ${mb(sent)} of ${mb(total)} MB`;
}

// ── Generate ─────────────────────────────────────────────

function GenerateTab({
  kinds,
  onGenerate,
  prompt: initial,
  editable,
  onMade,
}: {
  kinds: DriveKind[];
  onGenerate: DrivePickerProps["onGenerate"];
  prompt?: string;
  editable: boolean;
  onMade: (asset: MediaAsset | undefined) => void;
}) {
  const [prompt, setPrompt] = useState(initial ?? "");
  const [kind, setKind] = useState<"image" | "video">(kinds.includes("image") ? "image" : "video");
  const [running, setRunning] = useState(false);
  // No screen-supplied generator: the picker's own makes IMAGES, so a screen that takes only video or documents has nothing to offer here.
  const generate: DrivePickerProps["onGenerate"] =
    onGenerate ?? (kinds.includes("image") ? (p, _kind, opts) => generateImageToDrive({ prompt: p, ...(opts?.quoteToken ? { quoteToken: opts.quoteToken } : {}) }) : undefined);
  const offered = onGenerate ? kinds : kinds.filter((k) => k === "image");
  const both = offered.includes("image") && offered.includes("video");
  const queryClient = useQueryClient();
  // The price of one image, asked for while the tab is open and shown before the button is pressed (the cost is known first).
  const price = usePeaksQuote(PEAKS_ACTIONS.generateImage, Boolean(generate) && kind === "image");

  if (!generate || (!offered.includes("image") && !offered.includes("video"))) {
    return (
      <div className="flex-1 p-4">
        <Notice title="Generating isn't available here" body="Generate an image from where you write the post, or upload one from your computer." />
      </div>
    );
  }
  async function run() {
    if (!generate || prompt.trim().length === 0) return;
    setRunning(true);
    try {
      const made = await generate(prompt.trim(), kind, kind === "image" ? quoteTokenFor(price) : undefined);
      onMade(made ?? undefined);
    } catch (err) {
      // Refused before it started (too few credits, already running): nothing was charged, and the api says what to do.
      const refusal = err instanceof ApiError ? chargedTaskRefusal(err.code, err.message) : undefined;
      if (refusal) toast.error(refusal.title, { description: refusal.description });
      else if (err instanceof ApiError && err.code === "QUOTE_NOT_HONOURED") {
        // The receipt for the price shown has lapsed: nothing ran. Ask for the price again, then press again.
        queryClient.resetQueries({ queryKey: ["peaks-quote"] });
        toast.error("That price has changed.", { description: err.message || "Ask for a fresh quote and confirm the new price." });
      } else if (err instanceof ApiError && err.code === "STORAGE_QUOTA_EXCEEDED") toast.error("Your Drive is full.", { description: `${err.message} You were not charged.` });
      else toast.error("We couldn't make that", { description: err instanceof Error ? `${err.message} You were not charged.` : "Try again in a moment. You were not charged." });
    } finally {
      setRunning(false);
    }
  }
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      <div className="space-y-1.5">
        <Label htmlFor="drive-picker-generate" className="text-sm font-medium">
          Describe what you want
        </Label>
        <Textarea id="drive-picker-generate" value={prompt} onChange={(e) => setPrompt(e.target.value)} readOnly={!editable} rows={4} placeholder="A blue tin of Assam tea on a wooden table, warm morning light" />
      </div>
      {both && (
        <div className="flex gap-2" role="group" aria-label="What to make">
          <Button type="button" size="sm" variant={kind === "image" ? "default" : "outline"} onClick={() => setKind("image")} className="gap-1.5">
            <ImageIcon className="size-3.5" /> Image
          </Button>
          <Button type="button" size="sm" variant={kind === "video" ? "default" : "outline"} onClick={() => setKind("video")} className="gap-1.5">
            <Video className="size-3.5" /> Video
          </Button>
        </div>
      )}
      {kind === "image" && <PriceLine price={price} />}
      <Button type="button" onClick={() => void run()} disabled={running || prompt.trim().length === 0} className="w-full gap-1.5">
        {running ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" /> : <Sparkles className="size-3.5" />}
        {running ? "Making it…" : `Make ${kind === "image" ? "an image" : "a video"}`}
      </Button>
      <p className="text-xs text-muted-foreground">Uses your AI credits. Images usually take a few seconds; videos up to a minute. What you make is saved to Drive.</p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** An uploaded file, in the shape the grid shows. */
function fileOf(u: UploadedFile): DriveFile {
  const mimeType = u.mimeType ?? "";
  return {
    id: u.mediaId,
    name: u.name,
    kind: kindOfMime(mimeType),
    mimeType,
    visibility: u.visibility,
    publicUrl: u.publicUrl,
    sizeBytes: u.sizeBytes,
    source: "uploaded",
    createdAt: new Date().toISOString(),
  };
}

export function kindOfMime(mime: string): DriveKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("font/")) return "font";
  return "document";
}

/**
 * What the screen receives for a chosen file. A Published file's `url` is its public one. A Private file's is a SIGNED link that expires
 * (`linkExpiresInSeconds` says when), fetched now; null when the link could not be made, so the caller never gets a file with no way to read it.
 */
export async function assetOf(f: DriveFile, requirePublicUrl: boolean, needUrl = true): Promise<MediaAsset | null> {
  let url = f.publicUrl;
  let expires: number | undefined;
  if (f.visibility === "private") {
    if (requirePublicUrl) return null;
    if (!needUrl) {
      // The screen sends the file by id: no link is fetched, so a slow or failing link route cannot block it.
      url = "";
    } else {
      try {
        const link = await getFileLink(f.id);
        url = link.url;
        expires = link.expiresInSeconds ?? undefined;
      } catch {
        return null;
      }
    }
  }
  if (url === undefined || (url === "" && needUrl)) return null;
  return {
    id: f.id,
    url,
    mime: f.mimeType,
    width: f.width,
    height: f.height,
    bytes: f.sizeBytes,
    alt: f.altText,
    name: f.name,
    visibility: f.visibility,
    ...(expires !== undefined ? { linkExpiresInSeconds: expires } : {}),
    source: f.source === "ai_generated" ? (f.kind === "video" ? "ai_video" : "ai_image") : "upload",
    createdAt: f.createdAt,
  };
}
