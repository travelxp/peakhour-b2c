"use client";

import { MediaPicker } from "@/components/composer/media-picker";
import type { MediaAsset } from "@/components/composer/types";
import { listMedia, uploadMedia, type MediaItem } from "@/lib/api/media";

/**
 * <LibraryMediaPicker> — the composer MediaPicker primitive wired to the
 * real cnt_media / R2 backend (Media Manager plan §7). Closes the
 * newsletter image-placeholder "pick from library" + "upload" gap.
 *
 * Reusable anywhere a stored image is needed (strategist Images stage,
 * composers, …): the Library tab searches cnt_media, the Upload tab stores
 * to R2 via the shared endpoint, and onSelect returns the chosen assets.
 * Generate is intentionally omitted here — placeholder AI generation has
 * its own dedicated button + finalize gate.
 */
function toAsset(m: MediaItem): MediaAsset {
  return {
    id: m.id,
    url: m.publicUrl,
    mime: m.mimeType,
    width: m.width,
    height: m.height,
    bytes: m.sizeBytes,
    alt: m.aiOrigin?.prompt,
    source: m.source === "ai_generated" ? "ai_image" : "upload",
    createdAt: m.createdAt,
  };
}

export function LibraryMediaPicker({
  trigger,
  maxSelection,
  onSelect,
}: {
  trigger?: React.ReactNode;
  maxSelection?: number;
  onSelect: (assets: MediaAsset[]) => void;
}) {
  return (
    <MediaPicker
      accept="image"
      trigger={trigger}
      maxSelection={maxSelection}
      onSelect={onSelect}
      onSearch={async (query, _kind, signal) => {
        // The list endpoint has no server-side search; pull the first page
        // and filter client-side over the AI prompt / type (matches the
        // Media Manager page's search). Good enough for v1 picking.
        const { items } = await listMedia({ status: "active", limit: 60 });
        if (signal.aborted) return [];
        const q = query.trim().toLowerCase();
        const filtered = q
          ? items.filter(
              (m) =>
                m.aiOrigin?.prompt?.toLowerCase().includes(q) ||
                m.mimeType.toLowerCase().includes(q),
            )
          : items;
        return filtered.map(toAsset);
      }}
      onUpload={async (files) => {
        // Sequential so a quota rejection stops the batch cleanly; the
        // picker surfaces the thrown error as a toast.
        const created: MediaAsset[] = [];
        for (const file of files) {
          const res = await uploadMedia(file);
          created.push({
            id: res.mediaId,
            url: res.publicUrl,
            mime: file.type,
            bytes: res.sizeBytes,
            source: "upload",
            createdAt: new Date().toISOString(),
          });
        }
        return created;
      }}
    />
  );
}
