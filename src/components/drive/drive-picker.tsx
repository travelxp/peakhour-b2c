"use client";

/**
 * <DrivePicker/> - the ONE place a file is chosen for anything: a post, an ad, a page, a message, a listing. Every screen that needs an
 * image, a video or a document opens this same sheet: Drive (what you have), Upload (add something new), Link (a file at an https address)
 * and Generate (make something, where the screen can). Nothing else in the app opens a file chooser (src/lib/media-picker-guard.test.ts).
 *
 * THE SCREEN NAMES WHERE THE FILE IS GOING, AND THE PICKER KNOWS THE RULES
 *  - `destination` is a post on a channel, an ad placement, a message, a listing or a page. The picker reads that destination's rules from the
 *    api (`lib/media-rules.ts`, one table built from the constraints adapters the publishers enforce): which types, how big, how many, what
 *    shape, how long. No screen passes a type, a size or a count, so no two screens can disagree about a place.
 *  - A file the place would refuse is greyed out on its tile, with why. One that could be made to fit (a shape to crop, a size to reduce) says
 *    what to do. An upload is judged BEFORE it is sent; a refused file never leaves the browser.
 *  - Where the destination has a channel, files that fit come first. The content verdicts are the api's `channelFit` (a reading of what is in
 *    the file); the hard limits above are the same adapter's, so the two never disagree. A file nobody has judged yet is "Not checked yet".
 *  - A Private file has no public link. Where the screen needs one (`requirePublicUrl`, the default: posts, ads, pages) the tile is greyed
 *    out and says why. Where it does not (an Inbox reply sends the bytes), the file can be added and the picker fetches a short-lived signed
 *    link for it at the moment of adding.
 *
 * Mount this component's panel (`DrivePickerPanel`) directly to test it: the sheet is only the frame.
 */

import { MediaImage } from "@/components/shared/media-image";
import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Loader2, Lock, Search, Sparkles, Video, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { PEAKS_ACTIONS } from "@/lib/api/peaks";
import { usePeaksQuote, quoteTokenFor } from "@/hooks/use-peaks-quote";
import { chargedTaskRefusal } from "@/hooks/use-audience-plan";
import { PriceLine } from "@/components/audience/discover-audiences-dialog";
import { generateImageToDrive, GeneratedPrivateError } from "@/lib/drive/generate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { MediaAsset } from "@/components/composer/types";
import { listDriveFiles, type DriveFile, type DriveKind } from "@/lib/drive/files";
import { anyVerdict, fitNote, orderByFit, PRIVATE_NEEDS_PUBLIC } from "@/lib/drive/fit";
import { assetOf } from "@/lib/drive/asset-of";
import { aloneProblem, judgeFile, fitChannelOf, kindOfMime, kindsOfRule, roomLeft, useMediaRule, verdictText, type MediaDestination, type Verdict } from "@/lib/media-rules";
import { LinkTab, UploadTab, driveFileOf, fullSentence, type UploadSeam } from "@/components/drive/drive-picker-upload";

export { assetOf, kindOfMime };
export { useDropPaste, type DropPasteOptions } from "@/components/drive/drive-picker-upload";
export type { MediaDestination } from "@/lib/media-rules";

export type PickerTab = "drive" | "upload" | "link" | "generate";

