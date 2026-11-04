import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChannelFitEntry, CleanupGroup, MediaItem, StorageUsage } from "@/lib/api/media";
import type { UploadRow } from "@/lib/drive/upload-engine";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), getWithMeta: vi.fn() }, ApiError: class extends Error {}, API_BASE_URL: "https://api.example" }));
vi.mock("@/hooks/use-credits", () => ({ useCreditsBalance: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { FileTile } = await import("./file-tile");
const { FileDetail } = await import("./file-detail");
const { CleanupPanel } = await import("./cleanup-view");
const { TrashList } = await import("./trash-view");
const { StoragePanel } = await import("./storage-view");
const { UploadTray } = await import("./upload-tray");
const { DrivePrivacyView } = await import("./drive-privacy-card");
const { listState } = await import("./files-view");

/**
 * Component tests for the Drive page's STATES, read as the text and attributes a person gets (not snapshots). Time is injected (`now`), so no
 * assertion depends on the clock or the locale: "24 days left" is a subtraction, not a formatted date.
 */

const NOW = new Date("2026-11-04T12:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const flat = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

function file(over: Partial<MediaItem> = {}): MediaItem {
  return {
    id: "m1",
    publicUrl: "https://m.test/a.png",
    mimeType: "image/png",
    name: "Gold tin with marigolds",
    kind: "image",
    visibility: "published",
    shared: false,
    sizeBytes: 3_100_000,
    width: 3000,
    height: 3000,
    source: "uploaded",
    describeState: "described",
    usedInCount: 0,
    usedIn: [],
    createdAt: minutesAgo(60),
    ...over,
  };
}
const tile = (item: MediaItem, over: Partial<Parameters<typeof FileTile>[0]> = {}) =>
  renderToStaticMarkup(<FileTile item={item} now={NOW} open={false} checked={false} canSelect onOpen={() => {}} onCheck={() => {}} {...over} />);

describe("a tile Peakhour is still naming", () => {
  it("shimmers and says what it is doing, by kind: image, video, document", () => {
    const cases: Array<[Partial<MediaItem>, string]> = [
      [{ kind: "image" }, "Studying your image…"],
      [{ kind: "video", mimeType: "video/mp4", publicUrl: "https://m.test/a.mp4" }, "Watching your video…"],
      [{ kind: "document", mimeType: "application/pdf", visibility: "private", publicUrl: undefined }, "Reading your document…"],
    ];
    for (const [over, line] of cases) {
      for (const describeState of ["pending", "describing"] as const) {
        const html = tile(file({ name: "IMG_4512.jpg", describeState, createdAt: minutesAgo(1), ...over }));
        expect(flat(html)).toContain(line);
        expect(html.match(/drive-shine/g)!.length).toBeGreaterThanOrEqual(2);
        expect(html).toContain('role="status"');
      }
    }
  });

  it("never says AI processing or analysing", () => {
    const html = tile(file({ describeState: "pending", createdAt: minutesAgo(1) }));
    expect(flat(html)).not.toMatch(/AI processing|analys/i);
  });

  it("shows no shimmer for a finished file, a file the describer will not read, or one that has waited past the window", () => {
    for (const over of [{ describeState: "described" as const }, { describeState: "not_described" as const }, { describeState: "pending" as const, createdAt: minutesAgo(16) }]) {
      const html = tile(file({ createdAt: minutesAgo(1), ...over }));
      expect(html).not.toContain("drive-shine");
      expect(html).not.toContain('role="status"');
    }
  });

  it("a file waiting 14 minutes still shimmers, one waiting 16 does not", () => {
    expect(tile(file({ describeState: "pending", createdAt: minutesAgo(14) }))).toContain("drive-shine");
    expect(tile(file({ describeState: "pending", createdAt: minutesAgo(16) }))).not.toContain("drive-shine");
  });

  it("the shimmer stops moving under prefers-reduced-motion", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8").replace(/\s+/g, " ");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.drive-shine \{ animation: none;/);
    expect(css).toMatch(/\.drive-shine \{[^}]*animation: drive-shine/);
  });
});

describe("a settled tile", () => {
  it("says how many places it is used, or that it is not used yet, and shows its name and badge", () => {
    expect(flat(tile(file({ usedInCount: 2 })))).toContain("Used in 2 places");
    expect(flat(tile(file({ usedInCount: 1 })))).toContain("Used in 1 place");
    const unused = flat(tile(file()));
    expect(unused).toContain("Not used yet");
    expect(unused).toContain("Gold tin with marigolds");
    expect(unused).toContain("Image");
  });

  it("badges a video with its length and a private document as private", () => {
    expect(flat(tile(file({ kind: "video", mimeType: "video/mp4", durationSeconds: 24 })))).toContain("Video 0:24");
    expect(flat(tile(file({ kind: "document", mimeType: "application/pdf", visibility: "private", publicUrl: undefined })))).toContain("PDF, private");
  });

  it("a private file has no image to load; a published image does, with its alt text", () => {
    expect(tile(file({ kind: "document", mimeType: "application/pdf", visibility: "private", publicUrl: undefined }))).not.toContain("<img");
    expect(tile(file({ altText: "A gold tin on cream cloth" }))).toContain('alt="A gold tin on cream cloth"');
  });

  it("offers a select box only to someone who may change files, and marks the open file", () => {
    expect(tile(file())).toContain('aria-label="Select Gold tin with marigolds"');
    expect(tile(file(), { canSelect: false })).not.toContain("Select Gold tin");
    expect(tile(file(), { open: true })).toContain('aria-pressed="true"');
    expect(tile(file())).toContain('aria-label="Open Gold tin with marigolds"');
  });
});

function detail(item: MediaItem, over: Partial<Parameters<typeof FileDetail>[0]> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <FileDetail item={item} now={NOW} canEdit onPatch={async () => {}} onTrash={() => {}} trashing={false} {...over} />
    </QueryClientProvider>,
  );
}

describe("the file panel", () => {
  it("links each place a file is used to the thing that uses it", () => {
    const html = detail(
      file({
        usedInCount: 3,
        usedIn: [
          { kind: "page", refId: "p1", label: "Our story" },
          { kind: "idea", refId: "i1" },
          { kind: "ad_creative", refId: "a1", published: true },
        ],
      }),
    );
    expect(html).toContain('href="/dashboard/pages/p1"');
    expect(html).toContain('href="/dashboard/strategist/i1"');
    expect(html).toContain('href="/dashboard/ads"');
    expect(flat(html)).toContain("Page: Our story");
    expect(flat(html)).toContain("Ad, live");
    expect(flat(html)).toMatch(/Used in/);
  });

  it("shows share links as one plain-text row, and an unknown kind without crashing or an empty href", () => {
    const html = detail(
      file({
        usedInCount: 2,
        usedIn: [
          { kind: "share", refId: "s1", count: 5 },
          { kind: "hologram", refId: "h1" } as never,
        ],
      }),
    );
    expect(flat(html)).toContain("Share links (5)");
    expect(flat(html)).toContain("Somewhere in Peakhour");
    expect(html).not.toContain('href=""');
    expect(html).not.toMatch(/<a [^>]*>[^<]*Share links/);
    expect(html).not.toMatch(/<a [^>]*>[^<]*Somewhere in Peakhour/);
  });

  it("says a file is not used anywhere yet, and when the list is longer than the panel shows", () => {
    expect(flat(detail(file()))).toContain("Not used anywhere yet");
    expect(flat(detail(file({ usedInCount: 25, usedIn: [{ kind: "page", refId: "p1" }] })))).toContain("and 24 more");
  });

  it("lists where a file fits, best first, and says plainly where it does not", () => {
    const channelFit: ChannelFitEntry[] = [
      { channel: "instagram", fit: "good" },
      { channel: "facebook", fit: "possible" },
      { channel: "x", fit: "poor", reason: "too large" },
    ];
    const text = flat(detail(file({ channelFit })));
    expect(text).toContain("Fits");
    expect(text).toContain("Instagram");
    expect(text).toContain("Facebook, with care");
    expect(text).toContain("Not for X: too large");
    expect(flat(detail(file()))).not.toContain("Fits");
  });

  it("says Published or Private in words", () => {
    expect(flat(detail(file()))).toContain("Published. Anyone with the address can open it.");
    const priv = flat(detail(file({ kind: "document", mimeType: "application/pdf", visibility: "private", publicUrl: undefined })));
    expect(priv).toContain("Private. Opens only with a link that expires.");
    expect(priv).toContain("Share link");
  });

  it("a private file's panel carries the share dialog line and each link's Opened by list (the real panel, cache pre-filled)", () => {
    const item = file({ kind: "document", mimeType: "application/pdf", visibility: "private", publicUrl: undefined });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(["drive-share-privacy"], { retentionDays: 90 });
    qc.setQueryData(["drive-share-links", item.id], [
      { id: "s1", expiresAt: "2026-11-10T12:00:00.000Z", hasPassword: true, openCount: 2, createdAt: "2026-11-03T12:00:00.000Z" },
      { id: "s2", expiresAt: "2026-11-01T12:00:00.000Z", revokedAt: "2026-11-02T12:00:00.000Z", hasPassword: false, openCount: 0, createdAt: "2026-10-30T12:00:00.000Z" },
    ]);
    qc.setQueryData(["drive-share-access", "s1"], { entries: [], retentionDays: 90, truncated: false });
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <FileDetail item={item} now={NOW} canEdit onPatch={async () => {}} onTrash={() => {}} trashing={false} />
      </QueryClientProvider>,
    );
    const text = flat(html);
    expect(text).toContain("When someone opens this link, we keep their IP address and device for 90 days so you can spot a leak.");
    expect(text).toContain("Expires after");
    expect(text).toContain("Password (optional");
    expect(html.match(/data-testid="share-link-row"/g)).toHaveLength(2);
    // only a link that has been opened reads its history; the other says so without a request
    expect(html.match(/aria-label="Opened by"/g)).toHaveLength(1);
    expect(text).toContain("Not opened yet.");
    expect(text).toContain("opened 2 times");
    // only the live link can be revoked
    expect(html.match(/>Revoke</g)).toHaveLength(1);
    expect(text).toContain("Revoked");
  });

  it("a viewer, and a published file, get no share links panel", () => {
    expect(flat(detail(file({ kind: "document", mimeType: "application/pdf", visibility: "private", publicUrl: undefined }), { canEdit: false }))).not.toContain("Share links");
    const pub = flat(detail(file()));
    expect(pub).not.toContain("Share links");
    expect(pub).toContain("Copy link");
  });

  it("lets someone who may change the file edit name, description, alt text and tags, and move it to Trash", () => {
    const html = detail(file({ tags: ["gold tin"] }));
    for (const label of ["name", "description", "alt text"]) expect(html).toContain(`aria-label="Edit ${label}"`);
    expect(html).toContain('aria-label="Add a tag"');
    expect(html).toContain('aria-label="Remove tag gold tin"');
    expect(flat(html)).toContain("Move to Trash");
  });

  it("changes nothing for a viewer, and explains a shared file", () => {
    const html = detail(file({ shared: true, tags: ["gold tin"] }), { canEdit: false });
    expect(html).not.toContain('aria-label="Edit name"');
    expect(html).not.toContain('aria-label="Add a tag"');
    expect(html).not.toContain('aria-label="Remove tag');
    expect(flat(html)).not.toContain("Move to Trash");
    expect(flat(html)).toContain("Shared across your organisation. Only an admin can change it.");
  });

  it("while being named, shows the wait instead of an empty description", () => {
    const text = flat(detail(file({ describeState: "pending", createdAt: minutesAgo(1) })));
    expect(text).toContain("Studying your image…");
    expect(text).toContain("will appear here in a moment");
    expect(text).not.toContain("No description yet");
  });
});

const groups = (over: Partial<CleanupGroup>[] = []): CleanupGroup[] => {
  const base: CleanupGroup[] = [
    { kind: "duplicate_content_hash", count: 6, reclaimableBytes: 0.31 * 1024 ** 3, trashable: true },
    { kind: "orphan_generated", count: 16, reclaimableBytes: 0.74 * 1024 ** 3, trashable: true },
    { kind: "unused_90d", count: 9, reclaimableBytes: 0.62 * 1024 ** 3, trashable: true },
    { kind: "large_5mb_plus", count: 2, reclaimableBytes: 0.23 * 1024 ** 3, trashable: false },
  ];
  return base.map((g, i) => ({ ...g, ...(over[i] ?? {}) }));
};
const panel = (g: CleanupGroup[], chosen: string[], over: Partial<Parameters<typeof CleanupPanel>[0]> = {}) =>
  renderToStaticMarkup(<CleanupPanel groups={g} capped={false} chosen={new Set(chosen as never)} onToggle={() => {}} onMove={() => {}} moving={false} {...over} />);

describe("Smart Cleanup", () => {
  const all = ["duplicate_content_hash", "orphan_generated", "unused_90d"];

  it("totals only what is chosen and can be moved, and the button says Trash, never delete", () => {
    const html = panel(groups(), all);
    const text = flat(html);
    expect(text).toContain("You can free 1.67 GB");
    expect(text).toContain("Move 31 files to Trash");
    expect(text).not.toMatch(/delet/i);
    expect(text).toContain("Files in use, or ever published, are never listed here.");
    expect(text).toContain("30 days");
    // unchecking a group takes it out of the total
    expect(flat(panel(groups(), ["orphan_generated"]))).toContain("Move 16 files to Trash");
    expect(flat(panel(groups(), ["orphan_generated"]))).toContain("You can free 0.74 GB");
    // large files are advice: even if somehow chosen they add nothing to the total
    expect(flat(panel(groups(), [...all, "large_5mb_plus"]))).toContain("Move 31 files to Trash");
  });

  it("shows each group with its size, and large files as advice with no box to tick", () => {
    const html = panel(groups(), all);
    const text = flat(html);
    for (const t of ["Exact duplicates", "AI drafts never used", "Unused for 90 days", "Large files worth shrinking"]) expect(text).toContain(t);
    expect(text).toContain("0.31 GB");
    expect(text).toContain("0.23 GB");
    expect(text).toContain("Nothing is removed for this");
    // three boxes, none for the large files
    expect(html.match(/role="checkbox"/g)).toHaveLength(3);
    expect(html).not.toContain('aria-label="Large files worth shrinking"');
  });

  it("a group with nothing in it is not listed, and the button cannot be pressed with nothing chosen", () => {
    const g = groups([{ count: 0, reclaimableBytes: 0 }]);
    expect(flat(panel(g, all))).not.toContain("Exact duplicates");
    expect(panel(groups(), [])).toMatch(/<button[^>]*\sdisabled=""[^>]*>\s*Move 0 files to Trash/);
  });

  it("with nothing to tidy up it says so, and never offers a move", () => {
    const empty = groups().map((g) => ({ ...g, count: 0, reclaimableBytes: 0 }));
    const html = panel(empty, []);
    expect(flat(html)).toContain("Nothing to tidy up right now");
    expect(flat(html)).not.toContain("to Trash");
  });

  it("while moving, the button says so and is disabled", () => {
    expect(panel(groups(), all, { moving: true })).toMatch(/<button[^>]*\sdisabled=""[^>]*>\s*Moving…/);
  });

  it("says when there are more files than it lists", () => {
    expect(flat(panel(groups(), all, { capped: true }))).toContain("more files to review than this page lists");
  });
});

describe("Trash", () => {
  const trashed = (over: Partial<MediaItem> = {}) => file({ id: "t1", name: "Old homepage banner.jpg", sizeBytes: 1_258_291, deletedAt: minutesAgo(60), hardDeleteAfter: new Date(NOW.getTime() + 24 * 86_400_000 - 3_600_000).toISOString(), ...over });
  const list = (items: MediaItem[], canRestore: (i: MediaItem) => boolean = () => true) => renderToStaticMarkup(<TrashList items={items} now={NOW} canRestore={canRestore} restoringId={null} onRestore={() => {}} />);

  it("says how many days are left, the size, and offers Restore", () => {
    const text = flat(list([trashed()]));
    expect(text).toContain("Old homepage banner.jpg");
    expect(text).toContain("1.2 MB");
    expect(text).toContain("24 days left");
    expect(text).toContain("Restore");
    expect(text).toContain("do not count against your storage");
  });

  it("counts the last day, and the day it goes", () => {
    expect(flat(list([trashed({ hardDeleteAfter: new Date(NOW.getTime() + 3_600_000).toISOString() })]))).toContain("1 day left");
    expect(flat(list([trashed({ hardDeleteAfter: new Date(NOW.getTime() - 1000).toISOString() })]))).toContain("Removed for good today");
  });

  it("offers no Restore to someone who cannot restore that file (a shared file for an editor)", () => {
    const text = flat(list([trashed({ shared: true })], (i) => !i.shared));
    expect(text).not.toContain("Restore");
    expect(text).toContain("Old homepage banner.jpg");
  });

  it("an empty Trash says so", () => {
    expect(flat(list([]))).toContain("Trash is empty.");
  });
});

const usage = (over: Partial<StorageUsage> = {}): StorageUsage => ({
  totalBytes: 6.4 * 1024 ** 3,
  softDeletedBytes: 0.6 * 1024 ** 3,
  fileCount: 100,
  limitBytes: 25 * 1024 ** 3,
  limitGb: 25,
  gbUsed: 6.4,
  percentUsed: 25.6,
  source: "plan",
  pool: { planGb: 25, packGb: 0, overrideGb: null, holdings: [{ planKey: "suite", planName: "Suite", trial: false, gb: 25 }] },
  perBusiness: [],
  byKind: { video: { bytes: 3.6 * 1024 ** 3, fileCount: 4 }, image: { bytes: 2.1 * 1024 ** 3, fileCount: 80 }, document: { bytes: 0.4 * 1024 ** 3, fileCount: 12 }, font: { bytes: 0.3 * 1024 ** 3, fileCount: 4 } },
  paused: false,
  packs: [],
  canBuyPacks: true,
  catalog: [{ gb: 5, peaksPerMonth: 750 }, { gb: 25, peaksPerMonth: 3750 }],
  ...over,
});
const storage = (u: StorageUsage, cleanupBytes = 1.9 * 1024 ** 3) => renderToStaticMarkup(<StoragePanel usage={u} cleanupBytes={cleanupBytes} />);

describe("Storage", () => {
  it("says what is used of what is included, by kind, with the Smart Cleanup line and its link", () => {
    const html = storage(usage());
    const text = flat(html);
    expect(text).toContain("6.4 GB");
    expect(text).toContain("of 25 GB");
    for (const t of ["Videos", "3.60 GB", "Images", "2.10 GB", "Documents", "Fonts"]) expect(text).toContain(t);
    expect(text).toContain("Smart Cleanup can free 1.90 GB");
    expect(text).toContain("Trash holds 0.60 GB that does not count");
    expect(html).toContain('href="/dashboard/drive?tab=cleanup"');
  });

  it("offers the packs and the one Add space button when space can be added", () => {
    const text = flat(storage(usage()));
    expect(text).toContain("+5 GB");
    expect(text).toContain("750 Peaks a month");
    expect(text).toContain("Add space");
  });

  it("offers no purchase while a pack is paused, and says what to do", () => {
    const html = storage(usage({ paused: true }));
    expect(html).not.toMatch(/<button[^>]*>\s*Add space/);
    expect(flat(html)).toContain("Top up your Peaks to add space.");
  });

  it("an empty Drive draws no bar and does not divide by zero", () => {
    const html = storage(usage({ totalBytes: 0, gbUsed: 0, percentUsed: 0 }));
    expect(html).not.toContain("NaN");
    expect(html).not.toContain('aria-label="Storage by kind of file"');
  });

  it("a Drive from before the breakdown existed still shows its storage", () => {
    const html = storage(usage({ byKind: undefined }));
    expect(flat(html)).toContain("6.4 GB");
    expect(html).not.toContain("NaN");
  });
});

const row = (over: Partial<UploadRow> = {}): UploadRow => ({ id: "u1", filename: "IMG_4471.jpg", sizeBytes: 1000, kind: "image", status: "uploading", progress: 0.62, ...over });
const tray = (rows: UploadRow[], described = new Map<string, never>()) =>
  renderToStaticMarkup(<UploadTray rows={rows} described={described} onClose={() => {}} onRetry={() => {}} onCancel={() => {}} onClear={() => {}} />);

describe("the upload tray", () => {
  it("says it carries on when closed, and shows per-file progress", () => {
    const html = tray([row(), row({ id: "u2", filename: "clip.mp4", kind: "video", progress: 0.1 })]);
    const text = flat(html);
    expect(text).toContain("Uploading 2 files");
    expect(text).toContain("Close this any time. Uploads carry on, and resume if your connection drops.");
    expect(text).toContain("Uploading, 62%");
    expect(text).toContain("Uploading, 10%");
    expect(html).toContain('style="width:62%"');
  });

  it("after the upload it says what Peakhour is doing, then the name Peakhour gave it", () => {
    const landed = row({ status: "done", progress: 1, mediaId: "m1", name: "IMG_4471" });
    expect(flat(tray([landed]))).toContain("Studying your image…");
    expect(flat(tray([row({ ...landed, kind: "video" })]))).toContain("Watching your video…");
    expect(flat(tray([row({ ...landed, kind: "document" })]))).toContain("Reading your document…");
    const named = flat(tray([landed], new Map([["m1", { describeState: "described", name: "Red tin with cardamom pods" } as never]])));
    expect(named).toContain("Red tin with cardamom pods");
    expect(named).toContain("Was IMG_4471.jpg");
    expect(named).toContain("Named and sorted");
  });

  it("a file the describer will not read just says Added to Drive", () => {
    const landed = row({ status: "done", progress: 1, mediaId: "m1", kind: "other" });
    expect(flat(tray([landed]))).toContain("Added to Drive");
    expect(flat(tray([row({ ...landed, kind: "image" })], new Map([["m1", { describeState: "not_described", name: "x" } as never]])))).toContain("Added to Drive");
  });

  it("says Already in Drive for a duplicate, and that it will not be stored twice", () => {
    const text = flat(tray([row({ status: "duplicate", progress: 1, mediaId: "m1", name: "Blue tin on a wooden table", filename: "blue tin copy.jpg" })]));
    expect(text).toContain("Already in Drive");
    expect(text).toContain("will not be stored twice");
    expect(flat(tray([row()]))).not.toContain("stored twice");
  });

  it("a stopped file says why and offers Try again; a full Drive also offers Add space", () => {
    const failed = row({ status: "failed", error: "Your Drive is full. Add space or clear some files, then try again.", quotaFull: true, final: false });
    const html = tray([failed]);
    expect(flat(html)).toContain("Your Drive is full.");
    expect(flat(html)).toContain("Try again");
    expect(flat(html)).toContain("Add space");
    expect(html).toContain('role="alert"');
  });

  it("a file that is refused for good (wrong type, too big) offers no Try again", () => {
    const text = flat(tray([row({ status: "failed", error: "This video is too large; the limit is 512 MB.", final: true })]));
    expect(text).toContain("too large");
    expect(text).not.toContain("Try again");
  });

  it("only a file still going up has a Stop button", () => {
    expect(tray([row()])).toContain('aria-label="Stop uploading IMG_4471.jpg"');
    expect(tray([row({ status: "done", progress: 1 })])).not.toContain("Stop uploading");
  });
});

describe("Settings: Don't send private files to AI", () => {
  const view = (over: Partial<Parameters<typeof DrivePrivacyView>[0]> = {}) => renderToStaticMarkup(<DrivePrivacyView on={false} canChange busy={false} error={null} onChange={() => {}} {...over} />);

  it("says what each state means", () => {
    expect(flat(view({ on: false }))).toContain("A private file may be sent to one AI provider to name and describe it.");
    expect(flat(view({ on: true }))).toContain("No private file is read by AI. Published files are still named and described.");
    expect(view({ on: true })).toContain('aria-checked="true"');
    expect(view({ on: false })).toContain('aria-checked="false"');
  });

  it("an admin can change it; anyone else is told only an admin can", () => {
    expect(view()).not.toMatch(/<button[^>]*role="switch"[^>]*\sdisabled=""/);
    const locked = view({ canChange: false });
    expect(locked).toMatch(/<button[^>]*role="switch"[^>]*\sdisabled=""/);
    expect(flat(locked)).toContain("Only an admin can change this.");
  });

  it("a refused save is said in words, beside the switch", () => {
    expect(flat(view({ error: "This setting is not available yet. Try again later." }))).toContain("not available yet");
    expect(view({ error: "x" })).toContain('role="alert"');
  });
});

describe("what the list query is doing (react-query v5)", () => {
  it("a paused first fetch is OFFLINE, not loading and not an error", () => {
    expect(listState({ isPending: true, isError: false, fetchStatus: "paused" })).toBe("offline");
  });
  it("a first fetch in flight is loading; a refetch after an error with no data is loading again, not a stale error", () => {
    expect(listState({ isPending: true, isError: false, fetchStatus: "fetching" })).toBe("loading");
  });
  it("an error is an error, and data is ready", () => {
    expect(listState({ isPending: false, isError: true, fetchStatus: "idle" })).toBe("error");
    expect(listState({ isPending: false, isError: false, fetchStatus: "idle" })).toBe("ready");
  });
});
