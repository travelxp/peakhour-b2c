import { describe, expect, it, vi } from "vitest";
import type { PlacementRow, VersionRow } from "@/lib/api/creative-studio";
import {
  adPlatformLabel,
  captionLength,
  captionProblem,
  connectedChannelKeys,
  defaultTicked,
  extendCount,
  keysToExtend,
  keysToRender,
  makeSizes,
  mediaFor,
  parseCap,
  readyVersions,
  sizeRows,
  studioConnectedChannels,
} from "./studio-publish";

const placement = (key: string, kind: PlacementRow["kind"], over: Partial<PlacementRow> = {}): PlacementRow => ({
  key,
  channel: key.split(".")[0]!,
  label: "Feed post",
  placement: "instagram_feed",
  format: "feed",
  width: 1080,
  height: 1350,
  specRef: { sourceUrl: "https://x", verifiedAt: "2026-11-01T00:00:00.000Z" },
  kind,
  ...over,
});
const version = (key: string, state: VersionRow["state"], id = `v-${key}`): VersionRow => ({ id, key, state, label: "Feed post", width: 1080, height: 1350 });

describe("size rows (S12, U8, U9)", () => {
  const placements = [
    placement("instagram.instagram_feed.1080x1350", "ready"),
    placement("instagram.instagram_stories.1080x1920", "needs_extend", { label: "Story", placement: "instagram_stories", height: 1920 }),
    placement("threads.feed.none", "no_spec", { width: null, height: null, specRef: null }),
  ];

  it("a channel with no verified size is a no_spec row, never a guessed size", () => {
    const rows = sizeRows(placements, []);
    expect(rows.map((r) => r.state)).toEqual(["ready", "needs_extend", "no_spec"]);
  });

  it("only the free sizes are ticked to start with: a size that costs Peaks is never ticked for the merchant", () => {
    expect([...defaultTicked(sizeRows(placements, []))]).toEqual(["instagram.instagram_feed.1080x1350"]);
  });

  it("a size already made, being made or failed says so", () => {
    const made = sizeRows(placements, [
      version("instagram.instagram_feed.1080x1350", "published"),
      version("instagram.instagram_stories.1080x1920", "extending"),
    ]);
    expect(made.map((r) => r.state)).toEqual(["ready", "extending", "no_spec"]);
    const failed = sizeRows(placements, [version("instagram.instagram_stories.1080x1920", "extend_failed")]);
    expect(failed[1]!.state).toBe("extend_failed");
  });

  it("the free draw is asked only for ticked sizes that have no row yet", () => {
    const rows = sizeRows(placements, [version("instagram.instagram_feed.1080x1350", "ready")]);
    const ticked = new Set(["instagram.instagram_feed.1080x1350", "instagram.instagram_stories.1080x1920", "threads.feed.none"]);
    // the feed size is already drawn; the no_spec row can never be drawn
    expect(keysToRender(rows, ticked)).toEqual(["instagram.instagram_stories.1080x1920"]);
  });

  it("the quoted step is asked for the ticked sizes that need more background, from the placement or from what the free draw said", () => {
    const rows = sizeRows(placements, []);
    const ticked = new Set(["instagram.instagram_feed.1080x1350", "instagram.instagram_stories.1080x1920"]);
    expect(keysToExtend(rows, ticked, [])).toEqual(["instagram.instagram_stories.1080x1920"]);
    // the renderer said the feed size needs more background after all
    expect(keysToExtend(rows, ticked, [version("instagram.instagram_feed.1080x1350", "needs_extend")])).toEqual([
      "instagram.instagram_feed.1080x1350",
      "instagram.instagram_stories.1080x1920",
    ]);
    expect(extendCount(rows, ticked)).toBe(1);
  });

  it("only made sizes go on to a post; a size still being made does not", () => {
    const rows = sizeRows(placements, [version("instagram.instagram_stories.1080x1920", "extending")]);
    const ticked = new Set(["instagram.instagram_feed.1080x1350", "instagram.instagram_stories.1080x1920"]);
    const rendered = [version("instagram.instagram_feed.1080x1350", "ready", "fresh")];
    expect(readyVersions(rows, ticked, rendered).map((v) => v.id)).toEqual(["fresh"]);
  });
});

