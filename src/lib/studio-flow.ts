import { ApiError } from "@/lib/api";
import { formatPeaks } from "@/lib/pricing";
import { STUDIO_COPY } from "@/lib/studio-copy";
import type { KitColor } from "@/lib/api/brand-kit";
import type {
  CreativeView,
  FinalRow,
  PreviewView,
  PressQuote,
  ProductImage,
  ShortlistItem,
} from "@/lib/api/creative-studio";

/**
 * Pure helpers for the creative flow (UX spec L2 brief, L3 previews, L4 shortlist and finals). No React, no fetching: tested directly.
 * Merchant words come from `studio-copy.ts`; this file only picks which sentence and fills in its figures.
 */

export const MAX_BRIEF_PRODUCTS = 3;
export const LINE_MAX = 140;
/** The most finals one press makes (api `MAX_FINALS_PER_PRESS`). */
export const MAX_FINALS_PER_PRESS = 24;
/** The headline, offer and button limits of the wording fields (spec S8). */
export const WORDING_MAX = { headline: 60, offer: 40, cta: 24 } as const;

export const STUDIO_PATHS = {
  shortlist: "/dashboard/studio/shortlist",
  creative: (id: string) => `/dashboard/studio/c/${encodeURIComponent(id)}`,
  buyPeaks: "/dashboard/peaks",
  brandKit: "/dashboard/drive?tab=brand",
} as const;

// ── Errors: one function for every charged or changing call (spec 4.2) ────────────────────────────────────────

export type RefusalAction = "add_peaks" | "see_progress" | "retry" | "new_plan" | "requote";

