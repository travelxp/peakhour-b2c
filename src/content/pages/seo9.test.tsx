import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DirectoryPage, FeaturePage, IntegrationPage } from "@/components/marketing/seo/templates";
import { getCapability } from "@/lib/seo/capabilities";
import { PAGES, findPageByPath, getPage } from "@/lib/seo/pages";
import { SEO9_PAGES } from "@/lib/seo/pages-seo9";
import { capabilitiesSatisfied, isPublishable } from "@/lib/seo/publish";
import { pathFor } from "@/lib/seo/resolve";
import { MARKETING_PATHS } from "@/lib/seo/gate";
import { directoryItems, type BaseContent } from "@/components/marketing/seo/content-types";
import { featuresDirectory, integrationsDirectory } from "./seo9-directories";
import { FEATURE_CONTENT } from "./features";
import { INTEGRATION_CONTENT } from "./integrations";

const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));

const DIRECTORIES = ["integrations.index", "features.index"];
const CONTENT = { ...INTEGRATION_CONTENT, ...FEATURE_CONTENT };
const contentIds = SEO9_PAGES.map((p) => p.pageId).filter((id) => !DIRECTORIES.includes(id));

function contentOf(pageId: string): BaseContent {
  if (pageId === "integrations.index") return integrationsDirectory();
  if (pageId === "features.index") return featuresDirectory();
  return CONTENT[pageId].content;
}

function viewOf(pageId: string) {
  const page = getPage(pageId);
  let el;
  if (pageId === "integrations.index") el = <DirectoryPage page={page} content={integrationsDirectory()} />;
  else if (pageId === "features.index") el = <DirectoryPage page={page} content={featuresDirectory()} />;
  else if (INTEGRATION_CONTENT[pageId]) el = <IntegrationPage page={page} content={INTEGRATION_CONTENT[pageId].content} />;
  else el = <FeaturePage page={page} content={FEATURE_CONTENT[pageId].content} />;
  const html = renderToStaticMarkup(el);
  const links = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => decode(m[1]));
  const strings = JSON.stringify(contentOf(pageId)).match(/"[^"]{3,}"/g) ?? [];
  return { html, links, strings };
}

describe("SEO-9 records", () => {
  it("has a content object for every page, and none for a stranger", () => {
    expect(Object.keys(CONTENT).sort()).toEqual([...contentIds].sort());
  });

  it("keeps titles within 60 characters and descriptions within 160, with every H1 and title unique across the registry", () => {
    for (const p of SEO9_PAGES) {
      expect(p.title.length, `${p.pageId} title`).toBeLessThanOrEqual(60);
      expect(p.description.length, `${p.pageId} description`).toBeLessThanOrEqual(160);
      expect(p.queryClusterId, p.pageId).toBeTruthy();
    }
    expect(new Set(PAGES.map((p) => p.h1)).size).toBe(PAGES.length);
    expect(new Set(PAGES.map((p) => p.title)).size).toBe(PAGES.length);
  });

  it("is published and indexable only with an approved, satisfied claim; the rest are review and not indexable", () => {
    for (const p of SEO9_PAGES) {
      const published = p.editorialStatus === "published";
      expect(p.indexable, p.pageId).toBe(published);
      expect(isPublishable(p), p.pageId).toBe(published);
      if (published && !DIRECTORIES.includes(p.pageId)) expect(p.capabilityIds.length, p.pageId).toBeGreaterThan(0);
    }
    const review = SEO9_PAGES.filter((p) => p.editorialStatus === "review").map((p) => p.pageId).sort();
    expect(review).toEqual([
      "features.ai.blog.writer",
      "features.newsletter.writer",
      "integrations.google.ads",
      "integrations.google.search.console",
      "integrations.linkedin.ads",
    ]);
  });

  it("has a gate entry for every page, at the registry path", () => {
    const gate = new Set(MARKETING_PATHS.map((m) => m.path));
    for (const p of SEO9_PAGES) {
      expect(gate.has(p.path), p.path).toBe(true);
      expect(findPageByPath(p.path)?.pageId).toBe(p.pageId);
    }
  });
});

