import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { resolveLocaleRoute } from "./locale-route";
import { LOCALES, PUBLISHED_LOCALES } from "./types";
import { LOCALE_HEADER, PATH_HEADER } from "@/i18n/config";

/*
 * Bible T19: with only English published, every non-English URL is a real 404, and every English URL is
 * served exactly as before. These run against the REAL registry, with no fixture.
 */

const ENV_KEYS = ["VERCEL_ENV", "SITE_INDEXABLE", "COMING_SOON", "COMING_SOON_PREVIEW_SECRET"] as const;
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

const NON_ENGLISH = LOCALES.filter((l) => l !== "en");

describe("only English is published", () => {
  it("is the starting point of these tests", () => {
    expect([...PUBLISHED_LOCALES]).toEqual(["en"]);
  });

  it("every prefixed URL is a not-found verdict, home and nested pages alike", () => {
    for (const l of NON_ENGLISH) {
      const p = `/${l.toLowerCase()}`;
      for (const path of [p, `${p}/shopify`, `${p}/pricing`, `${p}/how-it-works`, `${p}/dashboard`, `${p}/anything/at/all`]) {
        expect(resolveLocaleRoute(path), path).toEqual({ kind: "not-found", locale: l });
      }
    }
  });

  it("an English URL is not a locale route at all", () => {
    for (const path of ["/", "/shopify", "/pricing", "/how-it-works", "/dashboard", "/auth", "/fr-nonsense", "/frog", "/deutsch", "/pt"]) {
      expect(resolveLocaleRoute(path), path).toBeNull();
    }
  });

  it("only the lowercase prefix is a locale prefix (/fr-CA is not /fr-ca)", () => {
    expect(resolveLocaleRoute("/fr-CA/shopify")).toBeNull();
    expect(resolveLocaleRoute("/FR/shopify")).toBeNull();
    expect(resolveLocaleRoute("/fr-ca/shopify")).not.toBeNull();
  });
});

describe("the middleware", () => {
  const req = (path: string, headers: Record<string, string> = {}) => new NextRequest(`https://dev.peakhour.ai${path}`, { headers });
  const rewritten = (res: Response) => res.headers.get("x-middleware-rewrite");
  const sent = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`);

  it("answers /fr-ca/shopify, /de/pricing and /pt-br with the public 404 (a rewrite to /gate-404)", () => {
    for (const path of ["/fr-ca/shopify", "/de/pricing", "/pt-br", "/es-es/contact", "/fr/anything"]) {
      const res = middleware(req(path));
      expect(new URL(rewritten(res)!).pathname, path).toBe("/gate-404");
    }
  });

  it("leaves every English URL unrewritten and unprefixed", () => {
    for (const path of ["/", "/shopify", "/pricing", "/pricing/teams", "/how-it-works", "/dashboard", "/auth", "/fr-nonsense"]) {
      const res = middleware(req(path));
      expect(rewritten(res), path).toBeNull();
      expect(res.headers.get("x-middleware-next")).toBe("1");
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("never redirects by browser language or cookie", () => {
    const res = middleware(req("/shopify", { "accept-language": "fr-CA,fr;q=0.9", cookie: "NEXT_LOCALE=fr-ca; locale=fr" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(rewritten(res)).toBeNull();
    expect(sent(res, LOCALE_HEADER)).toBeNull();
  });

  it("keeps the CSP nonce on a full-document request, rewritten or not", () => {
    for (const path of ["/shopify", "/fr-ca/shopify"]) {
      const res = middleware(req(path));
      expect(res.headers.get("content-security-policy"), path).toContain("default-src 'self'");
      expect(sent(res, "x-nonce"), path).toBeTruthy();
    }
  });

  it("gives a prefetch or RSC request no nonce and no CSP, rewritten or not", () => {
    for (const path of ["/shopify", "/fr-ca/shopify"]) {
      const res = middleware(req(path, { rsc: "1" }));
      expect(res.headers.get("content-security-policy"), path).toBeNull();
      expect(sent(res, "x-nonce"), path).toBeNull();
    }
  });

  it("strips a caller's x-ph-locale and x-ph-path and sets its own path", () => {
    for (const extra of [{}, { rsc: "1" }]) {
      const res = middleware(req("/pricing", { [LOCALE_HEADER]: "fr-CA", [PATH_HEADER]: "/fr-ca/x", ...extra }));
      expect(sent(res, LOCALE_HEADER)).toBeNull();
      expect(sent(res, PATH_HEADER)).toBe("/pricing");
    }
  });

  it("still sends noindex off Production on a locale 404, and none on Production", () => {
    expect(middleware(req("/fr-ca/shopify")).headers.get("x-robots-tag")).toBe("noindex, nofollow");
    process.env.VERCEL_ENV = "production";
    expect(middleware(req("/fr-ca/shopify")).headers.get("x-robots-tag")).toBeNull();
    expect(new URL(rewritten(middleware(req("/fr-ca/shopify")))!).pathname).toBe("/gate-404");
  });

  it("with the coming-soon gate on, the gate answers first (a locale path is the gate's own 404)", () => {
    process.env.COMING_SOON = "true";
    process.env.VERCEL_ENV = "production";
    for (const path of ["/fr-ca/shopify", "/de/pricing", "/pt-br"]) {
      expect(new URL(rewritten(middleware(req(path)))!).pathname, path).toBe("/gate-404");
    }
    // and the gate's other verdicts are untouched
    expect(new URL(rewritten(middleware(req("/commerce")))!).pathname).toBe("/coming-soon");
    expect(rewritten(middleware(req("/shopify")))).toBeNull();
  });

  it("a direct request to the internal route has no locale header, so the route 404s it", () => {
    const res = middleware(req("/ph-locale/fr-CA/shopify", { [LOCALE_HEADER]: "fr-CA" }));
    expect(rewritten(res)).toBeNull();
    expect(sent(res, LOCALE_HEADER)).toBeNull();
  });
});
