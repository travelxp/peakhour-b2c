import { api, ApiError } from "@/lib/api";

/**
 * /v1/creative: Creative Studio's client.
 *
 * Two kinds of read live here:
 *   - the EXISTING api (peakhour-api `routes/creative/post-ideas.ts`): the ideas feed and its dismissal. Free, no AI, no Peaks.
 *   - the DEFENSIVE reads (`GET /v1/creative/studio/availability`, spec 8.2): not on api master when this lane was built. They never throw
 *     and never guess upwards: a missing, failed or unreadable answer means "nothing AI is available yet" and Pro tools off.
 */

// ── Post ideas (EXISTING) ────────────────────────────────────

export type PostIdeaKind =
  | "festival"
  | "low_stock"
  | "overstock"
  | "high_margin"
  | "new_reviews"
  | "new_products"
  | "sold_before";

export type PostFormat = "feed" | "story" | "reel";

export interface PostIdeaProduct {
  id: string;
  title: string;
}

/** One idea as the api sends it. `reason` is one plain line that names the signal; show it unedited. */
export interface PostIdea {
  id: string;
  kind: PostIdeaKind;
  reason: string;
  productIds: string[];
  products: PostIdeaProduct[];
  format: PostFormat;
  /** Counts and names behind the reason (a festival idea carries its name and date). Plain values only. */
  facts: Record<string, string | number | boolean | null>;
  /** ISO time after which the idea is no longer worth posting. */
  expiresAt: string;
}

export interface PostIdeasResponse {
  ideas: PostIdea[];
  generatedAt: string;
  /** Days a dismissed idea stays away (a festival idea stays away until it has passed). */
  coolingDays: number;
  /** ISO country of the business's market, or null. */
  market: string | null;
}

export interface DismissResponse {
  dismissed: true;
  id: string;
  /** ISO time the idea may come back. */
  backAfter: string;
}

export interface UndismissResponse {
  id: string;
  /** false when there was no dismissal left to take back. */
  restored: boolean;
}

// ── Availability (NEW, read defensively) ─────────────────────

export const STUDIO_CAPABILITIES = ["previews", "final", "extend", "wordOptions", "aiIdeas", "video", "textAds"] as const;
export type StudioCapability = (typeof STUDIO_CAPABILITIES)[number];
export type CapabilityState = "on" | "coming_soon";

/** The business's Studio settings (S19, `GET /v1/creative/studio/availability` `settings`). */
export interface StudioSettings {
  noAiPeople: boolean;
  /** null = no limit. */
  monthlyCapPeaks: number | null;
  remindShortlist: boolean;
  whatsappUpdates: boolean;
  /** Peaks Studio used this calendar month (UTC): what the monthly limit is measured against. */
  usedThisMonthPeaks: number;
}

/** What every setting is until the api says otherwise: the api's own defaults. */
export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  noAiPeople: false,
  monthlyCapPeaks: null,
  remindShortlist: true,
  whatsappUpdates: false,
  usedThisMonthPeaks: 0,
};

export interface StudioAvailability {
  capabilities: Record<StudioCapability, CapabilityState>;
  /** The per-user "Pro tools" flag. Off unless the api says exactly `true`. */
  proTools: boolean;
  settings: StudioSettings;
  /** False when the api gave no usable answer (not built yet, failed, unreadable): everything AI is then "coming soon". */
  known: boolean;
}

const allComingSoon = (): Record<StudioCapability, CapabilityState> =>
  Object.fromEntries(STUDIO_CAPABILITIES.map((c) => [c, "coming_soon" as const])) as Record<StudioCapability, CapabilityState>;

/** What every screen assumes until the api has said otherwise. */
export const UNAVAILABLE: StudioAvailability = { capabilities: allComingSoon(), proTools: false, settings: DEFAULT_STUDIO_SETTINGS, known: false };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Read the availability answer without trusting it. Only the exact string "on" turns a capability on; anything else (a missing key, a
 * misspelt state, a boolean) stays "coming soon". Pro tools is on only for the boolean `true`. Accepts the map under `capabilities` or at
 * the top level, since the contract (spec 8.2) names the content and not the envelope.
 */
