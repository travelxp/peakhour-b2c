import { api, newActionKey } from "@/lib/api";
import type { PostFormat, StudioSettings } from "@/lib/api/creative";

/**
 * /v1/creative, the workflow half (peakhour-api `routes/creative/studio.ts`, row CS-3a): briefs, the quote of a press, quoted presses (202 and a
 * job the merchant can leave), the polling read, free tweaks, the heart, the shortlist and finals.
 *
 * Every charged call here is ONE click: it carries a fresh `Idempotency-Key` and the receipt(s) of the price that was shown (`x-peaks-quote`,
 * and `x-peaks-quote-cutout` when a product photo still has to be cut out). Shapes are read off the api's own services; none is guessed.
 */

export type CreativeStatus = "brief" | "making_previews" | "previews_ready" | "previews_failed" | "has_final" | "archived";

export type PreviewState =
  | "rendering"
  | "ready"
  | "dropped"
  | "failed"
  | "skipped"
  | "shortlisted"
  | "finalizing"
  | "final_ready"
  | "final_blocked"
  | "final_failed";

export type FinalState = "queued" | "making" | "checking" | "ready" | "blocked" | "failed";
export type LapseReason = "text" | "colour" | "product" | "restored";

/** The plan as the api keeps it. Photos pair to products by position. */
export interface StudioBrief {
  ideaId?: string;
  ideaKind?: string;
  productIds: string[];
  line: string;
  language: string;
  format: PostFormat;
  noAiPeople: boolean;
  photoMediaIds: string[];
  count: number;
}

export interface BriefWarning {
  code: "NO_PHOTO" | "SMALL_PHOTO";
  text: string;
  productId: string;
}

export interface BriefBody {
  kind?: "image" | "words";
  ideaId?: string;
  ideaKind?: string;
  productIds: string[];
  line: string;
  language: string;
  format: PostFormat;
  noAiPeople?: boolean;
  photoMediaIds?: string[];
  count?: 3 | 4;
}

export type BriefPatch = Partial<Omit<BriefBody, "kind">>;

export interface CreatedBrief {
  creativeId: string;
  brief: StudioBrief;
  /** True when the plan was saved because previews cannot be made yet: it shows under "Saved plans". */
  savedPlan: boolean;
  warnings: BriefWarning[];
}

export interface PreviewSafety {
  status: "passed" | "fixed" | "dropped";
  note?: string;
}

/** One preview as the polling read sends it. A `dropped` one never comes back as a tile. */
export interface PreviewView {
  id: string;
  index: number;
  state: PreviewState;
  imageUrl: string | null;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  headline: string | null;
  offer: string | null;
  cta: string | null;
  productId: string | null;
  productTitle: string | null;
  safety: PreviewSafety | null;
  layoutVersion: number;
  liked: boolean;
  lapsedBecause: LapseReason | null;
  wordingOptions: string[];
  chosenOption: number;
  canUndo: boolean;
  productCrop: { x: number; y: number; w: number; h: number } | null;
  note?: string;
}

export interface FinalRow {
  id: string;
  previewId: string;
  state: FinalState;
  width: number | null;
  height: number | null;
  match: { passed: boolean } | null;
}

export type PressKind = "previews" | "more" | "new_background" | "wording";

export interface JobRow {
  id: string | null;
  setId: string;
  kind: PressKind;
  state: "queued" | "running";
  done: number;
  total: number;
}

export interface LastPress {
  kind: PressKind;
  state: string;
  delivered: number | null;
  dropped: number | null;
  failed: number | null;
  charged: { peaks: number; units: number } | null;
}

export interface CreativeView {
  id: string;
  kind: "image" | "words";
  status: CreativeStatus;
  brief: StudioBrief;
  warnings: BriefWarning[];
  previews: PreviewView[];
  earlier: PreviewView[];
  finals: FinalRow[];
  versions: Array<VersionRow & { finalId: string; channel: string }>;
  approval: { lookApproved: boolean; lapsedBecause?: LapseReason };
  jobs: JobRow[];
  safetySummary: { dropped: number; notes: string[] };
  lastPress: LastPress | null;
  updatedAt: string;
}

