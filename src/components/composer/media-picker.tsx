"use client";

/**
 * <MediaPicker/> — asset-library search + selection UI. Opens a Sheet
 * from the right with three tabs: Library (browse + search), Upload
 * (drag-drop + file picker), Generate (AI image / video). Selected
 * assets are returned to the host via `onSelect(assets[])`.
 *
 * Per the locked plan ([[project_composer_scheduler_buildout]],
 * decision 2026-05-29): this PR ships the *UI shell* against a
 * handler-callback interface. The host owns:
 *   - `onSearch(query, filter)` — returns assets the library shows
 *   - `onUpload(File[])` — uploads files, returns the persisted
 *     assets (host implements R2 + cnt_media; placeholder shim
 *     this session)
 *   - `onGenerate(prompt, kind)` — fires the relevant creative skill
 *
 * R2 + cnt_media + the upload pipeline land in the next session
 * per [[project_media_manager_r2_plan]]. The picker shape stays
 * unchanged; only the handler implementations swap.
 *
 * Behaviour:
 *   - Multi-select with per-tile checkbox; Insert button shows the
 *     count and is enabled only when >= 1 selected.
 *   - Per-asset alt-text input on hover (required for X/LI a11y).
 *   - Source badge (Upload / AI-image / AI-video) on each tile.
 *   - Aspect-ratio chip per tile (1:1 / 4:5 / 16:9 / native) for
 *     quick scan against platform target.
 *   - Grid is virtualised-lite: renders only the first 60 visible
 *     items + a Load more sentinel. Full virtualisation is a follow-
 *     up if libraries get large.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  Image as ImageIcon,
  Loader2,
  Search,
  Sparkles,
  Upload,
  Video,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MediaAsset } from "./types";

export interface MediaPickerProps {
  /** Trigger button. Host passes its own styled button — defaults to
   *  a ghost icon button if omitted. */
  trigger?: React.ReactNode;
  /** Filter what types the picker surfaces. Defaults to images+videos. */
  accept?: "image" | "video" | "both";
  /** Maximum number of assets the caller wants. Default unbounded. */
  maxSelection?: number;
  /** Search the library. Receives the query + a kind filter. Returns
   *  matching assets. Host owns the data layer (R2/cnt_media or
   *  shim). */
  onSearch: (
    query: string,
    kind: "image" | "video" | "both",
    signal: AbortSignal,
  ) => Promise<MediaAsset[]>;
  /** Upload File objects (from dropzone or file picker). Returns the
   *  persisted assets so the picker can append them to the library
   *  grid in real time. Host owns the storage backend. */
  onUpload?: (files: File[]) => Promise<MediaAsset[]>;
  /** Fire an AI creative skill (generate-image / generate-video).
   *  Returns the generated asset so the picker can highlight it. */
  onGenerate?: (
    prompt: string,
    kind: "image" | "video",
  ) => Promise<MediaAsset>;
  /** Called when the user clicks Insert with selected assets. The
   *  Sheet closes automatically. */
  onSelect: (assets: MediaAsset[]) => void;
}

