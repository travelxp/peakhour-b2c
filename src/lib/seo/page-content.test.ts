import { describe, it, expect } from "vitest";
import { PAGE_CONTENT } from "@/content/pages";
import { PAGES } from "./pages";
import { contentFor, type ByLocale } from "./page-content";

const copy: ByLocale<string> = { en: "English", "fr-CA": "Français" };
const englishOnly: ByLocale<string> = { en: "English" };
const dev = { VERCEL_ENV: "preview" };
const prod = { VERCEL_ENV: "production" };

describe("contentFor", () => {
  it("returns the locale's own copy", () => {
    expect(contentFor(copy, "en")).toBe("English");
    expect(contentFor(copy, "fr-CA")).toBe("Français");
  });

  it("returns nothing for a locale with no copy: no silent English at a non-English URL (T19)", () => {
    expect(contentFor(englishOnly, "fr-CA")).toBeUndefined();
    expect(contentFor(englishOnly, "de", { env: dev })).toBeUndefined();
  });

  it("falls back to English only when a development preview asks for it", () => {
    expect(contentFor(englishOnly, "fr-CA", { previewFallback: true, env: dev })).toBe("English");
    expect(contentFor(englishOnly, "fr-CA", { previewFallback: true, env: {} })).toBe("English");
  });

  it("never falls back on Production, whatever is asked", () => {
    expect(contentFor(englishOnly, "fr-CA", { previewFallback: true, env: prod })).toBeUndefined();
    expect(contentFor(englishOnly, "fr-CA", { previewFallback: true, env: { ...prod, SITE_INDEXABLE: "true" } })).toBeUndefined();
  });

  it("an unregistered page has no copy", () => {
    expect(contentFor(undefined, "en")).toBeUndefined();
  });
});

describe("the registry", () => {
  it("has copy for every published non-English variant, and a title and description within their limits", () => {
    for (const page of PAGES) {
      for (const [locale, variant] of Object.entries(page.locales ?? {})) {
        if (variant?.status !== "published") continue;
        const own = PAGE_CONTENT[page.pageId]?.[locale as "fr-CA"];
        expect(own, `${page.pageId} ${locale} is published with no copy`).toBeTruthy();
        expect(own!.title.length, `${page.pageId} ${locale} title`).toBeLessThanOrEqual(60);
        expect(own!.description.length, `${page.pageId} ${locale} description`).toBeLessThanOrEqual(160);
      }
    }
  });

  it("registers copy only for pages that exist", () => {
    const ids = new Set(PAGES.map((p) => p.pageId));
    for (const id of Object.keys(PAGE_CONTENT)) expect(ids.has(id), id).toBe(true);
  });

  it("every published variant states a lowercase path under its locale prefix, and a reviewer", () => {
    for (const page of PAGES) {
      for (const [locale, variant] of Object.entries(page.locales ?? {})) {
        if (variant?.status !== "published") continue;
        expect(variant.path.startsWith(`/${locale.toLowerCase()}`), page.pageId).toBe(true);
        expect(variant.path, page.pageId).toBe(variant.path.toLowerCase());
        expect(variant.reviewer, `${page.pageId} ${locale} has no native reviewer`).toBeTruthy();
      }
    }
  });
});
