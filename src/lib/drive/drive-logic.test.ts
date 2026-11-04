import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DescribeStateRow, MediaItem } from "@/lib/api/media";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn() }, ApiError: class extends Error {}, API_BASE_URL: "" }));

const { NO_FILTERS, applyDescribeRows, canChangeFile, driveAbilities, isFiltered, toListParams, waitingIds } = await import("./files-state");
const { usedInHref, usedInLabel, tileLine, isBeingDescribed, SHIMMER_WINDOW_MS, cleanupCopy, DESCRIBING_LINE, fitsOf, channelLabel } = await import("./copy");
const { tabFromParam, DRIVE_TABS } = await import("./tabs");
const { fitWithin, posterTime, POSTER_MAX_SIDE } = await import("./probe-file");
const { trayTitle, pillText } = await import("./tray-copy");

const NOW = new Date("2026-11-04T12:00:00.000Z");
const ago = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const item = (over: Partial<MediaItem> = {}): MediaItem => ({
  id: "a", publicUrl: "https://m/a.png", mimeType: "image/png", name: "IMG_1", kind: "image", visibility: "published", shared: false, sizeBytes: 1, source: "uploaded",
  describeState: "pending", usedInCount: 0, usedIn: [], createdAt: ago(1), ...over,
});

describe("who may change what", () => {
  it("an editor changes the business's own files, an admin or owner the shared ones too, a viewer nothing", () => {
    expect(driveAbilities("viewer")).toEqual({ canEdit: false, isAdmin: false });
    expect(driveAbilities("editor")).toEqual({ canEdit: true, isAdmin: false });
    expect(driveAbilities("admin")).toEqual({ canEdit: true, isAdmin: true });
    expect(driveAbilities("owner")).toEqual({ canEdit: true, isAdmin: true });
    expect(driveAbilities(undefined)).toEqual({ canEdit: false, isAdmin: false });
    expect(canChangeFile({ shared: true }, driveAbilities("editor"))).toBe(false);
    expect(canChangeFile({ shared: true }, driveAbilities("admin"))).toBe(true);
    expect(canChangeFile({ shared: false }, driveAbilities("editor"))).toBe(true);
    expect(canChangeFile({ shared: false }, driveAbilities("viewer"))).toBe(false);
  });
});

describe("the list request a set of filters makes", () => {
  it("sends only what the person chose, searching on the server", () => {
    expect(toListParams(NO_FILTERS, 1)).toEqual({ status: "active", page: 1, limit: 40, sort: "newest" });
    const p = toListParams({ ...NO_FILTERS, q: "  diwali reel with the blue tin ", kind: "video", channel: "instagram", used: "unused", source: "ai_generated", visibility: "private", collectionId: "c1", sort: "name" }, 3);
    expect(p).toEqual({ status: "active", page: 3, limit: 40, sort: "name", q: "diwali reel with the blue tin", kind: "video", channel: "instagram", used: "unused", source: "ai_generated", visibility: "private", collectionId: "c1" });
  });
  it("Live in ads is the smart collection of that name, and a chosen collection wins over it", () => {
    expect(toListParams({ ...NO_FILTERS, kind: "live", liveCollectionId: "live1" }, 1)).toMatchObject({ collectionId: "live1" });
    expect(toListParams({ ...NO_FILTERS, kind: "live", liveCollectionId: "live1" }, 1)).not.toHaveProperty("kind");
    expect(toListParams({ ...NO_FILTERS, kind: "live", liveCollectionId: "live1", collectionId: "mine" }, 1)).toMatchObject({ collectionId: "mine" });
  });
  it("knows when the list is narrowed, so an empty answer reads as 'nothing matches' and not 'no files yet'", () => {
    expect(isFiltered(NO_FILTERS)).toBe(false);
    expect(isFiltered({ ...NO_FILTERS, sort: "name" })).toBe(false);
    expect(isFiltered({ ...NO_FILTERS, q: "tin" })).toBe(true);
    expect(isFiltered({ ...NO_FILTERS, q: "   " })).toBe(false);
    expect(isFiltered({ ...NO_FILTERS, visibility: "private" })).toBe(true);
  });
});

