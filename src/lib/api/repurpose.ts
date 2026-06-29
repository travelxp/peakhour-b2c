import { api } from "@/lib/api";

/**
 * Typed client for the W4 PlatformRecommender + W6 engine API
 * surface shipped in peakhour-api PRs #324 (/recommend-platforms) +
 * #325 (/repurpose). Matches the response shapes returned by those
 * endpoints; if the API contract changes, update this file and the
 * consumers (RepurposeSheet, useRepurpose hook).
 */

// ── Shared types ──────────────────────────────────────────

export type PlatformFitBand = "green" | "amber" | "grey";

export type PlatformFitHardBlock =
  | "text_too_long_to_compress"
  | "no_media"
  | "incompatible_media_type"
  | "channel_deprecated"
  | "unknown_channel";

export interface PlatformRecommendation {
  /** cfg_channels.key — flat lowercase alphanumeric ("linkedin", "x", …) */
  channel: string;
  /** 0–100 composite fit score. INTERNAL — sort key / band threshold only.
   *  Per plan §4.5 it is deliberately NOT rendered to the user (false
   *  precision); the band + rationale carry everything actionable. */
  fitScore: number;
  band: PlatformFitBand;
  /** One-line rationale, safe to render verbatim in the UI */
  rationale: string;
  /** The hook/angle to lead with on this channel — set by the LLM
   *  recommender (tier "industry"/"personal"). Previews how the piece would
   *  read on the channel AND seeds the write skill. Absent on rules-tier rows. */
  suggestedAngle?: string;
  /** Present iff the recommender forced grey regardless of soft signals */
  hardBlocks?: PlatformFitHardBlock[];
  /** "linkedin@1.0.0" — useful for ops dashboards, not user-facing */
  adapterVersion: string;
  tier: "rules" | "industry" | "personal";
}

/**
 * Discriminated source union shared by both endpoints. ad_hoc carries
 * title + text inline (paste-and-repurpose composer); the other three
 * are persisted-source references the API loads server-side.
 */
export type RepurposeSource =
  | { type: "draft"; draftId: string }
  | { type: "idea"; ideaId: string }
  | { type: "published_post"; socialPostId: string }
  | {
      type: "ad_hoc";
      title: string;
      text: string;
      tags?: string[];
      hasMedia?: boolean;
    };

// ── POST /v1/content/recommend-platforms ──────────────────

export interface RecommendPlatformsResponse {
  /** cnt_platform_fit._id — pass back to /repurpose so the user's
   *  confirmed platforms[] stamps userResponse on the same audit row. */
  platformFitId: string;
  recommendations: PlatformRecommendation[];
  /** Count of channels the business has connected. UI uses this to
   *  show a "connect a channel" affordance when 0. */
  connectedChannelsCount: number;
}

export async function recommendPlatforms(
  source: RepurposeSource,
): Promise<RecommendPlatformsResponse> {
  return api.request<RecommendPlatformsResponse>(
    "/v1/content/recommend-platforms",
    {
      method: "POST",
      body: JSON.stringify({ source }),
    },
  );
}

// ── POST /v1/content/repurpose ────────────────────────────

/**
 * One generated variant. The engine returns a single doc per
 * /repurpose call with `adaptations[]` covering all confirmed
 * platforms (LinkedIn → 1 entry; X → 2 entries: "post" + "thread";
 * stub platforms filtered out before persist).
 */
export interface RepurposedAdaptation {
  /** Channel key (matches PlatformRecommendation.channel) */
  platform: string;
  /** "post" | "thread" | etc. — content type within the channel */
  contentType: string;
  content: string;
  hashtags?: string[];
  hook?: string;
  estimatedEngagement: number;
  reasoning?: string;
  /** Extra per-channel metadata (e.g. X thread carries metadata.tweets) */
  metadata?: Record<string, unknown>;
}

export interface RepurposeFailure {
  platform: string;
  error: string;
}

/**
 * A long-form blog draft produced by the blog_article path (WordPress /
 * Shopify). Unlike social adaptations (soc_social_posts), these persist to
 * cnt_drafts as `pending_approval` — the merchant reviews + publishes them
 * from the content dashboard (or, later, the scheduler). One row per channel.
 */
