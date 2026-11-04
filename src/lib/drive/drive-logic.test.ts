import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DescribeStateRow, MediaItem } from "@/lib/api/media";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn() }, ApiError: class extends Error {}, API_BASE_URL: "" }));

const { NO_FILTERS, applyDescribeRows, canChangeFile, driveAbilities, isFiltered, toListParams, waitingIds } = await import("./files-state");
const { usedInHref, usedInLabel, trashFailureText, blockedText, tileLine, isBeingDescribed, SHIMMER_WINDOW_MS, cleanupCopy, DESCRIBING_LINE, fitsOf, channelLabel } = await import("./copy");
const { placesSummary, placeLine, replaceIntro, replaceOutcome, replaceFailureText, versionLine, savedText, saveFailureText, kindOfChosenFile, replaceKindProblem, isSavableAddress } = await import("./copy");
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
  });
  it("name a share link in plain words, and collapse the links into one line with their count", () => {
    expect(usedInLabel({ kind: "share", refId: "x" })).toBe("Share link");
    expect(usedInLabel({ kind: "share", refId: "x", count: 1 })).toBe("Share link");
    expect(usedInLabel({ kind: "share", refId: "x", count: 5 })).toBe("Share links (5)");
  });
  it("a share link is plain text, not a link to the page you are on", () => {
    expect(usedInHref({ kind: "share", refId: "x", count: 5 })).toBeNull();
  });
  it("a kind this page does not know yet reads in plain words and goes nowhere", () => {
    const e = { kind: "hologram", refId: "x" } as unknown as Parameters<typeof usedInLabel>[0];
    expect(usedInLabel(e)).toBe("Somewhere in Peakhour");
    expect(usedInHref(e)).toBeNull();
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

describe("why a file did not go to Trash", () => {
  it("shows the api's reason on a 409, because trying again cannot fix it", () => {
    const reason = "This shared file is still used by an ad, post, page, Brand Kit or share link; take it out of use, or revoke its share link, before deleting it.";
    expect(trashFailureText(Object.assign(new Error(reason), { status: 409 }))).toBe(reason);
  });
  it("keeps the generic line for anything else (a 500, a lost connection, a 409 with no words)", () => {
    expect(trashFailureText(Object.assign(new Error("boom"), { status: 500 }))).toBe("That file could not be moved to Trash. Try again.");
    expect(trashFailureText(new Error("Failed to fetch"))).toBe("That file could not be moved to Trash. Try again.");
    expect(trashFailureText(Object.assign(new Error(""), { status: 409 }))).toBe("That file could not be moved to Trash. Try again.");
    expect(trashFailureText(undefined)).toBe("That file could not be moved to Trash. Try again.");
  });
  it("counts the files a bulk move left, in the singular and the plural, and says nothing for none", () => {
    expect(blockedText(0)).toBe("");
    expect(blockedText(1)).toMatch(/^ 1 file was left because it is still in use by a share link/);
    expect(blockedText(3)).toMatch(/^ 3 files were left because they are still in use/);
    expect(blockedText(3)).toMatch(/revoke the share link/);
  });
});

describe("Replace everywhere: the words", () => {
  const it1 = (kind: string, label?: string, reason?: string) => ({ kind: kind as never, refId: "r", label, reason });
  it("counts places by what they are, and never says undefined for a kind it does not know", () => {
    expect(placesSummary([it1("draft"), it1("draft"), it1("scheduled_item")])).toBe("2 drafts, 1 scheduled post");
    expect(placesSummary([it1("share")])).toBe("1 share link");
    expect(placesSummary([it1("hologram"), it1("hologram")])).toBe("2 other places");
    expect(placesSummary([])).toBe("");
  });
  it("names an item, with the reason it stays when it does", () => {
    expect(placeLine(it1("page", "Spring sale"))).toBe("Page: Spring sale");
    expect(placeLine(it1("scheduled_item", undefined, "Already published"))).toBe("Scheduled post. Already published.");
    // a reason that already ends in a full stop is not given a second
    expect(placeLine(it1("scheduled_item", undefined, "Already published."))).toBe("Scheduled post. Already published.");
    expect(placeLine(it1("page", "Spring sale", "Live page. "))).toBe("Page: Spring sale. Live page.");
  });
  it("the intro says what changes and what stays, and says so when nothing is in use", () => {
    expect(replaceIntro([it1("draft")], [it1("page"), it1("page")])).toBe("1 draft will use the new file. 2 pages already went out, or are being sent, and stay exactly as they were. The old file is kept, so they keep showing it.");
    expect(replaceIntro([], [it1("page")])).toContain("Nothing will change anywhere it is used.");
    expect(replaceIntro([], [])).toContain("Nothing uses this file yet");
  });
  it("an outcome with anything not changed is a failure that says to try again, and never claims success", () => {
    const ok = replaceOutcome({ changed: [it1("draft")], staysAsSent: [], notChanged: [] });
    expect(ok).toEqual({ headline: "1 draft now use the new file. The old file is in version history for 30 days.", failed: false });
    // things that went out still show the old file: it is kept, not purged
    expect(replaceOutcome({ changed: [it1("draft")], staysAsSent: [it1("page")], notChanged: [] }).headline).toBe("1 draft now use the new file. The old file is kept, because things that went out still show it.");
    const partial = replaceOutcome({ changed: [it1("draft")], staysAsSent: [], notChanged: [it1("scheduled_item")] });
    expect(partial.failed).toBe(true);
    expect(partial.headline).toContain("1 scheduled post could not be changed");
    expect(partial.headline).toContain("Try again to finish");
  });
  it("shows the api's own reason when trying again cannot help, and a plain sentence otherwise", () => {
    expect(replaceFailureText({ status: 409, message: "A image can only be replaced by another image." })).toBe("A image can only be replaced by another image.");
    expect(replaceFailureText({ status: 503, message: "x" })).toContain("Nothing that was already published changed");
    expect(replaceFailureText(new Error("boom"))).toContain("Try again");
  });
  it("a version says when it was replaced and how long it is kept", () => {
    const v = { id: "v", name: "Logo", mimeType: "image/png", sizeBytes: 2048, visibility: "published" as const, replacedAt: new Date(NOW.getTime() - 3 * 86_400_000).toISOString(), hardDeleteAfter: new Date(NOW.getTime() + 27 * 86_400_000).toISOString() };
    expect(versionLine(v, NOW)).toBe("2 KB. Replaced 3 days ago. 27 days left");
    expect(versionLine({ ...v, replacedAt: NOW.toISOString() }, NOW)).toContain("Replaced today");
    // no purge date: kept while something that went out still shows it
    expect(versionLine({ ...v, hardDeleteAfter: undefined }, NOW)).toBe("2 KB. Replaced 3 days ago. Kept while things that went out still show it");
  });
});

describe("Save to Drive: the words", () => {
  it("an Inbox file says it is Private; a file Drive had says so", () => {
    expect(savedText({ name: "Photo", visibility: "private", deduped: false, alreadyInDrive: false })).toContain("It is Private");
    expect(savedText({ name: "Photo", visibility: "published", deduped: false, alreadyInDrive: false })).toBe('Saved to Drive as "Photo".');
    expect(savedText({ name: "Photo", visibility: "published", deduped: true, alreadyInDrive: false })).toContain("already had this exact file");
    expect(savedText({ name: "Photo", visibility: "published", deduped: false, alreadyInDrive: true })).toBe('"Photo" is already in Drive.');
  });
  it("shows the api's reason for a full Drive, a type Drive does not store or an address that cannot be fetched", () => {
    expect(saveFailureText({ status: 402, message: "Your Drive is full." })).toBe("Your Drive is full.");
    expect(saveFailureText({ status: 415, message: "Drive does not store this kind of file." })).toBe("Drive does not store this kind of file.");
    expect(saveFailureText({ status: 500, message: "x" })).toBe("That could not be saved to Drive. Try again.");
  });
});

describe("Replace everywhere: the file chosen is checked before anything is uploaded", () => {
  const f = (name: string, type: string) => ({ name, type });
  it("tells the kind of a chosen file by its type, then its extension, and says nothing when it cannot tell", () => {
    expect(kindOfChosenFile(f("a.png", "image/png"))).toBe("image");
    expect(kindOfChosenFile(f("a.mov", "video/quicktime"))).toBe("video");
    expect(kindOfChosenFile(f("a.pdf", "application/pdf"))).toBe("document");
    expect(kindOfChosenFile(f("a.docx", ""))).toBe("document");
    expect(kindOfChosenFile(f("a.woff2", ""))).toBe("font");
    expect(kindOfChosenFile(f("a.xyz", "application/octet-stream"))).toBeNull();
  });
  it("a PDF cannot replace an image, in words; the same kind and an unknown kind go on to the api", () => {
    expect(replaceKindProblem(f("menu.pdf", "application/pdf"), "image")).toBe("This file is an image, so it can only be replaced by an image. You chose a document.");
    expect(replaceKindProblem(f("b.jpg", "image/jpeg"), "image")).toBeNull();
    expect(replaceKindProblem(f("b.xyz", ""), "image")).toBeNull();
  });
  it("offers Save to Drive for a plain https address only, and never for a Drive file's own address", () => {
    const key = `${"a".repeat(24)}/${"b".repeat(24)}/202611/${"c".repeat(32)}.png`;
    expect(isSavableAddress("https://cdn.example.com/hero.png")).toBe(true);
    expect(isSavableAddress(`https://media.example.com/${key}`)).toBe(false);
    expect(isSavableAddress(`https://x.test/r?u=${encodeURIComponent(key)}`)).toBe(false);
    expect(isSavableAddress("data:image/png;base64,AAAA")).toBe(false);
    expect(isSavableAddress("blob:https://app.test/1")).toBe(false);
    expect(isSavableAddress("http://cdn.example.com/hero.png")).toBe(false);
  });
});