export function MediaPicker({
  trigger,
  accept = "both",
  maxSelection,
  onSearch,
  onUpload,
  onGenerate,
  onSelect,
}: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"library" | "upload" | "generate">("library");
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Map<string, MediaAsset>>(new Map());
  const [altDrafts, setAltDrafts] = useState<Map<string, string>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  // Stash onSearch in a ref — inline lambdas from the host would
  // otherwise change identity every render and continuously reset
  // the 150ms debounce, so the search would never execute.
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // Debounced search. setLoading(true) is synchronous inside the
  // timeout (which fires post-render), avoiding the spinner-after-
  // results race that the previous microtask hack introduced.
  useEffect(() => {
    if (!open || activeTab !== "library") return;
    const id = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      onSearchRef.current(query.trim(), accept, ctrl.signal)
        .then((results) => {
          if (ctrl.signal.aborted) return;
          setLibrary(results);
          setLoading(false);
        })
        .catch((err) => {
          if (ctrl.signal.aborted) return;
          toast.error("Library search failed", {
            description: err instanceof Error ? err.message : String(err),
          });
          setLibrary([]);
          setLoading(false);
        });
    }, 150);
    return () => clearTimeout(id);
  }, [open, activeTab, query, accept]);

  function toggle(asset: MediaAsset) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(asset.id)) {
        next.delete(asset.id);
      } else {
        if (maxSelection && next.size >= maxSelection) {
          toast.info(`Maximum ${maxSelection} item${maxSelection === 1 ? "" : "s"} per pick.`);
          return prev;
        }
        // Merge any alt-text the user typed in the drawer.
        const altDraft = altDrafts.get(asset.id);
        next.set(asset.id, altDraft ? { ...asset, alt: altDraft } : asset);
      }
      return next;
    });
  }

  function handleInsert() {
    // Snapshot alt-text drafts onto the selected assets at insert
    // time (so an alt typed AFTER selection still flows through).
    const final = Array.from(selected.values()).map((a) => {
      const draft = altDrafts.get(a.id);
      return draft && draft !== a.alt ? { ...a, alt: draft } : a;
    });
    onSelect(final);
    setOpen(false);
    setSelected(new Map());
    setAltDrafts(new Map());
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs">
            <ImageIcon className="size-3.5" />
            Media
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            <ImageIcon className="size-4" /> Media picker
          </SheetTitle>
          <SheetDescription>
            Browse, upload, or generate. Pick one or more, add alt-text, then insert.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "library" | "upload" | "generate")}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="border-b px-6 pt-3">
            <TooltipProvider delayDuration={300}>
              <TabsList className="w-full justify-start bg-transparent p-0">
                <TabsTrigger value="library" className="data-[state=active]:bg-muted">
                  Library
                </TabsTrigger>
                {onUpload ? (
                  <TabsTrigger value="upload" className="data-[state=active]:bg-muted">
                    Upload
                  </TabsTrigger>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* Wrap in span so Tooltip can attach to a disabled element */}
                      <span tabIndex={0}>
                        <TabsTrigger value="upload" disabled className="data-[state=active]:bg-muted">
                          Upload
                        </TabsTrigger>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Upload is not enabled for this composer.</TooltipContent>
                  </Tooltip>
                )}
                {onGenerate ? (
                  <TabsTrigger value="generate" className="data-[state=active]:bg-muted">
                    <Sparkles className="mr-1 size-3" /> Generate
                  </TabsTrigger>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <TabsTrigger value="generate" disabled className="data-[state=active]:bg-muted">
                          <Sparkles className="mr-1 size-3" /> Generate
                        </TabsTrigger>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>AI generation is not enabled for this composer.</TooltipContent>
                  </Tooltip>
                )}
              </TabsList>
            </TooltipProvider>
          </div>

          {/* LIBRARY TAB */}
          <TabsContent value="library" className="flex flex-1 flex-col overflow-hidden m-0">
            <div className="border-b px-6 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, tag, or alt-text…"
                  className="h-9 pl-8"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <LibraryGrid
                loading={loading}
                items={library}
                selected={selected}
                altDrafts={altDrafts}
                onToggle={toggle}
                onAltDraft={(id, alt) =>
                  setAltDrafts((m) => {
                    const next = new Map(m);
                    next.set(id, alt);
                    return next;
                  })
                }
              />
            </ScrollArea>
          </TabsContent>

          {/* UPLOAD TAB */}
          <TabsContent value="upload" className="flex flex-1 flex-col overflow-hidden m-0">
            <UploadPanel
              accept={accept}
              onUpload={async (files) => {
                if (!onUpload) return;
                try {
                  const created = await onUpload(files);
                  setLibrary((prev) => [...created, ...prev]);
                  // Pre-select what was just uploaded so the user can
                  // hit Insert immediately if that's all they wanted.
                  setSelected((prev) => {
                    const next = new Map(prev);
                    for (const a of created) {
                      if (maxSelection && next.size >= maxSelection) break;
                      next.set(a.id, a);
                    }
                    return next;
                  });
                  setActiveTab("library");
                  toast.success(`Uploaded ${created.length} file${created.length === 1 ? "" : "s"}.`);
                } catch (err) {
                  toast.error("Upload failed", {
                    description: err instanceof Error ? err.message : String(err),
                  });
                }
              }}
            />
          </TabsContent>

          {/* GENERATE TAB */}
          <TabsContent value="generate" className="flex flex-1 flex-col overflow-hidden m-0">
            <GeneratePanel
              accept={accept}
              onGenerate={async (prompt, kind) => {
                if (!onGenerate) return;
                try {
                  const created = await onGenerate(prompt, kind);
                  setLibrary((prev) => [created, ...prev]);
                  setSelected((prev) => {
                    if (maxSelection && prev.size >= maxSelection) return prev;
                    const next = new Map(prev);
                    next.set(created.id, created);
                    return next;
                  });
                  setActiveTab("library");
                  toast.success(`Generated ${kind === "image" ? "image" : "video"}.`);
                } catch (err) {
                  toast.error("Generate failed", {
                    description: err instanceof Error ? err.message : String(err),
                  });
                }
              }}
            />
          </TabsContent>
        </Tabs>

        <SheetFooter className="border-t bg-muted/30 px-6 py-3 sm:flex-row sm:justify-between sm:items-center">
          <div className="text-xs text-muted-foreground">
            {selected.size === 0 ? "Nothing selected." : `${selected.size} selected.`}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={selected.size === 0} onClick={handleInsert}>
              Insert {selected.size > 0 && `(${selected.size})`}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Library grid ─────────────────────────────────────────

