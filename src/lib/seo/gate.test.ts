import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { PILLAR_ORDER } from "@/lib/pillars";
import {
  MARKETING_PATHS,
  isGateOn,
  PUBLIC_PATHS,
  gatedVerdict,
  isPublicPath,
  isListedThroughGate,
} from "./gate";

describe("the coming-soon gate's allowlist", () => {
  it("keeps every exemption it had when it lived in the middleware", () => {
    expect([...PUBLIC_PATHS]).toEqual([
      "/privacy-policy",
      "/terms",
      "/cookie-policy",
      "/data-deletion",
      "/launch-partner",
      "/auth",
      "/pricing",
      "/peaks",
      "/shopify",
      "/shopify/connect",
      "/claim",
      "/reconnect",
      "/growth/confirm",
      "/share",
    ]);
  });

  it("matches an entry exactly or as a prefix, never as a bare string prefix", () => {
    expect(isPublicPath("/pricing/teams")).toBe(true);
    expect(isPublicPath("/pricingx")).toBe(false);
    expect(isPublicPath("/growth")).toBe(false);
  });
});

describe("isGateOn", () => {
  it("is true only for COMING_SOON=true", () => {
    expect(isGateOn({ COMING_SOON: "true" })).toBe(true);
    for (const v of [undefined, "", "false", "1", "TRUE"]) expect(isGateOn({ COMING_SOON: v })).toBe(false);
  });
});

describe("gatedVerdict: what a gated path becomes", () => {
  it("serves the teaser as itself at /", () => {
    expect(gatedVerdict("/")).toBe("teaser");
  });

  it("serves the teaser with noindex for a known gated marketing page", () => {
    for (const p of ["/how-it-works", "/contact", ...PILLAR_ORDER.map((s) => `/${s}`)]) {
      expect(gatedVerdict(p), p).toBe("teaser-noindex");
    }
  });

  it("serves the teaser with noindex for the signed-in app, whose guards take over", () => {
    expect(gatedVerdict("/dashboard")).toBe("teaser-noindex");
    expect(gatedVerdict("/dashboard/settings/billing")).toBe("teaser-noindex");
    expect(gatedVerdict("/onboarding/about")).toBe("teaser-noindex");
  });

  it("returns 404, not the teaser, for a path that matches no route", () => {
    for (const p of ["/does-not-exist", "/features/foo", "/fr/shopify", "/a", "/presence/x", "/gate-404"]) {
      expect(gatedVerdict(p), p).toBe("not-found");
    }
  });
});

describe("the sitemap's view of the gate", () => {
  it("lists only paths the gate lets through, plus the teaser's own /", () => {
    const paths = MARKETING_PATHS.map((m) => m.path).filter(isListedThroughGate);
    expect(paths).toContain("/");
    expect(paths).toContain("/pricing");
    expect(paths).toContain("/shopify");
    expect(paths).toContain("/peaks");
    expect(paths).not.toContain("/how-it-works");
    expect(paths).not.toContain("/contact");
    for (const s of PILLAR_ORDER) expect(paths).not.toContain(`/${s}`);
    for (const p of paths) expect(p === "/" || isPublicPath(p), p).toBe(true);
  });

  it("every marketing path is unique and has a page.tsx under src/app", () => {
    const seen = new Set<string>();
    for (const { path } of MARKETING_PATHS) {
      expect(seen.has(path), path).toBe(false);
      seen.add(path);
      const dir = path === "/" ? "" : path;
      const file = resolve(__dirname, "..", "..", "app", "(site)", join(dir.slice(1), "page.tsx"));
      expect(() => readFileSync(file), path).not.toThrow();
    }
  });
});

describe("every real route is known to the gate", () => {
  it("no page.tsx under src/app/(site) (bar the gate's own 404 route and the catch-all) would answer 404 while the gate is on", () => {
    // "/ph-locale" is the internal route the locale middleware rewrites to (SEO-4); it is not a public page and
    // asked for directly it is a 404, which is what the gate says for it.
    // Add a marketing route and forget MARKETING_PATHS, and with the gate on it would 404 instead of the teaser.
    const root = resolve(__dirname, "..", "..", "app", "(site)");
    const routes: string[] = [];
    const walk = (dir: string, url: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) {
          if (f.startsWith("[")) {
            // A dynamic segment: the route is its static parent (a prefix), unless it is the catch-all.
            if (!f.startsWith("[...") && statSync(p).isDirectory()) routes.push(url || "/");
            continue;
          }
          walk(p, `${url}/${f.replace(/^\((.*)\)$/, "")}`.replace(/\/$/, ""));
        } else if (f === "page.tsx") {
          routes.push(url || "/");
        }
      }
    };
    walk(root, "");
    const unknown = [...new Set(routes)].filter((r) => r !== "/gate-404" && r !== "/ph-locale" && !isPublicPath(r) && gatedVerdict(r) === "not-found");
    expect(routes.length).toBeGreaterThan(20);
    expect(unknown).toEqual([]);
  }, 60_000);
});
