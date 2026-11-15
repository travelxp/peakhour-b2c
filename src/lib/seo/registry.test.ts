import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { PAGES, getPage } from "./pages";
import { CAPABILITIES, getCapability } from "./capabilities";
import { MARKETING_PATHS } from "./gate";
import { isPublishable, isPreviewable } from "./publish";
import { pathFor } from "./resolve";
import { pageMeta, absoluteUrl } from "./metadata";
import { DEFAULT_LOCALE, LOCALES, PUBLISHED_LOCALES, type Capability, type PageRecord } from "./types";
import { SITE } from "@/lib/utils";

const base = PAGES[0];
const asPage = (over: Partial<PageRecord>): PageRecord => ({ ...base, capabilityIds: [], ...over });

describe("T01: ids, paths and locale paths are unique", () => {
  it("has unique page ids and unique English paths with no trailing slash", () => {
    expect(new Set(PAGES.map((p) => p.pageId)).size).toBe(PAGES.length);
    expect(new Set(PAGES.map((p) => p.path)).size).toBe(PAGES.length);
    for (const p of PAGES) {
      expect(p.path.startsWith("/"), p.pageId).toBe(true);
      if (p.path !== "/") expect(p.path.endsWith("/"), p.pageId).toBe(false);
    }
  });

  it("builds a unique path for every page in every locale: English unprefixed, others lowercase-prefixed", () => {
    const all: string[] = [];
    for (const p of PAGES) {
      for (const l of LOCALES) {
        const path = pathFor(p.pageId, l);
        all.push(path);
        if (l === DEFAULT_LOCALE) expect(path).toBe(p.path);
        else expect(path === `/${l.toLowerCase()}` || path.startsWith(`/${l.toLowerCase()}/`)).toBe(true);
      }
    }
    expect(new Set(all).size).toBe(all.length);
  });

  it("pathFor defaults to English, prefixes /fr-ca, and throws on an unknown id", () => {
    expect(pathFor("shopify")).toBe("/shopify");
    expect(pathFor("shopify", "fr-CA")).toBe("/fr-ca/shopify");
    expect(pathFor("home", "pt-BR")).toBe("/pt-br");
    expect(() => pathFor("no.such.page")).toThrow(/Unknown pageId/);
    expect(() => getPage("no.such.page")).toThrow();
  });

  it("has unique capability ids, and every capability a page names exists", () => {
    expect(new Set(CAPABILITIES.map((c) => c.id)).size).toBe(CAPABILITIES.length);
    for (const p of PAGES) for (const id of p.capabilityIds) expect(getCapability(id), `${p.pageId} -> ${id}`).toBeDefined();
  });
});

describe("T02: a non-published or non-indexable page is never publishable and never in the sitemap", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.doUnmock("./pages");
    vi.doUnmock("@/lib/marketing-pages");
    vi.resetModules();
  });

  it("is publishable only when published and indexable", () => {
    expect(isPublishable(asPage({}))).toBe(true);
    for (const s of ["idea", "briefed", "draft", "review", "approved", "archived"] as const) {
      expect(isPublishable(asPage({ editorialStatus: s })), s).toBe(false);
    }
    expect(isPublishable(asPage({ indexable: false }))).toBe(false);
  });

  it("needs a published locale, and a non-English variant must itself be published", () => {
    expect(PUBLISHED_LOCALES).toEqual(["en"]);
    const withVariant = asPage({ locales: { "fr-CA": { path: "/fr-ca/x", status: "published" } } });
    expect(isPublishable(withVariant, "fr-CA")).toBe(false);
    expect(isPublishable(withVariant, "en")).toBe(true);
  });

  it("a page names only capabilities that carry a claim (the gate checks claims, so an unclaimed one would pass vacuously)", () => {
    for (const p of PAGES) for (const id of p.capabilityIds) expect(getCapability(id)!.approvedClaims.length, `${p.pageId} -> ${id}`).toBeGreaterThan(0);
  });

  it("every registered page is publishable today (existing pages stay as they are)", () => {
    for (const p of PAGES) expect(isPublishable(p), p.pageId).toBe(true);
  });

  it("previews drafts, reviews and approved pages only off Production", () => {
    const draft = asPage({ editorialStatus: "draft" });
    expect(isPreviewable(draft, {})).toBe(true);
    expect(isPreviewable(asPage({ editorialStatus: "review" }), { VERCEL_ENV: "preview" })).toBe(true);
    expect(isPreviewable(draft, { VERCEL_ENV: "production" })).toBe(false);
    expect(isPreviewable(draft, { VERCEL_ENV: "production", SITE_INDEXABLE: "false" })).toBe(true);
    expect(isPreviewable(asPage({ editorialStatus: "published" }), {})).toBe(false);
    expect(isPreviewable(asPage({ editorialStatus: "idea" }), {})).toBe(false);
  });

  it("the sitemap omits a page that is not published or not indexable", async () => {
    vi.resetModules();
    vi.doMock("@/lib/marketing-pages", () => ({ getMarketingSitemapEntries: async () => [] }));
    vi.doMock("./pages", async (orig) => {
      const real = await orig<typeof import("./pages")>();
      return {
        ...real,
        PAGES: real.PAGES.map((p) =>
          p.pageId === "peaks" ? { ...p, editorialStatus: "draft" as const } : p.pageId === "contact" ? { ...p, indexable: false } : p,
        ),
      };
    });
    process.env.VERCEL_ENV = "production";
    delete process.env.COMING_SOON;
    delete process.env.SITE_INDEXABLE;
    const sitemap = (await import("@/app/sitemap")).default;
    const urls = (await sitemap()).map((e) => new URL(e.url).pathname);
    expect(urls).not.toContain("/peaks");
    expect(urls).not.toContain("/contact");
    expect(urls).toContain("/pricing");
  });

  it("the sitemap lastmod is the page's lastReviewedAt", async () => {
    vi.resetModules();
    vi.doMock("@/lib/marketing-pages", () => ({ getMarketingSitemapEntries: async () => [] }));
    process.env.VERCEL_ENV = "production";
    delete process.env.COMING_SOON;
    delete process.env.SITE_INDEXABLE;
    const sitemap = (await import("@/app/sitemap")).default;
    const entry = (await sitemap()).find((e) => new URL(e.url).pathname === "/pricing");
    expect(entry?.lastModified).toEqual(new Date(getPage("pricing").lastReviewedAt));
  });
});

