import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { BulkBar, CreativesView, ProductPhotoList, ProductPhotosView, ImportStatusList } = await import("./library-view");
const { LibraryFilters, AddFromDialog } = await import("./library");
const { STUDIO_COPY } = await import("@/lib/studio-copy");

import type { LibraryItem, LibraryPage } from "@/lib/api/creative";
import type { ProductPhotoTile, ProductPhotosOne } from "@/lib/api/creative";
import type { ProductImportStatus } from "@/lib/api/media";

const item = (over: Partial<LibraryItem> = {}): LibraryItem => ({
  id: "c1",
  kind: "image",
  status: "has_final",
  headline: "Diwali sale",
  format: "story",
  productIds: ["p1"],
  updatedAt: "2026-11-18T10:00:00.000Z",
  thumbUrl: "https://cdn.example/t.jpg",
  publish: { state: "none", scheduled: 0, posted: 0, channels: [], inAd: false },
  master: { finalId: "f1", width: 1080, height: 1920 },
  versions: [],
  words: null,
  actions: { download: true, newVersion: true, delete: true, deleteBlock: null },
  ...over,
});
const page = (items: LibraryItem[], over: Partial<LibraryPage> = {}): LibraryPage => ({ items, total: items.length, page: 1, pageSize: 24, ...over });

const creatives = (over: Partial<Parameters<typeof CreativesView>[0]> = {}) =>
  renderToStaticMarkup(
    <CreativesView view="made" status="ready" data={page([item()])} filtered={false} onRetry={() => {}} onClearFilters={() => {}} onPage={() => {}} {...over} />,
  );

describe("Made in Studio", () => {
  it("loading draws skeletons: no tiles, no empty state, no error", () => {
    const html = creatives({ status: "loading", data: undefined });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("<li");
    expect(html).not.toContain("Nothing made yet");
    expect(html).not.toContain("couldn&#x27;t load");
  });
  it("an error is an error with Retry, never an empty Library", () => {
    const html = creatives({ status: "error", data: undefined });
    expect(html).toContain("couldn&#x27;t load what you&#x27;ve made");
    expect(html).toContain("Retry");
    expect(html).not.toContain("Nothing made yet");
  });
  it("offline says so", () => {
    const html = creatives({ status: "offline", data: undefined });
    expect(html).toContain("offline");
    expect(html).not.toContain("Retry");
  });
  it("empty: the designed state with the spec's words and See ideas", () => {
    const html = creatives({ data: page([]) });
    expect(html).toContain("Nothing made yet");
    expect(html).toContain("Finals you make show up here, ready to post again.");
    expect(html).toContain('href="/dashboard/studio"');
    expect(html).toContain("See ideas");
  });
  it("empty after a search says nothing matches and offers to clear it", () => {
    const html = creatives({ data: page([]), filtered: true });
    expect(html).toContain("Nothing matches");
    expect(html).toContain("Clear search");
    expect(html).not.toContain("Nothing made yet");
  });
  it("a tile is a link to the creative, named for screen readers, with real alt text and a text chip", () => {
    const html = creatives();
    expect(html).toContain('href="/dashboard/studio/c/c1"');
    expect(html).toContain('aria-label="Open: Diwali sale, Story"');
    expect(html).toContain('alt="Preview of Diwali sale"');
    expect(html).toContain("Final");
    expect(html).toContain("1 post");
    expect(html).toContain("<ul");
  });
  it("a creative with no picture or headline still draws, plainly", () => {
    const html = creatives({ data: page([item({ thumbUrl: null, headline: null })]) });
    expect(html).toContain("No picture yet");
    expect(html).toContain("Untitled post");
    expect(html).not.toContain("<img");
  });
  it("an archived one says so", () => expect(creatives({ data: page([item({ status: "archived" })]) })).toContain("Archived"));
  it("two or more pages show a labelled pager; Previous is off on page 1, Next is off on the last", () => {
    const first = creatives({ data: page([item()], { total: 30, page: 1 }) });
    expect(first).toContain("Page 1 of 2");
    expect(first).toMatch(/<button[^>]*disabled=""[^>]*>Previous page/);
    expect(first).not.toMatch(/<button[^>]*disabled=""[^>]*>Next page/);
    const last = creatives({ data: page([item()], { total: 30, page: 2 }) });
    expect(last).toMatch(/<button[^>]*disabled=""[^>]*>Next page/);
  });
  it("a page past the end keeps its pager so the way back is there, and is not the empty state", () => {
    const html = creatives({ data: page([], { total: 30, page: 3 }) });
    expect(html).toContain("There is nothing on this page.");
    expect(html).toContain("Previous page");
    expect(html).not.toContain("Nothing made yet");
    expect(html).not.toContain("<img");
  });
  it("one page shows no pager", () => expect(creatives()).not.toContain("Page 1 of"));
});

