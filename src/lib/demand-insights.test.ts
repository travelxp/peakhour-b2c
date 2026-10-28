import { describe, it, expect } from "vitest";
import {
  ADMIN_PATH,
  adminUrl,
  askedLine,
  isInsights,
  safeHref,
  stateOfError,
  surfaceLine,
  trendLine,
} from "./demand-insights";

describe("adminUrl - built from the store handle and a path of the api's shape, never from data", () => {
  it("PASS: the three paths the api builds become admin.shopify.com links", () => {
    expect(adminUrl("table-story.myshopify.com", "/products")).toBe("https://admin.shopify.com/store/table-story/products");
    expect(adminUrl("table-story.myshopify.com", "/products/new")).toBe("https://admin.shopify.com/store/table-story/products/new");
    expect(adminUrl("table-story.myshopify.com", "/products/9398320070892")).toBe("https://admin.shopify.com/store/table-story/products/9398320070892");
  });

  it("★a path that is not one of those draws no link", () => {
    for (const bad of [
      "https://evil.example/x",
      "javascript:alert(1)",
      "//evil.example",
      "/products/1/../../settings",
      "/products/abc",
      "/orders/1",
      "/products/1?x=1",
      "/products/1#x",
      " /products",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(adminUrl("table-story.myshopify.com", bad)).toBeNull();
    }
  });

  it("★a store that is not a plain <handle>.myshopify.com draws no link", () => {
    for (const bad of ["evil.example", "a.myshopify.com.evil.example", "https://a.myshopify.com", "a.myshopify.com/x", "a@evil.example/.myshopify.com", "A.myshopify.com", "", null, undefined]) {
      expect(adminUrl(bad, "/products")).toBeNull();
    }
  });

  it("ADMIN_PATH matches exactly the api's shapes", () => {
    for (const ok of ["/products", "/products/new", "/products/12"]) expect(ADMIN_PATH.test(ok)).toBe(true);
    for (const bad of ["/product", "/products/", "/products/new/", "/products/new1", "/Products"]) expect(ADMIN_PATH.test(bad)).toBe(false);
  });

  it("safeHref allows only http(s)", () => {
    expect(safeHref("https://admin.shopify.com/x")).toBe("https://admin.shopify.com/x");
    expect(safeHref("http://x.example")).toBe("http://x.example");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://x", "", null, undefined]) expect(safeHref(bad)).toBeNull();
  });
});

describe("the small decisions", () => {
  it("asked: once vs n times", () => {
    expect(askedLine(1)).toBe("Asked once");
    expect(askedLine(14)).toBe("Asked 14 times");
  });

  it("trend: more unmet asks warns, fewer is good news, flat says nothing", () => {
    expect(trendLine({ trend: "up", trendPct: 40 })).toEqual({ tone: "warning", text: "Up 40% on the month before" });
    expect(trendLine({ trend: "down", trendPct: -25 })).toEqual({ tone: "success", text: "Down 25% on the month before" });
    expect(trendLine({ trend: "new", trendPct: null })).toEqual({ tone: "info", text: "New this month" });
    expect(trendLine({ trend: "flat", trendPct: 3 })).toBeNull();
    // an "up" with no percentage never reads "Up null%"
    expect(trendLine({ trend: "up", trendPct: null })).toBeNull();
  });

  it("surfaces: named ones are listed, an unknown one is left out rather than shown raw", () => {
    expect(surfaceLine(["woocommerce", "storefront"])).toBe("WooCommerce, Storefront chat");
    expect(surfaceLine(["other"])).toBe("");
  });

  it("a business with no store is its own state; any other failure is an error", () => {
    expect(stateOfError({ status: 404, code: "NO_STORE" })).toEqual({ kind: "no-store" });
    expect(stateOfError({ status: 404, code: "NOT_FOUND" })).toEqual({ kind: "error" });
    expect(stateOfError({ status: 500, code: "NO_STORE" })).toEqual({ kind: "error" });
    expect(stateOfError(new Error("boom"))).toEqual({ kind: "error" });
    expect(stateOfError(null)).toEqual({ kind: "error" });
  });

  it("isInsights accepts the api's shape and nothing else", () => {
    expect(isInsights({ windowDays: 30, totalAsks: 0, items: [] })).toBe(true);
    for (const bad of [null, undefined, {}, { items: [] }, { windowDays: 30, totalAsks: "3", items: [] }, { windowDays: 30, totalAsks: 1, items: {} }, "x"]) {
      expect(isInsights(bad)).toBe(false);
    }
  });
});
