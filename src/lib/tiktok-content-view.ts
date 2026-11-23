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
  key: "privacy" | "commercial_kind" | "duration" | "duration_unknown" | "media";
  message: string;
}

/** What the sheet knows about the video's length: not yet, unreadable, or a number of seconds. */
export type VideoLength = { state: "checking" } | { state: "unreadable" } | { state: "known"; seconds: number };

/**
 * Why Post is disabled. Empty means the sheet may offer Post. A video's length must be KNOWN before Post is offered: an unread or unreadable
 * video cannot be checked against the account's limit, so it never passes by default.
 */
export function postProblems(
  c: PostChoices,
  media: { kind: "video"; length: VideoLength } | { kind: "photos" } | { kind: "none" },
  maxVideoPostDurationSec?: number | null,
): PostProblem[] {
  const out: PostProblem[] = [];
  if (!c.privacy) out.push({ key: "privacy", message: "Choose who can see this post." });
  if (c.commercial && !c.yourBrand && !c.brandedContent) {
    out.push({ key: "commercial_kind", message: "Say whether this promotes your own brand, a paid partnership, or both." });
  }
  if (media.kind === "none") out.push({ key: "media", message: "This post has no video or photos yet." });
  if (media.kind === "video") {
    const len = media.length;
    if (len.state === "checking") out.push({ key: "duration_unknown", message: "Checking the length of your video." });
    else if (len.state === "unreadable") {
      out.push({ key: "duration_unknown", message: "We could not read this video, so we cannot check its length. Choose another video." });
    } else if (typeof maxVideoPostDurationSec === "number" && len.seconds > maxVideoPostDurationSec) {
      out.push({
        key: "duration",
        message: `This video is ${Math.round(len.seconds)} seconds long. This TikTok account can post videos up to ${maxVideoPostDurationSec} seconds.`,
      });
    }
  }
  return out;
}

// -- Media --------------------------------------------------------------------------------------------

/**
 * What the composer holds, judged by mime type (never by file name): video/* is a video, image/* is a photo, anything else is not something
 * TikTok takes. A post is one video, or photos, never both.
 */
export function mediaKind(mimes: string[]): "none" | "video" | "photos" | "mixed" | "many_videos" | "unsupported" {
  if (mimes.length === 0) return "none";
  const videos = mimes.filter((m) => m.startsWith("video/")).length;
  const images = mimes.filter((m) => m.startsWith("image/")).length;
  if (videos + images < mimes.length) return "unsupported";
  if (videos > 0 && images > 0) return "mixed";
  if (videos > 1) return "many_videos";
  return videos === 1 ? "video" : "photos";
}

/** `channelOptions.mediaType` the item is committed with. */
export function mediaTypeOf(mimes: string[]): "video" | "photo" {
  return mimes.some((m) => m.startsWith("video/")) ? "video" : "photo";
}

/** The message under the picker when the post holds something TikTok does not take. Null when it is fine. */
export function mediaRefusal(mimes: string[]): string | null {
  switch (mediaKind(mimes)) {
    case "mixed":
      return "A TikTok post is one video or photos, not both. Remove the video or remove the photos.";
    case "many_videos":
      return "A TikTok post takes one video. Remove the extra videos.";
    case "unsupported":
      return "TikTok takes a video or photos only. Remove the file that is neither.";
    default:
      return null;
  }
}

/** True for an item committed as a video. Read from `channelOptions.mediaType`, which the composer set from the file's type. */
export function isVideoItem(item: Pick<ScheduledItemDto, "payload">): boolean {
  const opts = item.payload.channelOptions as { mediaType?: unknown } | undefined;
  return opts?.mediaType === "video";
}

// -- Status -------------------------------------------------------------------------------------------

export type TikTokStatus = "saved" | "approved" | "waiting" | "choose_privacy" | "sending" | "retrying" | "published" | "failed" | "cancelled" | "attention";

export interface TikTokStatusView {
  status: TikTokStatus;
  label: string;
  /** One plain sentence under the chip. */
  detail: string;
  tone: "neutral" | "info" | "success" | "warning" | "destructive";
  /** The button the row offers: Post to TikTok for an item with no choices yet, Open for one that needs a choice, Edit for one whose choices are saved, none otherwise. */
  action: "post" | "open" | "edit" | null;
}

export const COMING_SOON_CODE = "tiktok_coming_soon";
export const PRIVACY_REQUIRED_CODE = "tiktok_privacy_required";

/** True once the post sheet has saved this item's privacy level. */
export function hasSavedChoices(item: Partial<Pick<ScheduledItemDto, "payload">>): boolean {
  const opts = item.payload?.channelOptions as { privacyLevel?: unknown } | undefined;
  return typeof opts?.privacyLevel === "string" && opts.privacyLevel !== "";
}