export function parseAvailability(raw: unknown): StudioAvailability {
  if (!isRecord(raw)) return UNAVAILABLE;
  const map = isRecord(raw.capabilities) ? raw.capabilities : raw;
  const capabilities = allComingSoon();
  for (const c of STUDIO_CAPABILITIES) if (map[c] === "on") capabilities[c] = "on";
  return { capabilities, proTools: raw.proTools === true, settings: parseSettings(raw.settings), known: true };
}

/** The settings after one change: what the api's answer names replaces what was held, and what it does not name stays. */
export function mergeSettings(held: StudioSettings, answer: unknown): StudioSettings {
  return parseSettings({ ...held, ...(isRecord(answer) ? answer : {}), usedThisMonthPeaks: held.usedThisMonthPeaks });
}

/** The settings as the api sent them; a missing or odd field is the default, never a guess. A limit is a whole number of 1 or more, else none. */
export function parseSettings(raw: unknown): StudioSettings {
  if (!isRecord(raw)) return DEFAULT_STUDIO_SETTINGS;
  const d = DEFAULT_STUDIO_SETTINGS;
  const cap = raw.monthlyCapPeaks;
  const used = raw.usedThisMonthPeaks;
  return {
    noAiPeople: raw.noAiPeople === true,
    monthlyCapPeaks: typeof cap === "number" && Number.isInteger(cap) && cap >= 1 ? cap : null,
    remindShortlist: typeof raw.remindShortlist === "boolean" ? raw.remindShortlist : d.remindShortlist,
    whatsappUpdates: raw.whatsappUpdates === true,
    usedThisMonthPeaks: typeof used === "number" && Number.isFinite(used) && used > 0 ? used : 0,
  };
}


// ── Library (CS-3a `GET /v1/creative?view=`) ─────────────────

export type LibraryView = "made" | "plans";

/** One creative in the Library. `thumbUrl` is the cover preview's thumbnail, or null when it could not be signed. */
export interface LibraryItem {
  id: string;
  kind: "image" | "words";
  status: "brief" | "making_previews" | "previews_ready" | "previews_failed" | "has_final" | "archived";
  headline: string | null;
  format: PostFormat;
  productIds: string[];
  updatedAt: string;
  thumbUrl: string | null;
  /** Where it has been sent, read from the handoff records: `scheduled` while any size is waiting for its time, else `posted`, else `none`. */
  publish: { state: "none" | "scheduled" | "posted"; scheduled: number; posted: number; channels: string[]; inAd: boolean };
  /** The finished full-size picture, or null while there is none. */
  master: { finalId: string; width: number | null; height: number | null } | null;
  /** The platform sizes that are made (a size that still needs more background is not here). */
  versions: Array<{ id: string; label: string; channel: string; width: number; height: number; state: "ready" | "scheduled" | "published" }>;
  /** Words only (a words creative has no picture): how many options are in play, how many are approved, the one the tile shows and the platform it was written for. Null on a picture. */
  words: { options: number; approved: number; card: { headline: string; primaryText: string; description: string | null; cta: string | null; hashtags: string[] } | null; platform: string | null } | null;
  actions: { download: boolean; newVersion: boolean; delete: boolean; deleteBlock: "making" | null };
}

/** The Pro tools filters of "Made in Studio". */
export interface LibraryFilter {
  publish?: "none" | "scheduled" | "posted";
  channel?: string;
  /** ISO times: last changed at or after `from` and before `to`. */
  from?: string;
  to?: string;
}

export interface DownloadLink {
  url: string;
  filename: string;
  width?: number;
  height?: number;
}

export interface BulkResult {
  done: string[];
  skipped: Array<{ id: string; code: string; message: string }>;
}

