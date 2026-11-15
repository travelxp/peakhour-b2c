import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import {
  ComparisonPage,
  DirectoryPage,
  FeaturePage,
  GuidePage,
  IndustryPage,
  IntegrationPage,
  PlatformPage,
  ShopifyFeaturePage,
  SolutionPage,
} from "@/components/marketing/seo/templates";
import { ShopifyPageView } from "@/components/marketing/shopify/shopify-page-view";
import * as fx from "@/app/(site)/seo-kit/fixtures";
import { SITE } from "@/lib/utils";
import { SHOPIFY_SEO } from "@/lib/shopify-features";
import { PAGES } from "./pages";
import { isListedThroughGate } from "./gate";
import { isPublishable } from "./publish";
import { pathFor } from "./resolve";
import { organizationLd, webSiteLd, breadcrumbListLd, faqPageLd, articleLd, softwareApplicationLd, SOCIAL_PROFILES } from "./structured-data";
import { sitemapEntries, sitemapNameFor, SITEMAP_NAMES } from "./sitemap";

/*
 * T14 (Bible 9.3): structured data states only what the page shows. Each test renders a real template or the
 * /shopify page and reads the JSON-LD out of the HTML it produced, so the markup is judged against the same output a
 * crawler gets.
 */

type Node = Record<string, unknown>;

const decode = (s: string) =>
  s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));

function blocks(html: string): Node[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]) as Node);
}
function h1Of(html: string): string {
  return text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1]).trim();
}
/** The labels the visible breadcrumb nav draws, in order. */
function renderedCrumbs(html: string): string[] {
  const nav = /<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/.exec(html)![0];
  return [...nav.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]).replace(/›/g, "").trim()).filter(Boolean);
}

const TEMPLATES: [string, ReactElement][] = [
  ["feature", <FeaturePage key="a" page={fx.FEATURE_PAGE} content={fx.FEATURE} />],
  ["shopify-feature", <ShopifyFeaturePage key="b" page={fx.SHOPIFY_FEATURE_PAGE} content={fx.SHOPIFY_FEATURE} />],
  ["solution", <SolutionPage key="c" page={fx.SOLUTION_PAGE} content={fx.SOLUTION} />],
  ["industry", <IndustryPage key="d" page={fx.INDUSTRY_PAGE} content={fx.INDUSTRY} />],
  ["platform", <PlatformPage key="e" page={fx.PLATFORM_PAGE} content={fx.PLATFORM} />],
  ["integration", <IntegrationPage key="f" page={fx.INTEGRATION_PAGE} content={fx.INTEGRATION} />],
  ["comparison", <ComparisonPage key="g" page={fx.COMPARISON_PAGE} content={fx.COMPARISON} />],
  ["guide", <GuidePage key="h" page={fx.GUIDE_PAGE} content={fx.GUIDE} />],
  ["directory", <DirectoryPage key="i" page={fx.DIRECTORY_PAGE} content={fx.DIRECTORY} />],
];

const shopifyHtml = renderToStaticMarkup(
  <ShopifyPageView pricing={null} comingSoon={false} signup={{ label: "Start", href: "/auth" }} />,
);

const rendered: [string, string][] = [
  ...TEMPLATES.map(([n, el]) => [n, renderToStaticMarkup(el)] as [string, string]),
  ["/shopify", shopifyHtml],
];

describe("T14: every JSON-LD block parses and says what the page says", () => {
  for (const [name, html] of rendered) {
    it(`${name}: blocks parse, carry @context and @type, and none claims a rating or review`, () => {
      const found = blocks(html);
      expect(found.length).toBeGreaterThan(0);
      for (const b of found) {
        expect(b["@context"]).toBe("https://schema.org");
        expect(typeof b["@type"]).toBe("string");
      }
      expect(JSON.stringify(found)).not.toMatch(/aggregateRating|"review"|"reviewRating"|ratingValue/i);
    });

    it(`${name}: the BreadcrumbList is the trail the page draws, in order`, () => {
      const list = blocks(html).find((b) => b["@type"] === "BreadcrumbList") as Node;
      expect(list).toBeTruthy();
      const items = list.itemListElement as { position: number; name: string; item: string }[];
      expect(items.map((i) => i.name)).toEqual(renderedCrumbs(html));
      expect(items.map((i) => i.position)).toEqual(items.map((_, i) => i + 1));
      for (const i of items) expect(i.item.startsWith(SITE.url.replace(/\/$/, ""))).toBe(true);
    });
  }

  it("a FAQPage is emitted with its questions and answers visible in the HTML, at most once per page", () => {
    for (const [name, html] of rendered) {
      const faqs = blocks(html).filter((b) => b["@type"] === "FAQPage");
      expect(faqs.length, name).toBeLessThanOrEqual(1);
      const visible = text(html);
      for (const faq of faqs) {
        const qs = faq.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
        expect(qs.length, name).toBeGreaterThan(0);
        for (const q of qs) {
          expect(visible, `${name}: ${q.name}`).toContain(q.name);
          expect(visible, `${name}: answer to ${q.name}`).toContain(q.acceptedAnswer.text);
        }
      }
    }
    expect(blocks(shopifyHtml).filter((b) => b["@type"] === "FAQPage")).toHaveLength(1);
  });

  it("the guide's Article headline is its visible H1; author and date are the ones shown", () => {
    const html = rendered.find(([n]) => n === "guide")![1];
    const art = blocks(html).find((b) => b["@type"] === "Article") as Node;
    expect(art.headline).toBe(h1Of(html));
    expect((art.author as Node).name).toBe(fx.GUIDE.author);
    expect(art.dateModified).toBe(fx.GUIDE.updatedAt);
    expect(text(html)).toContain(fx.GUIDE.author);
    // Only the guide template emits an Article.
    for (const [n, h] of rendered) if (n !== "guide") expect(blocks(h).some((b) => b["@type"] === "Article"), n).toBe(false);
  });

  it("/shopify: the SoftwareApplication is named in the page's title and visible text", () => {
    const app = blocks(shopifyHtml).find((b) => b["@type"] === "SoftwareApplication") as Node;
    expect(app.applicationCategory).toBe("BusinessApplication");
    expect(app.operatingSystem).toBe("Web");
    expect(SHOPIFY_SEO.title.startsWith(String(app.name))).toBe(true);
    expect(text(shopifyHtml)).toContain(String(app.name));
  });
});