export interface BlogDraftResult {
  /** cfg_channels.key — "wordpress" | "shopify" */
  channel: string;
  /** cnt_drafts._id (string) of the saved blog draft */
  draftId: string;
  title: string;
  /** Which body markup was stored: Gutenberg blocks vs classic HTML. */
  format: "blocks" | "classic";
}

export interface RepurposeResponse {
  /** soc_social_posts._id (string) when at least one variant was
   *  persisted; null when every requested platform failed or was a
   *  coming-soon stub (Facebook / Instagram / Threads). */
  socialPostId: string | null;
  sourceTitle: string;
  adaptations: RepurposedAdaptation[];
  /** Long-form blog drafts (cnt_drafts) — populated when a blog_article
   *  destination (WordPress/Shopify) was requested + connected. Empty for
   *  the social-only path. */
  blogDrafts: BlogDraftResult[];
  failedPlatforms: RepurposeFailure[];
  /** True when the route's idempotency short-circuit returned a
   *  prior post instead of generating fresh variants. UI can show
   *  "showing your previous repurpose" if it matters for context. */
  idempotent?: boolean;
}

export interface RepurposeRequest {
  source: RepurposeSource;
  platforms: string[];
  /** Pass the platformFitId from the prior /recommend-platforms call
   *  to (a) stamp userResponse on the cnt_platform_fit row for the
   *  closed-loop training signal, AND (b) opt into the idempotency
   *  short-circuit (double-POST returns the prior post instead of
   *  re-generating). */
  platformFitId?: string;
}

export async function repurpose(req: RepurposeRequest): Promise<RepurposeResponse> {
  return api.request<RepurposeResponse>("/v1/content/repurpose", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ── Channel display metadata ──────────────────────────────
// Renders the platform name + icon hint in the picker UI. Stays in
// lockstep with the cfg_channels keys server-side. Adding a new
// channel here is purely cosmetic — the recommender/engine work
// regardless once the cfg_channels seed + adapter ships.

export interface ChannelDisplay {
  label: string;
  /** Lucide icon name OR null for channels we don't have a brand-true
   *  icon for. Renderer falls back to a generic chip. */
  icon:
    | "linkedin"
    | "twitter"
    | "facebook"
    | "instagram"
    | "message-circle"
    | "globe"
    | "shopping-bag"
    | null;
  /** Long-form blog destination (WordPress/Shopify) → the result is a saved
   *  cnt_drafts article (pending approval), not a social variant. Lets the UI
   *  branch the recommend/done rendering on a capability, not a channel name. */
  isBlog?: boolean;
}

export const CHANNEL_DISPLAY: Record<string, ChannelDisplay> = {
  linkedin: { label: "LinkedIn", icon: "linkedin" },
  x: { label: "X (Twitter)", icon: "twitter" },
  facebook: { label: "Facebook", icon: "facebook" },
  instagram: { label: "Instagram", icon: "instagram" },
  threads: { label: "Threads", icon: "message-circle" },
  // blog_article destinations — the result is a long-form article draft.
  wordpress: { label: "WordPress", icon: "globe", isBlog: true },
  shopify: { label: "Shopify blog", icon: "shopping-bag", isBlog: true },
};

export function getChannelDisplay(channel: string): ChannelDisplay {
  return CHANNEL_DISPLAY[channel] ?? { label: channel, icon: null };
}

// ── Band → visual styling (Tailwind classes) ──────────────
// One place so the chip / row / badge stays consistent across the
// sheet, suggested-drafts card preview, and any future surface.

// Band copy follows plan §4.5 — qualitative, SME-friendly, never a raw %.
export const BAND_STYLES: Record<PlatformFitBand, { dot: string; chip: string; label: string }> = {
  green: {
    dot: "bg-emerald-500",
    chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    label: "Recommended",
  },
  amber: {
    dot: "bg-amber-500",
    chip: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    label: "Worth a try",
  },
  grey: {
    dot: "bg-slate-400",
    chip: "border-slate-400/40 bg-slate-400/10 text-slate-600 dark:text-slate-400",
    label: "Not a fit",
  },
};