/** One product in the Library's "Product photos" tab. `main` is its main photo (null when it has none). */
export interface ProductPhotoTile {
  productId: string;
  title: string;
  count: number;
  main: ProductPhotoView | null;
}
export interface ProductPhotoView {
  mediaId: string;
  /** `store`: brought in from the store. `library`: a Library file the merchant added. */
  source: "store" | "library";
  isMain: boolean;
  thumbUrl: string | null;
}
export interface ProductPhotosPage {
  items: ProductPhotoTile[];
  next?: string;
}
export interface ProductPhotosOne {
  productId: string;
  title: string;
  count: number;
  photos: ProductPhotoView[];
}

export interface LibraryPage {
  items: LibraryItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Memory (CS-3a `/v1/creative/memory`) ─────────────────────

export interface MemoryEvidence {
  count: number;
  since: string;
  basis: "test" | "pattern";
  /** The api's plain sentence: "Based on 12 posts, since 3 Nov." or "Early guess. Based on 2 posts." */
  label: string;
}

export interface MemoryLine {
  id: string;
  text: string;
  kind: "taste" | "rule";
  /** "learned" by Studio, or "you" (a line the merchant wrote with Pro tools). */
  source: "learned" | "you";
  /** "You wrote this", "From a test of two versions" or "A pattern we noticed". Never proof. */
  origin: string;
  evidence: MemoryEvidence | null;
  editable: boolean;
}

/** A rule that always wins. `changeIn: "brand-kit"` links to the Brand Kit; null has nothing to change here. */
export interface MemoryRule {
  text: string;
  changeIn: "brand-kit" | null;
}

/** One of the three trend lines. `now` against `first` (the merchant's first month), with how many approved posts are behind each. */
export interface TrendLine {
  key: "liked_first_try" | "changes_per_post" | "peaks_per_post";
  now: number;
  first: number;
  unit: "percent" | "count" | "peaks";
  direction: "better" | "worse" | "same";
  evidence: { now: number; first: number };
}

export interface MemoryTrends {
  approvedPosts: number;
  /** At least 10 approved posts in all. */
  enough: boolean;
  needs: number;
  /** Each stretch (the first month, and now) has posts of its own, so the two can be compared. */
  comparable: boolean;
  firstMonth: { from: string; to: string; posts: number } | null;
  now: { from: string; to: string; posts: number } | null;
  lines: TrendLine[];
}

export interface MemoryRead {
  lines: MemoryLine[];
  /** Pass as `after` to read the next page of lines. Absent on the last page. */
  next?: string;
  totalLines: number;
  rules: MemoryRule[];
  note: string;
  trends: MemoryTrends;
  pooledOptIn: boolean;
}

/** A later page of "Your taste": lines only. */
export interface MemoryLinesPage {
  lines: MemoryLine[];
  next?: string;
}

/** One page as the api sends it: the first has everything, a later one has lines only. */
export type MemoryPage = MemoryLinesPage & Partial<Omit<MemoryRead, "lines" | "next">>;

export interface MemoryExport {
  exportedAt: string;
  lines: Array<{ text: string; kind: string; source: string; evidence?: { count: number; since: string; basis: string }; createdAt: string }>;
  pooledOptIn: boolean;
}

export const MEMORY_LINE_MAX = 140;

export const creativeApi = {
  postIdeas: () => api.get<PostIdeasResponse>("/v1/creative/post-ideas"),

  dismissPostIdea: (id: string) => api.post<DismissResponse>("/v1/creative/post-ideas/dismiss", { id }),

  /** The Undo after a dismissal. Nothing to take back is still a success (`restored: false`). */
  undismissPostIdea: (id: string) => api.post<UndismissResponse>("/v1/creative/post-ideas/undismiss", { id }),

  /**
   * Only a 404 (the endpoint is not deployed yet) is an answer: "not available yet". Any other failure (network, 401, 5xx) THROWS, so the
   * query sits in an error state instead of caching "everything coming soon, Pro tools off" for a minute as if the api had said it.
   * {@link useStudioAvailability} turns that error into the same safe default without caching it.
   */
  async availability(): Promise<StudioAvailability> {
    try {
      return parseAvailability(await api.get<unknown>("/v1/creative/studio/availability"));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 501)) return UNAVAILABLE;
      throw e;
    }
  },

  library: (q: { view: LibraryView; q?: string; status?: string; page?: number } & LibraryFilter) =>
    api.get<LibraryPage>("/v1/creative", {
      view: q.view,
      ...(q.q ? { q: q.q } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.page && q.page > 1 ? { page: String(q.page) } : {}),
      ...(q.publish ? { publish: q.publish } : {}),
      ...(q.channel ? { channel: q.channel } : {}),
      ...(q.from ? { from: q.from } : {}),
      ...(q.to ? { to: q.to } : {}),
    }),

  /** A short-lived link to save the master (no ids), one final, or one platform size. Free. */
  download: (id: string, q: { finalId?: string; versionId?: string } = {}) =>
    api.get<DownloadLink>(`/v1/creative/${encodeURIComponent(id)}/download`, { ...(q.finalId ? { finalId: q.finalId } : {}), ...(q.versionId ? { versionId: q.versionId } : {}) }),
  /** "Make a new version": a new plan from a final. Free; its previews are quoted later. */
  newVersion: (id: string) => api.post<{ creativeId: string }>(`/v1/creative/${encodeURIComponent(id)}/new-version`, {}),
  /** Soft delete. The pictures go to the Drive's trash unless a post, an ad or another creative still uses them. */
  deleteCreative: (id: string) => api.delete<{ ok: true; id: string; trashed: number; keptForPosts: number }>(`/v1/creative/${encodeURIComponent(id)}`),
  /** Pro tools. Each id is judged on its own: `skipped` says which stayed and why. */
  bulk: (action: "delete" | "archive", ids: string[]) => api.post<BulkResult>("/v1/creative/bulk", { action, ids }),

  productPhotos: (q: { after?: string; limit?: number } = {}) =>
    api.get<ProductPhotosPage>("/v1/creative/product-photos", { ...(q.after ? { after: q.after } : {}), ...(q.limit ? { limit: String(q.limit) } : {}) }),
  productPhotosOne: (productId: string) => api.get<ProductPhotosOne>(`/v1/creative/product-photos/${encodeURIComponent(productId)}`),
  /** "Add photo": a Library file that is already there becomes a photo of the product. Nothing is uploaded to the store. */
  linkProductPhoto: (productId: string, mediaId: string) => api.post<{ productId: string; mediaId: string; linked: boolean }>("/v1/creative/product-photos", { productId, mediaId }),
  setMainProductPhoto: (productId: string, mediaId: string) => api.put<{ productId: string; mediaId: string; isMain: true }>(`/v1/creative/product-photos/${encodeURIComponent(productId)}/main`, { mediaId }),

  memory: (q: { after?: string; limit?: number } = {}) => api.get<MemoryRead>("/v1/creative/memory", { ...(q.after ? { after: q.after } : {}), ...(q.limit ? { limit: String(q.limit) } : {}) }),
  /** The next page of "Your taste", by the `next` of the page before. */
  memoryLines: (after: string, limit?: number) => api.get<MemoryLinesPage>("/v1/creative/memory/lines", { after, ...(limit ? { limit: String(limit) } : {}) }),
  /** Stop using a line. Free. */
  deleteMemoryLine: (id: string) => api.delete<{ ok: true }>(`/v1/creative/memory/lines/${encodeURIComponent(id)}`),
  /** Pro tools. Only a line the merchant wrote can be reworded. */
  editMemoryLine: (id: string, text: string) => api.patch<{ id: string }>(`/v1/creative/memory/lines/${encodeURIComponent(id)}`, { text }),
  /** Pro tools. */
  addMemoryLine: (text: string) => api.post<{ id: string }>("/v1/creative/memory/lines", { text }),
  setPooled: (optIn: boolean) => api.patch<{ pooledOptIn: boolean }>("/v1/creative/memory/pooled", { optIn }),
  exportMemory: () => api.post<MemoryExport>("/v1/creative/memory/export", {}),
  /** Wipes what Studio learned. The Library is not touched. */
  wipeMemory: () => api.delete<{ deleted: number }>("/v1/creative/memory"),
};
