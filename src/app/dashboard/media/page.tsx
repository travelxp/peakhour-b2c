"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload,
  Search,
  Image as ImageIcon,
  Trash2,
  Loader2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import {
  listMedia,
  getMedia,
  getStorageUsage,
  uploadMedia,
  deleteMedia,
  formatBytes,
  type MediaItem,
  type MediaSource,
} from "@/lib/api/media";
import { ApiError } from "@/lib/api";
import { StorageMeter } from "./storage-meter";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDate } from "@/lib/locale";

const MEDIA_CRONS = [
  "media-usage-scan",
  "media-cleanup-suggestions",
  "media-hard-delete",
  "media-storage-reconcile",
] as const;

const SOURCE_LABELS: Record<MediaSource, string> = {
  ai_generated: "AI generated",
  uploaded: "Uploaded",
  unsplash: "Unsplash",
  imported_beehiiv: "Beehiiv",
  imported_data_url: "Imported",
};

const SUGGESTION_LABELS: Record<string, string> = {
  unused_90d: "Unused 90d+",
  large_5mb_plus: "Large file",
  duplicate_content_hash: "Duplicate",
  orphan_generated: "Never used",
};

// Client-side upload guards (server re-validates). SVG excluded to match the
// api upload allowlist (stored-XSS decision).
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export default function MediaManagerPage() {
  const queryClient = useQueryClient();
  const [source, setSource] = useState<MediaSource | undefined>(undefined);
  const [status, setStatus] = useState<"active" | "deleted">("active");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const usageQuery = useQuery({
    queryKey: ["storage-usage"],
    queryFn: getStorageUsage,
  });

  const mediaQuery = useInfiniteQuery({
    queryKey: ["media", source ?? "all", status],
    queryFn: ({ pageParam }) =>
      listMedia({ source, status, page: pageParam, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.hasMore ? last.meta.page + 1 : undefined,
  });

  const items = useMemo(
    () => mediaQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [mediaQuery.data],
  );

  // Client-side search over the loaded pages (AI prompt + source label).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (m) =>
        m.aiOrigin?.prompt?.toLowerCase().includes(q) ||
        (SOURCE_LABELS[m.source] ?? m.source).toLowerCase().includes(q) ||
        m.mimeType.toLowerCase().includes(q),
    );
  }, [items, search]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["media"] });
    void queryClient.invalidateQueries({ queryKey: ["storage-usage"] });
  }, [queryClient]);

  const uploadMutation = useMutation({
    mutationFn: uploadMedia,
    onSuccess: (res) => {
      toast.success(res.deduped ? "Image already in your library" : "Image uploaded");
      invalidate();
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError && err.code === "STORAGE_QUOTA_EXCEEDED"
          ? "Storage limit reached — clean up or upgrade to upload more."
          : err instanceof ApiError
            ? err.message
            : "Upload failed";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMedia,
    onSuccess: (res) => {
      toast.success(`Moved to trash — ${formatBytes(res.freedBytes)} freed (recoverable for 30 days)`);
      setSelected(null);
      invalidate();
    },
    onError: () => toast.error("Couldn't delete that item"),
  });

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      for (const file of Array.from(files)) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          toast.error(`${file.name}: unsupported type (PNG/JPEG/WebP/GIF only)`);
          continue;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          toast.error(`${file.name}: too large (max 15 MB)`);
          continue;
        }
        uploadMutation.mutate(file);
      }
    },
    [uploadMutation],
  );

  return (
    <div className="space-y-4">
      <CronToolbar crons={MEDIA_CRONS} onTriggered={invalidate} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Media</h1>
          <p className="text-sm text-muted-foreground">
            Images generated and uploaded across your content.
          </p>
        </div>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {usageQuery.data && (
        <div className="rounded-lg border p-4">
          <StorageMeter usage={usageQuery.data} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search prompt or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 pl-8"
          />
        </div>
        <Select
          value={source ?? "all"}
          onValueChange={(v) => setSource(v === "all" ? undefined : (v as MediaSource))}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          value={status}
          onValueChange={(v) => v && setStatus(v as "active" | "deleted")}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="active">Active</ToggleGroupItem>
          <ToggleGroupItem value="deleted">Trash</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Drop zone + grid */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-transparent"
        }`}
      >
        {mediaQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-md" />
            ))}
          </div>
        ) : mediaQuery.isError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load your media"
            description="Something went wrong fetching the library. Please try again."
            action={{ label: "Retry", onClick: () => void mediaQuery.refetch() }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title={search ? "No matches" : status === "deleted" ? "Trash is empty" : "No media yet"}
            description={
              search
                ? "Try a different search."
                : status === "deleted"
                  ? "Deleted media appears here for 30 days before it's permanently removed."
                  : "Generate images on a finalized idea, or drag files here to upload."
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelected(m);
                  // Fire-and-forget: bumps lastAccessedAt server-side
                  // (feeds unused-90d detection). UI keeps the list row.
                  void getMedia(m.id).catch(() => {});
                }}
                className="group relative overflow-hidden rounded-md border bg-muted text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <div className="aspect-square overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.publicUrl}
                    alt={m.aiOrigin?.prompt ?? "media asset"}
                    loading="lazy"
                    className="size-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
                <div className="flex items-center justify-between gap-1 p-1.5 text-[11px]">
                  <Badge variant="secondary" className="gap-1 px-1 py-0">
                    {m.source === "ai_generated" && <Sparkles className="size-3" />}
                    {SOURCE_LABELS[m.source] ?? m.source}
                  </Badge>
                  <span className="text-muted-foreground">{formatBytes(m.sizeBytes)}</span>
                </div>
                {m.suggestedAction && (
                  <span className="absolute right-1 top-1 rounded bg-amber-500/90 px-1 py-0.5 text-[10px] font-medium text-white">
                    {SUGGESTION_LABELS[m.suggestedAction.kind] ?? "Cleanup"}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {mediaQuery.hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={() => void mediaQuery.fetchNextPage()}
              disabled={mediaQuery.isFetchingNextPage}
            >
              {mediaQuery.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Media detail</SheetTitle>
                <SheetDescription>
                  {SOURCE_LABELS[selected.source]} · {formatBytes(selected.sizeBytes)}
                  {selected.width && selected.height ? ` · ${selected.width}×${selected.height}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-4">
                <div className="overflow-hidden rounded-md border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selected.publicUrl} alt="" className="max-h-80 w-full object-contain" />
                </div>
                <dl className="space-y-1.5 text-sm">
                  <Row label="Type" value={selected.mimeType} />
                  <Row label="Created" value={formatDate(selected.createdAt, null)} />
                  <Row label="Used in" value={`${selected.usedInCount} idea${selected.usedInCount === 1 ? "" : "s"}`} />
                  {selected.uploadedBy?.userName && (
                    <Row label="Uploaded by" value={selected.uploadedBy.userName} />
                  )}
                  {selected.aiOrigin?.modelId && (
                    <Row label="Model" value={selected.aiOrigin.modelId} />
                  )}
                  {selected.suggestedAction && (
                    <Row
                      label="Suggestion"
                      value={`${SUGGESTION_LABELS[selected.suggestedAction.kind]} · ${formatBytes(selected.suggestedAction.reclaimableBytes)} reclaimable`}
                    />
                  )}
                  {selected.deletedAt && selected.hardDeleteAfter && (
                    <Row
                      label="Auto-purge"
                      value={formatDate(selected.hardDeleteAfter, null)}
                    />
                  )}
                </dl>
                {selected.aiOrigin?.prompt && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">AI prompt</p>
                    <p className="mt-1 rounded bg-muted p-2 text-xs">{selected.aiOrigin.prompt}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button asChild variant="outline" className="flex-1">
                    <a href={selected.publicUrl} target="_blank" rel="noreferrer">
                      Open original
                    </a>
                  </Button>
                  {!selected.deletedAt && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="destructive" disabled={deleteMutation.isPending}>
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      }
                      title="Delete this image?"
                      description="It moves to the trash and is recoverable for 30 days, then permanently removed. Your storage is freed immediately."
                      confirmLabel="Delete"
                      variant="destructive"
                      onConfirm={() => deleteMutation.mutate(selected.id)}
                    />
                  )}
                </div>
                {selected.usedInCount > 0 && !selected.deletedAt && (
                  <p className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="size-3" />
                    Used in {selected.usedInCount} idea{selected.usedInCount === 1 ? "" : "s"} — deleting may break them.
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
