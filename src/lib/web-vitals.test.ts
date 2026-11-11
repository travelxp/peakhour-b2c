import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildBeacon,
  connectionType,
  deviceClass,
  routePattern,
  sendBeacon,
  toSample,
} from "./web-vitals";

describe("routePattern", () => {
  it("leaves a static path alone", () => {
    expect(routePattern("/dashboard/overview", {})).toBe("/dashboard/overview");
    expect(routePattern("/", {})).toBe("/");
    expect(routePattern("/dashboard", null)).toBe("/dashboard");
  });

  it("replaces a dynamic segment with its param name", () => {
    expect(routePattern("/dashboard/content/6650f1c2a3b4c5d6e7f80912", { id: "6650f1c2a3b4c5d6e7f80912" })).toBe(
      "/dashboard/content/[id]",
    );
    expect(
      routePattern("/cms/skills/business/abc123", { businessId: "abc123" }),
    ).toBe("/cms/skills/business/[businessId]");
  });

  it("★never lets a share token through", () => {
    const token = "9f8a7c6d5e4b3a291807f6e5d4c3b2a1";
    expect(routePattern(`/share/${token}`, { token })).toBe("/share/[token]");
    expect(routePattern(`/share/${token}`, { token })).not.toContain(token);
  });

  it("★masks an opaque segment the router did not resolve as a param", () => {
    expect(routePattern("/share/9f8a7c6d5e4b3a291807f6e5d4c3b2a1", {})).toBe("/share/[id]");
    expect(routePattern("/dashboard/content/123456789", null)).toBe("/dashboard/content/[id]");
  });

  it("collapses a catch-all to one placeholder", () => {
    expect(routePattern("/help/billing/refunds", { slug: ["billing", "refunds"] })).toBe("/help/[...slug]");
    expect(routePattern("/a/b", { slug: ["a", "b"] })).toBe("/[...slug]");
  });

  it("matches URL-encoded values", () => {
    expect(routePattern("/p/a%20b", { name: "a b" })).toBe("/p/[name]");
    expect(routePattern("/p/a%20b", { name: "a%20b" })).toBe("/p/[name]");
  });

  it("handles two params in one path", () => {
    expect(routePattern("/x/111/y/222", { a: "111", b: "222" })).toBe("/x/[a]/y/[b]");
  });

  it("ignores an undefined param value", () => {
    expect(routePattern("/x/y", { a: undefined })).toBe("/x/y");
  });
});

describe("deviceClass", () => {
  it("splits at the md breakpoint", () => {
    expect(deviceClass(390)).toBe("mobile");
    expect(deviceClass(767)).toBe("mobile");
    expect(deviceClass(768)).toBe("desktop");
    expect(deviceClass(1440)).toBe("desktop");
  });
});

describe("connectionType", () => {
  it("passes a known effective type and drops anything else", () => {
    expect(connectionType({ connection: { effectiveType: "4g" } })).toBe("4g");
    expect(connectionType({ connection: { effectiveType: "slow-2g" } })).toBe("slow-2g");
    expect(connectionType({ connection: { effectiveType: "5g" } })).toBeUndefined();
    expect(connectionType({})).toBeUndefined();
    expect(connectionType(undefined)).toBeUndefined();
  });
});

describe("toSample", () => {
  it("keeps the five reported metrics with a valid rating", () => {
    expect(toSample({ name: "LCP", value: 1200, rating: "good" })).toEqual({ name: "LCP", value: 1200, rating: "good" });
    expect(toSample({ name: "CLS", value: 0.01 })).toEqual({ name: "CLS", value: 0.01 });
    expect(toSample({ name: "TTFB", value: 5, rating: "bogus" })).toEqual({ name: "TTFB", value: 5 });
  });

  it("drops FID, Next's own metrics and bad numbers", () => {
    expect(toSample({ name: "FID", value: 3 })).toBeNull();
    expect(toSample({ name: "Next.js-hydration", value: 3 })).toBeNull();
    expect(toSample({ name: "LCP", value: NaN })).toBeNull();
    expect(toSample({ name: "LCP", value: -1 })).toBeNull();
  });
});

describe("buildBeacon", () => {
  it("is null with nothing to send", () => {
    expect(buildBeacon("/dashboard", [], { viewportWidth: 1200 })).toBeNull();
  });

  it("carries only route, device, connection and metrics", () => {
    const b = buildBeacon("/dashboard", [{ name: "LCP", value: 1 }], { viewportWidth: 390, connection: "3g" });
    expect(b).toEqual({ route: "/dashboard", device: "mobile", connection: "3g", metrics: [{ name: "LCP", value: 1 }] });
    expect(buildBeacon("/", [{ name: "LCP", value: 1 }], { viewportWidth: 1200 })).not.toHaveProperty("connection");
  });

  it("keeps the latest value per metric", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ name: "CLS" as const, value: i }));
    expect(buildBeacon("/", many, { viewportWidth: 1200 })?.metrics).toEqual([{ name: "CLS", value: 99 }]);
  });
});

describe("sendBeacon", () => {
  afterEach(() => vi.unstubAllGlobals());
  const beacon = { route: "/dashboard", device: "desktop" as const, metrics: [{ name: "LCP" as const, value: 1 }] };

  it("posts a text/plain blob through navigator.sendBeacon", async () => {
    const sb = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon: sb });
    sendBeacon("https://api.test/v1/web-vitals", beacon);
    expect(sb).toHaveBeenCalledTimes(1);
    const [url, blob] = sb.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe("https://api.test/v1/web-vitals");
    expect(blob.type).toBe("text/plain");
    expect(JSON.parse(await blob.text())).toEqual(beacon);
  });

  it("falls back to a keepalive fetch when sendBeacon refuses", () => {
    vi.stubGlobal("navigator", { sendBeacon: () => false });
    const f = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", f);
    sendBeacon("https://api.test/v1/web-vitals", beacon);
    expect(f).toHaveBeenCalledTimes(1);
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.keepalive).toBe(true);
    expect(init.credentials).toBe("omit");
  });
});