describe("what a tile says and can do", () => {
  const sent = (state: "scheduled" | "posted", channels: string[]) => ({ state, scheduled: state === "scheduled" ? 1 : 0, posted: state === "posted" ? 1 : 0, channels, inAd: false });
  const acts = (over: Partial<NonNullable<Parameters<typeof CreativesView>[0]["actions"]>> = {}) => ({ canChange: true, ...over });
  it("the chip says Scheduled or Posted from the handoff, in text, with the channels under the title", () => {
    const html = creatives({ data: page([item({ id: "a", publish: sent("scheduled", ["instagram"]) }), item({ id: "b", publish: sent("posted", ["linkedin", "x"]) }), item({ id: "c" })]) });
    expect(html).toContain("Scheduled");
    expect(html).toContain("Posted");
    expect(html).toContain("Story. Instagram");
    expect(html).toContain("Story. LinkedIn, X");
    expect(html).toContain('data-publish="scheduled"');
    expect(html).toContain('data-publish="none"');
  });
  it("an editor gets Download, Make a new version and Delete, each named for the post", () => {
    const html = creatives({ actions: acts() });
    expect(html).toContain('aria-label="Download: Diwali sale"');
    expect(html).toContain('aria-label="Make a new version of: Diwali sale"');
    expect(html).toContain('aria-label="Delete: Diwali sale"');
  });
  it("a viewer can save a picture and nothing else", () => {
    const html = creatives({ actions: acts({ canChange: false }) });
    expect(html).toContain("Download");
    expect(html).not.toContain("Make a new version");
    expect(html).not.toContain('aria-label="Delete:');
  });
  it("what the api says cannot be done is not offered: no picture, not final, still being made", () => {
    const html = creatives({ actions: acts(), data: page([item({ actions: { download: false, newVersion: false, delete: false, deleteBlock: "making" } })]) });
    expect(html).not.toContain("Download");
    expect(html).not.toContain("Make a new version");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^]*Still being made/);
  });
  it("a post with a change in flight has its buttons off", () => {
    const html = creatives({ actions: acts({ busyIds: new Set(["c1"]) }) });
    expect(html.match(/<button[^>]*disabled=""/g)?.length).toBe(3);
  });
  it("Pro tools select mode swaps the buttons for a labelled checkbox", () => {
    const html = creatives({ actions: acts({ selecting: true, selected: new Set(["c1"]) }) });
    expect(html).toContain('aria-label="Select: Diwali sale"');
    expect(html).toContain('aria-checked="true"');
    expect(html).not.toContain("Make a new version");
  });
  it("with no actions given (the plain list) no button is drawn", () => expect(creatives()).not.toContain("Delete"));
  it("saved plans can be deleted but not downloaded or made again", () => {
    const html = creatives({ view: "plans", actions: acts(), data: page([item({ status: "brief", actions: { download: false, newVersion: false, delete: true, deleteBlock: null } })]) });
    expect(html).toContain('aria-label="Delete: Diwali sale"');
    expect(html).not.toContain("Download");
  });
});

describe("a words creative in the Library", () => {
  const words = (over: Partial<LibraryItem> = {}) =>
    item({
      id: "w1",
      kind: "words",
      status: "previews_ready",
      headline: "Diwali offer on silk sarees",
      thumbUrl: null,
      master: null,
      words: { options: 4, approved: 2, card: { headline: "Silk for every festival", primaryText: "Hand woven, ready to wear.", description: null, cta: null, hashtags: [] }, platform: "linkedin" },
      actions: { download: false, newVersion: false, delete: true, deleteBlock: null },
      ...over,
    });
  it("draws the words themselves, never an empty picture slot, and says what is in the set", () => {
    const html = creatives({ data: page([words()]) });
    expect(html).toContain('data-kind="words"');
    expect(html).toContain("Silk for every festival");
    expect(html).toContain("Hand woven, ready to wear.");
    expect(html).toContain("4 options, 2 approved. Written for LinkedIn");
    expect(html).toContain("Approved words");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("No picture yet");
    expect(html).not.toContain("Story");
  });
  it("one option reads as one option; a plan with no card yet says so; no Download or new version is offered", () => {
    const one = creatives({ data: page([words({ words: { options: 1, approved: 1, card: null, platform: null } })]), actions: { canChange: true } });
    expect(one).toContain("1 option, 1 approved");
    expect(one).toContain("No words to show yet.");
    expect(one).not.toContain("Download");
    expect(one).not.toContain("Make a new version");
    expect(one).toContain("Delete");
  });
  it("where it was sent beats the approved chip, as for a picture", () => {
    const html = creatives({ data: page([words({ publish: { state: "posted", scheduled: 0, posted: 1, channels: ["instagram"], inAd: false } })]) });
    expect(html).toContain("Posted");
    expect(html).toContain("4 options, 2 approved. Written for LinkedIn. Instagram");
  });
  it("the status filter says what Finals means for words", () => {
    expect(STUDIO_COPY.library.statuses.has_final).toBe("Finals and approved words");
  });
});

