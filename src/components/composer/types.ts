/**
 * Shared types for the composer foundation primitives.
 *
 * These types are the contract that the foundation kit (in
 * `src/components/composer/`) exposes to every host composer (X,
 * LinkedIn, Beehiiv, Strategist publish tab, calendar "+ compose new").
 * Hosts thread their concrete `onAiAction`, `onSearchMentions`,
 * `onSelectMedia`, etc. callbacks into the primitives — no primitive
 * touches the network directly, so the foundation has zero backend
 * dependencies and ships ahead of any new endpoints.
 */

/** Stable identifier for a publishing channel. Mirrors the channel
 *  keys used by the recommender / engine in peakhour-api
 *  (write-skill registry at src/v1/ai/repurposer.ts). */
export type PlatformKey =
  | "linkedin"
  | "x"
  | "beehiiv"
  | "facebook"
  | "instagram"
  | "threads"
  | "bluesky";

/** Per-platform composer rules. Used by `<PlatformCharCounter/>` and
 *  by `<AiComposeToolbar/>` to decide what "shorten" / "lengthen"
 *  targets make sense.
 *
 *  IMPORTANT: keep these aligned with the engine's actual platform
 *  limits in peakhour-api. Out-of-sync values would let a user compose
 *  a "valid" tweet that the engine then rejects at publish time.
 *
 *  X's 280-char counter is intentionally a simplification — real X
 *  shortens URLs to 23 chars regardless of length and counts emojis as
 *  variable weight. PR #4 (X composer rewrite) ports x-twitter-text
 *  for full parity; foundation ships the simple counter so the X
 *  composer can replace it in-place. */
export interface PlatformLimits {
  /** Hard character ceiling. Counter shows red past this. */
  maxChars: number;
  /** Soft warning threshold (0..1 of maxChars). Counter shows amber. */
  warnAt: number;
  /** Human-readable label for the platform (used in tooltips). */
  label: string;
}

export const PLATFORM_LIMITS: Record<PlatformKey, PlatformLimits> = {
  x: { maxChars: 280, warnAt: 0.9, label: "X (Twitter)" },
  linkedin: { maxChars: 3000, warnAt: 0.85, label: "LinkedIn" },
  beehiiv: { maxChars: 100_000, warnAt: 0.95, label: "Beehiiv" },
  facebook: { maxChars: 63_206, warnAt: 0.95, label: "Facebook" },
  instagram: { maxChars: 2200, warnAt: 0.9, label: "Instagram" },
  threads: { maxChars: 500, warnAt: 0.9, label: "Threads" },
  bluesky: { maxChars: 300, warnAt: 0.9, label: "Bluesky" },
};

/** AI rewrite operations exposed by `<AiComposeToolbar/>`. The host
 *  composer passes a single `onAiAction(op, ctx)` callback; this enum
 *  is the discriminant. Adding a new op = add the chip + map to the
 *  backend rewrite endpoint's `op` field (peakhour-api
 *  `POST /v1/content/rewrite`, landing parallel to PR #3/#4). */
export type RewriteOp =
  /** Generate a fresh draft from scratch (no current text consumed). */
  | "compose"
  /** Rewrite the current text in a different angle / structure. */
  | "redraft"
  /** Trim the current text down (target: 60-70% of input length). */
  | "shorten"
  /** Expand the current text (target: 130-150% of input length). */
  | "lengthen"
  /** Re-tone the current text (caller supplies tone direction). */
  | "tone"
  /** Insert a pull-quote suggestion at the caret. */
  | "quote"
  /** Insert a sponsorship/disclosure boilerplate. */
  | "disclosure";

/** Context the toolbar passes back to the host's AI handler. */
export interface AiActionContext {
  op: RewriteOp;
  /** Full current composer text (caller's source of truth). */
  text: string;
  /** Platform the composer is targeting — lets the handler pick the
   *  right write-skill (write-linkedin-post vs write-x). Some
   *  composers are platform-agnostic (e.g. Beehiiv newsletter →
   *  treat as a single-target platform). */
  platform: PlatformKey;
  /** Optional per-op extras. e.g. for `tone`, the host's tone-picker
   *  passes `{ targetTone: "punchier" }` here. */
  extras?: Record<string, unknown>;
}

