import { describe, it, expect } from "vitest";
import { resolveActiveStore, withStore, type CommerceStore } from "./commerce-store";

const store = (merchantId: string, primary = false): CommerceStore => ({
  merchantId,
  platform: "shopify",
  name: merchantId,
  shopDomain: `${merchantId}.myshopify.com`,
  currency: "INR",
  primary,
});

describe("resolveActiveStore", () => {
  it("one store: nothing is sent, so a single-store business is unchanged", () => {
    expect(resolveActiveStore([store("a", true)], null)).toMatchObject({ merchantId: undefined, store: { merchantId: "a" } });
  });

  it("two stores: the primary by default, named", () => {
    expect(resolveActiveStore([store("a", true), store("b")], null).merchantId).toBe("a");
  });

  it("two stores: the saved pick when it is still connected", () => {
    expect(resolveActiveStore([store("a", true), store("b")], "b").merchantId).toBe("b");
  });

  it("a saved pick that is gone falls back to the primary, not to nothing", () => {
    expect(resolveActiveStore([store("a"), store("c", true)], "b").merchantId).toBe("c");
  });

  it("no stores: nothing", () => {
    expect(resolveActiveStore([], "b")).toEqual({ store: null, merchantId: undefined });
  });
});

describe("withStore", () => {
  it("adds the parameter after a path's own query, or starts one", () => {
    expect(withStore("/v1/commerce/summary", "m1")).toBe("/v1/commerce/summary?merchantId=m1");
    expect(withStore("/v1/commerce/catalog?page=2&limit=25", "m1")).toBe("/v1/commerce/catalog?page=2&limit=25&merchantId=m1");
  });

  it("leaves the path alone with no store", () => {
    expect(withStore("/v1/commerce/summary", undefined)).toBe("/v1/commerce/summary");
  });
});
