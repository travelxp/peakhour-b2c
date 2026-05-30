"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Sparkles } from "lucide-react";
import {
  listMedia,
  bulkDeleteMedia,
  formatBytes,
  type MediaItem,
  type SuggestedActionKind,
} from "@/lib/api/media";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Smart Delete banner + wizard (Media Manager / R2 plan §7, L11/L12).
 * Surfaces the 4 advisory cleanup categories tagged by the weekly cron;
 * the user reviews + multi-selects, then bulk soft-deletes. Advisory only —
 * nothing is auto-deleted.
 */

const CATEGORIES: { kind: SuggestedActionKind; label: string; hint: string }[] = [
  { kind: "duplicate_content_hash", label: "Duplicates", hint: "Identical to a newer image" },
  { kind: "orphan_generated", label: "AI images, never used", hint: "Generated but not embedded anywhere" },
  { kind: "unused_90d", label: "Unused for 90+ days", hint: "No references, created over 90 days ago" },
  { kind: "large_5mb_plus", label: "Large files (5 MB+)", hint: "Consider re-encoding before deleting" },
];

interface CategoryGroup {
  kind: SuggestedActionKind;
  items: MediaItem[];
}

export function SmartDelete() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: groups = [] } = useQuery({
    queryKey: ["smart-delete"],
    queryFn: async (): Promise<CategoryGroup[]> => {
      const results = await Promise.all(
        CATEGORIES.map((c) =>
          listMedia({ suggestedAction: c.kind, status: "active", limit: 100 }),
        ),
      );
      return CATEGORIES.map((c, i) => ({ kind: c.kind, items: results[i]!.items }));
    },
    staleTime: 60_000,
  });

  const totalSuggested = useMemo(
    () => groups.reduce((sum, g) => sum + g.items.length, 0),
    [groups],
  );

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const reclaimable = useMemo(
    () =>
      allItems
        .filter((m) => selected.has(m.id))
        .reduce((sum, m) => sum + (m.suggestedAction?.reclaimableBytes ?? m.sizeBytes), 0),
    [allItems, selected],
  );

  const bulkDelete = useMutation({
    mutationFn: () => bulkDeleteMedia([...selected]),
    onSuccess: (res) => {
      toast.success(`${res.deletedCount} item(s) moved to trash — ${formatBytes(res.freedBytes)} freed`);
      setSelected(new Set());
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["media"] });
      void queryClient.invalidateQueries({ queryKey: ["storage-usage"] });
      void queryClient.invalidateQueries({ queryKey: ["smart-delete"] });
    },
    onError: () => toast.error("Couldn't delete the selected items"),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCategory(kind: SuggestedActionKind, on: boolean) {
    const ids = groups.find((g) => g.kind === kind)?.items.map((m) => m.id) ?? [];
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  if (totalSuggested === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
        <span className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <Sparkles className="size-4" />
          Smart Delete found {totalSuggested} item{totalSuggested === 1 ? "" : "s"} you may not need.
        </span>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Review suggestions
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Suggested cleanup</DialogTitle>
            <DialogDescription>
              Review and select what to remove. Deleted media stays recoverable for 30 days; your storage is freed immediately. Nothing is deleted without your confirmation.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[55vh] pr-3">
            <div className="space-y-5">
              {CATEGORIES.map((cat) => {
                const group = groups.find((g) => g.kind === cat.kind);
                if (!group || group.items.length === 0) return null;
                const groupBytes = group.items.reduce(
                  (s, m) => s + (m.suggestedAction?.reclaimableBytes ?? m.sizeBytes),
                  0,
                );
                const allOn = group.items.every((m) => selected.has(m.id));
                return (
                  <div key={cat.kind}>
                    <label className="flex items-center gap-2 font-medium">
                      <Checkbox
                        checked={allOn}
                        onCheckedChange={(v) => toggleCategory(cat.kind, v === true)}
                      />
                      {cat.label}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({group.items.length} · {formatBytes(groupBytes)})
                      </span>
                    </label>
                    <p className="ml-6 text-xs text-muted-foreground">{cat.hint}</p>
                    <div className="ml-6 mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {group.items.map((m) => (
                        <label
                          key={m.id}
                          className="flex cursor-pointer items-center gap-2 rounded border p-1.5 text-xs"
                        >
                          <Checkbox
                            checked={selected.has(m.id)}
                            onCheckedChange={() => toggle(m.id)}
                          />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.publicUrl}
                            alt=""
                            loading="lazy"
                            className="size-8 shrink-0 rounded object-cover"
                          />
                          <span className="truncate text-muted-foreground">{formatBytes(m.sizeBytes)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter className="items-center gap-2 sm:justify-between">
            <span className="text-sm text-muted-foreground">
              {selected.size} selected · {formatBytes(reclaimable)} reclaimable
            </span>
            <Button
              variant="destructive"
              disabled={selected.size === 0 || bulkDelete.isPending}
              onClick={() => bulkDelete.mutate()}
            >
              <Trash2 className="size-4" />
              {bulkDelete.isPending ? "Deleting…" : `Delete ${selected.size} selected`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
