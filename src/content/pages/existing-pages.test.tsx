import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HubPage } from "@/components/marketing/seo/templates";
import { CAPABILITIES } from "@/lib/seo/capabilities";
import { PAGES, getPage } from "@/lib/seo/pages";
import { isPublishable } from "@/lib/seo/publish";
import { pathFor } from "@/lib/seo/resolve";
import { capabilityStatus, claimsHoldOn } from "@/lib/seo/status";
import { COMMERCE } from "./commerce";
import { CONTENT } from "./content";
import { GROWTH } from "./growth";
import { PRESENCE } from "./presence";
import { SUPPORT } from "./support";
import { HOW_IT_WORKS } from "./how-it-works";
import { PEAKS } from "./peaks";
import { HOME_MODULES, homeContent } from "./home";
import type { BaseContent, HubContent } from "@/components/marketing/seo/content-types";

vi.mock("@/lib/marketing-pages", () => ({ getMarketingSitemapEntries: async () => [] }));

/*
 * SEO-7: the existing public pages. The registry holds each page's title, description and H1; src/content/pages holds
 * the words, built from approved claims. These tests pin the limits and the honesty rules for all of them.
 */

const HUBS: Record<string, HubContent> = { commerce: COMMERCE, content: CONTENT, growth: GROWTH, support: SUPPORT, presence: PRESENCE };
const PUBLIC_IDS = ["home", "pricing", "pricing.teams", "peaks", "how.it.works", "commerce", "content", "growth", "support", "presence", "shopify"];

