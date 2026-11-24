import { describe, expect, it } from "vitest";
import {
  activeFirst,
  formatFigure,
  hubState,
  instagramOverviewTiles,
  mediaInsightTiles,
  mediaThumbnail,
  mediaTypeLabel,
  parseGraphTime,
  pageOverviewTiles,
  postExcerpt,
  postInsightTiles,
  reasonText,
  windowFor,
  previousWindow,
  tileChange,
  metaInsightActions,
  countRecentPosts,
  type Tile,
} from "./meta-content-view";

describe("windowFor", () => {
  it("is the last N complete days ending yesterday, both ends inclusive", () => {
    const now = new Date("2026-11-17T23:30:00Z");
    expect(windowFor(7, now)).toEqual({ since: "2026-11-10", until: "2026-11-16" });
    expect(windowFor(28, now)).toEqual({ since: "2026-10-20", until: "2026-11-16" });
  });
  it("crosses a month and a year boundary", () => {
    expect(windowFor(7, new Date("2027-01-03T00:00:00Z"))).toEqual({ since: "2026-12-27", until: "2027-01-02" });
  });
});

describe("parseGraphTime", () => {
  it("reads Graph's colon-less offset, which Safari rejects as written", () => {
    expect(parseGraphTime("2026-11-01T08:00:00+0000")?.toISOString()).toBe("2026-11-01T08:00:00.000Z");
    expect(parseGraphTime("2026-11-01T08:00:00+0530")?.toISOString()).toBe("2026-11-01T02:30:00.000Z");
    expect(parseGraphTime("2026-11-01T08:00:00-0800")?.toISOString()).toBe("2026-11-01T16:00:00.000Z");
    expect(parseGraphTime("2026-11-01T08:00:00Z")?.toISOString()).toBe("2026-11-01T08:00:00.000Z");
  });
  it("is null for nothing or nonsense, never Invalid Date", () => {
    expect(parseGraphTime(undefined)).toBeNull();
    expect(parseGraphTime("")).toBeNull();
    expect(parseGraphTime("not a date")).toBeNull();
  });
});

describe("mediaThumbnail", () => {
  it("uses Meta's thumbnail first, and never a video file as a picture", () => {
    expect(mediaThumbnail({ mediaType: "REELS", mediaUrl: "v.mp4", thumbnailUrl: "t.jpg" })).toBe("t.jpg");
    expect(mediaThumbnail({ mediaType: "VIDEO", mediaUrl: "v.mp4" })).toBeUndefined();
    expect(mediaThumbnail({ mediaType: "IMAGE", mediaUrl: "i.jpg" })).toBe("i.jpg");
    expect(mediaThumbnail({ mediaType: "CAROUSEL_ALBUM", mediaUrl: "v.mp4", thumbnailUrl: "c.jpg" })).toBe("c.jpg");
  });
});

describe("formatFigure", () => {
  it("null is Not available and a real zero is 0", () => {
    expect(formatFigure(null)).toBe("Not available");
    expect(formatFigure(undefined)).toBe("Not available");
    expect(formatFigure(0)).toBe("0");
    expect(formatFigure(1234)).toBe("1,234");
  });
});

describe("reasonText", () => {
  it("turns the api's codes into plain English with no codes in them", () => {
    for (const code of [
      "insights_request_failed:http_400_code_100",
      "graph_did_not_return_page_follows",
      "post_node_omitted_shares",
      "post_node_request_failed:http_400",
      "graph_returned_non_numeric_post_clicks",
      "profile_did_not_return_followers_count",
    ]) {
      const t = reasonText(code)!;
      expect(t).toBeTruthy();
      expect(t).not.toMatch(/code_|graph|http|_/i);
    }
    expect(reasonText(undefined)).toBeUndefined();
  });
});

