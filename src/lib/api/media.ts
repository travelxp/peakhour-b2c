import { api } from "@/lib/api";

/**
 * Drive API client (Peakhour Drive; internally still "media", the cnt_media collection). Wraps the /v1/media + /v1/storage endpoints
 * (peakhour-api). Uploads are in lib/drive/upload-engine.ts: bytes go straight to R2 and never through this client.
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

export type MediaKind = "image" | "video" | "document" | "font";
export type MediaVisibility = "published" | "private";

/** Whether the background describer has named the file yet (the api's one rule: helpers/drive-describe-state.ts). */
export type DescribeState = "described" | "describing" | "pending" | "not_described";

/** One place a file is used. The page builds the link from `kind` and `refId`. */
export interface UsedInEntry {
  kind: "idea" | "draft" | "ad_creative" | "scheduled_item" | "social_post" | "page" | "brand" | "listing";
  refId: string;
  label?: string;
  published?: boolean;
}

export interface ChannelFitEntry {
  channel: string;
  fit: "good" | "possible" | "poor";
  reason?: string;
}

export interface MediaItem {
  id: string;
  /** A Private file has none: read it through `getMediaUrl`. */
  publicUrl?: string;
  mimeType: string;
  name: string;
  kind: MediaKind;
  visibility: MediaVisibility;
  /** Shared across the organisation (changing one takes an admin). */
  shared: boolean;
  originalFilename?: string;
  description?: string;
  altText?: string;
  tags?: string[];
  collectionIds?: string[];
  durationSeconds?: number;
  posterMediaId?: string;
  describedAt?: string;
  describeState: DescribeState;
  useCases?: string[];
  channelFit?: ChannelFitEntry[];
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
  usedIn: UsedInEntry[];
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
  /** Live bytes and files by kind, for the Storage page's bar. */
  byKind?: Record<MediaKind, { bytes: number; fileCount: number }>;
  /** New uploads are blocked while a pack could not renew. Files and space are untouched. */
  paused: boolean;
  packs: StoragePackView[];
  canBuyPacks: boolean;
  catalog: StoragePackOffer[];
}

export interface ListMediaParams {
  /** Plain words: searched on the server across name, description, tags, alt text and AI prompt. */
  q?: string;
  kind?: MediaKind;
  channel?: string;
  used?: "used" | "unused";
  source?: MediaSource;
  visibility?: MediaVisibility;
  collectionId?: string;
  suggestedAction?: SuggestedActionKind;
  status?: "active" | "deleted";
  sort?: "newest" | "oldest" | "name" | "largest";
  page?: number;
  limit?: number;
}

/** The api client unwraps `data`; list responses carry pagination in `meta`,
 *  so we re-request the raw envelope here to read it. */
export async function listMedia(
  params: ListMediaParams = {},
): Promise<{ items: MediaItem[]; meta: MediaListMeta }> {
  const qs: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs[k] = String(v);
  }

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
export function cancelStoragePack(id: string): Promise<{ pack: StoragePackView; alreadyCancelled: boolean; spaceEndsNow: boolean }> {
  return api.delete<{ pack: StoragePackView; alreadyCancelled: boolean; spaceEndsNow: boolean }>(`/v1/storage/packs/${id}`);
}

export function deleteMedia(id: string): Promise<{ deletedCount: number; freedBytes: number }> {
  return api.delete(`/v1/media/${id}`);
}

export function bulkDeleteMedia(
  mediaIds: string[],
): Promise<{ deletedCount: number; freedBytes: number; forbidden?: number; blocked?: number }> {
  return api.post(`/v1/media/bulk-delete`, { mediaIds });
}

export function restoreMedia(id: string): Promise<{ restored: boolean; mediaId: string }> {
  return api.post(`/v1/media/${id}/restore`, {});
}

/** What a person may change on a file. `null` clears a description or alt text. */
export interface MediaPatch {
  name?: string;
  description?: string | null;
  altText?: string | null;
  tags?: string[];
  collectionIds?: string[];
  shared?: boolean;
  /** A video's poster frame: an image uploaded for it. */
  posterMediaId?: string;
}

export function updateMedia(id: string, patch: MediaPatch): Promise<MediaItem> {
  return api.patch<MediaItem>(`/v1/media/${id}`, patch);
}

export type BulkAction =
  | { action: "add_tags" | "remove_tags"; mediaIds: string[]; tags: string[] }
  | { action: "add_to_collection" | "remove_from_collection"; mediaIds: string[]; collectionId: string };

export interface BulkResult {
  requested: number;
  changed: number;
  notFound: number;
  forbidden: number;
  skipped: number;
}

export function bulkMedia(body: BulkAction): Promise<BulkResult> {
  return api.post<BulkResult>(`/v1/media/bulk`, body);
}

/** What the describer has written so far, for the tiles still waiting. */
export interface DescribeStateRow {
  id: string;
  describeState: DescribeState;
  name: string;
  description?: string;
  altText?: string;
  tags?: string[];
  useCases?: string[];
  channelFit?: ChannelFitEntry[];
  describedAt?: string;
}

export function getDescribeState(ids: string[]): Promise<DescribeStateRow[]> {
  return api.get<DescribeStateRow[]>(`/v1/media/describe-state`, { ids: ids.join(",") });
}

/** A private file's short-lived link (a published file answers its public URL). */
export function getMediaUrl(id: string, opts: { download?: boolean } = {}): Promise<{ url: string; signed: boolean; expiresInSeconds: number | null }> {
  return api.get(`/v1/media/${id}/url`, opts.download ? { download: "1" } : undefined);
}

/** A link for a PRIVATE file. The address is shown once, here. */
export function createShareLink(id: string, opts: { expiresInDays?: number; password?: string } = {}): Promise<{ shareId: string; url: string; expiresAt: string; hasPassword: boolean }> {
  return api.post(`/v1/media/${id}/shares`, opts);
}

export interface DriveCollection {
  id: string;
  name: string;
  shared: boolean;
  kind: "manual" | "smart";
  preset?: string;
  count: number;
}

export interface CollectionsList {
  collections: DriveCollection[];
  truncated: boolean;
  availablePresets: { preset: string; name: string }[];
}

export function listCollections(): Promise<CollectionsList> {
  return api.get<CollectionsList>(`/v1/media/collections`);
}

export function createCollection(body: { name: string } | { preset: string }): Promise<DriveCollection> {
  return api.post<DriveCollection>(`/v1/media/collections`, body);
}

export type CleanupKind = "duplicate_content_hash" | "orphan_generated" | "unused_90d" | "large_5mb_plus";

export interface CleanupGroup {
  kind: CleanupKind;
  count: number;
  reclaimableBytes: number;
  /** Large files are advice only: nothing is offered for removal. */
  trashable: boolean;
}

export function getCleanup(): Promise<{ groups: CleanupGroup[]; capped: boolean }> {
  return api.get(`/v1/media/cleanup`);
}

export function trashCleanup(kinds: CleanupKind[]): Promise<{ deletedCount: number; freedBytes: number; blocked: number; remaining: number }> {
  return api.post(`/v1/media/cleanup/trash`, { kinds });
}

/** The organisation's Drive privacy choice (Settings). */
export function getDrivePrivacy(): Promise<{ dontSendPrivateFilesToAi: boolean }> {
  return api.get(`/v1/media/privacy`);
}

export function setDrivePrivacy(dontSendPrivateFilesToAi: boolean): Promise<{ dontSendPrivateFilesToAi: boolean }> {
  return api.put(`/v1/media/privacy`, { dontSendPrivateFilesToAi });
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
