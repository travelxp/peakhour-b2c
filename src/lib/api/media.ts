import { api } from "@/lib/api";

/**
 * Media Manager API client (Media Manager / Cloudflare R2). Wraps the
 * /v1/media + /v1/storage endpoints (peakhour-api PR4).
 */

export type MediaSource =
  | "ai_generated"
  | "uploaded"
  | "unsplash"
  | "imported_beehiiv"
  | "imported_data_url";

export type SuggestedActionKind =
  | "unused_90d"
  | "large_5mb_plus"
  | "duplicate_content_hash"
  | "orphan_generated";

export interface MediaItem {
  id: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  source: MediaSource;
  aiOrigin?: {
    ideaId?: string;
    placeholderIndex?: number;
    prompt?: string;
    modelId?: string;
  };
  uploadedBy?: { userName?: string };
  suggestedAction?: {
    kind: SuggestedActionKind;
    reclaimableBytes: number;
    detectedAt: string;
    relatedMediaId?: string;
  };
  usedInCount: number;
  lastAccessedAt?: string;
  deletedAt?: string;
  hardDeleteAfter?: string;
  createdAt: string;
}

export interface MediaListMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface StorageUsage {
  totalBytes: number;
  softDeletedBytes: number;
  fileCount: number;
  limitBytes: number | null;
  gbIncluded: number | null;
  gbUsed: number;
  percentUsed: number | null;
  overageBytes: number;
  isOverage: boolean;
  plan: string;
}

export interface ListMediaParams {
  source?: MediaSource;
  suggestedAction?: SuggestedActionKind;
  status?: "active" | "deleted";
  page?: number;
  limit?: number;
}

/** The api client unwraps `data`; list responses carry pagination in `meta`,
 *  so we re-request the raw envelope here to read it. */
export async function listMedia(
  params: ListMediaParams = {},
): Promise<{ items: MediaItem[]; meta: MediaListMeta }> {
  const qs: Record<string, string> = {};
  if (params.source) qs.source = params.source;
  if (params.suggestedAction) qs.suggestedAction = params.suggestedAction;
  if (params.status) qs.status = params.status;
  if (params.page) qs.page = String(params.page);
  if (params.limit) qs.limit = String(params.limit);

  // api.get returns `data` only; pagination lives in `meta`. Fetch the
  // envelope directly so we keep total/hasMore.
  const search = new URLSearchParams(qs).toString();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? ""}/v1/media${search ? `?${search}` : ""}`,
    { credentials: "include" },
  );
  const json = (await res.json()) as {
    ok: boolean;
    data?: MediaItem[];
    meta?: MediaListMeta;
    error?: { message?: string };
  };
  if (!res.ok || !json.ok) {
    throw new Error(json.error?.message ?? "Failed to load media");
  }
  return {
    items: json.data ?? [],
    meta: json.meta ?? { page: 1, limit: 40, total: json.data?.length ?? 0, hasMore: false },
  };
}

export function getMedia(id: string): Promise<MediaItem> {
  return api.get<MediaItem>(`/v1/media/${id}`);
}

export function getStorageUsage(): Promise<StorageUsage> {
  return api.get<StorageUsage>(`/v1/storage/usage`);
}

export function uploadMedia(
  file: File,
): Promise<{ mediaId: string; publicUrl: string; sizeBytes: number; deduped: boolean }> {
  const form = new FormData();
  form.append("file", file);
  return api.postForm(`/v1/media/upload`, form);
}

export function deleteMedia(id: string): Promise<{ deletedCount: number; freedBytes: number }> {
  return api.delete(`/v1/media/${id}`);
}

export function bulkDeleteMedia(
  mediaIds: string[],
): Promise<{ deletedCount: number; freedBytes: number }> {
  return api.post(`/v1/media/bulk-delete`, { mediaIds });
}

export function restoreMedia(id: string): Promise<{ restored: boolean; mediaId: string }> {
  return api.post(`/v1/media/${id}/restore`, {});
}

/** Human-readable byte size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