describe("SEO-9 claims resolve to approved claims on the page's surface", () => {
  it("every claim a page leans on exists, belongs to a capability in its record, and is satisfied", () => {
    for (const id of contentIds) {
      const page = getPage(id);
      const claimIds = CONTENT[id].claimIds;
      if (page.editorialStatus === "review") expect(claimIds, id).toEqual([]);
      else expect(claimIds.length, id).toBeGreaterThan(0);
      for (const claimId of claimIds) {
        const cap = page.capabilityIds.map((c) => getCapability(c)!).find((c) => c.approvedClaims.some((a) => a.id === claimId));
        expect(cap, `${id} -> ${claimId}`).toBeDefined();
      }
      if (page.editorialStatus === "published") {
        // Every capability a published page lists is backed by a claim the page uses, and satisfied on the surface.
        for (const capId of page.capabilityIds) {
          expect(claimIds.some((c) => c.startsWith(`${capId}.`)), `${id} lists ${capId} with no claim`).toBe(true);
        }
        expect(capabilitiesSatisfied(page)).toBe(true);
      }
    }
  });

  it("shows the Beta chip on the two Google Business Profile pages", () => {
    expect(viewOf("integrations.google.business.profile").html).toContain("Beta");
    expect(viewOf("features.google.business.profile.management").html).toContain("Beta");
  });

  it("carries at least one stated limit on every content page", () => {
    for (const id of contentIds) {
      const c = CONTENT[id].content as unknown as { limitations: string[] };
      expect(c.limitations.length, id).toBeGreaterThan(0);
    }
  });
});

describe("SEO-9 pages render their H1, the direct answer and working links", () => {
  for (const p of SEO9_PAGES) {
    it(p.pageId, () => {
      const { html, links } = viewOf(p.pageId);
      const t = text(html);
      const answer = decode(contentOf(p.pageId).directAnswer);
      expect(t).toContain(decode(p.h1));
      expect(t).toContain(answer);
      // The direct answer is the first paragraph after the H1.
      expect(t.indexOf(answer)).toBeGreaterThan(t.indexOf(decode(p.h1)));
      for (const href of links) {
        if (href.startsWith("#") || href.startsWith("http")) continue;
        const target = findPageByPath(href.split("#")[0]);
        expect(target, `${p.pageId} links to ${href}`).toBeDefined();
        // A published page never links to a page that would 404 on production.
        if (p.editorialStatus === "published" && target) expect(isPublishable(target), `${p.pageId} -> ${href}`).toBe(true);
      }
      const rel = contentOf(p.pageId).related;
      expect(rel.length).toBeGreaterThanOrEqual(2);
      expect(rel.length).toBeLessThanOrEqual(6);
      for (const r of p.relatedIds) expect(() => pathFor(r), `${p.pageId} relatedIds`).not.toThrow();
      expect(links).toContain(pathFor(p.parentId!));
    });
  }
});

describe("SEO-9 owner rules on the copy", () => {
  it("never writes a currency amount, a council word, a trademark mark or an invented number", () => {
    for (const id of [...contentIds, ...DIRECTORIES]) {
      const all = viewOf(id).strings.join(" ");
      expect(all, id).not.toMatch(/[₹£$€]/);
      expect(all, id).not.toMatch(/\b(council|strategist|critic|chair)\b/i);
      expect(all, id).not.toMatch(/[™®]/);
      expect(all, id).not.toMatch(/\b(trusted by|customers love)\b|\d+\s?%/i);
    }
  });

  it("lists only publishable pages in the directories, grouped with Presence first", () => {
    const ints = directoryItems(integrationsDirectory());
    expect(ints.map((i) => i.title)).not.toContain("Google Ads");
    expect(ints.map((i) => i.title)).not.toContain("LinkedIn Ads");
    expect(ints[0].pillar).toBe("Presence");
    expect(directoryItems(featuresDirectory()).map((i) => i.title)).not.toContain("AI blog writer");
    expect(ints.length).toBe(9);
    expect(directoryItems(featuresDirectory()).length).toBe(5);
  });

  it("is reachable from the hubs through registry data", () => {
    expect(getPage("presence").relatedIds).toContain("features.review.management");
    expect(getPage("content").relatedIds).toContain("features.social.media.content");
    expect(getPage("growth").relatedIds).toContain("integrations.meta.ads");
    expect(getPage("home").relatedIds).toContain("integrations.index");
  });
});