export interface DrivePickerProps {
  trigger?: React.ReactNode;
  /** Where the file is going. The picker applies that place's rules: types, size, count, shape, length. */
  destination: MediaDestination;
  /** How many files the place already holds, so the picker knows how much room is left. Default 0. */
  attached?: number;
  /** True (default): the file must have a public link, so a Private file cannot be added. False: a Private file is added with a short-lived signed link. */
  requirePublicUrl?: boolean;
  /** What a file uploaded here becomes. Default: Published where a public link is needed, else the file type's own default. An Inbox reply passes "private": a shopper's photo must not get a public address. */
  uploadAs?: "published" | "private";
  /** False when the screen takes only the file's id and reads the bytes itself (an Inbox reply): no link is fetched, so a Private file's `url` is "". Default true. */
  needUrl?: boolean;
  /** The button: "Add to post". Default "Add". */
  addLabel?: string;
  /**
   * Make something new. Returns the file to add, or nothing when the screen shows the result itself (the picker then closes).
   * Leave it off and, where the place takes images, the Generate tab makes an image from the sentence and saves it to Drive
   * (`POST /v1/media/generate`, charged like the Strategist's image, the price shown first). `quoteToken` is the receipt for the price shown.
   */
  onGenerate?: (prompt: string, kind: "image" | "video", opts?: { quoteToken?: string }) => Promise<MediaAsset | void>;
  /**
   * True when the screen's own `onGenerate` is charged as the image act (`content.generate_image`), so the tab shows that price first. The picker's
   * built-in generator always is. Leave it off for a generator charged as anything else: the tab then shows no price rather than the wrong one.
   */
  generatePriced?: boolean;
  /** This slot takes one file (a placeholder's picture), whatever the place takes in all. The picker takes the smaller. */
  single?: boolean;
  /** Which tabs to offer. Default: all four. A screen that must not make a file (a business's own photos) leaves Generate out. */
  tabs?: readonly PickerTab[];
  /** What the Generate box starts with (a brief the screen already holds). */
  generatePrompt?: string;
  /** False when Generate makes the file from `generatePrompt` alone (the box is read-only). Default true. */
  promptEditable?: boolean;
  onSelect: (assets: MediaAsset[]) => void;
}

const ALL_TABS: readonly PickerTab[] = ["drive", "upload", "link", "generate"];
const TAB_NAME: Record<PickerTab, string> = { drive: "Drive", upload: "Upload", link: "Link", generate: "Generate" };

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
          <SheetDescription>Choose a file from Drive, upload a new one, add one from a link, or generate one.</SheetDescription>
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

/** What is known of a Drive file, for judging it. */
const factsOf = (f: DriveFile) => ({
  mimeType: f.mimeType,
  sizeBytes: f.sizeBytes,
  ...(f.width ? { width: f.width } : {}),
  ...(f.height ? { height: f.height } : {}),
  ...(f.durationSeconds !== undefined ? { durationSeconds: f.durationSeconds } : {}),
});

