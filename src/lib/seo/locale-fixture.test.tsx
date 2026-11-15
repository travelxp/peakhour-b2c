// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import en from "../../../messages/en.json";

// A world where fr-CA is published for the fixture pages (locale-fixture.ts). Everything else is the real code.
vi.mock("./types", async (orig) => ({ ...(await orig<typeof import("./types")>()), PUBLISHED_LOCALES: ["en", "fr-CA"] }));
vi.mock("./pages", async (orig) => {
  const { withFixturePages } = await import("./locale-fixture");
  return withFixturePages(await orig<typeof import("./pages")>());
});
vi.mock("@/lib/marketing-pages", () => ({ getMarketingSitemapEntries: async () => [] }));

import { middleware } from "@/middleware";
import { NextRequest } from "next/server";
import sitemap from "@/app/sitemap";
import { LanguageSwitcherView } from "@/components/shared/language-switcher";
import { languageOptions } from "./language-options";
import { resolveLocaleRoute, pageAtPath, pageForPublicPath } from "./locale-route";
import { pageMeta } from "./metadata";
import { PAGES, getPage } from "./pages";
import { isPublishable } from "./publish";
import { contentFor } from "./page-content";
import { LOCALES, PUBLISHED_LOCALES, type Locale } from "./types";

const tr = createTranslator({ locale: "en", messages: en, namespace: "LanguageSwitcher" }) as (k: string) => string;
import { siteOrigin } from "./metadata";
const ORIGIN = siteOrigin();

