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
  /** Words only: the channel the words are written for. Absent: no platform chosen (the writer's default, Facebook and Instagram). */
  platform?: string;
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
  /** Words only. Left off when none is chosen. */
  platform?: string;
}

/** `platform: null` puts the choice back to none chosen. */
export type BriefPatch = Partial<Omit<BriefBody, "kind" | "platform">> & { platform?: string | null };

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

/** A colour the colour tweak accepts, by the key it takes. */
export interface Swatch {
  key: string;
  name: string;
  hex: string;
}

/** How easy the headline is to read on the picture behind it. `contrast` is a ratio (shown only with Pro tools); `hardToRead` is the api's own verdict. */
export interface HeadlineBackdrop {
  hex: string;
  contrast: number;
  hardToRead: boolean;
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
  /** Where the product sits in the picture, as fractions (0..1) of its width and height; null for a picture drawn before the crop was kept. */
  productCrop: { x: number; y: number; w: number; h: number } | null;
  headlineBackdrop: HeadlineBackdrop | null;
  /** Words only: the option card (headline, main text, description, button, hashtags without the #). Null on a picture. */
  words?: WordsCard | null;
  /** Words only: where the card went once it was used (null while nowhere). Absent from an api that predates it. */
  sent?: WordsSent | null;
  note?: string;
}

/** Where a words-only option went: the channels it was posted on, the channels it is scheduled on, and whether it was sent to Growth as an ad. */
export interface WordsSent {
  posted: string[];
  scheduled: string[];
  inAd: boolean;
}

/** One words-only option card, as the api sends it. */
export interface WordsCard {
  headline: string;
  primaryText: string;
  description: string | null;
  cta: string | null;
  hashtags: string[];
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
  /** The language(s) the wording is written in. */
  languages: string[];
  /** The colours the colour tweak accepts, by key. Absent only from an api that predates it: the page then falls back to the brand kit's. */
  palette?: Swatch[];
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

/** The price of a whole batch (S16): one total, the previews' price and the cut-outs', and the two receipts the create takes back. */
export interface BatchQuote extends PressQuote {
  products: number;
  previewsEach: number;
}

/** What the batch is made from: the products and how many previews each. The api makes one plan per product from its title. */
export interface BatchBody {
  productIds: string[];
  language: string;
  count: 3 | 4;
  format?: "feed" | "story" | "reel";
}

export interface BatchStarted {
  batchId: string;
  creativeIds: string[];
  jobId: string;
  quote: { peaks: number; units: number };
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
  /** Words only has no final to make: its cards are not offered to Make final. Absent from an api that predates it (a picture). */
  kind?: "image" | "words";
  /** Words only: where the option went once it was used (null while nowhere). */
  sent?: WordsSent | null;
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
  /** Words only: the parts of the words the platform's limits made shorter. Empty or absent when they fit as written. */
  shortened?: WordsPart[];
  /** Words ad hand-offs, built by the app from one answer per platform it asked: what each platform's limits shortened. */
  shortenedFor?: ShortenedFor[];
}

/** The parts of the words that one ad platform's limits made shorter. */
export interface ShortenedFor {
  platform: string;
  parts: WordsPart[];
}

/** A part of a words option, as the api names it. */
export type WordsPart = "headline" | "primaryText" | "description" | "cta" | "hashtags";

export interface SettingsPatch {
  noAiPeople?: boolean;
  /** null clears the limit. */
  monthlyCapPeaks?: number | null;
  remindShortlist?: boolean;
  whatsappUpdates?: boolean;
  proTools?: boolean;
}

/** One tile of a batch (S16), as `GET /v1/creative/batches/:id` gives it: the small picture, the product and the headline come with it. */
export interface BatchPreview {
  id: string;
  creativeId: string;
  state: PreviewState;
  liked: boolean;
  index: number;
  thumbUrl: string | null;
  productTitle: string | null;
  headline: string | null;
  /** The heart was taken off by a change: tap it again to approve the new look. */
  lapsed: boolean;
}

export interface BatchView {
  id: string;
  status: "draft" | "making" | "ready" | "partial" | "failed";
  /** What the whole batch cost to quote, as the api kept it. Shown nowhere as a figure of ours. */
  quote: { peaks: number; units: number } | null;
  products: number;
  done: number;
  failedProducts: number;
  creatives: string[];
  previews: BatchPreview[];
}

export type BatchOp = "approve" | "reject" | "clear";

export interface BatchActionResult {
  updated: number;
  skipped: number;
  shortlistCount: number;
}

/** One line of a creative's look history (S17). Versions are per preview: `version` counts that preview's looks. */
export interface HistoryItem {
  previewId: string;
  version: number;
  summary: string;
  at: string;
  current: boolean;
  restorable: boolean;
}

export type ApprovalLinkState = "waiting" | "approved" | "rejected" | "revoked" | "expired";

export interface ApprovalLink {
  id: string;
  previewId: string;
  state: ApprovalLinkState;
  expiresAt: string;
  answeredName: string | null;
  answeredAt: string | null;
}

/** A link just made. The token is shown once: only its hash is kept. */
export interface CreatedApprovalLink {
  id: string;
  token: string;
  expiresAt: string;
  note: string;
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
  /** Words only: ONE shortlisted option goes on (free, repeatable). The caption carries the hashtags; there is no picture. An ad names the channel it will run on. */
  handoffWordsOrganic: (creativeId: string, previewId: string) =>
    api.post<OrganicHandoff>(`/v1/creative/${creativeId}/handoff`, { target: "organic", previewIds: [previewId] }),
  handoffWordsAd: (creativeId: string, previewId: string, channel: string) =>
    api.post<AdHandoff>(`/v1/creative/${creativeId}/handoff`, { target: "ad", previewIds: [previewId], channel }),

