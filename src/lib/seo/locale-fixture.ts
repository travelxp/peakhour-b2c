import type { PageRecord } from "./types";

/*
 * A fixture for the locale tests (SEO-4): the real registry plus three pages that carry a published fr-CA
 * variant, so the routing, hreflang, sitemap and switcher can be exercised while no real locale is published.
 * Test-only: nothing in the app imports it. A test uses it by mocking ./types (PUBLISHED_LOCALES) and ./pages.
 *
 *   /fx              parent, fr-CA published at /fr-ca/fx
 *   /fx/child        child of /fx, NO fr-CA variant (the switcher falls back to /fr-ca/fx)
 *   /fx/leaf         child of /fx, fr-CA published at /fr-ca/fx/leaf
 *   /fx/draft        fr-CA variant in "review": not published, so it 404s and is never listed
 */
const base = (over: Partial<PageRecord> & Pick<PageRecord, "pageId" | "path">): PageRecord => ({
  family: "core",
  scope: "global",
  capabilityIds: [],
  surface: "web",
  editorialStatus: "published",
  indexable: true,
  title: `${over.pageId} title`,
  description: `${over.pageId} description`,
  h1: `${over.pageId} h1`,
  primaryCta: { label: "Join", href: "/launch-partner", kind: "launch-partner" },
  owner: "growth",
  lastReviewedAt: "2026-11-15",
  relatedIds: [],
  ...over,
});

export const FIXTURE_PAGES: PageRecord[] = [
  base({ pageId: "fx.parent", path: "/fx", locales: { "fr-CA": { path: "/fr-ca/fx", status: "published", reviewer: "fixture" } } }),
  base({ pageId: "fx.child", path: "/fx/child", parentId: "fx.parent" }),
  base({
    pageId: "fx.leaf",
    path: "/fx/leaf",
    parentId: "fx.parent",
    locales: { "fr-CA": { path: "/fr-ca/fx/leaf", status: "published", reviewer: "fixture" } },
  }),
  // A page with no variant listed BEFORE the page whose translated slug is /fr-ca/boutique: it must not shadow it.
  base({ pageId: "fx.boutique.a", path: "/boutique" }),
  base({ pageId: "fx.boutique.b", path: "/shop-b", locales: { "fr-CA": { path: "/fr-ca/boutique", status: "published", reviewer: "fixture" } } }),
  base({ pageId: "fx.orphan", path: "/fx/orphan", parentId: "does.not.exist" }),
  base({ pageId: "fx.draft", path: "/fx/draft", locales: { "fr-CA": { path: "/fr-ca/fx/draft", status: "review" } } }),
];

/** The ./pages module's exports, with the fixture pages added (and "home" given a published fr-CA variant). */
export function withFixturePages(real: { PAGES: readonly PageRecord[] }) {
  const home = real.PAGES.find((p) => p.pageId === "home")!;
  const PAGES: PageRecord[] = [
    { ...home, locales: { "fr-CA": { path: "/fr-ca", status: "published", reviewer: "fixture" } } },
    ...real.PAGES.filter((p) => p.pageId !== "home"),
    ...FIXTURE_PAGES,
  ];
  const byId = new Map(PAGES.map((p) => [p.pageId, p]));
  return {
    PAGES,
    getPage: (id: string) => {
      const p = byId.get(id);
      if (!p) throw new Error(`Unknown pageId "${id}"`);
      return p;
    },
    findPageByPath: (path: string) => PAGES.find((p) => p.path === path),
  };
}
