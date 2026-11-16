import { describe, it, expect } from "vitest";
import { SITE } from "@/lib/utils";
import { articleLd } from "@/lib/seo/structured-data";
import { COMPETITOR_BRIEFS } from "@/content/seo/competitors";
import { buildComparisonContent } from "@/content/seo/competitors/build";
import { COD_GUIDE } from "@/content/pages/guide-whatsapp-cod-confirmation";

// "Written by" names the company. A team or product name ("Peakhour Growth") reads as the
// product that wrote the page, and articleLd files any name other than SITE.name as a Person.
describe("bylines", () => {
  const bylines = [
    ...COMPETITOR_BRIEFS.map((b) => [b.pageId, buildComparisonContent(b).author] as const),
    ["guide.cod", COD_GUIDE.author] as const,
  ];

  it.each(bylines)("%s is written by the company", (_id, author) => {
    expect(author).toBe(SITE.name);
    const ld = articleLd({ headline: "H", path: "/p", author });
    expect(ld.author).toEqual({ "@type": "Organization", name: SITE.name });
  });

  it("covers every comparison", () => {
    expect(bylines.length).toBe(COMPETITOR_BRIEFS.length + 1);
    expect(COMPETITOR_BRIEFS.length).toBeGreaterThanOrEqual(40);
  });
});
