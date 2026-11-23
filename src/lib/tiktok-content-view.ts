import type { ScheduledItemDto } from "@/lib/scheduler/types";
import type { ContentHubIntegration } from "@/lib/nav-queries";

/**
 * TikTok in the Content engine: the pure decisions, one place each, so each has a test.
 *
 * TIKTOK PUBLISHING IS NOT OPEN. Nothing here says a post went live: the Post button saves a request and the status reads
 * "Waiting for TikTok approval" until TikTok approves Peakhour. The wording below is the only place those words live.
 */

export const TIKTOK_PROVIDER = "tiktok";
export const TIKTOK_PATH = "/dashboard/content/tiktok";
export const TIKTOK_CHANNEL = "tiktok";

/** The one sentence the Post button answers with. Merchant-facing, and the only claim made about what happens next. */
export const TIKTOK_COMING_SOON_MESSAGE =
  "TikTok integration is coming soon. Your post is saved and will publish once TikTok approves Peakhour.";

/** The api's `tiktok` row is `available` for a preview org and `coming_soon` for everyone else. Anything else (a failed list, no row) is not available. */
export function tiktokAvailable(integrations: ContentHubIntegration[] | undefined): boolean {
  return Array.isArray(integrations) && integrations.some((i) => i.provider === TIKTOK_PROVIDER && i.availability === "available");
}

// -- Creator info errors ------------------------------------------------------------------------------

export type TikTokAccountState = "ready" | "not_connected" | "needs_reauth" | "unavailable" | "error";

/** What the creator-info read means for the screen. NOT_CONNECTED and NEEDS_REAUTH (409) send the merchant to Reconnect; TIKTOK_UNAVAILABLE (502/503) is a plain retry. */
export function tiktokAccountState(error: { status?: number; code?: string } | null | undefined): TikTokAccountState {
  if (!error) return "ready";
  if (error.code === "NOT_CONNECTED") return "not_connected";
  if (error.code === "NEEDS_REAUTH") return "needs_reauth";
  if (error.code === "TIKTOK_UNAVAILABLE" || error.status === 502 || error.status === 503) return "unavailable";
  return "error";
}

// -- Post options -------------------------------------------------------------------------------------

/** TikTok's privacy values, in the words TikTok's own app uses. A value not listed reads as itself, never hidden. */
const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};
export const SELF_ONLY = "SELF_ONLY";

export function privacyLabel(value: string): string {
  return PRIVACY_LABELS[value] ?? value;
}

export interface PostChoices {
  privacy: string | null;
  commercial: boolean;
  yourBrand: boolean;
  brandedContent: boolean;
}

/** "Branded content" (a paid partnership) cannot be private; "Only me" is switched off while it is on. */
export function privacyDisabled(value: string, c: Pick<PostChoices, "commercial" | "brandedContent">): boolean {
  return value === SELF_ONLY && c.commercial && c.brandedContent;
}

/** The label TikTok shows on the post. Branded content is a paid partnership; your brand alone is promotional. */
export function commercialLabel(c: Pick<PostChoices, "commercial" | "yourBrand" | "brandedContent">): string | null {
  if (!c.commercial) return null;
  if (c.brandedContent) return "Paid partnership";
  if (c.yourBrand) return "Promotional content";
  return null;
}

export interface PostProblem {
  /** Stable key for tests. */
  key: "privacy" | "commercial_kind" | "duration";
  message: string;
}

/** Why Post is disabled. Empty means the sheet may offer Post. The duration check applies to a video only. */
export function postProblems(
  c: PostChoices,
  media: { kind: "video"; durationSec?: number | null } | { kind: "photos" },
  maxVideoPostDurationSec?: number,
): PostProblem[] {
  const out: PostProblem[] = [];
  if (!c.privacy) out.push({ key: "privacy", message: "Choose who can see this post." });
  if (c.commercial && !c.yourBrand && !c.brandedContent) {
    out.push({ key: "commercial_kind", message: "Say whether this promotes your own brand, a paid partnership, or both." });
  }
  if (c.privacy === SELF_ONLY && c.commercial && c.brandedContent) {
    out.push({ key: "privacy", message: "Branded content cannot be private. Choose a different audience." });
  }
  if (
    media.kind === "video" &&
    typeof maxVideoPostDurationSec === "number" &&
    typeof media.durationSec === "number" &&
    media.durationSec > maxVideoPostDurationSec
  ) {
    out.push({
      key: "duration",
      message: `This video is ${Math.round(media.durationSec)} seconds long. This TikTok account can post videos up to ${maxVideoPostDurationSec} seconds.`,
    });
  }
  return out;
}

// -- Status -------------------------------------------------------------------------------------------

export type TikTokStatus = "approved" | "waiting" | "published" | "failed" | "cancelled";

export interface TikTokStatusView {
  status: TikTokStatus;
  label: string;
  /** One plain sentence under the chip. */
  detail: string;
  tone: "neutral" | "info" | "success" | "warning" | "destructive";
}

const WAITING: Omit<TikTokStatusView, "status"> = {
  label: "Waiting for TikTok approval",
  detail: "Your post is saved. It will publish once TikTok approves Peakhour.",
  tone: "warning",
};

/**
 * The state of a TikTok item, in words. `requested` is true once the merchant pressed Post in this browser: nothing is sent to TikTok, so the
 * only honest name for that is waiting. An item the scheduler has parked (needs_action, which is what TikTok's switch-off answers with) reads
 * the same. "Published" is shown only when the scheduler holds a link to the live post.
 */
export function tiktokStatusView(item: Pick<ScheduledItemDto, "status" | "externalUrl">, requested = false): TikTokStatusView {
  switch (item.status) {
    case "published":
      return item.externalUrl
        ? { status: "published", label: "Published", detail: "This post is on TikTok.", tone: "success" }
        : { status: "waiting", ...WAITING };
    case "needs_action":
      return { status: "waiting", ...WAITING };
    case "failed":
      return { status: "failed", label: "Not posted", detail: "TikTok did not take this post. Nothing was published.", tone: "destructive" };
    case "cancelled":
    case "skipped":
      return { status: "cancelled", label: "Cancelled", detail: "This post was cancelled and will not go out.", tone: "neutral" };
    default:
      return requested
        ? { status: "waiting", ...WAITING }
        : { status: "approved", label: "Approved", detail: "Approved by you. Open it to choose how it posts.", tone: "info" };
  }
}

// -- "Post" requests, remembered for this browser tab -------------------------------------------------

const REQUESTED_KEY = "ph:tiktok-post-requested";

/** The ids of items whose Post button was pressed. sessionStorage can throw or be absent (private window): then nothing is remembered. */
export function readPostRequests(): Set<string> {
  try {
    const raw = globalThis.sessionStorage?.getItem(REQUESTED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function rememberPostRequest(itemId: string): void {
  try {
    const next = readPostRequests();
    next.add(itemId);
    globalThis.sessionStorage?.setItem(REQUESTED_KEY, JSON.stringify([...next]));
  } catch {
    /* nothing to remember it in; the sheet still answered */
  }
}

/** Where "Post to TikTok" lives for an item: the channel page opens the sheet on `?post=<id>`. */
export function tiktokPostHref(itemId: string): string {
  return `${TIKTOK_PATH}?post=${encodeURIComponent(itemId)}`;
}

/** A video is any file that says so. Photo posts have no Duet or Stitch, and the sheet hides them. */
export function isVideoPayload(mediaUrls: string[] | undefined): boolean {
  const first = mediaUrls?.[0];
  return typeof first === "string" && /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(first);
}
