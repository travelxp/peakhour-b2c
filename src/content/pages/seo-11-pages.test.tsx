import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { DirectoryPage, FeaturePage, GuidePage, IndustryPage } from "@/components/marketing/seo/templates";
import type { BaseContent, GuideContent } from "@/components/marketing/seo/content-types";
import { getCapability } from "@/lib/seo/capabilities";
import { getPage, PAGES } from "@/lib/seo/pages";
import { isPreviewable, isPublishable } from "@/lib/seo/publish";
import { MARKETING_PATHS } from "@/lib/seo/gate";
import { PEAKHOUR_SUMMIT } from "./feature-peakhour-summit";
import { ABOUT, ABOUT_COMPANIES } from "./about";
import { AboutView } from "./about-view";
import { FASHION_APPAREL } from "./industry-fashion-apparel";
import { COD_GUIDE } from "./guide-whatsapp-cod-confirmation";
import { GUIDES, INDUSTRIES } from "./directories";
import { SITE } from "@/lib/utils";

/*
 * SEO-11: Peakhour Summit, About, the fashion industry page, the COD guide and the two directories. Each renders its
 * H1 and direct answer, claims only approved capabilities on the right surface, links only to registry paths and
 * keeps the owner's words (no council/strategist/critic/chair, no TM or R sign, no currency beside a Peakhour price).
 */

const IDS = [
  "feature.peakhour.summit",
  "about",
  "industries",
  "industries.fashion.apparel",
  "guides",
  "shopify.guides.whatsapp.cod.confirmation",
] as const;

const BY_ID: Record<(typeof IDS)[number], { content: BaseContent; el: () => ReactElement }> = {
  "feature.peakhour.summit": { content: PEAKHOUR_SUMMIT, el: () => <FeaturePage page={getPage("feature.peakhour.summit")} content={PEAKHOUR_SUMMIT} /> },
  about: { content: ABOUT, el: () => <AboutView page={getPage("about")} /> },
  industries: { content: INDUSTRIES, el: () => <DirectoryPage page={getPage("industries")} content={INDUSTRIES} /> },
  "industries.fashion.apparel": { content: FASHION_APPAREL, el: () => <IndustryPage page={getPage("industries.fashion.apparel")} content={FASHION_APPAREL} /> },
  guides: { content: GUIDES, el: () => <DirectoryPage page={getPage("guides")} content={GUIDES} /> },
  "shopify.guides.whatsapp.cod.confirmation": { content: COD_GUIDE, el: () => <GuidePage page={getPage("shopify.guides.whatsapp.cod.confirmation")} content={COD_GUIDE} /> },
};

const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const flat = (html: string) => decode(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));

describe("registry records", () => {
  it("has a record for every SEO-11 page with a title of 60 or fewer and a description of 160 or fewer", () => {
    for (const id of IDS) {
      const p = getPage(id);
      expect(p.title.length, id).toBeLessThanOrEqual(60);
      expect(p.description.length, id).toBeLessThanOrEqual(160);
      expect(p.lastReviewedAt, id).toBe("2026-11-15");
    }
    expect(new Set(PAGES.map((p) => p.h1)).size).toBe(PAGES.length);
  });

  it("publishes only Peakhour Summit; everything else is a draft that production 404s", () => {
    for (const id of IDS) {
      const p = getPage(id);
      if (id === "feature.peakhour.summit") {
        expect(isPublishable(p)).toBe(true);
        expect(p.indexable).toBe(true);
      } else {
        expect(p.editorialStatus, id).toBe("review");
        expect(p.indexable, id).toBe(false);
        expect(isPublishable(p), id).toBe(false);
        expect(isPreviewable(p, {}), id).toBe(true);
        expect(isPreviewable(p, { VERCEL_ENV: "production" }), id).toBe(false);
      }
    }
  });

  it("names only approved claims, and the surface carries each one", () => {
    for (const id of IDS) {
      const p = getPage(id);
      for (const cid of p.capabilityIds) {
        const cap = getCapability(cid)!;
        expect(cap.approvedClaims.length, `${id} ${cid}`).toBeGreaterThan(0);
        expect(cap.implementations.some((i) => i.surface === p.surface || i.surface === "web"), `${id} ${cid}`).toBe(true);
      }
    }
    expect(getCapability("growth.peakhour_summit")!.implementations.find((i) => i.surface === "web")!.status).toBe("beta");
  });

  it("every page is a known marketing path", () => {
    const known = new Set(MARKETING_PATHS.map((m) => m.path));
    for (const id of IDS) expect(known.has(getPage(id).path), id).toBe(true);
  });
});