export interface StudioRefusal {
  code: string;
  /** "not_released" is the designed coming-soon state, never a toast and never an error. */
  tone: "not_released" | "error";
  /** One plain sentence. Every one of these says nothing was charged where that is the case. */
  text: string;
  action?: RefusalAction;
  /** CREDITS_EXHAUSTED only: what is needed and what the merchant has, so "Make {k} instead" can be offered. */
  need?: number;
  left?: number;
  /** The product ids a PHOTO_MISSING refusal is about. */
  productIds?: string[];
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/**
 * What a refused or failed call says. Unknown failures say "Something went wrong. You weren't charged." and offer Try again.
 * `what` names the thing for the not-available sentence: "Making previews".
 */
export function studioRefusal(error: unknown, what = "That"): StudioRefusal {
  const C = STUDIO_COPY.refusal;
  if (!(error instanceof ApiError)) return { code: "NETWORK", tone: "error", text: C.wentWrong, action: "retry" };
  const details = (error.details ?? {}) as Record<string, unknown>;
  switch (error.code) {
    case "CREATIVE_NOT_RELEASED":
      return { code: error.code, tone: "not_released", text: C.notAvailable(what) };
    case "CREDITS_EXHAUSTED": {
      const need = num(details.needed);
      const left = num(details.remaining);
      return {
        code: error.code,
        tone: "error",
        text: need !== undefined && left !== undefined ? C.creditsShort(formatPeaks(need), formatPeaks(Math.max(0, left))) : error.message,
        action: "add_peaks",
        ...(need !== undefined ? { need } : {}),
        ...(left !== undefined ? { left } : {}),
      };
    }
    case "ACT_ALREADY_RUNNING":
    case "DUPLICATE_REQUEST":
      return { code: error.code, tone: "error", text: C.alreadyRunning, action: "see_progress" };
    case "QUOTE_NOT_HONOURED":
      return { code: error.code, tone: "error", text: C.priceChangedNoFigure, action: "requote" };
    case "FORBIDDEN":
      return { code: error.code, tone: "error", text: C.askAnEditor };
    case "STUDIO_CAP_REACHED": {
      const cap = num(details.cap);
      return { code: error.code, tone: "error", text: cap !== undefined ? C.capReached(formatPeaks(cap)) : error.message };
    }
    case "BRIEF_LOCKED":
      return { code: error.code, tone: "error", text: C.briefLocked, action: "new_plan" };
    case "TOO_MANY_PREVIEWS":
      return { code: error.code, tone: "error", text: C.tooManyPreviews, action: "new_plan" };
    case "WORDS_ONLY":
      return { code: error.code, tone: "error", text: C.wordsOnly };
    case "PHOTO_MISSING":
      return {
        code: error.code,
        tone: "error",
        text: error.message,
        ...(Array.isArray(details.productIds) ? { productIds: details.productIds.filter((x): x is string => typeof x === "string") } : {}),
      };
    case "NOT_APPROVED":
      return { code: error.code, tone: "error", text: C.notApproved };
    case "VERSION_CONFLICT":
    case "STATE_CONFLICT":
      return { code: error.code, tone: "error", text: C.conflict };
    case "TEXT_DOES_NOT_FIT":
      return { code: error.code, tone: "error", text: C.textDoesNotFit };
    case "FONT_MISSING_GLYPH":
      return { code: error.code, tone: "error", text: C.fontMissingGlyph };
    // The api's own words for a change it cannot make: each is a plain sentence written for the merchant ("There's no shorter wording. Type your own.").
    case "TEXT_EMPTY":
    case "LAYER_MISSING":
    case "LAYER_LOCKED":
    case "OPTION_MISSING":
    case "NO_OTHER_OPTION":
    case "NOTHING_SHORTER":
    case "NOTHING_LONGER":
    case "COLOUR_UNKNOWN":
    case "PRODUCT_NOT_IN_BRIEF":
    case "NOTHING_TO_UNDO":
    case "CUTOUT_MISSING":
    case "NEEDS_EXTEND":
    case "RENDER_FAILED":
    case "VALIDATION_ERROR":
      return { code: error.code, tone: "error", text: error.message };
    default:
      return { code: error.code, tone: "error", text: C.wentWrong, action: "retry" };
  }
}

/** True for the one refusal that means "this use case is switched off": the screen falls into its coming-soon state, with no toast. */
export const isNotReleased = (e: unknown): boolean => e instanceof ApiError && e.code === "CREATIVE_NOT_RELEASED";

/**
 * After CREDITS_EXHAUSTED: how many units the balance still covers, fewer than wanted, so the sheet can offer "Make {k} instead" (U11).
 * Undefined when it covers none, or the sum cannot be worked out. `unitPeaks` is the per-unit price from the quote the merchant saw.
 */
export function affordableUnits(left: number | undefined, unitPeaks: number | undefined, wanted: number): number | undefined {
  if (left === undefined || unitPeaks === undefined || !(unitPeaks > 0)) return undefined;
  const k = Math.min(wanted - 1, Math.floor(left / unitPeaks));
  return k >= 1 ? k : undefined;
}

// ── The quote of a press (UX spec 4.1) ──────────────────────────────────────────────────────────────────────

/** Clock slack: a receipt this close to its end is treated as lapsed, as `deriveQuoteState` does for the Peaks quote. */
const RECEIPT_SKEW_MS = 30_000;

export interface PressQuoteState {
  quote: PressQuote | undefined;
  loading: boolean;
  /** Asked, and could not be priced. Distinct from loading, and from notReleased. */
  unavailable: boolean;
  /** The api said the use case is switched off: show the coming-soon state, never a figure. */
  notReleased: boolean;
}

/**
 * The states of a press quote, from react-query's flags. A receipt that has (nearly) lapsed is withheld, never handed out: sending a dead
 * one fails the act with 409 where sending none would charge the live rate. A quote in hand beats a background refetch.
 */
export function derivePressQuote(input: {
  enabled: boolean;
  isFetching: boolean;
  data: PressQuote | undefined;
  error: unknown;
  now: number;
}): PressQuoteState {
  const lapsed = !!input.data && [input.data.main, input.data.cutout].some((q) => q && q.expiresAt - RECEIPT_SKEW_MS <= input.now);
  const quote = lapsed ? undefined : input.data;
  const notReleased = input.enabled && isNotReleased(input.error);
  return {
    quote,
    loading: input.enabled && input.isFetching && !quote && !notReleased,
    unavailable: input.enabled && !input.isFetching && !quote && !notReleased,
    notReleased,
  };
}

/** The receipts to send with the click, only while they are live (never a lapsed one). */
export function receiptsOf(quote: PressQuote | undefined): { main?: string; cutout?: string } {
  if (!quote) return {};
  return { main: quote.main.token, ...(quote.cutout ? { cutout: quote.cutout.token } : {}) };
}

// ── Polling (spec 4.4) ───────────────────────────────────────────────────────────────────────────────────────

/** True while anything on the creative is still being made. */
export function isWorking(v: CreativeView | undefined): boolean {
  if (!v) return false;
  if (v.status === "making_previews") return true;
  if (v.jobs.length > 0) return true;
  if (v.previews.some((p) => p.state === "rendering" || p.state === "finalizing")) return true;
  if (v.finals.some((f) => f.state === "queued" || f.state === "making" || f.state === "checking")) return true;
  return v.versions.some((x) => x.state === "extending");
}

/** Every 1.5 s for the first 30 s of watching, then every 4 s; false (stop) when nothing is being made. */
export function pollInterval(v: CreativeView | undefined, updates: number): number | false {
  if (!isWorking(v)) return false;
  return updates < 20 ? 1500 : 4000;
}

export type CreativePhase = "making" | "failed" | "all_dropped" | "ready" | "brief";

/** What the creative page is showing, from its status. */
export function creativePhase(v: CreativeView): CreativePhase {
  if (v.status === "brief") return "brief";
  if (v.status === "making_previews") return "making";
  if (v.status === "previews_failed") return v.safetySummary.dropped > 0 && v.previews.length === 0 ? "all_dropped" : "failed";
  return "ready";
}

/** Progress of the press that is making previews: finished ones out of those asked for. */
export function makingProgress(v: CreativeView): { done: number; total: number } {
  const job = v.jobs.find((j) => j.kind === "previews" || j.kind === "more");
  if (job) return { done: job.done, total: job.total };
  const total = v.previews.length || v.brief.count;
  return { done: v.previews.filter((p) => p.state !== "rendering").length, total };
}

/** A preview a merchant can act on (heart, tweak): ready or hearted, never one still being made or one that failed. */
export const isActionable = (p: PreviewView): boolean => p.state === "ready" || p.state === "shortlisted";

/** Previews that came through: shown as tiles (still being made, ready, hearted, on the way to final, final). */
export const isShownTile = (p: PreviewView): boolean => p.state !== "skipped" && p.state !== "dropped";

// ── Finals ───────────────────────────────────────────────────────────────────────────────────────────────────

/** A shortlist row the Make final bar can make final: hearted, and not already on its way or made. */
export const isEligibleForFinal = (i: ShortlistItem): boolean => i.state === "shortlisted" && !i.lapsed;

/**
 * The previews the choose sheet will make final: all of them by default (up to one press), or the ones the merchant left ticked. Only what is
 * still waiting counts: a preview that left the shortlist since it was ticked (a teammate removed it, a press started it) drops out of the
 * count and the price, so the figure shown and the price asked for are always the same number.
 */
export function chosenForFinal<T extends { previewId: string }>(items: T[], picked: ReadonlySet<string> | null, max = MAX_FINALS_PER_PRESS): T[] {
  return picked ? items.filter((i) => picked.has(i.previewId)).slice(0, max) : items.slice(0, max);
}

export type ShortlistChip = "waiting" | "making" | "ready" | "blocked" | "failed" | "changed";

export function shortlistChip(i: ShortlistItem): ShortlistChip {
  if (i.lapsed) return "changed";
  switch (i.state) {
    case "finalizing":
      return "making";
    case "final_ready":
      return "ready";
    case "final_blocked":
      return "blocked";
    case "final_failed":
      return "failed";
    default:
      return "waiting";
  }
}

/** Finals from one press are made one after another: the ones not yet started are waiting their turn. */
export type FinalPhase = "waiting" | "making" | "checking" | "ready" | "blocked" | "failed";

export const finalPhase = (f: Pick<FinalRow, "state">): FinalPhase => (f.state === "queued" ? "waiting" : f.state);

/** The summary line once finals are done and some did not come through: "{k} of {n} are ready. You're charged for the {k} that came through." */
export function finalsSummary(finals: FinalRow[]): string | null {
  if (finals.length === 0 || finals.some((f) => f.state === "queued" || f.state === "making" || f.state === "checking")) return null;
  const ready = finals.filter((f) => f.state === "ready").length;
  return ready === finals.length ? null : STUDIO_COPY.final.summary(ready, finals.length);
}

// ── The plan (S3) and the product picker (S4) ───────────────────────────────────────────────────────────────

export interface PickerProduct {
  id: string;
  title: string;
  /** The Library photo that leads: position 0, else the first. */
  photo?: { mediaId: string; url?: string; width?: number; height?: number };
}

/** The product picker's tiles: one per product, from the Library's product photos (CS-7a). A photo with no product link is not a product. */
export function groupProducts(items: ProductImage[]): PickerProduct[] {
  const lead = new Map<string, ProductImage>();
  for (const it of items) {
    if (!it.productId) continue;
    const prev = lead.get(it.productId);
    if (!prev || it.position < prev.position) lead.set(it.productId, it);
  }
  return [...lead.entries()].map(([id, item]) => {
    const width = item.media.width ?? item.width;
    const height = item.media.height ?? item.height;
    return {
      id,
      title: item.productTitle?.trim() || "Product",
      photo: { mediaId: item.media.id, ...(item.media.publicUrl ? { url: item.media.publicUrl } : {}), ...(width ? { width } : {}), ...(height ? { height } : {}) },
    };
  });
}

export interface PlanInput {
  productIds: string[];
  /** Which products have a photo (the Library's, or one the merchant chose). */
  hasPhoto: (productId: string) => boolean;
  titleOf: (productId: string) => string;
}

export type PlanBlock = { kind: "no_product" } | { kind: "no_photo"; productId: string; title: string };

/** Why "Make previews" cannot be pressed yet, or null. A product with no photo blocks: the picture shows the real one, never an invented one. */
export function planBlock(p: PlanInput): PlanBlock | null {
  if (p.productIds.length === 0) return { kind: "no_product" };
  const missing = p.productIds.find((id) => !p.hasPhoto(id));
  return missing ? { kind: "no_photo", productId: missing, title: p.titleOf(missing) } : null;
}

/**
 * The photo list a brief sends: one media id per product, in the products' order, ONLY when every product has one (photos pair to products
 * by position on the api, so a short list would put a photo on the wrong product). Otherwise none, and the api uses each Library photo.
 */
export function photoMediaIdsFor(productIds: string[], photoOf: (productId: string) => string | undefined): string[] {
  const ids = productIds.map((id) => photoOf(id));
  return ids.every((x): x is string => !!x) ? (ids as string[]) : [];
}

/** The placeholder under "What should the post say?" taken from the idea. */
export function linePlaceholder(opts: { festival?: string | null; productTitle?: string | null }): string {
  const C = STUDIO_COPY.brief.line;
  if (opts.festival && opts.productTitle) return C.placeholderFestival(opts.festival, opts.productTitle);
  if (opts.productTitle) return C.placeholderProduct(opts.productTitle);
  return C.placeholderBlank;
}

/** Languages the plan can write in, shown by their own name (never a raw code). */
export const STUDIO_LANGUAGES: Array<{ code: string; name: string }> = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी (Hindi)" },
  { code: "ta", name: "தமிழ் (Tamil)" },
  { code: "te", name: "తెలుగు (Telugu)" },
  { code: "bn", name: "বাংলা (Bengali)" },
  { code: "mr", name: "मराठी (Marathi)" },
  { code: "gu", name: "ગુજરાતી (Gujarati)" },
  { code: "pa", name: "ਪੰਜਾਬੀ (Punjabi)" },
  { code: "ar", name: "العربية (Arabic)" },
  { code: "fr-CA", name: "Français (Québec)" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
];

// ── The tweak controls (S8) ─────────────────────────────────────────────────────────────────────────────────

export interface Swatch {
  key: string;
  name: string;
  hex: string;
}

/** The api's own plain pair, used when the brand kit has none (api `layout.ts` FALLBACK_SWATCHES). */
const FALLBACK_SWATCHES: Swatch[] = [
  { key: "white", name: "White", hex: "#ffffff" },
  { key: "gold", name: "Gold", hex: "#ffd24a" },
  { key: "black", name: "Black", hex: "#111111" },
  { key: "red", name: "Deep red", hex: "#e63946" },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "colour";

/**
 * The colours a merchant can pick, with the keys the api answers to. The api derives each key from the brand kit colour's name (a slug,
 * de-duplicated with "-2"), then adds its plain fallbacks; this repeats exactly that so a key sent here is one the api knows.
 */
export function paletteFromKit(colors: KitColor[]): Swatch[] {
  const out: Swatch[] = [];
  const used = new Set<string>();
  for (const c of colors) {
    if (!/^#[0-9a-fA-F]{6}$/.test(c.hex)) continue;
    const name = c.name?.trim() || (c.role ? c.role[0]!.toUpperCase() + c.role.slice(1) : c.hex);
    let key = slug(name);
    while (used.has(key)) key += "-2";
    used.add(key);
    out.push({ key, name, hex: c.hex.toLowerCase() });
  }
  for (const f of FALLBACK_SWATCHES) if (!used.has(f.key) && !out.some((s) => s.hex === f.hex)) out.push(f);
  return out;
}

/** The tweak for a typed wording: which field, and the op. Empty text is not sent. */
export function wordingOp(
  field: "headline" | "offer" | "cta",
  text: string,
): { op: "headline.set" | "offer.set" | "cta.set"; text: string } | null {
  const t = text.trim();
  if (!t) return null;
  return { op: field === "headline" ? "headline.set" : field === "offer" ? "offer.set" : "cta.set", text: t.slice(0, WORDING_MAX[field]) };
}
