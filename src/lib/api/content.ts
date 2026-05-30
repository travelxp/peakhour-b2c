import { api } from "@/lib/api";
import type { PlatformKey, RewriteOp } from "@/components/composer";

/**
 * Generic content-composer API client — the endpoints every publish
 * composer (LinkedIn / X / Beehiiv / Strategist / calendar) shares.
 * Channel-specific calls (e.g. LinkedIn policy check) live in their
 * own api modules (linkedin-content.ts).
 */

// ── AI rewrite (POST /v1/content/rewrite) ──────────────────

/** Per-op extras passed through to the rewrite skill — e.g. the tone
 *  picker sends `{ targetTone: "warmer" }`. */
export type RewriteExtras = Record<string, unknown>;

export interface RewriteContentInput {
  op: RewriteOp;
  text: string;
  platform: PlatformKey;
  /** Body format. Omit (default "text") for plain-text/social composers.
   *  "html" for the strategist newsletter/article editor so the rewrite
   *  preserves semantic HTML structure instead of flattening to prose. */
  format?: "text" | "html";
  extras?: RewriteExtras;
}

export interface RewriteContentResult {
  /** Replace ops (compose/redraft/shorten/lengthen/tone): the new full
   *  composer body. Insert ops (quote/disclosure): the snippet to
   *  splice at the caret. Discriminate via `insert`. */
  text: string;
  /** True iff `text` is a caret-insert snippet rather than a full-body
   *  replacement. OPTIONAL on the wire for forward/backward-compat: an
   *  API that predates the snippet contract omits it, in which case the
   *  caller MUST treat it as `false` (full-body replace = legacy
   *  behavior). See peakhour-api#431. */
  insert?: boolean;
}

/**
 * Run an AI rewrite op for the composer's `<AiComposeToolbar/>`.
 *
 * Returns `{ text, insert }`. For replace ops `text` is the new full
 * body (`setText(text)`); for insert ops (`insert === true`) `text` is
 * a short snippet the host splices at the tracked caret via
 * `insertAtCaret`. When `insert` is absent (older API), treat it as
 * `false` so the composer degrades to the legacy full-body replace
 * rather than wiping the draft with a snippet.
 */
export function rewriteContent(input: RewriteContentInput) {
  return api.post<RewriteContentResult>("/v1/content/rewrite", {
    op: input.op,
    text: input.text,
    platform: input.platform,
    ...(input.format ? { format: input.format } : {}),
    ...(input.extras ? { extras: input.extras } : {}),
  });
}

// ── Composer draft auto-save (POST/PUT /v1/content/drafts) ──

export interface ComposerDraftRef {
  draftId: string;
  status: string;
  updatedAt: string;
}

/** Content categories the composer can author. Subset of the
 *  cnt_drafts category enum the API accepts. */
export type ComposerDraftCategory =
  | "social_post"
  | "newsletter"
  | "blog_post"
  | "email_campaign"
  | "other";

export interface CreateDraftInput {
  text: string;
  /** Which composer authored this — stored in sourceMetadata. */
  channel?: PlatformKey;
  contentCategory?: ComposerDraftCategory;
}

/** Create a composer draft (status:"draft"). Returns the new draftId
 *  the host should remember and pass to `updateDraft` on later saves. */
export function createDraft(input: CreateDraftInput) {
  return api.post<ComposerDraftRef>("/v1/content/drafts", {
    text: input.text,
    ...(input.channel ? { channel: input.channel } : {}),
    ...(input.contentCategory ? { contentCategory: input.contentCategory } : {}),
  });
}

/** Update a composer draft. Scoped server-side to status:"draft" rows
 *  (404 otherwise), so it can never clobber a pipeline draft. */
export function updateDraft(draftId: string, input: { text: string; title?: string }) {
  return api.put<ComposerDraftRef>(`/v1/content/drafts/${draftId}`, {
    text: input.text,
    ...(input.title ? { title: input.title } : {}),
  });
}

// ── Voice cards (GET /v1/content/voice-cards) ──────────────

/** A cnt_voice_cards doc as served by GET /v1/content/voice-cards.
 *  Trimmed to the fields the composer's <VoiceCardPreview/> renders —
 *  the route returns the full doc, we read defensively. */
export interface VoiceCardDoc {
  _id?: string;
  channel?: string;
  category?: string;
  voice?: {
    tone?: string[];
    signaturePhrases?: string[];
    avoidPhrases?: string[];
  };
  lastGeneratedAt?: string;
  updatedAt?: string;
}

/** Fetch voice cards for a channel (+ optional category). Generic
 *  across composers — LinkedIn has its own richer endpoint, but X /
 *  Beehiiv / calendar use this one for the informational voice chip.
 *  (Brand voice is also injected server-side by the rewrite skill, so
 *  the chip is purely a "here's the voice we're writing in" cue.) */
export function getVoiceCards(params: { channel?: string; category?: string } = {}) {
  const query: Record<string, string> = {};
  if (params.channel) query.channel = params.channel;
  if (params.category) query.category = params.category;
  return api.get<VoiceCardDoc[]>("/v1/content/voice-cards", query);
}