describe("the builders", () => {
  it("Organization: the site name, the origin, and a logo that is a real public file", () => {
    const org = organizationLd();
    expect(org["@type"]).toBe("Organization");
    expect(org.name).toBe(SITE.name);
    expect(org.url).toBe(`${SITE.url.replace(/\/$/, "")}/`);
    const logo = String(org.logo);
    expect(logo.startsWith(SITE.url.replace(/\/$/, ""))).toBe(true);
    expect(existsSync(join(resolve(__dirname, "..", "..", ".."), "public", new URL(logo).pathname))).toBe(true);
    expect(JSON.stringify(org)).not.toMatch(/aggregateRating|review/i);
  });

  it("Organization sameAs lists only profiles the site links, and is absent when there are none", () => {
    expect(SOCIAL_PROFILES).toEqual([]);
    expect("sameAs" in organizationLd()).toBe(false);
  });

  it("WebSite names the site and has no SearchAction", () => {
    const w = webSiteLd();
    expect(w["@type"]).toBe("WebSite");
    expect(w.name).toBe(SITE.name);
    expect(JSON.stringify(w)).not.toContain("SearchAction");
  });

  it("the home page is wired to both blocks", () => {
    // The home page is an async server component over live catalog data; this proves it is wired, not rendered.
    const src = readFileSync(resolve(__dirname, "..", "..", "app", "(site)", "page.tsx"), "utf8");
    expect(src).toContain("organizationLd()");
    expect(src).toContain("webSiteLd()");
  });

  it("BreadcrumbList, FAQPage, Article and SoftwareApplication carry only what they are given", () => {
    const b = breadcrumbListLd([
      { label: "Home", href: "/" },
      { label: "Pricing", href: "/pricing" },
    ]);
    expect(JSON.stringify(b)).toContain('"position":2');
    expect(faqPageLd([{ q: "Q?", a: "A." }]).mainEntity).toEqual([
      { "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "A." } },
    ]);
    const a = articleLd({ headline: "H", path: "/g" });
    expect("author" in a).toBe(false);
    expect("dateModified" in a).toBe(false);
    const s = softwareApplicationLd({ name: "N", url: "u", description: "d" });
    expect("offers" in s).toBe(false);
    expect("installUrl" in s).toBe(false);
  });
});

describe("T08: the sitemap lists only publishable, canonical, unique, ungated URLs", () => {
  const env = { VERCEL_ENV: "production" } as const;

  it("every URL is a publishable registry page at its canonical path, and none repeats", async () => {
    const urls: string[] = [];
    for (const n of SITEMAP_NAMES.filter((x) => x !== "cms")) {
      for (const e of await sitemapEntries(n, env)) urls.push(e.url);
    }
    expect(new Set(urls).size).toBe(urls.length);
    const origin = SITE.url.replace(/\/$/, "");
    const expected = PAGES.filter((p) => isPublishable(p)).map((p) => `${origin}${pathFor(p.pageId)}`.replace(/^(https?:\/\/[^/]+)$/, "$1/"));
    expect([...urls].sort()).toEqual(expected.sort());
  });

  it("with the gate on, every listed URL is one the gate lets through", async () => {
    for (const n of SITEMAP_NAMES) {
      for (const e of await sitemapEntries(n, { ...env, COMING_SOON: "true" })) {
        expect(isListedThroughGate(new URL(e.url).pathname), e.url).toBe(true);
      }
    }
  });

  it("each page is in exactly one named sitemap", () => {
    for (const p of PAGES) expect(SITEMAP_NAMES).toContain(sitemapNameFor(p));
    expect(sitemapNameFor(PAGES.find((p) => p.pageId === "shopify")!)).toBe("shopify");
    expect(sitemapNameFor(PAGES.find((p) => p.pageId === "home")!)).toBe("core");
  });
});