/** Voice card payload the host fetches from
 *  `GET /v1/content/voice-cards` and passes to `<VoiceCardPreview/>`.
 *
 *  Mirrors the shape of `voi_voice_cards` in peakhour-mongodb but
 *  trimmed to the fields the preview actually renders — no need for
 *  the primitive to know about phraseCandidates / observations /
 *  performance.formatPerformance / etc. */
export interface VoiceCardSummary {
  /** Mongo ObjectId hex — used as the popover key + cache discriminant. */
  id: string;
  /** Channel scope (cnt_voice_cards.channel). */
  channel: PlatformKey;
  /** Category scope (cnt_voice_cards.category) — e.g. "thought_leadership". */
  category?: string;
  /** Short tone descriptors that summarise the card. */
  toneAdjectives: string[];
  /** Recurring "signature" phrases (cnt_voice_cards.voice.signaturePhrases). */
  signaturePhrases: string[];
  /** "Avoid" phrases the learner has flagged. */
  avoidPhrases: string[];
  /** Last refresh timestamp (ISO) — shown small in the popover footer. */
  refreshedAt?: string;
}

/** Media asset shape that `<MediaPicker/>` lists + returns on
 *  selection. Backed by `cnt_media` in peakhour-mongodb (or by a
 *  session shim until the R2 wiring lands per
 *  [[project_media_manager_r2_plan]]). */
export interface MediaAsset {
  /** Stable id for the asset — Mongo ObjectId hex once R2 ships. */
  id: string;
  /** Public URL (R2 presigned or data URL during the shim phase). */
  url: string;
  /** Optional alt-text (a11y + carried into the publish payload). */
  alt?: string;
  /** MIME type, used to drive the per-platform aspect-ratio chip and
   *  to filter pickable types per host (e.g. X composer = images only;
   *  Beehiiv = images + videos). */
  mime: string;
  /** Width / height in pixels (so the grid can render placeholders at
   *  the right aspect ratio without flashing). */
  width?: number;
  height?: number;
  /** Pixel byte-size — shown in the popover footer + used by the
   *  per-platform-size warning chip. */
  bytes?: number;
  /** Tags (auto-derived from filename + any user-applied chips). */
  tags?: string[];
  /** Source — distinguishes uploaded assets from AI-generated. The
   *  picker shows a small badge per source on each tile. */
  source: "upload" | "ai_image" | "ai_video";
  /** ISO created-at — drives "Recent" sort + "uploaded N days ago". */
  createdAt: string;
}

/** Status field shown by `<DraftSaver/>` and used by hosts to
 *  decide whether to allow publish (you can't publish while a save
 *  is in flight without risking lost edits). */
export type DraftSaveStatus = "idle" | "saving" | "saved" | "error";

/** A user/mention candidate returned by the host's mention-search
 *  handler. Generic across X and LinkedIn — the host maps its
 *  platform-specific search payload into this shape. */
export interface MentionCandidate {
  /** Platform-specific identifier (X user id, LinkedIn URN, etc.). */
  id: string;
  /** Handle / username as the user typed it (no leading @). */
  handle: string;
  /** Display name (e.g. "Jane Doe"). */
  displayName?: string;
  /** Avatar URL — optional; falls back to initials. */
  avatarUrl?: string;
  /** Verified badge marker (X blue check / LinkedIn premium). */
  verified?: boolean;
}

/** Hashtag candidate returned by host's hashtag-search handler. */
export interface HashtagCandidate {
  /** Tag without the leading #. */
  tag: string;
  /** Optional usage-count hint shown right-aligned in the chip
   *  (formatted as 1.2k, 850, etc. by the primitive). */
  usageCount?: number;
}
