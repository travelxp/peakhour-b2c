import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ProductImageItem, ProductImportStatus } from "@/lib/api/media";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { chipFor, creativeHref, groupProductPhotos, importLines, itemTitle, mergeProductPages, pageCount } from "@/lib/studio-library";

const photo = (over: Partial<ProductImageItem> = {}): ProductImageItem => ({
  id: "i1",
  source: "shopify",
  productId: "p1",
  productTitle: "Silk saree",
  sourceProductId: "s1",
  sourceImageId: "img1",
  position: 0,
  importedAt: "2026-11-18T10:00:00.000Z",
  media: { id: "m1", name: "a.jpg", mimeType: "image/jpeg", visibility: "private" },
  ...over,
});

describe("groupProductPhotos", () => {
  it("one row per product, counting its photos, with the lowest position as the main photo", () => {
    const g = groupProductPhotos([photo({ id: "a", position: 2 }), photo({ id: "b", position: 0 }), photo({ id: "c", productId: "p2", productTitle: "Kurta" })]);
    expect(g.map((x) => [x.title, x.count, x.main.id])).toEqual([
      ["Silk saree", 2, "b"],
      ["Kurta", 1, "c"],
    ]);
  });
  it("a photo with no product link groups by the store's product id and is never dropped", () => {
    const g = groupProductPhotos([
      photo({ id: "a", productId: undefined, productTitle: undefined, sourceProductId: "x" }),
      photo({ id: "b", productId: undefined, productTitle: undefined, sourceProductId: "x", position: 1 }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]!.count).toBe(2);
    expect(g[0]!.title).toBe(STUDIO_COPY.library.photoFallbackTitle);
  });
  it("unlinked photos with the same store id from two stores stay separate", () => {
    const g = groupProductPhotos([
      photo({ productId: undefined, source: "shopify", sourceProductId: "1" }),
      photo({ id: "z", productId: undefined, source: "woocommerce", sourceProductId: "1" }),
    ]);
    expect(g).toHaveLength(2);
  });
  it("is empty for no photos", () => expect(groupProductPhotos([])).toEqual([]));
});

describe("mergeProductPages", () => {
  it("joins pages in order and drops a photo that appears twice", () => {
    const merged = mergeProductPages([{ items: [photo({ id: "a" }), photo({ id: "b" })] }, { items: [photo({ id: "b" }), photo({ id: "c" })] }]);
    expect(merged.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});

describe("importLines", () => {
  const imp = (over: Partial<ProductImportStatus>): ProductImportStatus => ({ source: "shopify", status: "done", ...over });
  it("running says photos are on the way, in the store's name", () => {
    const [l] = importLines([imp({ status: "running" })]);
    expect(l).toMatchObject({ state: "running", text: "Getting photos from your Shopify store..." });
  });
  it("stopped carries the api's plain reason", () => {
    const [l] = importLines([imp({ status: "stopped", source: "woocommerce", stoppedReason: "Your Library is full, so product photos were not imported." })]);
    expect(l).toMatchObject({ state: "stopped", text: "Photos from your WooCommerce store paused", reason: "Your Library is full, so product photos were not imported." });
  });
  it("stopped with no reason still says something plain", () => {
    expect(importLines([imp({ status: "stopped" })])[0]!.reason).toBe(STUDIO_COPY.library.imports.stoppedFallback);
    expect(importLines([imp({ status: "stopped", stoppedReason: "   " })])[0]!.reason).toBe(STUDIO_COPY.library.imports.stoppedFallback);
  });
  it("done names the last check, and leaves out a time it cannot read", () => {
    expect(importLines([imp({ lastRunAt: "2026-11-18T10:00:00.000Z" })], "en-GB")[0]!.text).toBe("Photos from your Shopify store are up to date. Last checked 18 Nov 2026.");
    expect(importLines([imp({ lastRunAt: "nonsense" })])[0]!.text).toBe("Photos from your Shopify store are up to date.");
    expect(importLines([imp({})])[0]!.text).not.toContain("Last checked");
  });
  it("one line per store, in the api's order", () => {
    expect(importLines([imp({}), imp({ source: "woocommerce", status: "running" })]).map((l) => l.source)).toEqual(["shopify", "woocommerce"]);
  });
});

describe("small helpers", () => {
  it("chips say only what the list knows", () => {
    expect(chipFor({ status: "has_final" }, "made")).toBe("Final");
    expect(chipFor({ status: "archived" }, "made")).toBe("Archived");
    expect(chipFor({ status: "brief" }, "plans")).toBe("Saved plan");
  });
  it("an item with no headline is titled plainly", () => {
    expect(itemTitle({ headline: null })).toBe("Untitled post");
    expect(itemTitle({ headline: "  " })).toBe("Untitled post");
    expect(itemTitle({ headline: "Diwali sale" })).toBe("Diwali sale");
  });
  it("opens the creative's page, escaping the id", () => expect(creativeHref("a/b")).toBe("/dashboard/studio/c/a%2Fb"));
  it("pageCount never goes below one", () => {
    expect(pageCount(0, 24)).toBe(1);
    expect(pageCount(25, 24)).toBe(2);
    expect(pageCount(5, 0)).toBe(5);
  });
});

describe("the CMS storage page", () => {
  it("names the imported_store source instead of showing the raw string", () => {
    const src = readFileSync(resolve(__dirname, "../app/(site)/cms/storage/page.tsx"), "utf8");
    expect(src).toMatch(/imported_store:\s*"Product photos \(store\)"/);
    const media = readFileSync(resolve(__dirname, "api/media.ts"), "utf8");
    expect(media).toMatch(/\|\s*"imported_store"/);
  });
});
