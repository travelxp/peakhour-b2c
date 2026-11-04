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

/** A storage pack the org bought (Peakhour Drive Q3). The price is the one agreed at purchase. */
export interface StoragePackView {
  id: string;
  gb: number;
  peaksPerMonth: number;
  boughtAt: string;
  nextChargeAt: string;
  /** Renewal stopped: the space stays until `nextChargeAt`. */
  cancelAtPeriodEnd: boolean;
  /** The wallet was short at renewal: the space is kept, new uploads are blocked. */
  paused: boolean;
}

export interface StoragePackOffer {
  gb: number;
  peaksPerMonth: number;
}

/** The POOL: one quota for the whole organisation (each paid business adds its plan's allowance, packs add on top). */
export interface StorageUsage {
  totalBytes: number;
  softDeletedBytes: number;
  fileCount: number;
  /** null = unbounded. */
  limitBytes: number | null;
  limitGb: number | null;
  gbUsed: number;
  percentUsed: number | null;
  /** Where the quota comes from: a per-customer override, the plans (plus packs), a trial, or none (unlimited). */
  source: "override" | "plan" | "trial" | "unbounded";
  pool: { planGb: number; packGb: number; overrideGb: number | null; holdings: { planKey: string; planName: string | null; trial: boolean; gb: number }[] };
  perBusiness: { businessId: string; name: string; bytes: number; fileCount: number }[];
  /** New uploads are blocked while a pack could not renew. Files and space are untouched. */
  paused: boolean;
  packs: StoragePackView[];
  canBuyPacks: boolean;
  catalog: StoragePackOffer[];
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

  // getWithMeta keeps the shared client's 401-refresh + typed ApiError and
  // returns the envelope's `meta` (pagination lives there, not in `data`).
  const { data, meta } = await api.getWithMeta<MediaItem[]>("/v1/media", qs);
  const m = meta as Partial<MediaListMeta>;
  return {
    items: data ?? [],
    meta: {
      page: m.page ?? 1,
      limit: m.limit ?? 40,
      total: m.total ?? data?.length ?? 0,
      hasMore: m.hasMore ?? false,
    },
  };
}

export function getMedia(id: string): Promise<MediaItem> {
  return api.get<MediaItem>(`/v1/media/${id}`);
}

export function getStorageUsage(): Promise<StorageUsage> {
  return api.get<StorageUsage>(`/v1/storage/usage`);
}

/** Buy a pack: the first month is charged now, in full, and the pack is active at once. */
export function buyStoragePack(gb: number): Promise<{ pack: StoragePackView; charged: number; duplicate: boolean }> {
  return api.post<{ pack: StoragePackView; charged: number; duplicate: boolean }>(`/v1/storage/packs`, { gb });
}

/** Stop a pack renewing. The space stays until its next charge date. */
export function cancelStoragePack(id: string): Promise<{ pack: StoragePackView; alreadyCancelled: boolean }> {
  return api.delete<{ pack: StoragePackView; alreadyCancelled: boolean }>(`/v1/storage/packs/${id}`);
}

export interface MediaUploadResult {
  mediaId: string;
  publicUrl: string;
  sizeBytes: number;
  deduped: boolean;
}

export function uploadMedia(file: File): Promise<MediaUploadResult> {
  const form = new FormData();
  form.append("file", file);
  return api.postForm<MediaUploadResult>(`/v1/media/upload`, form);
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
