import { periodDelta, SMALL_BASE, type PeriodDelta } from "@/lib/period-delta";
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

/**
 * The last `days` complete days ending yesterday (UTC), both ends inclusive, as the api expects.
 * Today is left out: it is partial and Meta reports it late, so it would read as a false fall
 * against the previous, complete, period.
 */
export function windowFor(days: InsightDays, now: Date = new Date()): InsightWindow {
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 86_400_000);
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

/**
 * The saved Page's (or Instagram account's) row first, the rest in the order given. The api names it
 * (`activePageId` / `activeAccountId`); every picker defaults to its first row, so ordering is the
 * whole contract and a screen cannot forget to apply it. An unknown or missing id changes nothing.
 */
export function activeFirst<T extends { id: string }>(items: T[], activeId: string | null | undefined): T[] {
  const at = activeId ? items.findIndex((i) => i.id === activeId) : -1;
  return at <= 0 ? items : [items[at]!, ...items.slice(0, at), ...items.slice(at + 1)];
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

/* ------------------------------------------------------------------------------------------------
 * Trends: what changed against the previous period, and what to do about it.
 * Free and deterministic (no model call), in the style of analytics-actions.ts.
 * ---------------------------------------------------------------------------------------------- */

const DAY_MS = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** The window of the same length that ends the day before `w` starts (both ends inclusive, UTC). */
export function previousWindow(w: InsightWindow): InsightWindow {
  const days = Math.round((dayMs(w.until) - dayMs(w.since)) / DAY_MS) + 1;
  const until = dayMs(w.since) - DAY_MS;
  return { since: isoDay(until - (days - 1) * DAY_MS), until: isoDay(until) };
}

/**
 * Tiles that are a snapshot or a net change, not a total for the window. Followers is "today" in
 * both windows, and the Instagram follower change can be negative, so a percentage of either would
 * be false precision. They get no chip.
 */
export const NON_COMPARABLE_TILES: readonly string[] = ["followers", "followerSeries"];

/**
 * How one tile changed, by the shared `periodDelta` rules (a previous 0 or a small base is a count,
 * "+12", never an infinite %), so this screen agrees with Home and Search Console. null (no chip)
 * when either figure is missing, when both are 0, or for a tile that is not a window total.
 */
export function tileChange(key: string, current: number | null, previous: number | null): PeriodDelta | null {
  if (NON_COMPARABLE_TILES.includes(key)) return null;
  if (current === null || previous === null) return null;
  if (current === 0 && previous === 0) return null;
  return periodDelta(current, previous);
}

/** "the previous 28 days" for a note or a spoken sentence. */
export const previousPeriodPhrase = (days: InsightDays) => `the previous ${days} days`;

/** Key to value, for a missing tile null. */
function byKey(tiles: Tile[] | undefined): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const t of tiles ?? []) out[t.key] = t.value;
  return out;
}

/** Previous values under this are too small for a percentage to mean anything, so no line is written. */
export const INSIGHT_MIN_PREVIOUS = SMALL_BASE;
/** A rise of at least this many percent in views or reach is worth saying out loud. */
export const INSIGHT_RISE_PCT = 25;
/** A fall of at least this many percent in views or reach needs attention. */
export const INSIGHT_FALL_PCT = 25;
/** A fall of at least this many percent in engagement needs attention. */
export const INSIGHT_ENGAGEMENT_FALL_PCT = 25;
/** No post in this many days is named, because Meta shows fewer people an account that has gone quiet. */
export const INSIGHT_QUIET_DAYS = 7;
/** Posts in the last INSIGHT_QUIET_DAYS from which an account counts as posting regularly. */
export const INSIGHT_REGULAR_POSTS = 2;

export interface MetaInsightLine {
  id: string;
  group: "improving" | "declining" | "attention";
  text: string;
}

/** Posts in the last INSIGHT_QUIET_DAYS, or null when dates cannot be read (never a guessed 0). */
export function countRecentPosts(dates: string[], now: Date = new Date()): number | null {
  const times = dates.map((d) => parseGraphTime(d)?.getTime());
  // One unreadable date makes the count unknown: dropping it could turn "posted yesterday" into 0.
  if (times.some((t) => t === undefined)) return null;
  const cutoff = now.getTime() - INSIGHT_QUIET_DAYS * DAY_MS;
  return times.filter((t) => t !== undefined && t >= cutoff).length;
}

const HEADLINE: Record<"facebook" | "instagram", { key: string; noun: string }> = {
  facebook: { key: "mediaViews", noun: "Views" },
  instagram: { key: "reach", noun: "Accounts reached" },
};
const ENGAGEMENT: Record<"facebook" | "instagram", { key: string; noun: string }> = {
  facebook: { key: "postEngagements", noun: "Post engagements" },
  instagram: { key: "totalInteractions", noun: "Interactions" },
};

/**
 * Up to four plain-language lines about what is improving, declining or needs attention.
 * `recentPosts` is null while the posts list is not loaded, which silences the quiet-account line.
 */
export function metaInsightActions(input: {
  channel: "facebook" | "instagram";
  days: InsightDays;
  current: Tile[];
  previous: Tile[] | undefined;
  recentPosts: number | null;
}): MetaInsightLine[] {
  const { channel, days } = input;
  const cur = byKey(input.current);
  const prev = byKey(input.previous);
  const vs = previousPeriodPhrase(days);
  const lines: MetaInsightLine[] = [];

  /** Signed, rounded percent change from the same `periodDelta` the tile chip shows, so a line and
   *  its chip never disagree; null when either figure is missing or the base is too small to trust. */
  const pct = (key: string): number | null => {
    const d = periodDelta(cur[key], prev[key], { smallBase: INSIGHT_MIN_PREVIOUS });
    if (!d || d.basis !== "percent") return null;
    return d.direction === "down" ? -d.amount : d.amount;
  };

  const head = HEADLINE[channel];
  const headPct = pct(head.key);
  if (headPct !== null && headPct >= INSIGHT_RISE_PCT) {
    lines.push({ id: "reach_up", group: "improving", text: `${head.noun} are up ${headPct}% on ${vs}. Keep posting what worked.` });
  }
  if (headPct !== null && -headPct >= INSIGHT_FALL_PCT) {
    // "Post more often" is advice only for an account that posts rarely; one that already posts
    // regularly is told to change what it posts. An unknown count gets the neutral advice.
    const advice =
      input.recentPosts !== null && input.recentPosts < INSIGHT_REGULAR_POSTS
        ? "post more often this week"
        : "try a different kind of post this week, like the ones that did best";
    lines.push({ id: "reach_down", group: "declining", text: `${head.noun} fell ${-headPct}% on ${vs}: ${advice}.` });
  }
  const eng = ENGAGEMENT[channel];
  const engPct = pct(eng.key);
  if (engPct !== null && -engPct >= INSIGHT_ENGAGEMENT_FALL_PCT) {
    lines.push({ id: "engagement_down", group: "declining", text: `${eng.noun} fell ${-engPct}% on ${vs}: ask a question or share something people can react to.` });
  }
  // A fall already told to "post more often" carries the quiet account's point; say it once.
  if (input.recentPosts === 0 && !lines.some((l) => l.id === "reach_down")) {
    lines.push({ id: "quiet", group: "attention", text: `No posts in the last ${INSIGHT_QUIET_DAYS} days.` });
  }

  const order = { improving: 0, declining: 1, attention: 2 } as const;
  return lines.sort((a, b) => order[a.group] - order[b.group]);
}
