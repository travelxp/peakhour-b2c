import type {
  InsightWindow,
  MetaInstagramAccountInsights,
  MetaMediaInsights,
  MetaPageInsights,
  MetaPostInsights,
} from "@/lib/api/meta-content";

/**
 * View rules for the Facebook and Instagram hubs, kept out of the components so
 * they can be tested. Two rules run through all of it:
 *  - a figure Meta did not report is "Not available", never 0;
 *  - copy is plain English with no Meta jargon.
 */

export type InsightDays = 7 | 28;

/**
 * Parse a timestamp as Graph sends it ("2026-11-01T08:00:00+0000"). Safari does not accept an offset
 * without its colon, so it is added; an unparseable value is null, never "Invalid Date".
 */
export function parseGraphTime(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The last `days` days ending today (UTC), both ends inclusive, as the api expects. */
export function windowFor(days: InsightDays, now: Date = new Date()): InsightWindow {
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since = new Date(until.getTime() - (days - 1) * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { since: iso(since), until: iso(until) };
}

/** A count for a tile. `null` is "Not available", and a real 0 stays "0". */
export function formatFigure(n: number | null | undefined): string {
  if (n === null || n === undefined) return "Not available";
  return new Intl.NumberFormat("en-US", { notation: n >= 100_000 ? "compact" : "standard" }).format(n);
}

/** A plain-English reason for a missing figure, from the api's reason code. */
export function reasonText(code: string | undefined): string | undefined {
  if (!code) return undefined;
  if (code.startsWith("insights_request_failed")) return "Meta is not sharing this figure right now.";
  if (code.startsWith("graph_did_not_return") || code.startsWith("post_node_omitted")) {
    return "Meta did not report this figure.";
  }
  if (code.startsWith("post_node_request_failed")) return "Meta could not be reached for this figure.";
  if (code.startsWith("graph_returned_non_numeric")) return "Meta sent this figure in a form we cannot show.";
  if (code.startsWith("profile_did_not_return")) return "Meta did not report this figure.";
  return "Not available.";
}

export interface Tile {
  key: string;
  label: string;
  /** What the number means, one sentence. */
  help: string;
  value: number | null;
  /** Why `value` is null. Present only when it is. */
  reason?: string;
}

const tile = (
  key: string,
  label: string,
  help: string,
  value: number | null,
  unavailable: Partial<Record<string, string>>,
): Tile => ({
  key,
  label,
  help,
  value,
  reason: value === null ? (reasonText(unavailable[key]) ?? "Meta did not report this figure.") : undefined,
});

export function pageOverviewTiles(i: MetaPageInsights): Tile[] {
  const u = i.unavailable;
  return [
    tile("followers", "Followers", "People following your Page today.", i.followers, u),
    tile("mediaViews", "Views", "How many times your posts, videos and stories were seen.", i.mediaViews?.total ?? null, u),
    tile("postEngagements", "Post engagements", "Reactions, comments, shares and clicks on your posts.", i.postEngagements?.total ?? null, u),
    tile("newFollows", "New followers", "People who started following your Page.", i.newFollows?.total ?? null, u),
    tile("pageViews", "Page visits", "Times your Page was opened.", i.pageViews?.total ?? null, u),
  ];
}

export function instagramOverviewTiles(i: MetaInstagramAccountInsights): Tile[] {
  const u = i.unavailable;
  // Meta's reference does not say whether follower_count is new follows or net of unfollows, so this
  // is a "change", not "new followers" (the api type says the same).
  const followerChange = i.followerSeries ? i.followerSeries.reduce((n, p) => n + p.value, 0) : null;
  return [
    tile("followers", "Followers", "People following your account today.", i.followers, u),
    tile("views", "Views", "How many times your posts, reels and stories were seen.", i.views, u),
    tile("reach", "Accounts reached", "Different accounts that saw your content.", i.reach, u),
    tile("accountsEngaged", "Accounts engaged", "Different accounts that liked, commented, saved or shared.", i.accountsEngaged, u),
    tile("totalInteractions", "Interactions", "Likes, comments, saves and shares.", i.totalInteractions, u),
    tile("followerSeries", "Follower change", "How your follower count changed over this period.", followerChange, u),
  ];
}

export function postInsightTiles(i: MetaPostInsights): Tile[] {
  const u = i.unavailable;
  return [
    tile("mediaViews", "Views", "Times this post was seen.", i.mediaViews, u),
    tile("mediaViewers", "People reached", "Different people who saw it.", i.mediaViewers, u),
    tile("reactions", "Reactions", "Likes, loves and other reactions.", i.reactions, u),
    tile("comments", "Comments", "Comments on the post.", i.comments, u),
    tile("shares", "Shares", "Times it was shared.", i.shares, u),
    tile("clicks", "Clicks", "Clicks on the post.", i.clicks, u),
    tile("engagedUsers", "People engaged", "Different people who reacted, commented, shared or clicked.", i.engagedUsers, u),
  ];
}

export function mediaInsightTiles(i: MetaMediaInsights): Tile[] {
  const u = i.unavailable;
  return [
    tile("views", "Views", "Times this was seen.", i.views, u),
    tile("reach", "Accounts reached", "Different accounts that saw it.", i.reach, u),
    tile("engagement", "Interactions", "Likes, comments, saves and shares.", i.engagement, u),
    tile("saved", "Saves", "People who saved it.", i.saved, u),
  ];
}

/** First line of a post, trimmed to `max` characters, or a stand-in for a post with no text. */
export function postExcerpt(text: string | undefined, max = 140, empty = "No text"): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return empty;
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

const IG_TYPES: Record<string, string> = {
  IMAGE: "Photo",
  VIDEO: "Video",
  CAROUSEL_ALBUM: "Carousel",
  REELS: "Reel",
};

export function mediaTypeLabel(t: string): string {
  return IG_TYPES[t] ?? "Post";
}

/** The picture for a post row: a thumbnail when Meta gives one, else the media itself unless it is a video. */
export function mediaThumbnail(m: { mediaType: string; mediaUrl?: string; thumbnailUrl?: string }): string | undefined {
  if (m.thumbnailUrl) return m.thumbnailUrl;
  return m.mediaType === "VIDEO" || m.mediaType === "REELS" ? undefined : m.mediaUrl;
}

export type HubState =
  | "loading"
  | "not_connected"
  | "needs_reauth"
  | "needs_permission"
  | "capability_off"
  | "empty"
  | "error"
  | "ready";

export interface HubStateInput {
  loading: boolean;
  error?: { status?: number; code?: string } | null;
  /** Pages (Facebook hub) or linked Instagram accounts (Instagram hub). */
  count: number;
}

/** What the hub shows, decided in one place so each state has a test. */
export function hubState(s: HubStateInput): HubState {
  if (s.loading) return "loading";
  if (s.error) {
    // The api's codes (peakhour-api routes/meta-content handleCapabilityError).
    if (s.error.code === "NEEDS_REAUTH") return "needs_reauth";
    if (s.error.code === "CAPABILITY_DISABLED") return "capability_off";
    if (s.error.status === 404) return "not_connected";
    if (s.error.status === 403) return "needs_permission";
    return "error";
  }
  return s.count === 0 ? "empty" : "ready";
}