describe("the describing poll's answer lands on the files on screen", () => {
  const data = (items: MediaItem[]) => ({ pages: [{ items, meta: { page: 1, limit: 40, total: items.length, hasMore: false } }], pageParams: [1] });
  const answer = (over: Partial<DescribeStateRow> = {}): DescribeStateRow => ({ id: "a", describeState: "described", name: "Gold tin with marigolds", tags: ["gold tin"], description: "A gold tin.", ...over });

  it("swaps in the name, description, tags and state of the file named, and touches no other", () => {
    const other = item({ id: "b", name: "Other" });
    const out = applyDescribeRows(data([item(), other]), [answer()])!;
    expect(out.pages[0]!.items[0]).toMatchObject({ id: "a", name: "Gold tin with marigolds", tags: ["gold tin"], description: "A gold tin.", describeState: "described" });
    expect(out.pages[0]!.items[1]).toBe(other);
  });
  it("keeps what the poll does not carry (where it is used, its size, whether it is shared)", () => {
    const out = applyDescribeRows(data([item({ usedInCount: 3, shared: true, sizeBytes: 99 })]), [answer()])!;
    expect(out.pages[0]!.items[0]).toMatchObject({ usedInCount: 3, shared: true, sizeBytes: 99 });
  });
  it("returns the same object when nothing changed, so the page does not re-render for an unchanged answer", () => {
    const d = data([item({ describeState: "pending", name: "IMG_1" })]);
    expect(applyDescribeRows(d, [answer({ describeState: "pending", name: "IMG_1", tags: undefined, description: undefined })])).toBe(d);
    expect(applyDescribeRows(d, [])).toBe(d);
    expect(applyDescribeRows(undefined, [answer()])).toBeUndefined();
  });
  it("ignores an answer for a file that is not on screen", () => {
    const d = data([item()]);
    expect(applyDescribeRows(d, [answer({ id: "zzz" })])).toBe(d);
  });
});

describe("which tiles shimmer", () => {
  it("a file still being named, added within the window", () => {
    expect(isBeingDescribed({ describeState: "pending", createdAt: ago(1) }, NOW)).toBe(true);
    expect(isBeingDescribed({ describeState: "describing", createdAt: ago(1) }, NOW)).toBe(true);
    expect(isBeingDescribed({ describeState: "described", createdAt: ago(1) }, NOW)).toBe(false);
    expect(isBeingDescribed({ describeState: "not_described", createdAt: ago(1) }, NOW)).toBe(false);
    expect(isBeingDescribed({ describeState: "pending", createdAt: new Date(NOW.getTime() - SHIMMER_WINDOW_MS - 1).toISOString() }, NOW)).toBe(false);
  });
  it("only those are waited for: a page of finished files makes the poll sleep", () => {
    const items = [item({ id: "1", describeState: "described" }), item({ id: "2", describeState: "pending" }), item({ id: "3", describeState: "not_described" }), item({ id: "4", describeState: "describing" }), item({ id: "5", describeState: "pending", createdAt: ago(60) })];
    expect(waitingIds(items, NOW)).toEqual(["2", "4"]);
    expect(waitingIds(items.filter((i) => i.describeState === "described"), NOW)).toEqual([]);
  });
  it("says what it is doing by kind, in plain words", () => {
    expect(DESCRIBING_LINE.image).toBe("Studying your image…");
    expect(DESCRIBING_LINE.video).toBe("Watching your video…");
    expect(DESCRIBING_LINE.document).toBe("Reading your document…");
    expect(tileLine(item({ kind: "video" }), NOW)).toBe("Watching your video…");
    expect(tileLine(item({ describeState: "described", usedInCount: 0 }), NOW)).toBe("Not used yet");
    for (const line of Object.values(DESCRIBING_LINE)) expect(line).not.toMatch(/AI|analy/i);
  });
});

describe("the links from 'Used in'", () => {
  it("go to the page, the idea, or the screen that lists the rest", () => {
    expect(usedInHref({ kind: "page", refId: "p1" })).toBe("/dashboard/pages/p1");
    expect(usedInHref({ kind: "idea", refId: "i1" })).toBe("/dashboard/strategist/i1");
    expect(usedInHref({ kind: "ad_creative", refId: "x" })).toBe("/dashboard/ads");
    expect(usedInHref({ kind: "scheduled_item", refId: "x" })).toBe("/dashboard/calendar");
    expect(usedInHref({ kind: "social_post", refId: "x" })).toBe("/dashboard/calendar");
    expect(usedInHref({ kind: "draft", refId: "x" })).toBe("/dashboard/content");
    expect(usedInHref({ kind: "brand", refId: "x" })).toBe("/dashboard/drive?tab=brand");
    expect(usedInHref({ kind: "listing", refId: "x" })).toBe("/dashboard/presence");
    expect(usedInHref({ kind: "share", refId: "x" })).toBe("/dashboard/drive");
  });
  it("name a share link in plain words, with the live flag and label where there are some", () => {
    expect(usedInLabel({ kind: "share", refId: "x" })).toBe("Share link");
    expect(usedInLabel({ kind: "share", refId: "x", label: "Spring lookbook", published: true })).toBe("Share link: Spring lookbook, live");
  });
  it("every route it names exists as a page in the app", () => {
    const routes: Array<[string, string]> = [
      ["/dashboard/pages/p1", "src/app/(site)/dashboard/pages/[id]/page.tsx"],
      ["/dashboard/strategist/i1", "src/app/(site)/dashboard/strategist/[id]/page.tsx"],
      ["/dashboard/ads", "src/app/(site)/dashboard/ads/page.tsx"],
      ["/dashboard/calendar", "src/app/(site)/dashboard/calendar/page.tsx"],
      ["/dashboard/content", "src/app/(site)/dashboard/content/page.tsx"],
      ["/dashboard/presence", "src/app/(site)/dashboard/presence/page.tsx"],
      ["/dashboard/drive?tab=brand", "src/app/(site)/dashboard/drive/page.tsx"],
    ];
    for (const [href, file] of routes) {
      expect(() => readFileSync(join(process.cwd(), file)), href).not.toThrow();
    }
    expect(DRIVE_TABS.map((t) => t.id)).toContain("brand");
  });
});

