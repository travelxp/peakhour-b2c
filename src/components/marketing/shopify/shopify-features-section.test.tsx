import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PageRecord } from "@/lib/seo/types";

vi.mock("@/lib/marketing-pages", () => ({ getMarketingSitemapEntries: async () => [] }));

/** The "Shopify features" section links only feature pages the registry says are publishable. */

async function render(extra: PageRecord[]) {
  vi.resetModules();
  vi.doMock("@/lib/seo/pages", async (orig) => {
    const real = await orig<typeof import("@/lib/seo/pages")>();
    // The real registry now has SEO-8's feature pages; the test controls the set, so drop them first.
    const PAGES = [...real.PAGES.filter((p) => p.family !== "shopify-feature" || p.pageId === "shopify.features"), ...extra];
    return { ...real, PAGES, getPage: (id: string) => PAGES.find((p) => p.pageId === id)! };
  });
  const { ShopifyFeaturesSection } = await import("./shopify-features-section");
  return renderToStaticMarkup(ShopifyFeaturesSection());
}

afterEach(() => {
  vi.doUnmock("@/lib/seo/pages");
  vi.resetModules();
});

async function featurePage(over: Partial<PageRecord>): Promise<PageRecord> {
  const { PAGES } = await import("@/lib/seo/pages");
  return {
    ...PAGES.find((p) => p.pageId === "shopify")!,
    pageId: "shopify.features.cod",
    family: "shopify-feature",
    path: "/shopify/features/cod",
    title: "COD confirmation on Shopify",
    capabilityIds: [],
    ...over,
  };
}

describe("ShopifyFeaturesSection", () => {
  it("renders nothing while no Shopify feature page is published", async () => {
    expect(await render([])).toBe("");
  });

  it("links a published feature page with its title, and leaves out a draft", async () => {
    const published = await featurePage({});
    const draft = await featurePage({ pageId: "shopify.features.draft", path: "/shopify/features/draft", title: "A draft page", editorialStatus: "draft" });
    const html = await render([published, draft]);
    expect(html).toContain('href="/shopify/features/cod"');
    expect(html).toContain("COD confirmation on Shopify");
    expect(html).toContain("Shopify features");
    expect(html).not.toContain("/shopify/features/draft");
  });
});
