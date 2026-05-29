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
  extras?: RewriteExtras;
}

/**
 * Run an AI rewrite op for the composer's `<AiComposeToolbar/>`.
 * Returns the NEW full composer text. The toolbar's `onAiAction`
 * contract resolves to a string, so callers typically do
 * `const { text } = await rewriteContent(...); setText(text);`.
 */
export function rewriteContent(input: RewriteContentInput) {
  return api.post<{ text: string }>("/v1/content/rewrite", {
    op: input.op,
    text: input.text,
    platform: input.platform,
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