describe("tiles keep absent apart from zero", () => {
  it("page overview", () => {
    const tiles = pageOverviewTiles({
      mediaViews: { total: 0, series: [] },
      postEngagements: null,
      newFollows: { total: 4, series: [] },
      pageViews: null,
      followers: 910,
      unavailable: { postEngagements: "insights_request_failed:http_400_code_100" },
    });
    const by = Object.fromEntries(tiles.map((t) => [t.key, t]));
    expect(by.mediaViews.value).toBe(0);
    expect(by.mediaViews.reason).toBeUndefined();
    expect(by.postEngagements.value).toBeNull();
    expect(by.postEngagements.reason).toMatch(/not sharing/);
    // No code recorded at all: still says it is unknown, never blank.
    expect(by.pageViews.value).toBeNull();
    expect(by.pageViews.reason).toBeTruthy();
    expect(by.followers.value).toBe(910);
  });

  it("instagram overview sums the follower series into a change, and null stays null", () => {
    const tiles = instagramOverviewTiles({
      reach: 5,
      views: null,
      accountsEngaged: 0,
      totalInteractions: 0,
      followers: 1200,
      followerSeries: [
        { date: "a", value: 2 },
        { date: "b", value: -1 },
      ],
      unavailable: { views: "insights_request_failed:http_400_code_100" },
    });
    const by = Object.fromEntries(tiles.map((t) => [t.key, t]));
    expect(by.followerSeries.label).toBe("Follower change");
    expect(by.followerSeries.value).toBe(1);
    expect(by.views.value).toBeNull();
    expect(by.accountsEngaged.value).toBe(0);
    const none = instagramOverviewTiles({
      reach: null,
      views: null,
      accountsEngaged: null,
      totalInteractions: null,
      followers: null,
      followerSeries: null,
      unavailable: {},
    });
    expect(none.every((t) => t.value === null && t.reason)).toBe(true);
  });

  it("post and media insights", () => {
    const post = postInsightTiles({
      mediaViews: 9,
      mediaViewers: null,
      engagedUsers: 0,
      reactions: 3,
      comments: 1,
      shares: null,
      clicks: 0,
      unavailable: { mediaViewers: "graph_did_not_return_post_total_media_view_unique", shares: "post_node_omitted_shares" },
    });
    expect(post.find((t) => t.key === "mediaViewers")!.value).toBeNull();
    expect(post.find((t) => t.key === "clicks")!.value).toBe(0);
    const media = mediaInsightTiles({ views: 7, reach: null, engagement: 0, saved: 0, unavailable: {} });
    expect(media.map((t) => t.value)).toEqual([7, null, 0, 0]);
  });
});