describe("fits", () => {
  it("lists good, possible and poor apart, with channel names a person would write", () => {
    const f = fitsOf([
      { channel: "instagram", fit: "good" },
      { channel: "googlebusiness", fit: "possible" },
      { channel: "x", fit: "poor", reason: "too large" },
    ]);
    expect(f.good).toEqual(["Instagram"]);
    expect(f.possible).toEqual(["Google Business"]);
    expect(f.poor).toEqual([{ label: "X", reason: "too large" }]);
    expect(fitsOf(undefined)).toEqual({ good: [], possible: [], poor: [] });
    expect(channelLabel("newchannel")).toBe("Newchannel");
  });
});

describe("Smart Cleanup copy", () => {
  it("never says delete, and says large files are not removed", () => {
    for (const kind of ["duplicate_content_hash", "orphan_generated", "unused_90d", "large_5mb_plus"] as const) {
      for (const n of [1, 6]) {
        const c = cleanupCopy(kind, n);
        expect(`${c.title} ${c.why}`).not.toMatch(/delet/i);
      }
    }
    expect(cleanupCopy("large_5mb_plus", 2).why).toContain("Nothing is removed");
    expect(cleanupCopy("unused_90d", 1).why).toContain("1 file ");
  });
});

describe("tabs", () => {
  it("reads the tab from the URL and falls back to Files", () => {
    expect(tabFromParam("cleanup")).toBe("cleanup");
    expect(tabFromParam("storage")).toBe("storage");
    expect(tabFromParam("brand")).toBe("brand");
    expect(tabFromParam("nonsense")).toBe("files");
    expect(tabFromParam(null)).toBe("files");
    expect(DRIVE_TABS.map((t) => t.label)).toEqual(["Files", "Brand Kit", "Smart Cleanup", "Trash", "Storage"]);
  });
});

describe("a video's poster frame", () => {
  it("is scaled to fit, never up", () => {
    expect(fitWithin(1920, 1080, POSTER_MAX_SIDE)).toEqual({ width: 1280, height: 720 });
    expect(fitWithin(1080, 1920, POSTER_MAX_SIDE)).toEqual({ width: 720, height: 1280 });
    expect(fitWithin(640, 360, POSTER_MAX_SIDE)).toEqual({ width: 640, height: 360 });
  });
  it("is taken a second in, or a tenth of the way for a short clip, and never past the end", () => {
    expect(posterTime(24)).toBe(1);
    expect(posterTime(5)).toBe(0.5);
    expect(posterTime(0.04)).toBe(0);
    expect(posterTime(NaN)).toBe(0);
    expect(posterTime(Infinity)).toBe(0);
  });
});

describe("the tray's title and pill", () => {
  const r = (status: string, size = 100, progress = 0) => ({ id: status + size, filename: "f", sizeBytes: size, kind: "image" as const, status: status as never, progress });
  it("counts what is going up, then what stopped, then what is in", () => {
    expect(trayTitle([r("uploading"), r("waiting"), r("done")])).toBe("Uploading 2 files");
    expect(trayTitle([r("uploading")])).toBe("Uploading 1 file");
    expect(trayTitle([r("done"), r("failed")])).toBe("1 file did not upload");
    expect(trayTitle([r("done"), r("duplicate")])).toBe("2 files in Drive");
  });
  it("the pill shows the share of bytes sent across what is still going up, and nothing when idle", () => {
    expect(pillText([r("uploading", 100, 0.5), r("uploading", 300, 0.5)])).toBe("Uploading 2 files, 50%");
    expect(pillText([r("done", 100, 1)])).toBeNull();
  });
});

describe("nothing in the app still points at the old Media page", () => {
  const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
  it("the navigation, the command menu and the storage meter name Drive at /dashboard/drive", () => {
    for (const f of ["src/app/(site)/dashboard/layout.tsx", "src/components/molecules/command-menu.tsx", "src/components/dashboard/sidebar-storage-meter.tsx"]) {
      expect(read(f), f).not.toContain("/dashboard/media");
    }
    expect(read("src/components/molecules/command-menu.tsx")).toContain('"/dashboard/drive"');
    expect(read("src/components/dashboard/sidebar-storage-meter.tsx")).toContain("/dashboard/drive");
  });
  it("Drive is a top-level item directly above Peaks, not under Content", () => {
    const layout = read("src/app/(site)/dashboard/layout.tsx").replace(/\s+/g, " ");
    expect(layout).toMatch(/\{ href: "\/dashboard\/drive", label: "Drive", icon: HardDrive \}, \{ href: "\/dashboard\/peaks", label: "Peaks"/);
    // the Content sub-items no longer carry a Media entry
    const content = layout.slice(layout.indexOf('label: "Content"'), layout.indexOf('label: "Growth"'));
    expect(content).not.toMatch(/label: "Media"/);
    expect(content).not.toMatch(/dashboard\/drive/);
  });
});