describe("the bulk bar", () => {
  const bar = (count: number, busy = false) => renderToStaticMarkup(<BulkBar count={count} busy={busy} onDelete={() => {}} onArchive={() => {}} onClear={() => {}} />);
  it("is not there until something is selected", () => expect(bar(0)).toBe(""));
  it("says how many are selected and offers delete, put away and clear", () => {
    const html = bar(2);
    expect(html).toContain("2 selected");
    expect(html).toContain("Delete selected");
    expect(html).toContain("Put away selected");
    expect(html).toContain("Clear selection");
    expect(bar(1)).toContain("1 selected");
  });
  it("its buttons are off while a change is on its way", () => expect(bar(2, true).match(/<button[^>]*disabled=""/g)?.length).toBe(3));
});

describe("Saved plans", () => {
  it("empty has its own words", () => {
    const html = creatives({ view: "plans", data: page([]) });
    expect(html).toContain("No saved plans");
    expect(html).not.toContain("Nothing made yet");
  });
  it("a saved plan is chipped as one", () => expect(creatives({ view: "plans", data: page([item({ status: "brief", thumbUrl: null })]) })).toContain("Saved plan"));
  it("an error names the plans", () => expect(creatives({ view: "plans", status: "error", data: undefined })).toContain("your saved plans"));
});

const tile = (over: Partial<ProductPhotoTile> = {}): ProductPhotoTile => ({
  productId: "p1",
  title: "Silk saree",
  count: 2,
  main: { mediaId: "m1", source: "store", isMain: true, thumbUrl: "https://cdn.example/p.jpg" },
  ...over,
});
const photos = (over: Partial<Parameters<typeof ProductPhotosView>[0]> = {}) =>
  renderToStaticMarkup(<ProductPhotosView status="ready" tiles={[tile()]} imports={[]} hasMore={false} loadingMore={false} onRetry={() => {}} onMore={() => {}} locale="en-GB" {...over} />);

describe("Product photos", () => {
  it("loading, error and offline are not an empty list", () => {
    expect(photos({ status: "loading", tiles: [] })).toContain('aria-busy="true"');
    const err = photos({ status: "error", tiles: [] });
    expect(err).toContain("couldn&#x27;t load your product photos");
    expect(err).toContain("Retry");
    expect(err).not.toContain("No product photos yet");
    expect(photos({ status: "offline", tiles: [] })).not.toContain("No product photos yet");
  });
  it("empty: the spec's words and Upload a photo to Drive", () => {
    const html = photos({ tiles: [] });
    expect(html).toContain("No product photos yet");
    expect(html).toContain("Your store photos are added here automatically. You can also upload your own.");
    expect(html).toContain('href="/dashboard/drive"');
    expect(html).toContain("Upload a photo");
  });
  it("empty while an import runs shows progress, not the empty state", () => {
    const html = photos({ tiles: [], imports: [{ source: "shopify", status: "running" }] });
    expect(html).toContain("Getting photos from your Shopify store...");
    expect(html).toContain('role="progressbar"');
    expect(html).not.toContain("No product photos yet");
  });
  it("a product tile: title, photo count, main photo alt, and See photos", () => {
    const html = photos({ onOpen: () => {} });
    expect(html).toContain("Silk saree");
    expect(html).toContain("2 photos");
    expect(html).toContain('alt="Photo of Silk saree"');
    expect(html).toContain('aria-label="Photos of Silk saree"');
    expect(html).toContain("See photos");
  });
  it("a product with no photo says so, shows no photo, and offers no See photos (only the Add control the container passes)", () => {
    const html = photos({ tiles: [tile({ count: 0, main: null })], onOpen: () => {}, renderAdd: (t) => <button type="button">Add photo: {t.title}</button> });
    expect(html).toContain("No photos yet");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("See photos");
    expect(html).toContain("Add photo: Silk saree");
  });
  it("a viewer gets no Add control (the container passes none)", () => expect(photos()).not.toContain("Add photo"));
  it("a photo whose link could not be signed falls back quietly", () => expect(photos({ tiles: [tile({ main: { mediaId: "m9", source: "library", isMain: true, thumbUrl: null } })] })).toContain("Photo not shown"));
  it("a next page offers Show more photos; while it loads the button is off", () => {
    expect(photos({ hasMore: true })).toContain("Show more photos");
    expect(photos({ hasMore: true, loadingMore: true })).toMatch(/<button[^>]*disabled=""[^>]*>Loading more/);
    expect(photos()).not.toContain("Show more photos");
  });
  it("a count is the product's own exact total, even while more products wait", () => {
    expect(photos({ hasMore: true })).toContain("2 photos");
    expect(photos({ hasMore: true })).not.toContain("2+ photos");
  });
});