describe("a fixture locale is published", () => {
  it("is fr-CA", () => {
    expect([...PUBLISHED_LOCALES]).toEqual(["en", "fr-CA"]);
  });

  describe("routing", () => {
    it("rewrites a published variant to the internal route, with the locale kept for the page", () => {
      expect(resolveLocaleRoute("/fr-ca/fx")).toMatchObject({ kind: "rewrite", locale: "fr-CA", target: "/ph-locale/fr-CA/fx" });
      expect(resolveLocaleRoute("/fr-ca/fx/leaf")).toMatchObject({ kind: "rewrite", target: "/ph-locale/fr-CA/fx/leaf" });
      expect(resolveLocaleRoute("/fr-ca")).toMatchObject({ kind: "rewrite", target: "/ph-locale/fr-CA" });
    });

    it("404s a page with no variant, a variant in review, and a page that exists only in English", () => {
      for (const path of ["/fr-ca/fx/child", "/fr-ca/fx/draft", "/fr-ca/shopify", "/fr-ca/nothing"]) {
        expect(resolveLocaleRoute(path), path).toEqual({ kind: "not-found", locale: "fr-CA" });
      }
    });

    it("404s a locale that is declared but not published", () => {
      for (const path of ["/de/fx", "/fr/fx", "/pt-br/fx", "/es/fx"]) {
        expect(resolveLocaleRoute(path)?.kind, path).toBe("not-found");
      }
    });

    it("the middleware rewrites the published variant and stamps the locale and path headers", () => {
      const res = middleware(new NextRequest("https://dev.peakhour.ai/fr-ca/fx/leaf?utm_source=x", { headers: { "x-ph-locale": "de" } }));
      const to = new URL(res.headers.get("x-middleware-rewrite")!);
      expect(to.pathname).toBe("/ph-locale/fr-CA/fx/leaf");
      expect(to.search).toBe("?utm_source=x");
      expect(res.headers.get("x-middleware-request-x-ph-locale")).toBe("fr-CA");
      expect(res.headers.get("x-middleware-request-x-ph-path")).toBe("/fr-ca/fx/leaf");
      expect(res.headers.get("x-middleware-request-x-nonce")).toBeTruthy();
    });

    it("the middleware still 404s an unpublished variant", () => {
      const res = middleware(new NextRequest("https://dev.peakhour.ai/fr-ca/fx/draft"));
      expect(new URL(res.headers.get("x-middleware-rewrite")!).pathname).toBe("/gate-404");
      expect(res.headers.get("x-middleware-request-x-ph-locale")).toBeNull();
    });

    it("finds the page behind a public URL, for the language switcher", () => {
      expect(pageForPublicPath("/fx/leaf")).toMatchObject({ locale: "en", page: { pageId: "fx.leaf" } });
      expect(pageForPublicPath("/fr-ca/fx/leaf")).toMatchObject({ locale: "fr-CA", page: { pageId: "fx.leaf" } });
      expect(pageForPublicPath("/dashboard")).toBeUndefined();
    });
  });

  describe("hreflang (Bible T10: reciprocal, self-referencing, x-default)", () => {
    const published = (id: string) => LOCALES.filter((l) => PUBLISHED_LOCALES.includes(l) && isPublishable(getPage(id), l));
    const langs = (id: string, l: Locale) => (pageMeta(id, l).alternates?.languages ?? {}) as Record<string, string>;
    const urlOf = (id: string, l: Locale) => pageMeta(id, l).alternates!.canonical as string;

    it("lists every published variant, itself included, and x-default (the English URL)", () => {
      const l = langs("fx.leaf", "fr-CA");
      expect(l).toEqual({ en: `${ORIGIN}/fx/leaf`, "fr-CA": `${ORIGIN}/fr-ca/fx/leaf`, "x-default": `${ORIGIN}/fx/leaf` });
      expect(langs("fx.leaf", "en")).toEqual(l);
    });

    it("emits no hreflang on a page with no published variant, in either language", () => {
      expect(langs("fx.child", "en")).toEqual({});
      expect(langs("fx.draft", "en")).toEqual({});
      expect(langs("pricing", "en")).toEqual({});
    });

    it("is reciprocal across the whole registry: if A lists B, B lists A, and both list x-default", () => {
      let edges = 0;
      for (const page of PAGES) {
        for (const a of published(page.pageId)) {
          const fromA = langs(page.pageId, a);
          for (const [hreflang, href] of Object.entries(fromA)) {
            if (hreflang === "x-default") continue;
            edges++;
            const b = hreflang as Locale;
            const fromB = langs(page.pageId, b);
            // B's own URL is the target A names, and B names A back at A's URL.
            expect(urlOf(page.pageId, b), `${page.pageId} ${a}->${b}`).toBe(href);
            expect(fromB[a], `${page.pageId} ${b}->${a}`).toBe(urlOf(page.pageId, a));
            expect(fromA["x-default"], page.pageId).toBeTruthy();
            expect(fromB["x-default"], page.pageId).toBe(fromA["x-default"]);
          }
        }
      }
      expect(edges).toBeGreaterThan(0);
    });

    it("lists only variants that pass the publish gate, so a published-in-name variant in review is absent", () => {
      expect(Object.keys(langs("fx.draft", "en"))).toEqual([]);
    });
  });

  describe("the language switcher", () => {
    const render = (page: string | undefined, current: Locale) =>
      renderToStaticMarkup(<LanguageSwitcherView options={languageOptions(page ? getPage(page) : undefined, current)} t={tr} />);

    it("links to the equivalent page when the variant is published", () => {
      const html = render("fx.leaf", "en");
      expect(html).toContain('href="/fr-ca/fx/leaf"');
      expect(html).toContain("Français (Canada)");
      expect(html).not.toContain("section page only");
      expect(render("fx.leaf", "fr-CA")).toContain('href="/fx/leaf"');
    });

    it("links to the nearest published ancestor, with a visible notice, when there is no equivalent", () => {
      const html = render("fx.child", "en");
      expect(html).toContain('href="/fr-ca/fx"');
      expect(html).toContain("(section page only)");
    });

    it("never links to a variant in review (it would be a 404); falls back to the parent, else home", () => {
      expect(render("fx.draft", "en")).toContain('href="/fr-ca"');
      expect(render("fx.draft", "en")).not.toContain("/fr-ca/fx/draft");
    });

    it("a page outside the registry (the dashboard) lands on the other language's home page", () => {
      expect(render(undefined, "en")).toContain('href="/fr-ca"');
    });

    it("marks the current language and labels the nav", () => {
      const html = render("fx.leaf", "en");
      expect(html).toContain('aria-current="true"');
      expect(html).toContain('aria-label="Language"');
      expect(html).toContain('hrefLang="fr-CA"');
    });
  });

  describe("the sitemap", () => {
    it("lists the variants with alternates, on Production, and the English page with the same cluster", async () => {
      const keep = { VERCEL_ENV: process.env.VERCEL_ENV, COMING_SOON: process.env.COMING_SOON };
      process.env.VERCEL_ENV = "production";
      delete process.env.COMING_SOON;
      try {
        const entries = await sitemap();
        const leaf = entries.filter((e) => e.url.endsWith("/fx/leaf"));
        expect(leaf.map((e) => e.url).sort()).toEqual([`${ORIGIN}/fr-ca/fx/leaf`, `${ORIGIN}/fx/leaf`]);
        for (const e of leaf) {
          expect(e.alternates?.languages).toEqual({ en: `${ORIGIN}/fx/leaf`, "fr-CA": `${ORIGIN}/fr-ca/fx/leaf`, "x-default": `${ORIGIN}/fx/leaf` });
        }
        expect(entries.some((e) => e.url.includes("/fx/draft") && e.url.includes("/fr-ca"))).toBe(false);
        const child = entries.find((e) => e.url === `${ORIGIN}/fx/child`);
        expect(child?.alternates).toBeUndefined();
      } finally {
        for (const [k, v] of Object.entries(keep)) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
    });
  });

  describe("page content", () => {
    it("pageAtPath finds the registry page for a locale's URL", () => {
      expect(pageAtPath("/fr-ca/fx", "fr-CA")?.pageId).toBe("fx.parent");
      expect(pageAtPath("/fx", "fr-CA")).toBeUndefined();
    });
    it("contentFor never falls back to English at a non-English URL", () => {
      const byLocale = { en: "E" } as { en: string; "fr-CA"?: string };
      expect(contentFor(byLocale, "fr-CA")).toBeUndefined();
      expect(contentFor(byLocale, "fr-CA", { previewFallback: false })).toBeUndefined();
    });
  });
});