/** The code the scheduler parked the item with: the last attempt's error. */
export function lastErrorCode(item: Pick<ScheduledItemDto, "attempts">): string | undefined {
  return item.attempts?.at(-1)?.errorCode;
}

/**
 * The state of a TikTok item, in words, from the api's own status and nothing else. A post is "Published" only when the scheduler holds the
 * link; published without one reads "Published, link coming".
 */
export function tiktokStatusView(item: Pick<ScheduledItemDto, "status"> & Partial<Pick<ScheduledItemDto, "externalUrl" | "attempts" | "payload">>): TikTokStatusView {
  switch (item.status) {
    case "published":
      return item.externalUrl
        ? { status: "published", label: "Published", detail: "This post is on TikTok.", tone: "success", action: null }
        : { status: "published", label: "Published, link coming", detail: "TikTok has the post. The link will show here soon.", tone: "success", action: null };
    case "in_flight":
      return { status: "sending", label: "Sending…", detail: "Your post is being sent to TikTok.", tone: "info", action: null };
    case "awaiting_retry":
      return { status: "retrying", label: "Retrying", detail: "TikTok did not take it yet. We will try again shortly.", tone: "warning", action: null };
    case "needs_action": {
      const code = lastErrorCode(item);
      if (code === COMING_SOON_CODE) {
        return {
          status: "waiting",
          label: "Waiting for TikTok approval",
          detail: "Your post is saved. It will publish once TikTok approves Peakhour.",
          tone: "warning",
          action: null,
        };
      }
      if (code === PRIVACY_REQUIRED_CODE) {
        return { status: "choose_privacy", label: "Choose who can watch it", detail: "TikTok needs to know who can see this post.", tone: "warning", action: "open" };
      }
      return { status: "attention", label: "Needs attention", detail: "TikTok needs something from you before this can go out.", tone: "warning", action: null };
    }
    case "failed":
      return { status: "failed", label: "Not posted", detail: "TikTok did not take this post. Nothing was published.", tone: "destructive", action: null };
    case "cancelled":
    case "skipped":
      return { status: "cancelled", label: "Cancelled", detail: "This post was cancelled and will not go out.", tone: "neutral", action: null };
    default:
      // queued or ready. Choices already saved (a privacy level is the one thing a post cannot go without) means it is on its way.
      return hasSavedChoices(item)
        ? { status: "saved", label: "Saved. Sending soon.", detail: "Your choices are saved. You can still edit them.", tone: "info", action: "edit" }
        : { status: "approved", label: "Approved. Choose how it posts.", detail: "Open it to choose who can see it.", tone: "info", action: "post" };
  }
}

/** Where a link to an item lands: the channel page opens the sheet on `?post=<id>`. */
export function tiktokPostHref(itemId: string): string {
  return `${TIKTOK_PATH}?post=${encodeURIComponent(itemId)}`;
}

// -- What Post answered ---------------------------------------------------------------------------------

/** publish-now's answer (peakhour-api scheduler route): the outcome, the code when parked, and whether it went out. */
export interface PublishNowAnswer {
  outcome?: string;
  code?: string;
  published?: boolean;
}

export interface PostAnswer {
  kind: "posted" | "waiting" | "choose_privacy" | "needs_attention" | "failed" | "saved";
  /** Plain words, and what to do. */
  text: string;
}

export const SAVED_SHORTLY_MESSAGE = "Your choices are saved. It will go out shortly.";

/**
 * What the sheet says after Post, from publish-now's own answer and nothing else. "Waiting for TikTok approval" is said only when the api parked
 * the item as tiktok_coming_soon; a refused or failed publish-now (answer is null) says the choices are saved and nothing more.
 */
export function postAnswer(answer: PublishNowAnswer | null): PostAnswer {
  if (!answer) return { kind: "saved", text: SAVED_SHORTLY_MESSAGE };
  if (answer.published === true || answer.outcome === "published") return { kind: "posted", text: "Posted to TikTok." };
  if (answer.outcome === "needs_action") {
    if (answer.code === COMING_SOON_CODE) return { kind: "waiting", text: TIKTOK_COMING_SOON_MESSAGE };
    if (answer.code === PRIVACY_REQUIRED_CODE) {
      return { kind: "choose_privacy", text: "TikTok needs to know who can watch this post. Choose an audience above, then press Post again." };
    }
    return { kind: "needs_attention", text: "TikTok needs something from you before this can go out. Your choices are saved; open the post on the calendar to see what." };
  }
  if (answer.outcome === "permanent_error") {
    return { kind: "failed", text: "TikTok did not take this post, and nothing was published. Your choices are saved." };
  }
  return { kind: "saved", text: SAVED_SHORTLY_MESSAGE };
}
