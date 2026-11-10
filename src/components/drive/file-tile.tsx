"use client";

import { FileText, Play } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/lib/api/media";
import { badgeText, isBeingDescribed, tileLine } from "@/lib/drive/copy";

/**
 * One file in the Drive grid (Main board). A button that opens the file's panel, with a separate checkbox for bulk select (a control
 * cannot sit inside a button).
 *
 * WHILE PEAKHOUR IS NAMING THE FILE the preview carries the soft shimmer and the line under the name says what it is doing, by kind:
 * "Studying your image…", "Watching your video…", "Reading your document…". The shimmer is two empty layers over the preview, and
 * prefers-reduced-motion stops the movement (globals.css). A file the describer will not read (`not_described`) shows neither.
 */
export function FileThumb({ item, className }: { item: MediaItem; className?: string }) {
  if (item.kind === "image" && item.publicUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.publicUrl} alt={item.altText ?? item.name} loading="lazy" className={cn("size-full object-cover", className)} />
    );
  }
  return (
    <div className={cn("flex size-full items-center justify-center bg-muted", className)}>
      {item.kind === "video" ? (
        <span className="flex size-11 items-center justify-center rounded-full bg-foreground/80 text-background">
          <Play aria-hidden className="size-4 fill-current" />
        </span>
      ) : (
        <FileText aria-hidden className="size-9 text-muted-foreground" />
      )}
    </div>
  );
}

export function FileTile({
  item,
  now,
  open,
  checked,
  onOpen,
  onCheck,
  canSelect,
}: {
  item: MediaItem;
  now: Date;
  open: boolean;
  checked: boolean;
  onOpen: () => void;
  onCheck: (on: boolean) => void;
  canSelect: boolean;
}) {
  const describing = isBeingDescribed(item, now);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${item.name}`}
        aria-pressed={open}
        className={cn(
          "block w-full overflow-hidden rounded-xl border bg-card text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "border-foreground shadow-[0_0_0_1px_var(--foreground)]",
        )}
      >
        <div className="relative h-30 overflow-hidden bg-muted">
          <FileThumb item={item} />
          {describing && (
            <>
              <div className="drive-shine" aria-hidden />
              <div className="drive-shine drive-shine-warm" aria-hidden />
            </>
          )}
          <span className="absolute left-2 top-2 rounded-md bg-card/90 px-1.5 py-0.5 text-micro font-medium">{badgeText(item)}</span>
        </div>
        <div className="px-3 pb-3 pt-2.5">
          <div className="truncate text-[13px] font-medium">{item.name}</div>
          {describing ? (
            <div role="status" className="mt-0.5 text-xs font-medium text-brand-label">
              {tileLine(item, now)}
            </div>
          ) : (
            <div className="mt-0.5 text-xs text-muted-foreground">{tileLine(item, now)}</div>
          )}
        </div>
      </button>
      {canSelect && (
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheck(v === true)}
          aria-label={`Select ${item.name}`}
          className="absolute right-2 top-2 size-5 bg-card"
        />
      )}
    </div>
  );
}