  /** After the person pressed Post it or Schedule it on the scheduler: records the sizes as scheduled or published. */
  confirmHandoff: (creativeId: string, versionIds: string[], state: "scheduled" | "published") =>
    api.post<{ versions: Array<{ id: string; state: string }> }>(`/v1/creative/${creativeId}/handoff/confirm`, { versionIds, state }),

  /** Words only: after the scheduler took the option, records it as scheduled or posted on these channels (free). */
  confirmWordsHandoff: (creativeId: string, previewId: string, channels: string[], state: "scheduled" | "published") =>
    api.post<{ previews: Array<{ id: string; state: string; channels: string[] }> }>(`/v1/creative/${creativeId}/handoff/confirm`, { previewIds: [previewId], channels, state }),

  /** "Looks different? Tell us": free, counted for the team. */
  reportMismatch: (finalId: string, text: string | undefined) => api.post<{ ok: true }>(`/v1/creative/finals/${finalId}/report-mismatch`, text ? { text } : {}),

  /** Studio settings and the per-user Pro tools flag, saved on change. An editor's call. */
  saveSettings: (patch: SettingsPatch) => api.patch<{ settings: Omit<StudioSettings, "usedThisMonthPeaks">; proTools: boolean }>("/v1/creative/settings", patch),

  /** S16: the one price of a whole batch and its receipts. Free. 409 CREATIVE_NOT_RELEASED while previews are off, 403 PRO_TOOLS_REQUIRED, 422 PHOTO_MISSING. */
  batchQuote: (body: BatchBody) => api.post<BatchQuote>("/v1/creative/batches/quote", body),

  /** S16: start the batch. Charged once for the previews that come through; `receipts` are the ones the quote gave (a changed count is 409 QUOTE_NOT_HONOURED). 202. */
  createBatch: (body: BatchBody, receipts: PressReceipts) => api.post<BatchStarted>("/v1/creative/batches", body, pressHeaders(receipts)),

  /** S16: the grid's one read (Pro tools). */
  batch: (id: string) => api.get<BatchView>(`/v1/creative/batches/${id}`),

  /** S16: approve (the heart), reject ("Not for me") or clear, for many previews in ONE request. Free. */
  batchAction: (id: string, op: BatchOp, previewIds: string[], reasons?: string[]) =>
    api.post<BatchActionResult>(`/v1/creative/batches/${id}/actions`, { op, previewIds, ...(reasons?.length ? { reasons } : {}) }),

  /** S17: every look of every preview of a creative (Pro tools). */
  versions: (creativeId: string) => api.get<{ versions: HistoryItem[] }>(`/v1/creative/${creativeId}/versions`),

  /** S17: make an earlier look the new head. Free; the heart lapses (U2). */
  restore: (creativeId: string, version: number, previewId: string) =>
    api.post<{ layoutVersion: number }>(`/v1/creative/${creativeId}/versions/${version}/restore`, { previewId }),

  /** S18: make, list and stop approval links for one preview (Pro tools). */
  createApprovalLink: (creativeId: string, previewId: string) =>
    api.post<CreatedApprovalLink>(`/v1/creative/${creativeId}/approval-links`, { previewId }),
  approvalLinks: (creativeId: string) => api.get<{ links: ApprovalLink[] }>(`/v1/creative/${creativeId}/approval-links`),
  revokeApprovalLink: (creativeId: string, linkId: string) =>
    api.delete<{ ok: true }>(`/v1/creative/${creativeId}/approval-links/${linkId}`),

  /** The business's product photos with the product each belongs to. Pages by `next`. */
  productImages: (q: { productId?: string; after?: string; limit?: number } = {}) => {
    const p = new URLSearchParams();
    if (q.productId) p.set("productId", q.productId);
    if (q.after) p.set("after", q.after);
    p.set("limit", String(q.limit ?? 100));
    return api.get<ProductImagesResponse>(`/v1/media/product-images?${p.toString()}`);
  },
};
