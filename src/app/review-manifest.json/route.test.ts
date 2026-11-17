import { afterEach, describe, expect, it, vi } from "vitest";
import { MARKETING_PATHS } from "@/lib/seo/gate";
import { SITEMAP_NAMES, sitemapEntries } from "@/lib/seo/sitemap";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("/review-manifest.json", () => {
  it("serves the manifest on a non-production deployment (dev and previews)", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBe(1);
    expect(body.pages.length).toBeGreaterThan(50);
    expect(res.headers.get("cache-control")).toBe("no-store");
    // The live approvals are laid over the committed file.
    expect(body.pages.find((p: { pageId: string }) => p.pageId === "legal.terms").approval.source).toBe("placeholder");
  });

  it("serves it on a local build too", () => {
    vi.stubEnv("VERCEL_ENV", "");
    expect(GET().status).toBe(200);
  });

  it("answers 404 on production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const res = GET();
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not found");
  });

  it("is never in the sitemap and is not a marketing path", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("COMING_SOON", "false");
    for (const name of SITEMAP_NAMES) {
      expect(JSON.stringify(await sitemapEntries(name))).not.toContain("review-manifest");
    }
    expect(MARKETING_PATHS.some((m) => m.path.includes("review-manifest"))).toBe(false);
  });
});