describe("one product's photos", () => {
  const one = (over: Partial<ProductPhotosOne> = {}): ProductPhotosOne => ({
    productId: "p1",
    title: "Silk saree",
    count: 2,
    photos: [
      { mediaId: "m1", source: "store", isMain: true, thumbUrl: "https://cdn.example/a.jpg" },
      { mediaId: "m2", source: "library", isMain: false, thumbUrl: null },
    ],
    ...over,
  });
  const list = (over: Partial<Parameters<typeof ProductPhotoList>[0]> = {}) =>
    renderToStaticMarkup(<ProductPhotoList status="ready" data={one()} canChange onRetry={() => {}} onSetMain={() => {}} {...over} />);
  it("the main photo is chipped, each says where it came from, and only the others can be made main", () => {
    const html = list();
    expect(html).toContain("Main photo");
    expect(html).toContain("From your store");
    expect(html).toContain("Added by you");
    expect((html.match(/>Set as main photo</g) ?? []).length).toBe(1);
    expect(html).toContain('aria-label="Set as main photo: Silk saree, photo 2 of 2"');
    expect(html).toContain('alt="Photo 1 of 2 of Silk saree"');
    expect(html).toContain("Photo not shown");
  });
  it("a viewer sees the photos and cannot change the main one", () => expect(list({ canChange: false })).not.toContain("Set as main photo"));
  it("the photo being changed has its button off", () => expect(list({ busyId: "m2" })).toMatch(/<button[^>]*disabled=""[^>]*>Set as main photo/));
  it("loading, error and offline are states, not an empty list", () => {
    expect(list({ status: "loading", data: undefined })).toContain('aria-busy="true"');
    expect(list({ status: "error", data: undefined })).toContain("Retry");
    expect(list({ status: "offline", data: undefined })).toContain("offline");
  });
});

describe("import status per store", () => {
  const list = (imports: ProductImportStatus[]) => renderToStaticMarkup(<ImportStatusList imports={imports} locale="en-GB" />);
  it("nothing to say for no store", () => expect(list([])).toBe(""));
  it("a stopped import is announced with its plain stop reason", () => {
    const html = list([{ source: "woocommerce", status: "stopped", stoppedReason: "Your Library is full, so product photos were not imported. Free some space and they will come in." }]);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Photos from your WooCommerce store paused");
    expect(html).toContain("Your Library is full");
  });
  it("up to date says so with the last check", () => {
    const html = list([{ source: "shopify", status: "done", lastRunAt: "2026-11-18T10:00:00.000Z" }]);
    expect(html).toContain("up to date");
    expect(html).toContain("18 Nov 2026");
  });
  it("two stores, two lines, each in its own state", () => {
    const html = list([
      { source: "shopify", status: "running" },
      { source: "woocommerce", status: "stopped" },
    ]);
    expect(html).toContain('data-import-state="running"');
    expect(html).toContain('data-import-state="stopped"');
  });
});

describe("filters and Add from", () => {
  it("filters are labelled controls", () => {
    const html = renderToStaticMarkup(<LibraryFilters q="" values={{ status: "has_final", publish: "", channel: "", from: "", to: "" }} onQ={() => {}} onChange={() => {}} />);
    for (const id of ["search", "status", "sent", "channel", "from", "to"]) {
      expect(html).toContain(`for="studio-library-${id}"`);
      expect(html).toContain(`id="studio-library-${id}"`);
    }
    expect(html).toContain("Finals");
    expect(html).toContain("Archived");
    expect(html).toContain("Not sent yet");
    expect(html).toContain("Instagram");
    expect(html).toContain('type="date"');
  });
  it("the Add from sources are the spec's, and the closed dialog draws without a call", () => {
    expect(STUDIO_COPY.library.addFrom.sources).toEqual(["Google Drive", "Dropbox", "Canva", "Instagram posts", "Meta ads"]);
    expect(() => renderToStaticMarkup(<AddFromDialog open={false} onOpenChange={() => {}} />)).not.toThrow();
  });
});

describe("Library copy", () => {
  it("tab names are exactly the spec's", () => expect(STUDIO_COPY.library.tabs).toEqual({ made: "Made in Studio", photos: "Product photos", plans: "Saved plans" }));
});
