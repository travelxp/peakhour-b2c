import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "typescript";

vi.mock("@/lib/marketing-pages", () => ({
  getMarketingSitemapEntries: async () => [{ slug: "guides/x", updatedAt: "2026-11-01T00:00:00Z" }],
}));

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { nextConfig } from "../../../next.config";

const ENV_KEYS = ["VERCEL_ENV", "SITE_INDEXABLE", "COMING_SOON"] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("robots.txt", () => {
  it("is Disallow: / for every agent, with no sitemap line, off Production", () => {
    for (const env of [{}, { VERCEL_ENV: "preview" }, { VERCEL_ENV: "production", SITE_INDEXABLE: "false" }]) {
      Object.assign(process.env, env);
      const r = robots();
      expect(r.rules).toEqual({ userAgent: "*", disallow: "/" });
      expect(r.sitemap).toBeUndefined();
      expect(r.host).toBeUndefined();
      delete process.env.VERCEL_ENV;
      delete process.env.SITE_INDEXABLE;
    }
  });

  it("allows the public site and names the sitemap on Production", () => {
    process.env.VERCEL_ENV = "production";
    const r = robots();
    expect(r.rules).toMatchObject({ userAgent: "*", allow: "/" });
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe("sitemap", () => {
  it("is empty off Production", async () => {
    process.env.VERCEL_ENV = "preview";
    expect(await sitemap()).toEqual([]);
    delete process.env.VERCEL_ENV;
    expect(await sitemap()).toEqual([]);
  });

  it("lists the code routes and the CMS pages on Production with the gate off", async () => {
    process.env.VERCEL_ENV = "production";
    const urls = (await sitemap()).map((e) => new URL(e.url).pathname);
    expect(urls).toContain("/how-it-works");
    expect(urls).toContain("/commerce");
    expect(urls).toContain("/pricing/teams");
    expect(urls).toContain("/guides/x");
    expect(urls).toHaveLength(16);
  });

  it("lists only what the gate lets through while COMING_SOON=true", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.COMING_SOON = "true";
    const urls = (await sitemap()).map((e) => new URL(e.url).pathname).sort();
    expect(urls).toEqual(["/", "/cookie-policy", "/peaks", "/pricing", "/pricing/teams", "/privacy-policy", "/shopify", "/terms"]);
  });
});

describe("next.config headers(): noindex on every path off Production", () => {
  const noindex = async () =>
    ((await nextConfig.headers!()) as { source: string; headers: { key: string; value: string }[] }[]).filter((h) =>
      h.headers.some((x) => x.key === "X-Robots-Tag"),
    );
  it("sends X-Robots-Tag: noindex, nofollow on /:path* off Production", async () => {
    const rules = await noindex();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
    expect(rules[0].headers[0].value).toBe("noindex, nofollow");
  });
  it("sends none on Production", async () => {
    process.env.VERCEL_ENV = "production";
    expect(await noindex()).toEqual([]);
  });
});

describe("one trailing-slash policy: none, except the root", () => {
  it("next.config does not switch trailingSlash on, so /pricing/ is a 308 to /pricing", () => {
    // Next's default (trailingSlash false) answers /pricing/ with a 308 to /pricing.
    // scripts/seo/smoke.ts checks the live status; this keeps the setting from flipping.
    expect(nextConfig.trailingSlash ?? false).toBe(false);
    expect(nextConfig.skipTrailingSlashRedirect ?? false).toBe(false);
  });
});

describe("the catch-all route can load without jsdom", () => {
  it("page-blocks.tsx does not import isomorphic-dompurify at the top level", () => {
    // A static import loads jsdom for every request the [...slug] route sees, and jsdom
    // cannot load on the Vercel runtime (ERR_REQUIRE_ESM): unknown URLs answered 500.
    const file = resolve(__dirname, "..", "..", "components", "marketing", "page-blocks.tsx");
    const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const staticImports = sf.statements
      .filter(ts.isImportDeclaration)
      .map((d) => (d.moduleSpecifier as ts.StringLiteral).text);
    expect(staticImports).not.toContain("isomorphic-dompurify");
    expect(readFileSync(file, "utf8")).toContain('import("isomorphic-dompurify")');
  });

  it("neither does the route page or anything it imports directly from the marketing blocks", () => {
    const slug = readFileSync(join(resolve(__dirname, "..", "..", "app", "(site)", "[...slug]"), "page.tsx"), "utf8");
    expect(slug).not.toMatch(/from\s+["'](?:isomorphic-dompurify|jsdom|dompurify)["']/);
  });
});
