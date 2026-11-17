import { describe, expect, it } from "vitest";
import {
  formatFigure,
  hubState,
  instagramOverviewTiles,
  mediaInsightTiles,
  mediaTypeLabel,
  pageOverviewTiles,
  postExcerpt,
  postInsightTiles,
  reasonText,
  windowFor,
} from "./meta-content-view";

describe("windowFor", () => {
  it("is the last N days ending today, both ends inclusive", () => {
    const now = new Date("2026-11-17T23:30:00Z");
    expect(windowFor(7, now)).toEqual({ since: "2026-11-11", until: "2026-11-17" });
    expect(windowFor(28, now)).toEqual({ since: "2026-10-21", until: "2026-11-17" });
  });
  it("crosses a month and a year boundary", () => {
    expect(windowFor(7, new Date("2027-01-03T00:00:00Z"))).toEqual({ since: "2026-12-28", until: "2027-01-03" });
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

  it("instagram overview sums the follower series into a net change, and null stays null", () => {
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
    expect(by.followerSeries.label).toBe("New followers");
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
  const base = { pagesLoading: false, pagesError: null, pageCount: 2, channel: "facebook" as const };
  it("loading, not connected, missing permission, error", () => {
    expect(hubState({ ...base, pagesLoading: true })).toBe("loading");
    expect(hubState({ ...base, pagesError: { status: 404 } })).toBe("not_connected");
    expect(hubState({ ...base, pagesError: { status: 403 } })).toBe("needs_permission");
    expect(hubState({ ...base, pagesError: { status: 500 } })).toBe("error");
    expect(hubState({ ...base, pagesError: {} })).toBe("error");
  });
  it("a switched-off capability is not a reconnect", () => {
    expect(hubState({ ...base, pagesError: { status: 403, code: "CAPABILITY_DISABLED" } })).toBe("capability_off");
    expect(hubState({ ...base, pagesError: { status: 403, code: "CAPABILITY_SCOPE_MISSING" } })).toBe("needs_permission");
  });
  it("connected with no Pages", () => {
    expect(hubState({ ...base, pageCount: 0 })).toBe("no_pages");
  });
  it("facebook is ready with Pages", () => {
    expect(hubState(base)).toBe("ready");
  });
  it("instagram waits for every lookup, then says not linked, or is ready", () => {
    const ig = { ...base, channel: "instagram" as const };
    expect(hubState({ ...ig, instagramSettled: false, instagramCount: 0 })).toBe("loading");
    expect(hubState({ ...ig, instagramSettled: true, instagramCount: 0 })).toBe("no_instagram");
    expect(hubState({ ...ig, instagramSettled: true, instagramCount: 1 })).toBe("ready");
    // A lookup that failed is not "no account linked".
    expect(hubState({ ...ig, instagramSettled: true, instagramCount: 0, instagramFailed: true })).toBe("error");
  });
});