/** One quote the api signed: the price of a press and the receipt for it. */
export interface StudioQuoteView {
  action: string;
  peaks: number;
  units?: number;
  perUnit?: { unit: string; units: number; peaksPerUnit: number };
  token: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

/** The price of a press: ONE total to show, and the two receipts to send back (`main`, and `cutout` when a product photo still has to be cut out). */
export interface PressQuote {
  main: StudioQuoteView;
  cutout: StudioQuoteView | null;
  totalPeaks: number;
  missingPhoto?: Array<{ productId: string; title: string }>;
}

export interface PressReceipts {
  main?: string;
  cutout?: string;
}

export interface PressStarted {
  creativeId: string;
  jobId: string | null;
  setId: string;
  previewIds: string[];
  /** True when the same click was already running: nothing new was charged. */
  repeated: boolean;
}

export type TweakOp =
  | { op: "headline.set"; text: string }
  | { op: "headline.option"; index: number }
  | { op: "offer.set"; text: string }
  | { op: "cta.set"; text: string }
  | { op: "text.shorter" }
  | { op: "text.longer" }
  | { op: "colour.set"; role: "headline" | "offer" | "cta" | "plate"; paletteKey: string }
  | { op: "position.set"; position: "top" | "middle" | "bottom" }
  | { op: "product.swap"; productId: string }
  | { op: "product.size"; step: "smaller" | "bigger" }
  | { op: "undo" }
  | { op: "reset" };

export interface TweakResult {
  layoutVersion: number;
  lapsed: boolean;
  approval: { lookApproved: boolean; lapsedBecause?: LapseReason };
  preview: PreviewView;
}

export interface ShortlistItem {
  creativeId: string;
  previewId: string;
  state: PreviewState;
  headline: string;
  productTitle: string | null;
  thumbUrl: string | null;
  likedAt: string | null;
  /** The heart was taken off by a change: tap it again to approve the new look. */
  lapsed: boolean;
  /** Waiting longer than three days: earns the reminder line. */
  waitingLong: boolean;
}

export interface ShortlistResponse {
  items: ShortlistItem[];
  count: number;
}

export interface FinalsStarted {
  jobId: string | null;
  jobIds: string[];
  finals: Array<{ id: string; creativeId: string; previewId: string }>;
  /** The Peaks ran short part way: the finals before it are waiting their turn, this one and the rest were not started. */
  refused?: { code: string; message: string };
}

export interface FinalView {
  id: string;
  state: FinalState;
  imageUrl: string | null;
  previewUrl: string | null;
  match: { passed: boolean } | null;
  width: number | null;
  height: number | null;
}

/** One of the business's product photos, with the product it belongs to (CS-7a, `GET /v1/media/product-images`). */
export interface ProductImage {
  id: string;
  productId?: string;
  productTitle?: string;
  position: number;
  width?: number;
  height?: number;
  media: { id: string; name: string; mimeType: string; publicUrl?: string; width?: number; height?: number };
}

export interface ProductImagesResponse {
  items: ProductImage[];
  imports: Array<{ source: string; status: "running" | "done" | "stopped"; stoppedReason?: string }>;
  next?: string;
}

export type VersionState = "ready" | "needs_extend" | "extending" | "extend_failed" | "scheduled" | "published";

/** One size of a final, as the api keeps it (`creative.versions[]`, and the answers of render and extend). */
export interface VersionRow {
  id: string;
  key: string;
  state: VersionState;
  label: string;
  width: number;
  height: number;
  needsExtend?: boolean;
}

export type PlacementKind = "ready" | "needs_extend" | "no_spec";

/** One size a channel offers for the shape asked for, read from verified ad-spec rows only. A channel with none comes back as one `no_spec` row. */
export interface PlacementRow {
  key: string;
  channel: string;
  label: string;
  placement: string;
  format: PostFormat | null;
  width: number | null;
  height: number | null;
  specRef: { sourceUrl: string; verifiedAt: string } | null;
  kind: PlacementKind;
}

export interface PostCaption {
  text: string;
  headline: string;
  offer?: string;
  cta?: string;
  hashtags: string[];
}

export interface OrganicHandoff {
  media: Array<{ versionId: string; mediaId: string; url: string }>;
  caption: PostCaption;
  disclosure: string;
}

export interface AdHandoff {
  adCreativeId: string;
  /** One ad row per ad platform: an Instagram size and a LinkedIn size are two ads. */
  adCreatives: Array<{ platform: string; adCreativeId: string }>;
  note: string;
}

export interface SettingsPatch {
  noAiPeople?: boolean;
  /** null clears the limit. */
  monthlyCapPeaks?: number | null;
  remindShortlist?: boolean;
  whatsappUpdates?: boolean;
  proTools?: boolean;
}

/** The headers of one click on a charged press: a fresh Idempotency-Key and the receipts of the price that was shown. */
export function pressHeaders(receipts: PressReceipts): Record<string, string> {
  return {
    ...newActionKey(),
    ...(receipts.main ? { "x-peaks-quote": receipts.main } : {}),
    ...(receipts.cutout ? { "x-peaks-quote-cutout": receipts.cutout } : {}),
  };
}

export const studioApi = {
  createBrief: (body: BriefBody) => api.post<CreatedBrief>("/v1/creative/briefs", body),

  patchBrief: (id: string, patch: BriefPatch) =>
    api.patch<{ brief: StudioBrief; warnings: BriefWarning[] }>(`/v1/creative/${id}/brief`, patch),

  /** The polling read: everything the creative page draws, in one call. */
  creative: (id: string) => api.get<CreativeView>(`/v1/creative/${id}`),

  /** The price of one press and the receipts for it. 409 CREATIVE_NOT_RELEASED while the use case is off. */
  pressQuote: (id: string, kind: PressKind, count?: number) =>
    api.get<PressQuote>(`/v1/creative/${id}/quote?kind=${kind}${count !== undefined ? `&count=${count}` : ""}`),

  /**
   * The first press makes the brief's count of previews (3 or 4, sent as `count`); once previews exist one press asks for ONE more and sends
   * no count (the api refuses a count under 3).
   */
  makePreviews: (id: string, count: number | undefined, receipts: PressReceipts) =>
    api.post<PressStarted>(`/v1/creative/${id}/previews`, count === undefined ? undefined : { count }, pressHeaders(receipts)),

  newBackground: (id: string, previewId: string, receipts: PressReceipts) =>
    api.post<PressStarted>(`/v1/creative/${id}/previews/${previewId}/new-background`, undefined, pressHeaders(receipts)),

  newWording: (id: string, receipts: PressReceipts) =>
    api.post<PressStarted>(`/v1/creative/${id}/wording`, undefined, pressHeaders(receipts)),

  tweak: (id: string, previewId: string, baseVersion: number, op: TweakOp) =>
    api.patch<TweakResult>(`/v1/creative/${id}/previews/${previewId}/tweak`, { baseVersion, op }),

  heart: (id: string, previewId: string, on: boolean) =>
    api.post<{ liked: boolean; shortlistCount: number }>(`/v1/creative/${id}/previews/${previewId}/shortlist`, { on }),

  skip: (id: string, previewId: string, reasons: string[]) =>
    api.post<{ ok: true }>(`/v1/creative/${id}/previews/${previewId}/skip`, { reasons }),

  shortlist: () => api.get<ShortlistResponse>("/v1/creative/shortlist"),

  /** Only the count (hearts), for the badge on the Shortlist tab. */
  shortlistCount: () => api.get<{ count: number }>("/v1/creative/shortlist?count=1"),

  /** Make final for the approved previews. `quoteToken` is the receipt for exactly `items.length` finals. */
  makeFinals: (items: Array<{ creativeId: string; previewId: string }>, quoteToken: string | undefined) =>
    api.post<FinalsStarted>("/v1/creative/finals", { items }, pressHeaders(quoteToken ? { main: quoteToken } : {})),

  finalView: (creativeId: string, finalId: string) => api.get<FinalView>(`/v1/creative/${creativeId}/finals/${finalId}`),

  /** The sizes the chosen channels offer for one shape. `finalId` says which need more background for THAT final's picture. */
  placements: (channels: string[], format: PostFormat, finalId?: string) => {
    const p = new URLSearchParams({ channels: channels.join(","), format });
    if (finalId) p.set("finalId", finalId);
    return api.get<{ placements: PlacementRow[] }>(`/v1/creative/placements?${p.toString()}`);
  },

  /** Free: draw each size from the one final. A size that needs more background comes back `needs_extend`. */
  renderVersions: (creativeId: string, finalId: string, placementKeys: string[]) =>
    api.post<{ versions: VersionRow[] }>(`/v1/creative/${creativeId}/finals/${finalId}/versions/render`, { placementKeys }),

  /** Quoted per size: `quoteToken` is the receipt for exactly `placementKeys.length` sizes. 202, a job the merchant can leave. */
  extendVersions: (creativeId: string, finalId: string, placementKeys: string[], quoteToken: string | undefined) =>
    api.post<{ jobId: string; versions: VersionRow[] }>(
      `/v1/creative/${creativeId}/finals/${finalId}/versions/extend`,
      { placementKeys },
      pressHeaders(quoteToken ? { main: quoteToken } : {}),
    ),

  /** Free and repeatable: saves each size as a published file and gives the caption (organic), or makes the Ad Engine rows (ad, one per platform). */
  handoffOrganic: (creativeId: string, versionIds: string[]) =>
    api.post<OrganicHandoff>(`/v1/creative/${creativeId}/handoff`, { target: "organic", versionIds }),
  handoffAd: (creativeId: string, versionIds: string[]) => api.post<AdHandoff>(`/v1/creative/${creativeId}/handoff`, { target: "ad", versionIds }),

  /** After the person pressed Post it or Schedule it on the scheduler: records the sizes as scheduled or published. */
  confirmHandoff: (creativeId: string, versionIds: string[], state: "scheduled" | "published") =>
    api.post<{ versions: Array<{ id: string; state: string }> }>(`/v1/creative/${creativeId}/handoff/confirm`, { versionIds, state }),

  /** "Looks different? Tell us": free, counted for the team. */
  reportMismatch: (finalId: string, text: string | undefined) => api.post<{ ok: true }>(`/v1/creative/finals/${finalId}/report-mismatch`, text ? { text } : {}),

  /** Studio settings and the per-user Pro tools flag, saved on change. An editor's call. */
  saveSettings: (patch: SettingsPatch) => api.patch<{ settings: Omit<StudioSettings, "usedThisMonthPeaks">; proTools: boolean }>("/v1/creative/settings", patch),

  /** The business's product photos with the product each belongs to. Pages by `next`. */
  productImages: (q: { productId?: string; after?: string; limit?: number } = {}) => {
    const p = new URLSearchParams();
    if (q.productId) p.set("productId", q.productId);
    if (q.after) p.set("after", q.after);
    p.set("limit", String(q.limit ?? 100));
    return api.get<ProductImagesResponse>(`/v1/media/product-images?${p.toString()}`);
  },
};