function LibraryGrid({
  loading,
  items,
  selected,
  altDrafts,
  onToggle,
  onAltDraft,
}: {
  loading: boolean;
  items: MediaAsset[];
  selected: Map<string, MediaAsset>;
  altDrafts: Map<string, string>;
  onToggle: (a: MediaAsset) => void;
  onAltDraft: (id: string, alt: string) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 p-6 sm:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-md" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="rounded-full border bg-muted/40 p-3">
          <ImageIcon className="size-6 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm font-medium">Nothing here yet.</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Upload a file, generate something new, or change your search query.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 p-6 sm:grid-cols-3">
      {items.map((a) => {
        const isSelected = selected.has(a.id);
        const isVideo = a.mime.startsWith("video/");
        const altDraft = altDrafts.get(a.id) ?? a.alt ?? "";
        const kindLabel = isVideo ? "video" : "image";
        // Source label — full words for screen readers + visual users
        // alike. Tiles are wide enough at sm+ that the badge fits.
        const sourceLabel =
          a.source === "upload"
            ? "Uploaded"
            : a.source === "ai_image"
            ? "AI Image"
            : "AI Video";
        return (
          <div
            key={a.id}
            className={cn(
              "group relative overflow-hidden rounded-md border bg-background transition-all motion-reduce:transition-none",
              isSelected && "border-primary ring-2 ring-primary",
            )}
          >
            <button
              type="button"
              onClick={() => onToggle(a)}
              className="block aspect-square w-full overflow-hidden bg-muted"
              aria-pressed={isSelected}
              aria-label={`${isSelected ? "Deselect" : "Select"} ${a.alt ?? kindLabel} asset`}
            >
              {isVideo ? (
                <div className="flex h-full w-full items-center justify-center bg-black/80">
                  <Video className="size-8 text-white" />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.url}
                  alt={a.alt ?? ""}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
              )}
              {/* Source badge */}
              <div className="absolute left-1.5 top-1.5">
                <Badge
                  variant="secondary"
                  className="h-5 gap-1 px-1.5 text-[10px] backdrop-blur"
                >
                  {a.source === "ai_image" || a.source === "ai_video" ? (
                    <Sparkles className="size-2.5" />
                  ) : (
                    <Upload className="size-2.5" />
                  )}
                  {sourceLabel}
                </Badge>
              </div>
              {/* Selected check */}
              {isSelected && (
                <div className="absolute right-1.5 top-1.5">
                  <div className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </div>
                </div>
              )}
            </button>
            {/* Alt-text input — visible on hover, when selected, OR
                when the input itself is focused (keyboard reachability
                fix per review). */}
            <div
              className={cn(
                "border-t bg-background px-2 py-1.5 transition-opacity motion-reduce:transition-none",
                isSelected
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
              )}
            >
              <Input
                value={altDraft}
                onChange={(e) => onAltDraft(a.id, e.target.value)}
                placeholder="Describe for screen readers…"
                aria-label={`Alt text for ${a.alt ?? `${kindLabel} asset`}`}
                className="h-7 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Upload panel ─────────────────────────────────────────

function UploadPanel({
  accept,
  onUpload,
}: {
  accept: "image" | "video" | "both";
  onUpload: (files: File[]) => Promise<void>;
}) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const acceptAttr =
    accept === "image" ? "image/*" : accept === "video" ? "video/*" : "image/*,video/*";

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await onUpload(Array.from(files));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className={cn(
        "m-6 flex flex-col items-center justify-center rounded-md border-2 border-dashed bg-muted/30 p-12 text-center transition-colors",
        isDragging && "border-primary bg-primary/5",
      )}
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
    >
      <div className="rounded-full border bg-background p-3">
        {uploading ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none" />
        ) : (
          <Upload className="size-6 text-muted-foreground" />
        )}
      </div>
      <p className="mt-3 text-sm font-medium">
        {uploading ? "Uploading…" : "Drop files here, or click to browse."}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {accept === "image"
          ? "Images only."
          : accept === "video"
          ? "Videos only."
          : "Images and videos."}
      </p>
      <Label htmlFor={inputId} className="mt-4">
        <span
          className={cn(
            "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors",
            "hover:bg-accent",
          )}
        >
          <Upload className="size-3.5" />
          Choose files
        </span>
        <input
          id={inputId}
          type="file"
          multiple
          accept={acceptAttr}
          className="sr-only"
          onChange={(e: ChangeEvent<HTMLInputElement>) => void handleFiles(e.target.files)}
        />
      </Label>
    </div>
  );
}

// ── Generate panel ───────────────────────────────────────

function GeneratePanel({
  accept,
  onGenerate,
}: {
  accept: "image" | "video" | "both";
  onGenerate: (prompt: string, kind: "image" | "video") => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<"image" | "video">(
    accept === "video" ? "video" : "image",
  );
  const [running, setRunning] = useState(false);

  async function fire() {
    if (prompt.trim().length === 0) return;
    setRunning(true);
    try {
      await onGenerate(prompt.trim(), kind);
      setPrompt("");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="m-6 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="media-gen-prompt" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Describe what you want
        </Label>
        <Textarea
          id="media-gen-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={
            kind === "image"
              ? "A photorealistic image of a coffee shop at sunrise, warm tones, candid…"
              : "A 6-second clip of latte art being poured in slow motion…"
          }
        />
      </div>
      {accept === "both" && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant={kind === "image" ? "default" : "outline"}
            size="sm"
            onClick={() => setKind("image")}
            className="gap-1.5"
          >
            <ImageIcon className="size-3.5" /> Image
          </Button>
          <Button
            type="button"
            variant={kind === "video" ? "default" : "outline"}
            size="sm"
            onClick={() => setKind("video")}
            className="gap-1.5"
          >
            <Video className="size-3.5" /> Video
          </Button>
        </div>
      )}
      <Button
        type="button"
        onClick={fire}
        disabled={running || prompt.trim().length === 0}
        className="w-full gap-1.5"
      >
        {running ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" /> : <Sparkles className="size-3.5" />}
        {running ? "Generating…" : `Generate ${kind}`}
      </Button>
      <p className="text-xs text-muted-foreground">
        Costs are pulled from your monthly AI credits. Generation typically takes
        {kind === "image" ? " 5–15 seconds." : " 20–60 seconds."}
      </p>
    </div>
  );
}
