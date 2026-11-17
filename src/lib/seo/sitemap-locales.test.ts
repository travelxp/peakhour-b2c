import { describe, it, expect } from "vitest";
import { vi } from "vitest";

vi.mock("@/lib/marketing-pages", () => ({ getMarketingSitemapEntries: async () => [] }));

import { SITEMAP_NAMES, renderUrlset, sitemapEntries } from "./sitemap";

/** Bible T10/T19: with only English published, no sitemap lists a locale URL or carries an alternate (real registry, no fixture). */
describe("the sitemap, while only English is published", () => {
  it("lists no non-English URL and no hreflang alternate, and declares no xhtml namespace", async () => {
    let total = 0;
    for (const name of SITEMAP_NAMES) {
      const entries = await sitemapEntries(name, { VERCEL_ENV: "production" });
      total += entries.length;
      for (const e of entries) {
        expect(e.alternates, e.url).toBeUndefined();
        expect(new URL(e.url).pathname, e.url).not.toMatch(/^\/(fr|fr-ca|de|es|es-es|pt-br)(\/|$)/);
      }
      expect(renderUrlset(entries)).not.toContain("xhtml");
    }
    expect(total).toBeGreaterThan(10);
  });
});