describe("Continue (makeSizes)", () => {
  const rows = sizeRows(
    [placement("instagram.instagram_feed.1080x1350", "ready"), placement("instagram.instagram_stories.1080x1920", "needs_extend", { label: "Story" })],
    [],
  );
  const both = new Set(rows.map((r) => r.placement.key));

  it("draws, then asks the quoted step for the sizes that need more, and names what can be posted now", async () => {
    const render = vi.fn().mockResolvedValue([version("instagram.instagram_feed.1080x1350", "ready", "a"), version("instagram.instagram_stories.1080x1920", "needs_extend", "b")]);
    const extend = vi.fn().mockResolvedValue(undefined);
    const r = await makeSizes({ rows, ticked: both, render, extend, quotedUnits: 1 });
    expect(render).toHaveBeenCalledWith(["instagram.instagram_feed.1080x1350", "instagram.instagram_stories.1080x1920"]);
    expect(extend).toHaveBeenCalledWith(["instagram.instagram_stories.1080x1920"]);
    expect(r.ready.map((v) => v.id)).toEqual(["a"]);
    expect(r.extendStarted).toBe(true);
  });

  it("a refused quoted step is returned, not thrown: the free size is still made and nothing is charged", async () => {
    const refusal = new Error("no");
    const r = await makeSizes({
      rows,
      ticked: both,
      quotedUnits: 1,
      render: async () => [version("instagram.instagram_feed.1080x1350", "ready", "a"), version("instagram.instagram_stories.1080x1920", "needs_extend", "b")],
      extend: async () => {
        throw refusal;
      },
    });
    expect(r.extendError).toBe(refusal);
    expect(r.extendStarted).toBe(false);
    expect(r.ready.map((v) => v.id)).toEqual(["a"]);
  });

  it("when only free sizes are ticked the quoted step is never called", async () => {
    const extend = vi.fn();
    const r = await makeSizes({ rows, ticked: new Set(["instagram.instagram_feed.1080x1350"]), render: async () => [version("instagram.instagram_feed.1080x1350", "ready", "a")], extend, quotedUnits: 0 });
    expect(extend).not.toHaveBeenCalled();
    expect(r.ready.map((v) => v.id)).toEqual(["a"]);
  });

  it("the renderer found a different number of sizes that need more background than the price covers: nothing is started and the price is asked again", async () => {
    const extend = vi.fn();
    const r = await makeSizes({
      rows,
      ticked: both,
      quotedUnits: 0,
      render: async () => [version("instagram.instagram_feed.1080x1350", "needs_extend", "a"), version("instagram.instagram_stories.1080x1920", "needs_extend", "b")],
      extend,
    });
    expect(extend).not.toHaveBeenCalled();
    expect(r.requote).toBe(true);
    expect(r.extendStarted).toBe(false);
  });

  it("the post step gets each ready size with its channel, name and pixels from the free draw's own answer", async () => {
    const r = await makeSizes({
      rows,
      ticked: new Set(["instagram.instagram_feed.1080x1350"]),
      quotedUnits: 0,
      render: async () => [version("instagram.instagram_feed.1080x1350", "ready", "fresh")],
      extend: vi.fn(),
    });
    expect(r.ready).toEqual([{ id: "fresh", key: "instagram.instagram_feed.1080x1350", channel: "instagram", label: "Feed post", width: 1080, height: 1350 }]);
  });

  it("a failure of the free draw is thrown: nothing was made", async () => {
    await expect(makeSizes({ rows, ticked: both, render: async () => Promise.reject(new Error("boom")), extend: vi.fn(), quotedUnits: 1 })).rejects.toThrow("boom");
  });
});

describe("channels and captions (S13)", () => {
  it("Meta is ONE facebook row that the app expands into Pages and Instagram, so both light up from it", () => {
    const facebook = { provider: "facebook", connected: true, account: { extra: { pages: [{ pageName: "P", instagramAccountId: "ig1" }] } } };
    expect(studioConnectedChannels([facebook])).toEqual(["facebook", "instagram"]);
    const noInstagram = { provider: "facebook", connected: true, account: { extra: { pages: [{ pageName: "P" }] } } };
    expect(studioConnectedChannels([noInstagram])).toEqual(["facebook"]);
    expect(studioConnectedChannels([{ ...facebook, connected: false }])).toEqual([]);
  });

  it("only live connections count, under the names the scheduler uses", () => {
    expect(
      connectedChannelKeys([
        { provider: "facebook_pages", connected: true },
        { provider: "instagram", connected: false },
        { provider: "linkedin_content", connected: true },
        { provider: "x", connected: true },
      ]),
    ).toEqual(["facebook", "linkedin"]);
  });

  it("a caption counts letters, not code units, and is held to the channel's own limit", () => {
    expect(captionLength("नमस्ते")).toBe(6);
    expect(captionProblem("", "instagram")).toBe("required");
    expect(captionProblem("   ", "instagram")).toBe("required");
    expect(captionProblem("a".repeat(501), "threads")).toBe("too_long");
    expect(captionProblem("a".repeat(500), "threads")).toBeNull();
  });

  it("a channel's post carries the published copies of its own sizes, in the order chosen", () => {
    const versions = [
      { id: "a", channel: "instagram" },
      { id: "b", channel: "facebook" },
      { id: "c", channel: "instagram" },
    ];
    const media = [
      { versionId: "c", url: "https://m/c" },
      { versionId: "a", url: "https://m/a" },
      { versionId: "b", url: "https://m/b" },
    ];
    expect(mediaFor("instagram", versions, media)).toEqual(["https://m/a", "https://m/c"]);
    expect(mediaFor("linkedin", versions, media)).toEqual([]);
  });

  it("ads are named by what the merchant knows", () => {
    expect(adPlatformLabel("meta")).toBe("Facebook and Instagram");
    expect(adPlatformLabel("unknown_platform")).toBe("unknown_platform");
  });
});

describe("the monthly limit as typed (S19)", () => {
  it("accepts a whole number of 1 or more, with separators", () => {
    expect(parseCap("5000")).toEqual({ ok: true, value: 5000 });
    expect(parseCap(" 5,000 ")).toEqual({ ok: true, value: 5000 });
  });
  it("refuses zero, fractions, negatives and words", () => {
    for (const bad of ["0", "1.5", "-3", "ten", "", "1e3"]) expect(parseCap(bad)).toEqual({ ok: false, reason: "invalid" });
  });
  it("refuses more than the api keeps", () => {
    expect(parseCap("10000001")).toEqual({ ok: false, reason: "too_big" });
    expect(parseCap("10000000")).toEqual({ ok: true, value: 10_000_000 });
  });
});