describe("postExcerpt", () => {
  it("collapses whitespace, trims long text and stands in for none", () => {
    expect(postExcerpt("  hello\n\n world ")).toBe("hello world");
    expect(postExcerpt(undefined)).toBe("No text");
    expect(postExcerpt("   ")).toBe("No text");
    const long = postExcerpt("a".repeat(300), 50);
    expect(long.length).toBe(50);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("mediaTypeLabel", () => {
  it("names the types and falls back", () => {
    expect(mediaTypeLabel("REELS")).toBe("Reel");
    expect(mediaTypeLabel("CAROUSEL_ALBUM")).toBe("Carousel");
    expect(mediaTypeLabel("STORY")).toBe("Post");
  });
});

describe("hubState", () => {
  const base = { loading: false, error: null, count: 2 };
  it("loading, not connected, missing permission, error", () => {
    expect(hubState({ ...base, loading: true })).toBe("loading");
    expect(hubState({ ...base, error: { status: 404 } })).toBe("not_connected");
    expect(hubState({ ...base, error: { status: 403, code: "CAPABILITY_SCOPE_MISSING" } })).toBe("needs_permission");
    expect(hubState({ ...base, error: { status: 500 } })).toBe("error");
    expect(hubState({ ...base, error: {} })).toBe("error");
  });
  it("a switched-off capability is not a reconnect, and a dead token IS one", () => {
    expect(hubState({ ...base, error: { status: 403, code: "CAPABILITY_DISABLED" } })).toBe("capability_off");
    expect(hubState({ ...base, error: { status: 409, code: "NEEDS_REAUTH" } })).toBe("needs_reauth");
  });
  it("connected with nothing to show is empty, otherwise ready", () => {
    expect(hubState({ ...base, count: 0 })).toBe("empty");
    expect(hubState(base)).toBe("ready");
  });
});

describe("activeFirst", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("moves the saved row to the front and keeps the rest in order", () => {
    expect(activeFirst(rows, "c").map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(activeFirst(rows, "b").map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
  it("changes nothing for no id, an unknown id, or the first row", () => {
    for (const id of [null, undefined, "zzz", "a"]) expect(activeFirst(rows, id).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
  it("does not mutate its input", () => {
    activeFirst(rows, "c");
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("previousWindow", () => {
  it("is the same length, ending the day before since (7 days)", () => {
    expect(previousWindow({ since: "2026-11-11", until: "2026-11-17" })).toEqual({ since: "2026-11-04", until: "2026-11-10" });
  });
  it("28 days, across a month boundary", () => {
    expect(previousWindow({ since: "2026-10-21", until: "2026-11-17" })).toEqual({ since: "2026-09-23", until: "2026-10-20" });
  });
  it("crosses a year boundary and a leap day", () => {
    expect(previousWindow({ since: "2027-01-03", until: "2027-01-09" })).toEqual({ since: "2026-12-27", until: "2027-01-02" });
    expect(previousWindow({ since: "2028-03-01", until: "2028-03-07" })).toEqual({ since: "2028-02-23", until: "2028-02-29" });
  });
  it("composes with windowFor", () => {
    const w = windowFor(7, new Date("2026-11-17T10:00:00Z"));
    expect(previousWindow(w).until).toBe("2026-11-09");
  });
});

describe("tileChange", () => {
  it("is a percent delta for ordinary totals", () => {
    const c = tileChange("reach", 150, 100);
    expect(c).toMatchObject({ direction: "up", tone: "good", basis: "percent", amount: 50 });
    expect(tileChange("reach", 50, 100)).toMatchObject({ direction: "down", tone: "bad" });
  });
  it("previous 0 and current above 0 is a count, as on Home, never an infinite percent", () => {
    expect(tileChange("reach", 12, 0)).toMatchObject({ direction: "up", basis: "absolute", amount: 12 });
  });
  it("both 0 has no chip", () => {
    expect(tileChange("reach", 0, 0)).toBeNull();
  });
  it("a missing figure in either window has no chip, never 0%", () => {
    expect(tileChange("reach", null, 10)).toBeNull();
    expect(tileChange("reach", 10, null)).toBeNull();
  });
  it("snapshot and net-change tiles never get a chip", () => {
    expect(tileChange("followers", 120, 100)).toBeNull();
    expect(tileChange("followerSeries", 5, -3)).toBeNull();
  });
});

const t = (key: string, value: number | null): Tile => ({ key, label: key, help: "", value });

describe("metaInsightActions", () => {
  const run = (cur: Record<string, number | null>, prev: Record<string, number | null> | undefined, recentPosts: number | null = 3, channel: "facebook" | "instagram" = "facebook", days: 7 | 28 = 28) =>
    metaInsightActions({
      channel,
      days,
      current: Object.entries(cur).map(([k, v]) => t(k, v)),
      previous: prev && Object.entries(prev).map(([k, v]) => t(k, v)),
      recentPosts,
    });

  it("names a rise at the threshold and not below it", () => {
    const at = run({ mediaViews: 125 }, { mediaViews: 100 });
    expect(at.map((l) => l.id)).toEqual(["reach_up"]);
    expect(at[0]!.text).toBe("Views are up 25% on the previous 28 days. Keep posting what worked.");
    expect(run({ mediaViews: 124 }, { mediaViews: 100 })).toEqual([]);
  });
  it("names a fall at the threshold and not above it", () => {
    const at = run({ mediaViews: 75 }, { mediaViews: 100 });
    expect(at.map((l) => l.id)).toEqual(["reach_down"]);
    expect(run({ mediaViews: 76 }, { mediaViews: 100 })).toEqual([]);
  });
  it("tells only a rarely-posting account to post more often", () => {
    const text = (posts: number | null) => run({ mediaViews: 50 }, { mediaViews: 100 }, posts)[0]!.text;
    expect(text(1)).toBe("Views fell 50% on the previous 28 days: post more often this week.");
    expect(text(2)).toBe("Views fell 50% on the previous 28 days: try a different kind of post this week, like the ones that did best.");
    expect(text(null)).toContain("try a different kind of post");
  });
  it("names an engagement fall at the threshold, with the channel's own word", () => {
    const at = run({ totalInteractions: 75 }, { totalInteractions: 100 }, 3, "instagram", 7);
    expect(at).toHaveLength(1);
    expect(at[0]!.text).toContain("Interactions fell 25% on the previous 7 days");
    expect(run({ totalInteractions: 76 }, { totalInteractions: 100 }, 3, "instagram")).toEqual([]);
  });
  it("says nothing when the previous base is under the minimum", () => {
    expect(run({ mediaViews: 5 }, { mediaViews: 19 })).toEqual([]);
    expect(run({ mediaViews: 5 }, { mediaViews: 20 })).toHaveLength(1);
  });
  it("says nothing about a metric that is missing, or when there is no previous period", () => {
    expect(run({ mediaViews: null }, { mediaViews: 100 })).toEqual([]);
    expect(run({ mediaViews: 10 }, undefined)).toEqual([]);
  });
  it("a previous 0 makes no percentage line", () => {
    expect(run({ mediaViews: 50 }, { mediaViews: 0 })).toEqual([]);
  });
  it("flags a quiet account only for a real 0, not an unknown count", () => {
    expect(run({}, {}, 0).map((l) => l.id)).toEqual(["quiet"]);
    expect(run({}, {}, 0)[0]!.text).toBe("No posts in the last 7 days.");
    expect(run({}, {}, 1)).toEqual([]);
    expect(run({}, {}, null)).toEqual([]);
  });
  it("every line implies an action, so every line carries a brief for Draft this post, in the channel's own name", () => {
    const lines = run({ mediaViews: 10_000, postEngagements: 10 }, { mediaViews: 100, postEngagements: 100 }, 0);
    expect(lines.map((l) => l.id)).toEqual(["reach_up", "engagement_down", "quiet"]);
    for (const l of lines) expect(l.draft).toMatch(/^Write a Facebook post\. /);
    const ig = run({ reach: 10_000 }, { reach: 100 }, 3, "instagram");
    expect(ig[0]!.draft).toMatch(/^Write an Instagram post\. /);
  });
  it("orders improving, declining, attention", () => {
    const lines = run({ mediaViews: 10_000, postEngagements: 10 }, { mediaViews: 100, postEngagements: 100 }, 0);
    expect(lines.map((l) => l.group)).toEqual(["improving", "declining", "attention"]);
  });
  it("flags the lines that tell the merchant to post more, and only those", () => {
    expect(run({ mediaViews: 50 }, { mediaViews: 100 }, 1)[0]!.implies).toBe("post_more");
    expect(run({ mediaViews: 50 }, { mediaViews: 100 }, 2)[0]!.implies).toBeUndefined();
    expect(run({ mediaViews: 50 }, { mediaViews: 100 }, null)[0]!.implies).toBeUndefined();
    expect(run({}, {}, 0)[0]!.implies).toBe("post_more");
    expect(run({ mediaViews: 125 }, { mediaViews: 100 })[0]!.implies).toBeUndefined();
  });
  it("a fall that already says post more often is not repeated by the quiet line", () => {
    expect(run({ mediaViews: 50 }, { mediaViews: 100 }, 0).map((l) => l.id)).toEqual(["reach_down"]);
  });
  it("a line and its chip agree on a fraction that rounds to the threshold", () => {
    expect(run({ mediaViews: 124.6 }, { mediaViews: 100 }).map((l) => l.id)).toEqual(["reach_up"]);
    expect(run({ mediaViews: 75.4 }, { mediaViews: 100 }).map((l) => l.id)).toEqual(["reach_down"]);
  });
});

describe("countRecentPosts", () => {
  const now = new Date("2026-11-17T12:00:00Z");
  it("counts posts inside the quiet window", () => {
    expect(countRecentPosts(["2026-11-16T08:00:00+0000", "2026-11-01T08:00:00+0000"], now)).toBe(1);
    expect(countRecentPosts([], now)).toBe(0);
  });
  it("is null when dates exist but none can be read", () => {
    expect(countRecentPosts(["nonsense"], now)).toBeNull();
    expect(countRecentPosts(["nonsense", "2026-11-01T08:00:00+0000"], now)).toBeNull();
  });
  it("the cutoff is exactly INSIGHT_QUIET_DAYS back", () => {
    expect(countRecentPosts(["2026-11-10T12:00:00Z"], now)).toBe(1);
    expect(countRecentPosts(["2026-11-10T11:59:00Z"], now)).toBe(0);
  });
});