export function DrivePickerPanel({
  destination,
  attached = 0,
  single: oneSlot = false,
  requirePublicUrl = true,
  needUrl = true,
  uploadAs,
  addLabel = "Add",
  onGenerate,
  tabs = ALL_TABS,
  generatePrompt,
  generatePriced = false,
  promptEditable = true,
  onSelect,
  onClose,
  uploadOptions,
}: Omit<DrivePickerProps, "trigger"> & { onClose?: () => void; /** Test seam: the upload client's dependencies and how a file is measured. */ uploadOptions?: UploadSeam }) {
  const ruleState = useMediaRule(destination);
  const rule = ruleState.state === "ready" ? ruleState.rule : undefined;
  const [tab, setTab] = useState<PickerTab>("drive");
  const [text, setText] = useState("");
  const q = useDebounced(text.trim(), 250);
  const [selected, setSelected] = useState<Map<string, DriveFile>>(new Map());
  /** Files uploaded in this panel, shown first so they are there before the list refetches. */
  const [added, setAdded] = useState<DriveFile[]>([]);
  const [adding, setAdding] = useState(false);
  /** A line the panel says in place, where a toast would float over the sheet. */
  const [notice, setNotice] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const kinds = useMemo<DriveKind[]>(() => (rule ? kindsOfRule(rule) : []), [rule]);
  const single = kinds.length === 1 ? kinds[0] : undefined;
  const query = useInfiniteQuery({
    queryKey: ["drive-picker", { q, kind: single ?? null }],
    queryFn: ({ pageParam }) => listDriveFiles({ q, kind: single, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: tab === "drive" && rule !== undefined,
    staleTime: 15_000,
  });

  const channel = fitChannelOf(destination);
  // keyed on the list's CONTENT: the rule's kinds are a new array when the rule is
  const kindsKey = kinds.join(",");
  const files = useMemo(() => {
    const seen = new Set<string>();
    const all: DriveFile[] = [];
    for (const f of [...(q ? [] : added), ...(query.data?.pages.flatMap((p) => p.items) ?? [])]) {
      if (seen.has(f.id) || !kinds.includes(f.kind)) continue;
      seen.add(f.id);
      all.push(f);
    }
    return orderByFit(all, channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `kinds` is read through kindsKey
  }, [query.data, added, q, kindsKey, channel]);

  // With several kinds the api is asked for every kind and this list is filtered here, so a page can hold nothing this place can use: keep
  // reading pages until something shows or Drive runs out, rather than call a Drive full of videos empty.
  const fetchNext = query.fetchNextPage;
  const readingOn = single === undefined && rule !== undefined && files.length === 0 && Boolean(query.hasNextPage);
  const pagesRead = query.data?.pages.length ?? 0;
  useEffect(() => {
    if (readingOn && !query.isFetchingNextPage) void fetchNext();
    // `pagesRead` re-runs this when a page lands, so a page that arrives with nothing showable asks for the next
  }, [readingOn, query.isFetchingNextPage, pagesRead, fetchNext]);

  /** How many more files this place takes: what it holds in all, less what is already on it and what is chosen here. */
  const room = rule ? Math.max(0, Math.min(roomLeft(rule, attached), oneSlot ? 1 : Infinity) - selected.size) : 0;
  const verdictOf = (f: DriveFile): Verdict => (rule ? judgeFile(rule, factsOf(f)) : { state: "unchecked", reason: "" });

  function toggle(file: DriveFile) {
    if (selected.has(file.id)) {
      setNotice(null);
      setSelected((prev) => {
        const next = new Map(prev);
        next.delete(file.id);
        return next;
      });
      return;
    }
    if (rule && room <= 0) {
      setNotice(`${oneSlot || rule.maxCount === 1 ? "One file is" : `Up to ${rule.maxCount} files are`} all ${oneSlot ? "this takes" : `${rule.label} takes`}${attached > 0 && !oneSlot ? ` (${attached} already on it)` : ""}.`);
      return;
    }
    const together = aloneProblem(rule!, [...[...selected.values()].map(factsOf), factsOf(file)], attached);
    if (together) {
      setNotice(together);
      return;
    }
    setNotice(null);
    setSelected((prev) => new Map(prev).set(file.id, file));
  }

  async function add() {
    setAdding(true);
    try {
      const assets: MediaAsset[] = [];
      for (const f of selected.values()) {
        const asset = await assetOf(f, requirePublicUrl, needUrl);
        if (!asset) {
          setNotice(`We couldn't get a link for "${f.name}". ${f.visibility === "private" ? PRIVATE_NEEDS_PUBLIC : "Try again in a moment."}`);
          return;
        }
        assets.push(asset);
      }
      onSelect(assets);
    } finally {
      setAdding(false);
    }
  }

  const verdicts = anyVerdict(files, channel);
  const anyPrivateBlocked = requirePublicUrl && files.some((f) => f.visibility === "private");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background" data-testid="drive-picker">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 pr-12">
        <h2 className="text-base font-semibold">Add from Drive</h2>
        <div role="tablist" aria-label="Where to get the file" className="flex gap-1 text-sm">
          {ALL_TABS.filter((t) => tabs.includes(t)).map((t) => (
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
              {TAB_NAME[t]}
            </button>
          ))}
        </div>
      </div>

      {!rule ? (
        <RuleNotice state={ruleState} />
      ) : (
        <>
          {tab === "drive" && rule && (
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
                {channel && files.length > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="fit-line">
                    {verdicts ? `Showing what fits ${rule.label} first.` : `Fit checks for ${rule.label} are still being worked out, so files are shown newest first.`}
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
                  verdictOf={verdictOf}
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

          {tab === "upload" && rule && (
            <UploadTab
              rule={rule}
              room={room}
              single={oneSlot}
              alongside={[...selected.values()].map(factsOf)}
              attached={attached}
              requirePublicUrl={requirePublicUrl}
              visibility={uploadAs ?? (requirePublicUrl ? "published" : undefined)}
              seam={uploadOptions}
              onDone={(done) => {
                const fresh = done.map(driveFileOf);
                setAdded((prev) => [...fresh, ...prev]);
                setSelected((prev) => {
                  const next = new Map(prev);
                  for (const f of fresh) if (next.size < Math.min(roomLeft(rule, attached), oneSlot ? 1 : Infinity) && !(requirePublicUrl && f.visibility === "private")) next.set(f.id, f);
                  return next;
                });
                // marked stale, so the Drive tab (disabled while Upload is open) fetches afresh when it comes back
                void queryClient.invalidateQueries({ queryKey: ["drive-picker"] });
                setTab("drive");
              }}
            />
          )}

          {tab === "link" && rule && (
            <LinkTab
              rule={rule}
              room={room}
              single={oneSlot}
              alongside={[...selected.values()].map(factsOf)}
              attached={attached}
              requirePublicUrl={requirePublicUrl}
              onDone={(file) => {
                setAdded((prev) => [file, ...prev]);
                setSelected((prev) => new Map(prev).set(file.id, file));
                void queryClient.invalidateQueries({ queryKey: ["drive-picker"] });
                setTab("drive");
              }}
            />
          )}

          {tab === "generate" && (
            <GenerateTab
              kinds={kinds}
              full={room <= 0}
              onGenerate={onGenerate}
              prompt={generatePrompt}
              priced={generatePriced}
              editable={promptEditable}
              onMade={(asset) => {
                if (!asset) return onClose?.();
                if (room <= 0) {
                  setNotice(`It is saved in Drive, but it was not added. ${fullSentence(rule!, oneSlot)}`);
                  return;
                }
                // What was made is judged like any other file: a picture the place would refuse is in Drive, and says why it was not added.
                const v = rule ? judgeFile(rule, { mimeType: asset.mime, sizeBytes: asset.bytes ?? 1, ...(asset.width ? { width: asset.width } : {}), ...(asset.height ? { height: asset.height } : {}) }) : undefined;
                if (v && (v.state === "refused" || v.state === "fixable")) {
                  setNotice(`It is saved in Drive, but it was not added. ${verdictText(v)}`);
                  return;
                }
                onSelect([asset]);
              }}
            />
          )}
        </>
      )}

      {notice && (
        <p role="alert" className="flex items-start gap-1.5 border-t bg-destructive/5 px-4 py-2 text-sm text-destructive-on-tint" data-testid="picker-notice">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{notice}</span>
        </p>
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

/** What the sheet says while the place's rules are not there: loading, failed (with a retry) or a place the api has no rules for. */
function RuleNotice({ state }: { state: ReturnType<typeof useMediaRule> }) {
  if (state.state === "loading") {
    return (
      <div className="grid grid-cols-3 gap-2.5 p-4" aria-busy="true" aria-label="Checking what this place takes">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (state.state === "failed") {
    return (
      <Notice
        title="We couldn't check what this place takes"
        body="Check your connection and try again. Nothing can be added until we know."
        action={
          <Button type="button" variant="outline" size="sm" onClick={state.retry}>
            Try again
          </Button>
        }
      />
    );
  }
  return <Notice title="This place can't take files yet" body="We don't have the rules for it, so nothing can be added here." />;
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
  verdictOf,
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
  verdictOf: (file: DriveFile) => Verdict;
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
              verdict={verdictOf(f)}
              blockedReason={blockedReason(f, requirePublicUrl, verdictOf(f))}
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

/** Why a file cannot be added here, or null. A Private file where a public link is needed is the first reason; then the place's own rules. */
export function blockedReason(f: DriveFile, requirePublicUrl: boolean, verdict: Verdict): string | null {
  if (requirePublicUrl && f.visibility === "private") return "Private. No public link.";
  return verdictText(verdict);
}

function Tile({
  file,
  channel,
  selected,
  verdict,
  blockedReason: blocked,
  onToggle,
}: {
  file: DriveFile;
  channel: string | undefined;
  selected: boolean;
  verdict: Verdict;
  blockedReason: string | null;
  onToggle: () => void;
}) {
  const fit = fitNote(file, channel);
  const private_ = blocked !== null && verdict.state !== "refused" && verdict.state !== "fixable";
  // What the tile says under the name: why it cannot be used, else how it fits.
  const apiSaid = fit.verdict === "good" || fit.verdict === "possible" || fit.verdict === "poor";
  const label = private_
    ? blocked
    : verdict.state === "refused"
      ? "Doesn't fit"
      : verdict.state === "fixable"
        ? "Needs a change"
        : apiSaid
          ? fit.label
          : verdict.state === "fits"
            ? "Fits"
            : fit.label || "Not fully checked";
  const tone = blocked ? "warn" : apiSaid ? fit.tone : verdict.state === "fits" ? "good" : "muted";
  const why = private_ ? PRIVATE_NEEDS_PUBLIC : (blocked ?? fit.reason);
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={blocked !== null}
      aria-pressed={selected}
      aria-label={`${selected ? "Deselect" : "Select"} ${file.name}${label ? `. ${label}` : ""}${why ? `. ${why}` : ""}`}
      title={why}
      className={cn(
        "group relative block w-full overflow-hidden rounded-lg border bg-card text-left transition-colors motion-reduce:transition-none",
        selected ? "border-primary ring-2 ring-primary" : "border-border",
        blocked ? "cursor-not-allowed opacity-60" : "hover:border-primary/60",
      )}
    >
      <div className="relative flex h-24 items-center justify-center overflow-hidden bg-muted">
        <Thumb file={file} />
        {file.visibility === "private" && (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-sm bg-background/90 px-1.5 py-0.5 text-micro font-medium">
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
        {label && (
          <div className={cn("mt-0.5 truncate", tone === "good" && "text-success-on-tint", tone === "warn" && "text-warning-on-tint", tone === "muted" && "text-muted-foreground")}>{label}</div>
        )}
        {blocked && !private_ && <div className="mt-0.5 line-clamp-3 text-micro text-muted-foreground">{blocked}</div>}
      </div>
    </button>
  );
}

function Thumb({ file }: { file: DriveFile }) {
  if (file.kind === "image" && file.publicUrl && file.visibility === "published") {
    return <MediaImage src={file.publicUrl} alt={file.altText ?? ""} width={320} height={320} sizes="160px" className="h-full w-full object-cover" />;
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

// ── Generate ─────────────────────────────────────────────

function GenerateTab({
  kinds,
  full,
  onGenerate,
  prompt: initial,
  priced,
  editable,
  onMade,
}: {
  kinds: DriveKind[];
  /** The place has no room left: nothing is made, so nothing is charged for a picture that could not be added. */
  full: boolean;
  onGenerate: DrivePickerProps["onGenerate"];
  prompt?: string;
  priced: boolean;
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
  // Only for a generator charged as the image act: the built-in one, or a screen's own that says it is (`generatePriced`).
  const showPrice = !onGenerate || priced;
  const price = usePeaksQuote(PEAKS_ACTIONS.generateImage, Boolean(generate) && showPrice && kind === "image");

  if (full) {
    return (
      <div className="flex-1 p-4">
        <Notice title="Nothing more can be added here" body="Remove a file, or deselect one, to make room before making another." />
      </div>
    );
  }
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
      // The built-in generator makes images only, whatever `kind` says.
      const asked = onGenerate ? kind : "image";
      const made = await generate(prompt.trim(), asked, showPrice && asked === "image" ? quoteTokenFor(price) : undefined);
      onMade(made ?? undefined);
    } catch (err) {
      // Refused before it started (too few credits, already running): nothing was charged, and the api says what to do.
      const refusal = err instanceof ApiError ? chargedTaskRefusal(err.code, err.message) : undefined;
      if (err instanceof GeneratedPrivateError) {
        // Made, and kept as the Private file that already held those bytes: it is in the Drive tab, not handed back (a Private file has no public link).
        void queryClient.invalidateQueries({ queryKey: ["drive-picker"] });
        toast.info("Already in Drive", { description: err.message });
      } else if (refusal) toast.error(refusal.title, { description: refusal.description });
      else if (err instanceof ApiError && err.code === "QUOTE_NOT_HONOURED") {
        // The receipt for the price shown has lapsed: nothing ran. Ask for the price again, then press again.
        queryClient.resetQueries({ queryKey: ["peaks-quote"] });
        toast.error("That price has changed.", { description: err.message || "Ask for a fresh quote and confirm the new price." });
      } else if (err instanceof ApiError && err.code === "STORAGE_QUOTA_EXCEEDED") toast.error("Your Drive is full.", { description: `${err.message} You were not charged.` });
      // A 4xx is the api refusing before it made anything (a held charge is released unless the answer is a success), so nothing was charged. A 5xx
      // from a gateway or a dropped connection may have come after the image was made, so those say nothing about the charge and point to Drive.
      else if (err instanceof ApiError && err.status >= 400 && err.status < 500) toast.error("We couldn't make that", { description: `${err.message} You were not charged.` });
      else toast.error("We couldn't make that", { description: "Check Drive before trying again: the image may have been made." });
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
      {showPrice && kind === "image" && <PriceLine price={price} />}
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
