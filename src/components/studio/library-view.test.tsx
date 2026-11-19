import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { CreativesView, ProductPhotosView, ImportStatusList } = await import("./library-view");
const { LibraryFilters, AddFromDialog } = await import("./library");
const { STUDIO_COPY } = await import("@/lib/studio-copy");

import type { LibraryItem, LibraryPage } from "@/lib/api/creative";
import type { ProductImageItem, ProductImportStatus } from "@/lib/api/media";

const item = (over: Partial<LibraryItem> = {}): LibraryItem => ({
  id: "c1",
  kind: "image",
  status: "has_final",
  headline: "Diwali sale",
  format: "story",
  productIds: ["p1"],
  updatedAt: "2026-11-18T10:00:00.000Z",
  thumbUrl: "https://cdn.example/t.jpg",
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
  it("one page shows no pager", () => expect(creatives()).not.toContain("Page 1 of"));
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

const photo = (over: Partial<ProductImageItem> = {}): ProductImageItem => ({
  id: "i1",
  source: "shopify",
  productId: "p1",
  productTitle: "Silk saree",
  sourceProductId: "s1",
  sourceImageId: "img1",
  position: 0,
  importedAt: "2026-11-18T10:00:00.000Z",
  media: { id: "m1", name: "a.jpg", mimeType: "image/jpeg", visibility: "published", publicUrl: "https://cdn.example/p.jpg" },
  ...over,
});
const photos = (over: Partial<Parameters<typeof ProductPhotosView>[0]> = {}) =>
  renderToStaticMarkup(
    <ProductPhotosView status="ready" items={[photo()]} imports={[]} hasMore={false} loadingMore={false} onRetry={() => {}} onMore={() => {}} locale="en-GB" {...over} />,
  );

describe("Product photos", () => {
  it("loading, error and offline are not an empty list", () => {
    expect(photos({ status: "loading", items: [] })).toContain('aria-busy="true"');
    const err = photos({ status: "error", items: [] });
    expect(err).toContain("couldn&#x27;t load your product photos");
    expect(err).toContain("Retry");
    expect(err).not.toContain("No product photos yet");
    expect(photos({ status: "offline", items: [] })).not.toContain("No product photos yet");
  });
  it("empty: the spec's words and Upload a photo to Drive", () => {
    const html = photos({ items: [] });
    expect(html).toContain("No product photos yet");
    expect(html).toContain("Your store photos are added here automatically. You can also upload your own.");
    expect(html).toContain('href="/dashboard/drive"');
    expect(html).toContain("Upload a photo");
  });
  it("empty while an import runs shows progress, not the empty state", () => {
    const html = photos({ items: [], imports: [{ source: "shopify", status: "running" }] });
    expect(html).toContain("Getting photos from your Shopify store...");
    expect(html).toContain('role="progressbar"');
    expect(html).not.toContain("No product photos yet");
  });
  it("a product tile: title, photo count, main photo alt", () => {
    const html = photos({ items: [photo({ id: "a", position: 1 }), photo({ id: "b" })] });
    expect(html).toContain("Silk saree");
    expect(html).toContain("2 photos");
    expect(html).toContain('alt="Main photo of Silk saree"');
    expect(html).toContain("Add photo");
  });
  it("a private photo falls back quietly, or to the container's own renderer", () => {
    const priv = photo({ media: { id: "m9", name: "a.jpg", mimeType: "image/jpeg", visibility: "private" } });
    expect(photos({ items: [priv] })).toContain("Photo not shown");
    expect(photos({ items: [priv], renderPrivate: (m) => <span>signed {m.id}</span> })).toContain("signed");
  });
  it("a next page offers Show more products; while it loads the button is off", () => {
    expect(photos({ hasMore: true })).toContain("Show more products");
    expect(photos({ hasMore: true, loadingMore: true })).toMatch(/<button[^>]*disabled=""[^>]*>Loading more/);
    expect(photos()).not.toContain("Show more products");
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
    const html = renderToStaticMarkup(<LibraryFilters q="" status="has_final" onQ={() => {}} onStatus={() => {}} />);
    expect(html).toContain('for="studio-library-search"');
    expect(html).toContain('id="studio-library-search"');
    expect(html).toContain('for="studio-library-status"');
    expect(html).toContain("Finals");
    expect(html).toContain("Archived");
  });
  it("the Add from sources are the spec's, and the closed dialog draws without a call", () => {
    expect(STUDIO_COPY.library.addFrom.sources).toEqual(["Google Drive", "Dropbox", "Canva", "Instagram posts", "Meta ads"]);
    expect(() => renderToStaticMarkup(<AddFromDialog open={false} onOpenChange={() => {}} />)).not.toThrow();
  });
});

describe("Library copy", () => {
  it("tab names are exactly the spec's", () => expect(STUDIO_COPY.library.tabs).toEqual({ made: "Made in Studio", photos: "Product photos", plans: "Saved plans" }));
});
