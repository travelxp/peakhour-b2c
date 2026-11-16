import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SITE } from "@/lib/utils";
import { ComparisonPage, GuidePage, bylineAuthor } from "@/components/marketing/seo/templates";
import * as fx from "@/app/(site)/seo-kit/fixtures";
import { COMPETITOR_BRIEFS } from "@/content/seo/competitors";
import { buildComparisonContent } from "@/content/seo/competitors/build";

// "Written by" names a person, or else the company. A team or product name ("Peakhour Growth")
// read as the product that wrote the page, and articleLd filed it as a Person.

const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("bylines", () => {
  it("with no named author, the comparison and guide pages say they are written by the company", () => {
    const cmp = plain(renderToStaticMarkup(createElement(ComparisonPage, { page: fx.COMPARISON_PAGE, content: fx.COMPARISON })));
    expect(cmp).toContain(`Written by ${SITE.name}`);
    const guide = renderToStaticMarkup(createElement(GuidePage, { page: fx.GUIDE_PAGE, content: fx.GUIDE }));
    expect(plain(guide)).toContain(`Written by ${SITE.name}`);
    const ld = [...guide.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const article = ld.flatMap((n) => (Array.isArray(n["@graph"]) ? n["@graph"] : [n])).find((n) => n["@type"] === "Article");
    expect(article?.author).toEqual({ "@type": "Organization", name: SITE.name });
  });

  it("a named author is kept as given", () => {
    expect(bylineAuthor({ author: "  Asha Rao " })).toBe("Asha Rao");
    expect(bylineAuthor({ author: " " })).toBe(SITE.name);
    expect(bylineAuthor({})).toBe(SITE.name);
  });

  it("the comparison builder names no author, so every comparison gets the company", () => {
    expect(buildComparisonContent(COMPETITOR_BRIEFS[0]).author).toBeUndefined();
  });

  it("no content file sets a Peakhour team or product name as an author", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
          for (const m of readFileSync(p, "utf8").matchAll(/\bauthor\s*:\s*["'`]([^"'`]*)["'`]/g)) {
            if (/peakhour/i.test(m[1])) offenders.push(`${p}: ${m[1]}`);
          }
        }
      }
    };
    ["src/content", "src/app/(site)/seo-kit"].forEach(walk);
    expect(offenders).toEqual([]);
  });
});
