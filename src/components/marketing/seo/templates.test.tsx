import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { COMMERCE } from "@/content/pages/commerce";
import { GROWTH } from "@/content/pages/growth";
import { PRESENCE } from "@/content/pages/presence";
import { SUPPORT } from "@/content/pages/support";
import { CONTENT } from "@/content/pages/content";
import { INTEGRATION_CONTENT } from "@/content/pages/integrations";
import { featuresDirectory, integrationsDirectory } from "@/content/pages/seo9-directories";
import { getPage } from "@/lib/seo/pages";
import type { HubContent } from "./content-types";
import { statusMeta } from "./status-meta";
import { DirectoryPage, HubPage, IntegrationPage, hubLimits, isReviewed } from "./templates";

vi.mock("@/lib/marketing-pages", () => ({ getMarketingSitemapEntries: async () => [] }));

/*
 * DL-3: the faults the 2026-11-16 site audit found in the registry template, each fixed once at the source. Each test
 * here is one fault, so it cannot come back on any of the pages that share the template.
 */

const HUBS: Record<string, HubContent> = { commerce: COMMERCE, content: CONTENT, growth: GROWTH, support: SUPPORT, presence: PRESENCE };
const hubHtml = (id: string) => renderToStaticMarkup(<HubPage page={getPage(id)} content={HUBS[id]} />);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("a module hub", () => {
  for (const id of Object.keys(HUBS)) {
    it(`${id}: carries no "Limit:" footnote on a card, and prints each limit once in one block`, () => {
      const html = hubHtml(id);
      expect(text(html)).not.toMatch(/Limit: /);
      const limits = hubLimits(HUBS[id]);
      const block = html.match(/<section id="limits"[\s\S]*?<\/section>/)?.[0] ?? "";
      if (limits.length === 0) expect(block).toBe("");
      else {
        expect(block).toContain("What it does not do");
        for (const l of limits) expect(text(html.split('<section id="deeper"')[0].split('<section id="faq"')[0]).split(l.text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;")).length - 1, l.text).toBe(1);
      }
    });

    it(`${id}: shows each status chip once, on its card, and never again in the hero`, () => {
      const html = hubHtml(id);
      const hero = html.match(/<section class="bg-\[linear-gradient[\s\S]*?<\/section>/)?.[0] ?? "";
      expect(hero).not.toMatch(/Coming soon|>Live<|>Beta</);
      expect(hero).toContain("<aside");
    });

    it(`${id}: shows no audit language or filler`, () => {
      const t = text(hubHtml(id));
      expect(t).not.toMatch(/Checked against the product|Short answers, and what|Keep going|Built, and not switched on|Each platform has its own status/);
    });
  }

  it("never prints an SEO title (a pipe, a site suffix) on a link card", () => {
    for (const id of Object.keys(HUBS)) expect(text(hubHtml(id)), id).not.toMatch(/\|\s*Peakhour|Peakhour\.ai\b.{0,3}$/);
  });
});

describe("a capability status", () => {
  it("is said plainly, and the check date is metadata, not body text", () => {
    expect(statusMeta("live").description).toBe("Live.");
    expect(statusMeta("beta").description).toBe("In beta.");
    expect(statusMeta("development").description).toBe("Coming soon.");
    const id = "integrations.whatsapp";
    const html = renderToStaticMarkup(<IntegrationPage page={getPage(id)} content={INTEGRATION_CONTENT[id].content} />);
    expect(text(html)).not.toMatch(/Checked against the product/);
    expect(html).toMatch(/data-verified-at="\d{4}-\d{2}-\d{2}"/);
    expect(text(html)).toContain("Limits");
    expect(text(html)).not.toContain("What it does not do");
  });
});

describe("the directories", () => {
  it("carry no status-count card, and no SEO title on a card", () => {
    for (const [id, content] of [["integrations.index", integrationsDirectory()], ["features.index", featuresDirectory()]] as const) {
      const html = renderToStaticMarkup(<DirectoryPage page={getPage(id)} content={content} />);
      expect(text(html), id).not.toMatch(/On this page|Paused or retired/);
      expect(text(html), id).not.toMatch(/\|\s*Peakhour/);
    }
  });

  it("the features hub points to the Commerce, Growth and Shopify features it does not list", () => {
    const hrefs = featuresDirectory().related.map((l) => l.href);
    expect(hrefs).toEqual(expect.arrayContaining(["/commerce", "/growth", "/shopify/features"]));
  });
});

describe("a reviewer placeholder", () => {
  it("is process, not proof: only a named reviewer is shown", () => {
    expect(isReviewed("Pending review")).toBe(false);
    expect(isReviewed("Asha Rao")).toBe(true);
  });
});