describe("rendered pages", () => {
  for (const id of IDS) {
    it(`${id} renders its H1 and its direct answer first, with a status chip where it has one`, () => {
      const html = renderToStaticMarkup(BY_ID[id].el());
      const text = flat(html);
      expect(html.match(/<h1[ >]/g)?.length, id).toBe(1);
      expect(text).toContain(getPage(id).h1);
      expect(text).toContain(BY_ID[id].content.directAnswer);
    });

    it(`${id} links only to registry paths, with plain anchors`, () => {
      const paths = new Set(PAGES.map((p) => p.path));
      const html = renderToStaticMarkup(BY_ID[id].el());
      for (const m of html.matchAll(/href="([^"]+)"/g)) {
        const href = m[1];
        if (/^(https?:|mailto:|#)/.test(href)) continue;
        const path = href.split("#")[0];
        const known = paths.has(path) || ["/shopify/features/whatsapp-cod-confirmation", "/launch-partner"].includes(path) || ["/commerce", "/content", "/growth", "/support", "/presence"].includes(path);
        expect(known, `${id} -> ${href}`).toBe(true);
      }
    });

    it(`${id} follows the owner's wording rules`, () => {
      const text = flat(renderToStaticMarkup(BY_ID[id].el())) + " " + JSON.stringify(BY_ID[id].content);
      expect(text).not.toMatch(/\b(council|strategist|critic|chair)s?\b/i);
      expect(text).not.toMatch(/[™®]/);
      expect(text).not.toMatch(/[₹£$]\s?\d/);
      expect(text).not.toMatch(/\b(trusted by|guarantee[sd]?)\b/i);
    });
  }
});

describe("Peakhour Summit", () => {
  it("names the four seats exactly, in order, and says the price is shown first", () => {
    const seats = PEAKHOUR_SUMMIT.steps.map((s) => s.title);
    expect(seats).toEqual(["The case for", "The case against", "Safety checks", "Final call"]);
    expect(PEAKHOUR_SUMMIT.status).toBe("beta");
    expect(PEAKHOUR_SUMMIT.pricingNote).toMatch(/Peaks/);
    expect(PEAKHOUR_SUMMIT.pricingNote).toMatch(/first/);
  });
  it("links to /growth and /how-it-works", () => {
    const hrefs = PEAKHOUR_SUMMIT.related.map((l) => l.href);
    expect(hrefs).toContain("/growth");
    expect(hrefs).toContain("/how-it-works");
  });
});

describe("About", () => {
  it("states only what SITE states about the companies", () => {
    expect(ABOUT_COMPANIES.map((c) => c.ref)).toEqual([SITE.company.ref, SITE.companyUk.ref]);
    expect(ABOUT_COMPANIES.map((c) => c.address)).toEqual([SITE.company.address, SITE.companyUk.address]);
  });
});

describe("COD guide", () => {
  const g: GuideContent = COD_GUIDE;
  it("has a reviewer placeholder, today's date and an external source for every Meta claim", () => {
    expect(g.reviewer).toBe("Pending review");
    expect(g.updatedAt).toBe("2026-11-15");
    expect(g.sources.some((s) => s.href.startsWith("https://developers.facebook.com/"))).toBe(true);
  });
  it("says write-back is off by default and that nothing cancels on silence", () => {
    const all = JSON.stringify(g.sections);
    expect(all).toMatch(/off by default/);
    expect(all).toMatch(/never cancels/);
  });
});
