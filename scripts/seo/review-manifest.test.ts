import "../../src/lib/seo/review-authored-mode"; // first: the page copy must be read in authored mode
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAGE_APPROVALS } from "../../src/lib/seo/approvals";
import { COMPETITOR_BRIEFS } from "../../src/content/seo/competitors";
import { PAGES, getPage } from "../../src/lib/seo/pages";
import { canonicalJson, buildReviewManifest, contentHashOf, withoutApprovals, type ReviewManifest } from "../../src/lib/seo/review-manifest";
import { PAGE_COPY } from "../../src/lib/seo/review-copy";
import { HASHES_PATH, MANIFEST_PATH, render } from "./review-manifest";

const committed = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as ReviewManifest;

describe("the review manifest", () => {
  it("is what the registry produces now, approvals aside (run `npx tsx scripts/seo/review-manifest.ts --write`)", () => {
    expect(withoutApprovals(committed)).toEqual(withoutApprovals(buildReviewManifest()));
  });

  it("has the content-hashes file the publish gate reads in step with it (same --write)", () => {
    const committedHashes = JSON.parse(readFileSync(HASHES_PATH, "utf8")) as Record<string, string>;
    expect(committedHashes).toEqual(JSON.parse(render().hashes));
  });

  it("holds every published and review page, sorted by pageId, with the contract's keys", () => {
    const m = buildReviewManifest();
    expect(m.version).toBe(1);
    const want = PAGES.filter((p) => p.editorialStatus === "published" || p.editorialStatus === "review").map((p) => p.pageId).sort();
    expect(m.pages.map((p) => p.pageId)).toEqual(want);
    for (const p of m.pages) {
      expect(Object.keys(p).filter((k) => k !== "comparison").sort()).toEqual(
        ["approval", "claims", "contentHash", "devUrl", "editorialStatus", "family", "pageId", "path", "title"],
      );
      expect(p.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(p.devUrl).toBe(`https://dev.peakhour.ai${p.path}`);
    }
  });

  it("carries the placeholder approvals as of the write, and the comparison cells with their sources and dates", () => {
    const m = buildReviewManifest();
    expect(m.pages.filter((p) => p.approval).length).toBe(PAGE_APPROVALS.length);
    const wati = m.pages.find((p) => p.pageId === "shopify.compare.wati");
    expect(wati?.approval).toBeNull();
    expect(wati?.comparison?.vendor).toBe("Wati");
    const row = wati?.comparison?.rows[0];
    expect(row?.sourceUrl).toMatch(/^https:\/\/www\.wati\.io\//);
    expect(row?.observedAt).toBe("2026-11-16");
    expect(wati?.comparison?.pricing[0]).toMatchObject({ plan: expect.any(String), price: expect.any(String), currency: expect.any(String) });
    expect(m.pages.filter((p) => p.comparison).length).toBe(PAGES.filter((p) => p.family === "compare" || p.family === "shopify-compare").length);
  });
});

describe("the content hash", () => {
  const page = getPage("shopify.compare.wati");

  it("is the same for the same page and never includes the approval or the editorialStatus", () => {
    const h = contentHashOf(page);
    expect(contentHashOf({ ...page })).toBe(h);
    expect(contentHashOf({ ...page, editorialStatus: "published" })).toBe(h);
    expect(contentHashOf({ ...page, indexable: true, lastReviewedAt: "2030-01-01", owner: "someone" })).toBe(h);
  });

  it("moves with the title, the description, the H1, the call to action and the claims", () => {
    const h = contentHashOf(page);
    expect(contentHashOf({ ...page, title: `${page.title}!` })).not.toBe(h);
    expect(contentHashOf({ ...page, description: `${page.description}!` })).not.toBe(h);
    expect(contentHashOf({ ...page, h1: `${page.h1}!` })).not.toBe(h);
    expect(contentHashOf({ ...page, primaryCta: { ...page.primaryCta, label: "Other" } })).not.toBe(h);
    expect(contentHashOf({ ...page, capabilityIds: page.capabilityIds.slice(1) })).not.toBe(h);
  });

  it("gives every page its own hash", () => {
    expect(new Set(PAGES.map((p) => contentHashOf(p))).size).toBe(PAGES.length);
  });

  it("is built over a canonical JSON: key order and undefined do not matter, a function is refused", () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [2, { z: 1, y: 2 }] } })).toBe('{"a":{"c":[2,{"y":2,"z":1}]},"b":1}');
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
    expect(() => canonicalJson({ f: () => 1 })).toThrow(/not data/);
    expect(() => canonicalJson({ d: new Date() })).toThrow(/plain object/);
  });
});

describe("which pages the hash reads copy for", () => {
  // These pages keep their copy in a component, or list only the pages that can open (so the list depends on the
  // deployment): their hash covers the registry record and their claims, not a word of the body. A page added to this
  // list is a page whose copy edits an approval cannot see; add a data source in review-copy.ts instead where there is one.
  const COPY_GAPS = [
    "compare",
    "contact",
    "features.index",
    "integrations.index",
    "launch.partner",
    "legal.cookies",
    "legal.data.deletion",
    "legal.privacy",
    "legal.terms",
    "pricing",
    "pricing.teams",
    "shopify",
    "shopify.compare",
    "shopify.features",
    "trust.data.processing",
  ];

  it("is every page except the comparisons (the brief) and the pages named here", () => {
    const briefs = new Set(COMPETITOR_BRIEFS.map((b) => b.pageId));
    const missing = PAGES.filter((p) => !PAGE_COPY[p.pageId] && !briefs.has(p.pageId)).map((p) => p.pageId).sort();
    expect(missing).toEqual(COPY_GAPS);
  });

  it("holds no copy for a page that is not in the registry", () => {
    const ids = new Set(PAGES.map((p) => p.pageId));
    for (const id of Object.keys(PAGE_COPY)) expect(ids.has(id), id).toBe(true);
  });
});