describe("T03: every canonical uses SITE.url's origin and is self-referencing", () => {
  it("is absolute, on one origin, and equals the page's own URL", () => {
    const origin = new URL(SITE.url).origin;
    for (const p of PAGES) {
      const meta = pageMeta(p.pageId);
      const canonical = String(meta.alternates?.canonical);
      expect(new URL(canonical).origin, p.pageId).toBe(origin);
      expect(canonical, p.pageId).toBe(`${SITE.url.replace(/\/$/, "")}${p.path}`);
      expect(String((meta.openGraph as { url?: string }).url), p.pageId).toBe(canonical);
    }
  });

  it("emits hreflang only for published variants, plus x-default at English", () => {
    const langs = pageMeta("pricing").alternates?.languages as Record<string, string>;
    expect(Object.keys(langs).sort()).toEqual(["en", "x-default"]);
    expect(langs["x-default"]).toBe(absoluteUrl("pricing"));
  });

  it("keeps siteName, and the title and description of the page record", () => {
    const meta = pageMeta("peaks");
    expect(meta.title).toBe(getPage("peaks").title);
    expect(meta.description).toBe(getPage("peaks").description);
    expect(meta.openGraph).toMatchObject({ siteName: SITE.name, locale: "en" });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.robots).toBeUndefined(); // publishable: no page-level robots; dev stays noindex by header
  });
});

describe("T12: a claim that requires live fails the gate when the capability is not live on the page's surface", () => {
  const cap = (status: "live" | "beta" | "development", requires: "beta" | "live", surface: "web" | "shopify" = "web"): Capability => ({
    id: "fixture.cap",
    label: "Fixture",
    primaryPillar: "commerce",
    implementations: [{ surface, status, evidence: ["fixture"], verifiedAt: "2026-11-15" }],
    approvedClaims: [{ id: "c", text: "t", requires, approvedBy: "owner", approvedAt: "2026-11-15" }],
  });

  afterEach(() => {
    vi.doUnmock("./capabilities");
    vi.resetModules();
  });

  async function gateWith(capability: Capability, page: Partial<PageRecord>) {
    vi.resetModules();
    vi.doMock("./capabilities", () => ({ getCapability: (id: string) => (id === capability.id ? capability : undefined) }));
    const mod = await import("./publish");
    return mod.isPublishable(asPage({ capabilityIds: [capability.id], ...page }));
  }

  it("a live claim on a beta or in-development capability is not publishable", async () => {
    expect(await gateWith(cap("beta", "live"), {})).toBe(false);
    expect(await gateWith(cap("development", "live"), {})).toBe(false);
  });
  it("a live claim on a live capability, and a beta claim on a beta one, are publishable", async () => {
    expect(await gateWith(cap("live", "live"), {})).toBe(true);
    expect(await gateWith(cap("beta", "beta"), {})).toBe(true);
  });
  it("a live Shopify build says nothing about the web surface", async () => {
    expect(await gateWith(cap("live", "live", "shopify"), { surface: "web" })).toBe(false);
    expect(await gateWith(cap("live", "live", "shopify"), { surface: "shopify" })).toBe(true);
  });
  it("a page falls back to the capability's web implementation", async () => {
    expect(await gateWith(cap("live", "live", "web"), { surface: "shopify" })).toBe(true);
  });
  it("an unknown capability id is not publishable", () => {
    expect(isPublishable(asPage({ capabilityIds: ["no.such.capability"] }))).toBe(false);
  });
  it("the seeded registry has no live claim on a non-live implementation", () => {
    for (const c of CAPABILITIES) {
      for (const claim of c.approvedClaims) {
        if (claim.requires !== "live") continue;
        for (const i of c.implementations) expect(i.status, `${c.id} ${claim.id}`).toBe("live");
      }
    }
  });
});

describe("every public marketing route has a registry record", () => {
  it("covers SEO-1's list (MARKETING_PATHS, minus the teaser)", () => {
    const registered = new Set(PAGES.map((p) => p.path));
    for (const m of MARKETING_PATHS) {
      if (m.path === "/coming-soon") continue;
      expect(registered.has(m.path), m.path).toBe(true);
    }
  });

  it("every page.tsx under (site) that calls pageMeta names a real id at that page's path, and every record has a route", () => {
    const root = resolve(__dirname, "..", "..", "app", "(site)");
    const found: string[] = [];
    const walk = (dir: string, url: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p, `${url}/${f}`);
        else if (f === "page.tsx") {
          const m = /pageMeta\("([^"]+)"\)/.exec(readFileSync(p, "utf8"));
          if (m) {
            found.push(m[1]);
            expect(getPage(m[1]).path, p).toBe(url || "/");
          }
        }
      }
    };
    walk(root, "");
    expect(found.sort()).toEqual(PAGES.map((p) => p.pageId).sort());
  });
});