describe("titles, descriptions and H1s", () => {
  it("keep every public page title <= 60 and description <= 160 characters", () => {
    for (const id of PUBLIC_IDS) {
      const p = getPage(id);
      expect(p.title.length, `${id} title`).toBeLessThanOrEqual(60);
      expect(p.description.length, `${id} description`).toBeLessThanOrEqual(160);
    }
  });

  it("gives every registered page a unique title, description and H1", () => {
    for (const key of ["title", "description", "h1"] as const) {
      const values = PAGES.map((p) => p[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it("states a query cluster for every public page and publishes each", () => {
    for (const id of PUBLIC_IDS) {
      const p = getPage(id);
      expect(p.queryClusterId, id).toBeTruthy();
      expect(isPublishable(p), id).toBe(true);
    }
  });

  it("never writes the old positioning", () => {
    for (const p of PAGES) expect(`${p.title} ${p.description}`).not.toMatch(/one brain|Five modules\. One platform/i);
  });
});

describe("the module hubs are built from approved claims", () => {
  for (const [id, content] of Object.entries(HUBS)) {
    describe(id, () => {
      const page = getPage(id);

      it("renders the H1 and the direct answer, with breadcrumbs up to Home", () => {
        const html = renderToStaticMarkup(<HubPage page={page} content={content} />);
        expect(html).toContain(page.h1);
        expect(html).toContain(content.directAnswer.slice(0, 40));
        expect(html).toContain('aria-label="Breadcrumb"');
        expect(content.crumbs[0]).toEqual({ label: "Home", href: "/" });
        expect(content.crumbs.at(-1)?.href).toBe(page.path);
      });

      it("shows no card as live or beta unless its capability record says so", () => {
        for (const item of content.items) {
          const text = item.body;
          // A card is either an approved claim verbatim, or a coming-soon sentence for a non-shipped record.
          if (item.status === "live" || item.status === "beta") {
            const claim = findClaimByText(text);
            expect(claim, `${id}: "${item.title}" is not an approved claim`).toBeTruthy();
            expect(claimsHoldOn(claim!.capability.id, item.surface), `${id}: ${item.title}`).toBe(true);
            expect(capabilityStatus(claim!.capability.id, item.surface)).toBe(item.status);
          } else {
            expect(["development", "planned", "idea", "paused", "retired"]).toContain(item.status);
            expect(text, item.title).toMatch(/not switched on|built/i);
          }
        }
      });

      it("links to 2 to 6 related registry pages, up to its parent, and to no price in money", () => {
        expect(content.related.length).toBeGreaterThanOrEqual(2);
        expect(content.related.length).toBeLessThanOrEqual(6);
        const paths = new Set(PAGES.map((p) => p.path));
        for (const l of [...content.related, ...content.crumbs]) expect(paths.has(l.href), `${id} -> ${l.href}`).toBe(true);
        expect(JSON.stringify(content)).not.toMatch(/[₹£$]\s?\d|council|strategist|critic|chair/i);
      });

      it("lists in the record only capabilities that carry a claim and are satisfied", () => {
        expect(isPublishable(page)).toBe(true);
      });
    });
  }

  it("no hub card group has 5, 7 or 11 cards, which would leave one orphaned in a grid row", () => {
    for (const [id, content] of Object.entries(HUBS)) {
      const shipped = content.items.filter((i) => i.status === "live" || i.status === "beta").length;
      const soon = content.items.length - shipped;
      expect([5, 7, 11], `${id} shipped`).not.toContain(shipped);
      expect([5, 7, 11], `${id} soon`).not.toContain(soon);
    }
  });

  it("each hub links its publishable feature and integration pages from the registry, with no link listed twice", () => {
    for (const [id, content] of Object.entries(HUBS)) {
      const page = getPage(id);
      const html = renderToStaticMarkup(<HubPage page={page} content={content} />);
      const hrefs = [...html.matchAll(/<a [^>]*href="([^"#]+)"/g)].map((m) => m[1]);
      for (const rid of page.relatedIds) {
        const rel = PAGES.find((p) => p.pageId === rid);
        if (rel && (rel.family === "feature" || rel.family === "integration") && isPublishable(rel)) {
          expect(hrefs, `${id} -> ${rid}`).toContain(rel.path);
        }
      }
      const body = hrefs.filter((h) => h.startsWith("/") && h !== "/" && !["/pricing", "/peaks", "/how-it-works", "/shopify", "/commerce", "/content", "/growth", "/support", "/presence", "/launch-partner", "/auth"].includes(h));
      expect(new Set(body).size, `${id} lists a link twice`).toBe(body.length);
    }
  });

  it("support makes no live claim on the switched-off channels (plan Q3)", () => {
    const live = SUPPORT.items.filter((i) => i.status === "live" || i.status === "beta").map((i) => i.title);
    expect(live).toEqual(["Conversation insights"]);
    const text = JSON.stringify(SUPPORT).toLowerCase();
    expect(text).not.toContain("one inbox for every channel");
    expect(SUPPORT.directAnswer).toMatch(/switching on soon/);
  });

  it("growth shows Google Ads and LinkedIn Ads as coming soon, and no lead inbox", () => {
    const soon = GROWTH.items.filter((i) => i.status !== "live" && i.status !== "beta").map((i) => i.title);
    expect(soon).toEqual(["Google Ads", "LinkedIn Ads"]);
    expect(JSON.stringify(GROWTH)).not.toMatch(/lead inbox|leads captured/i);
    expect(GROWTH.items.find((i) => i.title === "Peakhour Summit")?.status).toBe("beta");
  });

  it("commerce says WooCommerce is coming soon, not live", () => {
    const woo = COMMERCE.platforms.find((p) => p.surface === "woocommerce");
    expect(woo?.status).toBe("development");
    expect(COMMERCE.directAnswer).toMatch(/WooCommerce is coming soon/);
  });

  it("presence says Google Business Profile is in beta with sending held behind a switch", () => {
    expect(PRESENCE.directAnswer).toMatch(/beta/);
    expect(PRESENCE.directAnswer).toMatch(/only once Peakhour switches sending on/);
    expect(PRESENCE.items.map((i) => i.title)).toEqual(
      expect.arrayContaining(["Edits, photos and posts", "Review replies", "Listing health score"]),
    );
  });
});

function findClaimByText(text: string) {
  for (const cap of CAPABILITIES) {
    const claim = cap.approvedClaims.find((c) => c.text === text);
    if (claim) return { claim, capability: cap };
  }
  return undefined;
}

describe("the other existing pages", () => {
  const all: Record<string, BaseContent> = { "how.it.works": HOW_IT_WORKS, peaks: PEAKS, home: homeContent("x") };
  for (const [id, content] of Object.entries(all)) {
    it(`${id}: answers first, links resolve, and says no old positioning or currency price`, () => {
      expect(content.directAnswer.length).toBeGreaterThan(40);
      const paths = new Set(PAGES.map((p) => p.path));
      for (const l of [...content.related, ...content.crumbs]) expect(paths.has(l.href), `${id} -> ${l.href}`).toBe(true);
      expect(JSON.stringify(content)).not.toMatch(/one brain|council|strategist|critic|chair/i);
      expect(JSON.stringify(content)).not.toMatch(/[₹£]\s?\d/);
      if (id !== "home") expect(content.crumbs.at(-1)?.href).toBe(pathFor(id));
    });
  }

  it("the home module cards take their status from the capability records", () => {
    const byTitle = Object.fromEntries(HOME_MODULES.map((m) => [m.title, m.status]));
    expect(byTitle.Support).not.toBe("live");
    expect(byTitle.Presence).toBe("beta");
  });
});
